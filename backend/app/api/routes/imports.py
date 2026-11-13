"""Masterlist import API (D-19). System Administrator only (``records.import``).

Flow: upload -> map columns and check -> commit (or cancel). Nothing reaches
``residents`` before commit. Audit events carry counts and the file name, never
row values.
"""

import csv
import io
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import func as sa_func
from sqlalchemy import update as sa_update
from sqlmodel import Session, col, select

from app.api.deps import SessionDep, require_permission
from app.core import masterlist_import as mi
from app.core.audit import record_audit_event
from app.core.permissions import Permission
from app.models import User
from app.models_import import ImportBatch, ImportRow
from app.models_residents import Resident

router = APIRouter(prefix="/imports", tags=["imports"])

ImportUser = Annotated[User, Depends(require_permission(Permission.RECORDS_IMPORT))]

# A batch that is never finished loses its staged personal data after this long.
STAGING_HOURS = 24


class MappingRequest(BaseModel):
    mapping: dict[str, str] = Field(max_length=mi.MAX_COLUMNS)
    date_order: Literal["ymd", "mdy", "dmy"] = "ymd"
    duplicate_action: Literal["skip", "update"] = "skip"


class ImportBatchPublic(BaseModel):
    id: uuid.UUID
    created_at: datetime
    created_by_email: str | None
    file_name: str
    file_type: str
    status: str
    total_rows: int
    headers: list[str]
    mapping: dict[str, str] | None
    date_order: str
    duplicate_action: str
    counts: dict[str, int] | None
    result: dict[str, int] | None
    committed_at: datetime | None


class ImportUploadPublic(ImportBatchPublic):
    importable_fields: list[str]
    required_fields: list[str]
    suggested_mapping: dict[str, str]
    sample_rows: list[dict[str, str | None]]


class ImportBatchesPublic(BaseModel):
    data: list[ImportBatchPublic]
    count: int


class ImportRowPublic(BaseModel):
    row_number: int
    classification: str | None
    errors: list[dict[str, str]]
    duplicate_scope: str | None
    duplicate_resident_id: uuid.UUID | None
    outcome: str | None
    raw: dict[str, Any] | None
    mapped: dict[str, Any] | None


class ImportRowsPublic(BaseModel):
    data: list[ImportRowPublic]
    count: int


def _public(batch: ImportBatch) -> ImportBatchPublic:
    return ImportBatchPublic.model_validate(batch, from_attributes=True)


def _get_or_404(session: Session, batch_id: uuid.UUID) -> ImportBatch:
    batch = session.get(ImportBatch, batch_id)
    if batch is None:
        raise HTTPException(status_code=404, detail="Import not found")
    return batch


def expire_stale_batches(session: Session) -> None:
    """Wipe staged personal data of batches left unfinished for too long."""
    cutoff = datetime.now(UTC) - timedelta(hours=STAGING_HOURS)
    stale = session.exec(
        select(ImportBatch.id).where(
            col(ImportBatch.status).in_(("uploaded", "mapped")),
            col(ImportBatch.created_at) < cutoff,
        )
    ).all()
    for batch_id in stale:
        mi.wipe_staged_data(session, batch_id)
        session.exec(
            sa_update(ImportBatch)
            .where(col(ImportBatch.id) == batch_id)
            .values(status="expired")
        )
    if stale:
        session.commit()


def _require_open(batch: ImportBatch) -> None:
    if batch.status not in ("uploaded", "mapped"):
        raise HTTPException(
            status_code=409, detail=f"This import is already {batch.status}"
        )


@router.get("/", response_model=ImportBatchesPublic)
def list_imports(
    session: SessionDep,
    _user: ImportUser,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> Any:
    expire_stale_batches(session)
    total = session.exec(select(sa_func.count()).select_from(ImportBatch)).one()
    rows = session.exec(
        select(ImportBatch)
        .order_by(col(ImportBatch.created_at).desc())
        .offset(skip)
        .limit(limit)
    ).all()
    return ImportBatchesPublic(data=[_public(b) for b in rows], count=total)


@router.post("/", response_model=ImportUploadPublic, status_code=201)
async def upload_import(
    session: SessionDep, user: ImportUser, file: Annotated[UploadFile, File()]
) -> Any:
    """Read the file into staging. Residents are not touched."""
    expire_stale_batches(session)
    content = await file.read(mi.MAX_FILE_BYTES + 1)
    file_name = (file.filename or "upload")[-255:]
    try:
        file_type, headers, rows = mi.parse_rows(file_name, content)
    except mi.ImportFileError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    previous = session.exec(
        select(ImportBatch.mapping)
        .where(col(ImportBatch.mapping).is_not(None))
        .order_by(col(ImportBatch.created_at).desc())
        .limit(1)
    ).first()
    batch = ImportBatch(
        created_by=user.id,
        created_by_email=user.email,
        file_name=file_name,
        file_type=file_type,
        total_rows=len(rows),
        headers=headers,
    )
    session.add(batch)
    session.flush()
    for number, values in rows:
        session.add(ImportRow(batch_id=batch.id, row_number=number, raw=values))
    record_audit_event(
        session,
        action="import.upload",
        actor=user,
        module="records",
        record_type="import",
        record_id=batch.id,
        details={"file_name": file_name, "rows": len(rows)},
    )
    session.commit()
    session.refresh(batch)
    return ImportUploadPublic(
        **_public(batch).model_dump(),
        importable_fields=list(mi.IMPORT_FIELDS),
        required_fields=list(mi.REQUIRED_FIELDS),
        suggested_mapping=mi.suggest_mapping(
            headers, dict(previous) if previous else None
        ),
        sample_rows=[values for _, values in rows[:5]],
    )


@router.get("/{batch_id}", response_model=ImportBatchPublic)
def read_import(batch_id: uuid.UUID, session: SessionDep, _user: ImportUser) -> Any:
    return _public(_get_or_404(session, batch_id))


@router.put("/{batch_id}/mapping", response_model=ImportBatchPublic)
def set_mapping(
    batch_id: uuid.UUID, body: MappingRequest, session: SessionDep, user: ImportUser
) -> Any:
    """Save the column mapping and check every row. Still nothing is imported."""
    batch = _get_or_404(session, batch_id)
    _require_open(batch)
    try:
        mi.check_mapping(batch.headers, body.mapping)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    batch.mapping = body.mapping
    batch.date_order = body.date_order
    batch.duplicate_action = body.duplicate_action
    counts = mi.classify_batch(session, batch)
    batch.counts = counts
    batch.status = "mapped"
    session.add(batch)
    record_audit_event(
        session,
        action="import.preview",
        actor=user,
        module="records",
        record_type="import",
        record_id=batch.id,
        details={"file_name": batch.file_name, **counts},
    )
    session.commit()
    session.refresh(batch)
    return _public(batch)


@router.get("/{batch_id}/rows", response_model=ImportRowsPublic)
def list_rows(
    batch_id: uuid.UUID,
    session: SessionDep,
    _user: ImportUser,
    classification: Literal["new", "duplicate", "error"] | None = None,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> Any:
    _get_or_404(session, batch_id)
    stmt = select(ImportRow).where(ImportRow.batch_id == batch_id)
    if classification is not None:
        stmt = stmt.where(ImportRow.classification == classification)
    total = session.exec(select(sa_func.count()).select_from(stmt.subquery())).one()
    rows = session.exec(
        stmt.order_by(col(ImportRow.row_number)).offset(skip).limit(limit)
    ).all()
    return ImportRowsPublic(
        data=[
            ImportRowPublic(
                row_number=r.row_number,
                classification=r.classification,
                errors=r.errors or [],
                duplicate_scope=r.duplicate_scope,
                duplicate_resident_id=r.duplicate_resident_id,
                outcome=r.outcome,
                raw=r.raw,
                mapped=r.mapped,
            )
            for r in rows
        ],
        count=total,
    )


@router.post("/{batch_id}/commit", response_model=ImportBatchPublic)
def commit_import(batch_id: uuid.UUID, session: SessionDep, user: ImportUser) -> Any:
    """Create (and optionally update) residents in one transaction.

    Rows with errors are not imported and are reported. If writing fails the
    whole batch is rolled back and marked ``failed``.
    """
    batch = _get_or_404(session, batch_id)
    if batch.status != "mapped" or not batch.mapping:
        raise HTTPException(
            status_code=409, detail="Map the columns and check the rows first"
        )
    try:
        result = _apply_batch(session, batch, user)
        batch.result = result
        batch.status = "committed"
        batch.committed_at = datetime.now(UTC)
        session.add(batch)
        mi.wipe_staged_data(session, batch.id)
        record_audit_event(
            session,
            action="import.commit",
            actor=user,
            module="records",
            record_type="import",
            record_id=batch.id,
            details={"file_name": batch.file_name, **result},
        )
        session.commit()
    except Exception:
        session.rollback()
        failed = session.get(ImportBatch, batch_id)
        if failed is not None:
            failed.status = "failed"
            session.add(failed)
            mi.wipe_staged_data(session, batch_id)
        record_audit_event(
            session,
            action="import.commit",
            actor=user,
            outcome="failed",
            module="records",
            record_type="import",
            record_id=batch_id,
            commit=True,
        )
        raise HTTPException(
            status_code=500, detail="The import failed and nothing was saved"
        )
    session.refresh(batch)
    return _public(batch)


def _apply_batch(session: Session, batch: ImportBatch, user: User) -> dict[str, int]:
    # Check again: residents may have changed since the preview.
    batch.counts = mi.classify_batch(session, batch)
    session.flush()
    rows = session.exec(
        select(ImportRow)
        .where(ImportRow.batch_id == batch.id)
        .order_by(col(ImportRow.row_number))
    ).all()
    now = datetime.now(UTC)
    result = {"created": 0, "updated": 0, "skipped": 0, "failed": 0}
    for row in rows:
        if row.classification == "error":
            row.outcome = "failed"
        elif row.classification == "duplicate":
            # Only "update" needs the existing record; skipping must not load
            # one resident per row (a full masterlist re-import is 20,000 rows).
            target = (
                session.get(Resident, row.duplicate_resident_id)
                if batch.duplicate_action == "update"
                and row.duplicate_scope == "existing"
                and row.duplicate_resident_id
                else None
            )
            if (
                batch.duplicate_action == "update"
                and target is not None
                and target.status == "active"
            ):
                _update_resident(target, row.mapped or {}, user, now)
                session.add(target)
                row.outcome = "updated"
            else:
                row.outcome = "skipped"
        else:
            values = dict(row.mapped or {})
            if values.get("birthdate"):
                values["birthdate"] = date.fromisoformat(values["birthdate"])
            resident = Resident.model_validate(
                values,
                update={
                    "created_at": now,
                    "updated_at": now,
                    "created_by_user_id": user.id,
                    "updated_by_user_id": user.id,
                },
            )
            session.add(resident)
            row.outcome = "created"
        result[row.outcome] += 1
        session.add(row)
    session.flush()
    return result


def _update_resident(
    resident: Resident, values: dict[str, Any], user: User, now: datetime
) -> None:
    """Overwrite fields the file has a value for; never blank out existing data."""
    protected = {"first_name", "last_name", "birthdate"}
    for field, value in values.items():
        if field in protected or value is None:
            continue
        setattr(resident, field, value)
    if values.get("resident_since_year") is not None:
        resident.resident_since_birth = False
    resident.updated_at = now
    resident.updated_by_user_id = user.id


@router.get("/{batch_id}/errors.csv")
def download_error_report(
    batch_id: uuid.UUID, session: SessionDep, _user: ImportUser
) -> Response:
    """Row numbers and reasons only: no resident values."""
    _get_or_404(session, batch_id)
    rows = session.exec(
        select(ImportRow)
        .where(ImportRow.batch_id == batch_id, ImportRow.classification == "error")
        .order_by(col(ImportRow.row_number))
    ).all()
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Row", "Field", "Problem"])
    for row in rows:
        for error in row.errors or []:
            writer.writerow([row.row_number, error["field"], error["message"]])
    return Response(
        content="﻿" + buffer.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="import-errors.csv"'},
    )


@router.delete("/{batch_id}", response_model=ImportBatchPublic)
def cancel_import(batch_id: uuid.UUID, session: SessionDep, user: ImportUser) -> Any:
    """Discard an unfinished import and wipe its staged data."""
    batch = _get_or_404(session, batch_id)
    _require_open(batch)
    mi.wipe_staged_data(session, batch.id)
    batch.status = "cancelled"
    session.add(batch)
    record_audit_event(
        session,
        action="import.cancel",
        actor=user,
        module="records",
        record_type="import",
        record_id=batch.id,
        details={"file_name": batch.file_name},
    )
    session.commit()
    session.refresh(batch)
    return _public(batch)
