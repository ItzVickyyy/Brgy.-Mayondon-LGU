"""Queries shared by the dashboard and the reports, so both show the same numbers.

Dates are business dates (``issuances.issue_date``, Manila). "Issued" means a
document currently in force (status ``issued``); voided documents are counted
separately and never as issued.
"""

from datetime import date, timedelta
from typing import Any, Literal

from sqlalchemy import and_, or_, true
from sqlalchemy import func as sa_func
from sqlmodel import Session, col, select

from app.core.periods import DateRange, Period, previous_range, resolve_period
from app.models_foundation import DocumentType
from app.models_issuance import (
    CLEARANCE_EXPIRING_SOON_DAYS,
    ID_EXPIRING_SOON_DAYS,
    Issuance,
)
from app.models_reports import ExpiringItem, PeriodInfo
from app.models_residents import Resident, build_full_name

ExpiryKind = Literal["clearance", "barangay_id"]
ExpiryStatus = Literal["expiring_soon", "expired"]
# Document type code -> kind shown to the user, and its "soon" window in days.
EXPIRY_KINDS: dict[ExpiryKind, tuple[str, int]] = {
    "clearance": ("BARANGAY_CLEARANCE", CLEARANCE_EXPIRING_SOON_DAYS),
    "barangay_id": ("BARANGAY_ID", ID_EXPIRING_SOON_DAYS),
}


def document_types(session: Session) -> list[DocumentType]:
    return list(session.exec(select(DocumentType).order_by(col(DocumentType.id))).all())


def in_range(range_: DateRange) -> list[Any]:
    """WHERE clauses limiting ``issue_date`` to the range (none for overall)."""
    clauses: list[Any] = [col(Issuance.issue_date) <= range_.end]
    if range_.start is not None:
        clauses.append(col(Issuance.issue_date) >= range_.start)
    return clauses


def count_by_type(
    session: Session, range_: DateRange, *, status: str, corrections_only: bool = False
) -> dict[int, int]:
    stmt = (
        select(col(Issuance.document_type_id), sa_func.count())
        .where(Issuance.status == status, *in_range(range_))
        .group_by(col(Issuance.document_type_id))
    )
    if corrections_only:
        stmt = stmt.where(col(Issuance.corrects_issuance_id).is_not(None))
    return dict(session.exec(stmt).all())


def monthly_issued(session: Session, range_: DateRange) -> dict[str, int]:
    """Issued documents per month, keyed ``YYYY-MM``."""
    month = sa_func.to_char(col(Issuance.issue_date), "YYYY-MM")
    rows = session.exec(
        select(month, sa_func.count())
        .where(Issuance.status == "issued", *in_range(range_))
        .group_by(month)
    ).all()
    return dict(rows)


def first_issue_date(session: Session) -> date | None:
    return session.exec(
        select(sa_func.min(col(Issuance.issue_date))).where(Issuance.status == "issued")
    ).one()


def expiring_records(
    session: Session,
    today: date,
    *,
    kind: ExpiryKind | None = None,
    status: ExpiryStatus | Literal["all", "any"] = "all",
) -> tuple[Any, dict[int, ExpiryKind]]:
    """``(statement, kind_of_type)``. The statement yields ``(Issuance,
    Resident)`` rows, one per resident and kind; ``kind_of_type`` maps a
    document type id to its kind. Only the resident's **latest issued**
    clearance or card counts, so a record that has since been renewed is not
    listed as expiring.

    ``status`` ``expiring_soon`` is today up to the kind's window; ``expired``
    is before today; ``all`` is either; ``any`` ignores the date entirely (the
    resident's latest record, valid or not).
    """
    kinds = [kind] if kind else list(EXPIRY_KINDS)
    codes = [EXPIRY_KINDS[k][0] for k in kinds]
    type_ids = {
        t.code: t.id for t in document_types(session) if t.code in codes and t.id
    }
    latest = (
        select(col(Issuance.id).label("id"))
        .where(
            Issuance.status == "issued",
            col(Issuance.expires_on).is_not(None),
            col(Issuance.document_type_id).in_(type_ids.values()),
        )
        .distinct(col(Issuance.resident_id), col(Issuance.document_type_id))
        .order_by(
            col(Issuance.resident_id),
            col(Issuance.document_type_id),
            col(Issuance.issued_at).desc(),
        )
        .subquery()
    )
    conditions: list[Any] = []
    for k in kinds:
        code, window = EXPIRY_KINDS[k]
        soon = and_(
            col(Issuance.expires_on) >= today,
            col(Issuance.expires_on) <= today + timedelta(days=window),
        )
        expired = col(Issuance.expires_on) < today
        status_clause = {
            "expiring_soon": soon,
            "expired": expired,
            "all": or_(soon, expired),
            "any": true(),
        }[status]
        conditions.append(
            and_(col(Issuance.document_type_id) == type_ids[code], status_clause)
        )
    kind_of_type = {
        type_ids[EXPIRY_KINDS[k][0]]: k for k in kinds
    }  # document type id -> kind
    stmt = (
        select(Issuance, Resident)
        .join(latest, latest.c.id == col(Issuance.id))
        .join(Resident, col(Resident.id) == col(Issuance.resident_id))
        .where(or_(*conditions))
        .order_by(col(Issuance.expires_on), col(Issuance.id))
    )
    return stmt, kind_of_type


def expiring_item(
    issuance: Issuance, resident: Resident, kind: ExpiryKind, today: date
) -> ExpiringItem:
    expires_on = issuance.expires_on
    assert expires_on is not None  # guaranteed by expiring_records
    return ExpiringItem(
        kind=kind,
        issuance_id=issuance.id,
        reference_no=issuance.reference_no or "",
        resident_id=resident.id,
        resident_name=build_full_name(resident),
        expires_on=expires_on,
        days_left=(expires_on - today).days,
        status="expired" if expires_on < today else "expiring_soon",
    )


def count_expiring(
    session: Session,
    today: date,
    kind: ExpiryKind | None,
    status: ExpiryStatus | Literal["all", "any"],
) -> int:
    stmt, _ = expiring_records(session, today, kind=kind, status=status)
    return session.exec(select(sa_func.count()).select_from(stmt.subquery())).one()


def period_info(period: Period, today: date) -> PeriodInfo:
    current = resolve_period(period, today)
    previous = previous_range(period, current)
    return PeriodInfo(
        period=period,
        start=current.start,
        end=current.end,
        previous_start=previous.start if previous else None,
        previous_end=previous.end if previous else None,
    )
