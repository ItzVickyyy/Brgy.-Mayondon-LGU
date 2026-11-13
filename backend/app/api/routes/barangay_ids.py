"""Barangay ID history for Records Management (read only).

IDs are issued through ``/issuances`` (document type BARANGAY_ID); this route
only lists each resident's latest issued card with a status computed from
``valid_until``. Nothing here is stored (docs/09, derived values).
"""

from datetime import UTC, datetime, timedelta
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func as sa_func
from sqlmodel import col, select

from app.api.deps import SessionDep, require_permission
from app.core.audit import record_audit_event, record_read_event
from app.core.dates import today_manila
from app.core.permissions import Permission
from app.core.search import search_words, word_matches
from app.models import User
from app.models_issuance import (
    ID_EXPIRING_SOON_DAYS,
    BarangayIdListItem,
    BarangayIdsPublic,
    IdNumberSeries,
    IdSeriesIn,
    IdSeriesPublic,
    IdSeriesStatus,
    Issuance,
    IssuanceBarangayId,
    series_preview,
)
from app.models_residents import Resident, build_full_name

router = APIRouter(prefix="/barangay-ids", tags=["barangay-ids"])

RecordsUser = Annotated[User, Depends(require_permission(Permission.RECORDS_EDIT))]
# Setting up the numbering series is administrator work, like overriding a number.
SeriesAdmin = Annotated[User, Depends(require_permission(Permission.ID_OVERRIDE))]


@router.get("/", response_model=BarangayIdsPublic)
def list_barangay_ids(
    session: SessionDep,
    user: RecordsUser,
    q: Annotated[
        str | None,
        Query(max_length=100, description="Name words, ID number or reference"),
    ] = None,
    status: Literal["valid", "expiring_soon", "expired", "all"] = "all",
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> Any:
    """Latest issued card per resident. A voided card is not listed; the card
    issued before it, if any, shows instead.

    Browsing the list without a name or number search is a bulk read of personal
    data and adds a ``barangay_id.list`` audit row (once per 10 minutes).
    """
    today = today_manila()
    soon = today + timedelta(days=ID_EXPIRING_SOON_DAYS)
    latest = (
        select(col(Issuance.id).label("id"))
        .join(
            IssuanceBarangayId, col(IssuanceBarangayId.issuance_id) == col(Issuance.id)
        )
        .where(Issuance.status == "issued", col(Issuance.archived_at).is_(None))
        .distinct(col(Issuance.resident_id))
        .order_by(col(Issuance.resident_id), col(Issuance.issued_at).desc())
        .subquery()
    )
    stmt = (
        select(Issuance, IssuanceBarangayId, Resident)
        .join(latest, latest.c.id == col(Issuance.id))
        .join(
            IssuanceBarangayId, col(IssuanceBarangayId.issuance_id) == col(Issuance.id)
        )
        .join(Resident, col(Resident.id) == col(Issuance.resident_id))
    )
    if status == "expired":
        stmt = stmt.where(col(IssuanceBarangayId.valid_until) < today)
    elif status == "expiring_soon":
        stmt = stmt.where(
            col(IssuanceBarangayId.valid_until) >= today,
            col(IssuanceBarangayId.valid_until) <= soon,
        )
    elif status == "valid":
        stmt = stmt.where(col(IssuanceBarangayId.valid_until) > soon)
    for word in search_words(q):
        stmt = stmt.where(
            word_matches(
                word,
                [Resident.first_name, Resident.last_name, Resident.middle_name],
                [Issuance.reference_no, IssuanceBarangayId.id_number],
            )
        )
    count = session.exec(select(sa_func.count()).select_from(stmt.subquery())).one()
    rows = session.exec(
        stmt.order_by(col(Issuance.issued_at).desc(), col(Issuance.id))
        .offset(skip)
        .limit(limit)
    ).all()

    if not search_words(q) and rows:
        record_read_event(
            session,
            action="barangay_id.list",
            actor=user,
            module="records",
            record_type="barangay_id",
            details={"status": status, "count": count},
        )

    def state(valid_until: Any) -> Literal["valid", "expiring_soon", "expired"]:
        if valid_until < today:
            return "expired"
        return "expiring_soon" if valid_until <= soon else "valid"

    return BarangayIdsPublic(
        data=[
            BarangayIdListItem(
                issuance_id=i.id,
                reference_no=i.reference_no or "",
                resident_id=r.id,
                resident_name=build_full_name(r),
                resident_status=r.status,
                id_number=card.id_number or "",
                transaction_type=card.transaction_type,
                issue_date=i.issue_date,
                valid_until=card.valid_until,
                status=state(card.valid_until),
            )
            for i, card, r in rows
        ],
        count=count,
    )


# --- Numbering series (patch 65) --------------------------------------------


def _series(session: SessionDep, *, lock: bool = False) -> IdNumberSeries:
    stmt = select(IdNumberSeries).where(IdNumberSeries.id == 1)
    if lock:
        stmt = stmt.with_for_update()
    row = session.exec(stmt).first()
    if row is None:
        row = IdNumberSeries()
        session.add(row)
        session.flush()
    return row


def _series_public(session: SessionDep, row: IdNumberSeries) -> IdSeriesPublic:
    editor = (
        session.get(User, row.updated_by_user_id) if row.updated_by_user_id else None
    )
    return IdSeriesPublic(
        prefix=row.prefix,
        include_year=row.include_year,
        digit_width=row.digit_width,
        restart_yearly=row.restart_yearly,
        next_number=row.next_number,
        enabled=row.enabled,
        preview=series_preview(row, today_manila().year),
        updated_at=row.updated_at,
        updated_by_name=(editor.full_name or editor.email) if editor else None,
    )


@router.get(
    "/series/status",
    response_model=IdSeriesStatus,
    dependencies=[Depends(require_permission(Permission.ID_WRITE))],
)
def series_status(session: SessionDep) -> Any:
    """Whether new ID numbers are assigned automatically (for the issue form)."""
    row = _series(session)
    if not row.enabled:
        return IdSeriesStatus(enabled=False)
    return IdSeriesStatus(
        enabled=True, preview=series_preview(row, today_manila().year)
    )


@router.get(
    "/series",
    response_model=IdSeriesPublic,
    dependencies=[Depends(require_permission(Permission.ID_OVERRIDE))],
)
def get_series(session: SessionDep) -> Any:
    """The numbering series setup (administrator only)."""
    return _series_public(session, _series(session))


@router.put("/series", response_model=IdSeriesPublic)
def update_series(body: IdSeriesIn, session: SessionDep, user: SeriesAdmin) -> Any:
    """Set the numbering series. ``next_number`` is the number the next new card
    receives; take it from the barangay's real latest ID. Audited."""
    row = _series(session, lock=True)
    new = {
        "prefix": body.prefix,
        "include_year": body.include_year,
        "digit_width": body.digit_width,
        "restart_yearly": body.restart_yearly,
        "next_number": body.next_number,
        "enabled": body.enabled,
    }
    changed = {k: v for k, v in new.items() if getattr(row, k) != v}
    for key, value in new.items():
        setattr(row, key, value)
    row.counter_year = today_manila().year
    row.updated_at = datetime.now(UTC)
    row.updated_by_user_id = user.id
    session.add(row)
    if changed:
        record_audit_event(
            session,
            action="id_series.update",
            actor=user,
            module="records",
            record_type="id_number_series",
            record_id=1,
            details={
                "fields": ", ".join(changed),
                "numbering": "on" if row.enabled else "off",
                "next_number": row.next_number,
            },
        )
    session.commit()
    session.refresh(row)
    return _series_public(session, row)
