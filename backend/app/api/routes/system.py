"""Program updates and installation status for the notification bell (System Administrator only).

``GET /system/update`` says whether a new approved version is waiting and whether
the computer's update service can install it; ``POST /system/update/request``
asks that service to install it now (the nightly run does it anyway; this is for
an administrator who does not want to wait). The program cannot update itself: the
files and the audit row below are the whole of what happens here (see
``app/core/update_state.py`` and ``scripts/update-watcher.ps1``).
"""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.deps import SessionDep, require_permission
from app.core import field_crypto, update_state
from app.core.audit import record_audit_event
from app.core.permissions import Permission
from app.models import User

router = APIRouter(prefix="/system", tags=["system"])

UpdateUser = Annotated[User, Depends(require_permission(Permission.SYSTEM_UPDATE))]
StatusUser = Annotated[User, Depends(require_permission(Permission.SYSTEM_STATUS))]


class UpdateStatusPublic(BaseModel):
    # False on a computer that has no update service: show nothing then.
    watcher_running: bool
    # unknown | up_to_date | available | updating | failed
    state: str
    installed: str
    target: str
    checked_at: datetime | None
    # An administrator pressed Update and the service has not started it yet.
    requested: bool
    message: str


def _public(status: update_state.UpdateStatus) -> UpdateStatusPublic:
    return UpdateStatusPublic(
        watcher_running=status.watcher_running,
        state=status.state,
        installed=status.installed,
        target=status.target,
        checked_at=status.checked_at,
        requested=status.requested,
        message=status.message,
    )


@router.get("/update", response_model=UpdateStatusPublic)
def read_update_status(_user: UpdateUser) -> UpdateStatusPublic:
    return _public(update_state.read_status())


@router.post("/update/request", response_model=UpdateStatusPublic)
def request_update(session: SessionDep, user: UpdateUser) -> UpdateStatusPublic:
    try:
        status = update_state.request_update()
    except update_state.UpdateNotPossible as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit_event(
        session,
        action="system.update_requested",
        actor=user,
        module="system",
        record_type="system",
        details={"target": status.target, "installed": status.installed},
        commit=True,
    )
    return _public(status)


class DataProtectionPublic(BaseModel):
    # Is DATA_ENCRYPTION_KEY set in .env?
    key_configured: bool
    # Health conditions saved as plain text (nothing was there to encrypt them).
    plain_count: int
    # Encrypted health conditions the key in .env cannot open (key lost or changed).
    unreadable_count: int


@router.get("/data-protection", response_model=DataProtectionPublic)
def read_data_protection(
    session: SessionDep, _user: StatusUser
) -> DataProtectionPublic:
    """Patch 214: lets the bell warn an administrator when the data key is missing or wrong.

    Only counts are returned, never a value. Not audited (a status read, like ``/system/update``).
    """
    status = field_crypto.protection_status(session)
    return DataProtectionPublic(
        key_configured=status.key_configured,
        plain_count=status.plain_count,
        unreadable_count=status.unreadable_count,
    )
