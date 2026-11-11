"""Database backup history and manual backups (System Administrator only).

``POST /backups`` makes a backup now; ``GET /backups`` lists the history;
``POST /backups/{id}/verify`` re-reads a stored file; ``GET /backups/{id}/download``
streams it. Restoring is not an API action: ``POST /backups/{id}/restore-request``
only checks the file, writes the audit event and returns the PowerShell command
to run on the server computer (see app/core/backup.py for why).
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlmodel import col, func, select

from app.api.deps import SessionDep, require_permission
from app.core import backup as backup_service
from app.core.audit import record_audit_event
from app.core.config import settings
from app.core.permissions import Permission
from app.models import User
from app.models_backup import (
    BackupListPublic,
    BackupRun,
    BackupRunPublic,
    RestoreRequestPublic,
)

router = APIRouter(prefix="/backups", tags=["backups"])

BackupUser = Annotated[User, Depends(require_permission(Permission.BACKUP_RESTORE))]


def _public(run: BackupRun) -> BackupRunPublic:
    exists = False
    if run.file_name:
        try:
            exists = backup_service.backup_path(run.file_name).is_file()
        except backup_service.BackupError:
            exists = False
    return BackupRunPublic.model_validate(run, update={"file_exists": exists})


def _get_or_404(session: SessionDep, backup_id: uuid.UUID) -> BackupRun:
    run = session.get(BackupRun, backup_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Backup not found")
    return run


@router.get("/", response_model=BackupListPublic)
def list_backups(
    session: SessionDep,
    _user: BackupUser,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> BackupListPublic:
    runs = session.exec(
        select(BackupRun).order_by(col(BackupRun.started_at).desc()).limit(limit)
    ).all()
    total = session.exec(select(func.count()).select_from(BackupRun)).one()
    return BackupListPublic(
        data=[_public(run) for run in runs],
        count=total,
        tool_available=backup_service.tool_available(),
        keep_copies=settings.BACKUP_KEEP_COPIES,
    )


@router.post("/", response_model=BackupRunPublic, status_code=201)
def create_backup(session: SessionDep, user: BackupUser) -> BackupRunPublic:
    try:
        run = backup_service.create_backup(session, kind="manual", actor=user)
    except backup_service.BackupBusy as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except backup_service.BackupUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return _public(run)


@router.post("/{backup_id}/verify", response_model=BackupRunPublic)
def verify_backup(
    backup_id: uuid.UUID, session: SessionDep, user: BackupUser
) -> BackupRunPublic:
    run = _get_or_404(session, backup_id)
    return _public(backup_service.verify_backup(session, run, actor=user))


@router.get("/{backup_id}/download")
def download_backup(
    backup_id: uuid.UUID, session: SessionDep, user: BackupUser
) -> FileResponse:
    run = _get_or_404(session, backup_id)
    if run.status != "ok" or not run.file_name:
        raise HTTPException(status_code=404, detail="No backup file to download")
    path = backup_service.backup_path(run.file_name)
    if not path.is_file():
        raise HTTPException(
            status_code=404, detail="The backup file is no longer there"
        )
    record_audit_event(
        session,
        action="backup.download",
        actor=user,
        module="backup",
        record_type="backup",
        record_id=run.id,
        details={"file_name": run.file_name},
    )
    session.commit()
    return FileResponse(
        path, media_type="application/octet-stream", filename=run.file_name
    )


@router.post("/{backup_id}/restore-request", response_model=RestoreRequestPublic)
def request_restore(
    backup_id: uuid.UUID, session: SessionDep, user: BackupUser
) -> RestoreRequestPublic:
    """Check the file and log the request. The restore itself is run offline."""
    run = _get_or_404(session, backup_id)
    if run.status != "ok" or not run.file_name:
        raise HTTPException(status_code=409, detail="This backup cannot be restored")
    run = backup_service.verify_backup(session, run, actor=user)
    if run.status != "ok":
        raise HTTPException(
            status_code=409,
            detail=run.error or "The backup failed its check and cannot be restored",
        )
    record_audit_event(
        session,
        action="backup.restore_requested",
        actor=user,
        module="backup",
        record_type="backup",
        record_id=run.id,
        details={"file_name": run.file_name},
        commit=True,
    )
    return RestoreRequestPublic(
        file_name=run.file_name,
        command=(
            f".\\scripts\\restore-db.ps1 -BackupFile .\\backups\\{run.file_name}"
            + (
                " -KeyFile <path to your private key file>"
                if run.file_name.endswith(".enc")
                else ""
            )
        ),
    )
