"""Barangay officials who sign or witness documents.

Any signed-in user can read the list (the issuance form needs it). Adding and
editing needs OFFICIALS_MANAGE (System Administrator only). Officials are never
deleted: later issuance rows point at them, so a former official is marked
``is_current = false`` instead.
"""

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import col, select

from app.api.deps import CurrentUser, SessionDep, require_permission
from app.core.audit import record_audit_event
from app.core.permissions import Permission
from app.models import User
from app.models_foundation import Official
from app.models_lookups import OfficialCreate, OfficialPublic, OfficialUpdate

router = APIRouter(prefix="/officials", tags=["officials"])

ManageUser = Annotated[User, Depends(require_permission(Permission.OFFICIALS_MANAGE))]


def _get_or_404(session: SessionDep, official_id: uuid.UUID) -> Official:
    official = session.get(Official, official_id)
    if official is None:
        raise HTTPException(status_code=404, detail="Official not found")
    return official


@router.get("/", response_model=list[OfficialPublic])
def list_officials(
    session: SessionDep,
    _user: CurrentUser,
    status: Annotated[Literal["current", "former", "all"], Query()] = "current",
) -> list[Official]:
    stmt = select(Official)
    if status == "current":
        stmt = stmt.where(col(Official.is_current).is_(True))
    elif status == "former":
        stmt = stmt.where(col(Official.is_current).is_(False))
    stmt = stmt.order_by(
        col(Official.is_current).desc(),
        col(Official.position),
        col(Official.full_name),
    )
    return list(session.exec(stmt).all())


@router.get("/{official_id}", response_model=OfficialPublic)
def get_official(
    official_id: uuid.UUID, session: SessionDep, _user: CurrentUser
) -> Official:
    return _get_or_404(session, official_id)


@router.post("/", response_model=OfficialPublic, status_code=201)
def create_official(
    body: OfficialCreate, session: SessionDep, user: ManageUser
) -> Official:
    official = Official.model_validate(body)
    session.add(official)
    session.flush()
    record_audit_event(
        session,
        action="official.create",
        actor=user,
        module="officials",
        record_type="official",
        record_id=official.id,
        details={"fields": sorted(body.model_dump())},
    )
    session.commit()
    session.refresh(official)
    return official


@router.patch("/{official_id}", response_model=OfficialPublic)
def update_official(
    official_id: uuid.UUID,
    body: OfficialUpdate,
    session: SessionDep,
    user: ManageUser,
) -> Official:
    official = _get_or_404(session, official_id)
    changes = body.model_dump(exclude_unset=True)
    for required in ("full_name", "position", "term_start", "is_elected", "is_current"):
        if required in changes and changes[required] is None:
            raise HTTPException(status_code=422, detail=f"{required} cannot be null")
    term_start = changes.get("term_start", official.term_start)
    term_end = changes.get("term_end", official.term_end)
    if term_end is not None and term_end < term_start:
        raise HTTPException(
            status_code=422, detail="term_end must not be before term_start"
        )
    changed = sorted(
        name for name, value in changes.items() if getattr(official, name) != value
    )
    if not changed:
        return official
    official.sqlmodel_update(changes)
    session.add(official)
    record_audit_event(
        session,
        action="official.update",
        actor=user,
        module="officials",
        record_type="official",
        record_id=official.id,
        details={"fields": changed},
    )
    session.commit()
    session.refresh(official)
    return official
