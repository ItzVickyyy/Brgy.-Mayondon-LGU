"""Barangay ID history for Records Management (read only).

IDs are issued through ``/issuances`` (document type BARANGAY_ID); this route
only lists each resident's latest issued card with a status computed from
``valid_until``. Nothing here is stored (docs/09, derived values).
"""

from datetime import timedelta
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func as sa_func
from sqlmodel import col, select

from app.api.deps import SessionDep, require_permission
from app.core.audit import record_read_event
from app.core.dates import today_manila
from app.core.permissions import Permission
from app.core.search import search_words, word_matches
from app.models import User
from app.models_issuance import (
    ID_EXPIRING_SOON_DAYS,
    BarangayIdListItem,
    BarangayIdsPublic,
    Issuance,
    IssuanceBarangayId,
)
from app.models_residents import Resident, build_full_name

router = APIRouter(prefix="/barangay-ids", tags=["barangay-ids"])

RecordsUser = Annotated[User, Depends(require_permission(Permission.RECORDS_EDIT))]


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
        .where(Issuance.status == "issued")
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
