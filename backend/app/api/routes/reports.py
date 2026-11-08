"""Management reports (System Administrator only, ``REPORTS_VIEW``).

Aggregate numbers only. Totals never carry resident names or the health
condition; the expiring list names the resident because it is a work list.
Every figure is computed on read from issued documents (docs/09, derived
values). Which reports and periods the client wants is still open (D-21).
"""

from datetime import datetime, time, timedelta
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func as sa_func
from sqlmodel import Session, col, select

from app.api.deps import SessionDep, require_permission
from app.core.dates import MANILA_TZ, today_manila
from app.core.periods import DateRange, Period, resolve_period
from app.core.permissions import Permission
from app.core.report_queries import (
    ExpiryKind,
    ExpiryStatus,
    count_by_type,
    count_expiring,
    document_types,
    expiring_item,
    expiring_records,
    in_range,
    period_info,
)
from app.models import User
from app.models_foundation import AuditLog, IssuancePurpose, Sector
from app.models_import import ImportBatch
from app.models_issuance import Issuance
from app.models_reports import (
    AccountActivityPublic,
    AccountActivityRow,
    ExpiringPublic,
    IdStatusCounts,
    IssuancesByPurposePublic,
    IssuancesByTypePublic,
    IssuanceTypeRow,
    PurposeRow,
    RecordsOverview,
    ReportSummary,
    SectorCount,
)
from app.models_residents import Resident, ResidentSector

router = APIRouter(prefix="/reports", tags=["reports"])

ReportsUser = Annotated[User, Depends(require_permission(Permission.REPORTS_VIEW))]
PeriodQuery = Annotated[Period, Query(description="Reporting period, to date")]

# Audit actions that count as "records added / edited" in account activity.
RECORD_ACTIONS = (
    "resident.create",
    "resident.update",
    "resident.archive",
    "resident.restore",
    "resident.photo_set",
    "resident.photo_remove",
)


def _percent(part: int, whole: int) -> float | None:
    return round(part * 100 / whole, 1) if whole else None


def _count_committed_imports(session: Session, range_: DateRange) -> int:
    """Imports finished in the range (Manila days, like the other figures)."""
    clauses: list[Any] = [
        col(ImportBatch.status) == "committed",
        col(ImportBatch.committed_at)
        < datetime.combine(range_.end + timedelta(days=1), time.min, tzinfo=MANILA_TZ),
    ]
    if range_.start is not None:
        clauses.append(
            col(ImportBatch.committed_at)
            >= datetime.combine(range_.start, time.min, tzinfo=MANILA_TZ)
        )
    return session.exec(
        select(sa_func.count()).select_from(ImportBatch).where(*clauses)
    ).one()


@router.get("/summary", response_model=ReportSummary)
def summary(
    session: SessionDep, _user: ReportsUser, period: PeriodQuery = "month"
) -> Any:
    today = today_manila()
    issued = sum(
        count_by_type(session, resolve_period(period, today), status="issued").values()
    )
    return ReportSummary(
        period=period_info(period, today),
        documents_issued=issued,
        records_expiring=count_expiring(session, today, None, "all"),
        imports_committed=_count_committed_imports(
            session, resolve_period(period, today)
        ),
    )


@router.get("/issuances-by-type", response_model=IssuancesByTypePublic)
def issuances_by_type(
    session: SessionDep, _user: ReportsUser, period: PeriodQuery = "month"
) -> Any:
    today = today_manila()
    info = period_info(period, today)
    current = resolve_period(period, today)
    issued = count_by_type(session, current, status="issued")
    voided = count_by_type(session, current, status="voided")
    corrections = count_by_type(
        session, current, status="issued", corrections_only=True
    )
    previous: dict[int, int] | None = None
    if info.previous_start is not None and info.previous_end is not None:
        previous = count_by_type(
            session, DateRange(info.previous_start, info.previous_end), status="issued"
        )
    total = sum(issued.values())
    rows = []
    for t in document_types(session):
        tid = t.id or 0
        before = previous.get(tid, 0) if previous is not None else None
        rows.append(
            IssuanceTypeRow(
                document_type_id=tid,
                code=t.code,
                name=t.name,
                issued=issued.get(tid, 0),
                voided=voided.get(tid, 0),
                corrections=corrections.get(tid, 0),
                share_percent=_percent(issued.get(tid, 0), total),
                previous_issued=before,
                change_percent=(
                    round((issued.get(tid, 0) - before) * 100 / before, 1)
                    if before
                    else None
                ),
            )
        )
    return IssuancesByTypePublic(
        period=info,
        data=rows,
        total_issued=total,
        total_voided=sum(voided.values()),
        total_corrections=sum(corrections.values()),
    )


@router.get("/issuances-by-purpose", response_model=IssuancesByPurposePublic)
def issuances_by_purpose(
    session: SessionDep, _user: ReportsUser, period: PeriodQuery = "month"
) -> Any:
    today = today_manila()
    rows = session.exec(
        select(col(IssuancePurpose.id), col(IssuancePurpose.name), sa_func.count())
        .select_from(Issuance)
        .outerjoin(IssuancePurpose, col(IssuancePurpose.id) == col(Issuance.purpose_id))
        .where(Issuance.status == "issued", *in_range(resolve_period(period, today)))
        .group_by(col(IssuancePurpose.id), col(IssuancePurpose.name))
        .order_by(sa_func.count().desc(), col(IssuancePurpose.name))
    ).all()
    total = sum(n for _, _, n in rows)
    return IssuancesByPurposePublic(
        period=period_info(period, today),
        data=[
            PurposeRow(
                purpose_id=pid,
                purpose=name or "(No purpose given)",
                issued=n,
                share_percent=_percent(n, total),
            )
            for pid, name, n in rows
        ],
        total_issued=total,
    )


@router.get("/expiring", response_model=ExpiringPublic)
def expiring(
    session: SessionDep,
    _user: ReportsUser,
    kind: ExpiryKind | None = None,
    status: Literal["expiring_soon", "expired", "all"] = "all",
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> Any:
    """Each resident's latest clearance or card that is expiring soon or
    already expired, soonest (or longest expired) first."""
    today = today_manila()
    status_filter: ExpiryStatus | Literal["all"] = status
    stmt, kind_of_type = expiring_records(
        session, today, kind=kind, status=status_filter
    )
    count = session.exec(select(sa_func.count()).select_from(stmt.subquery())).one()
    rows = session.exec(stmt.offset(skip).limit(limit)).all()
    return ExpiringPublic(
        data=[
            expiring_item(i, r, kind_of_type[i.document_type_id], today)
            for i, r in rows
        ],
        count=count,
    )


@router.get("/account-activity", response_model=AccountActivityPublic)
def account_activity(
    session: SessionDep, _user: ReportsUser, period: PeriodQuery = "month"
) -> Any:
    """Per account: documents issued and records changed in the period.
    Sign-ins are not recorded anywhere yet, so they are not reported."""
    today = today_manila()
    current = resolve_period(period, today)
    start = (
        datetime.combine(current.start, time.min, tzinfo=MANILA_TZ)
        if current.start
        else None
    )
    end = datetime.combine(current.end + timedelta(days=1), time.min, tzinfo=MANILA_TZ)

    issued_stmt = (
        select(col(Issuance.issued_by_user_id), sa_func.count())
        .where(Issuance.status.in_(["issued", "voided"]))  # type: ignore[attr-defined]
        .where(col(Issuance.issued_at) < end)
        .group_by(col(Issuance.issued_by_user_id))
    )
    audit_when: list[Any] = [
        col(AuditLog.occurred_at) < end,
        AuditLog.outcome == "success",
    ]
    if start is not None:
        issued_stmt = issued_stmt.where(col(Issuance.issued_at) >= start)
        audit_when.append(col(AuditLog.occurred_at) >= start)
    issued = dict(session.exec(issued_stmt).all())
    records = dict(
        session.exec(
            select(col(AuditLog.actor_user_id), sa_func.count())
            .where(*audit_when, col(AuditLog.action).in_(RECORD_ACTIONS))
            .group_by(col(AuditLog.actor_user_id))
        ).all()
    )
    last = dict(
        session.exec(
            select(col(AuditLog.actor_user_id), sa_func.max(col(AuditLog.occurred_at)))
            .where(*audit_when)
            .group_by(col(AuditLog.actor_user_id))
        ).all()
    )
    users = session.exec(select(User).order_by(col(User.email))).all()
    return AccountActivityPublic(
        period=period_info(period, today),
        data=[
            AccountActivityRow(
                user_id=u.id,
                email=u.email,
                full_name=u.full_name,
                role=u.role,
                is_active=u.is_active,
                documents_issued=issued.get(u.id, 0),
                records_changed=records.get(u.id, 0),
                last_activity=last.get(u.id),
            )
            for u in users
        ],
    )


@router.get("/records-overview", response_model=RecordsOverview)
def records_overview(session: SessionDep, _user: ReportsUser) -> Any:
    """Residents by status and sector, and Barangay IDs by status."""
    today = today_manila()
    status_counts = dict(
        session.exec(
            select(col(Resident.status), sa_func.count()).group_by(col(Resident.status))
        ).all()
    )
    by_sector = session.exec(
        select(col(Sector.id), col(Sector.name), sa_func.count(col(Resident.id)))
        .select_from(Sector)
        .outerjoin(ResidentSector, col(ResidentSector.sector_id) == col(Sector.id))
        .outerjoin(
            Resident,
            (col(Resident.id) == col(ResidentSector.resident_id))
            & (col(Resident.status) == "active"),
        )
        .group_by(col(Sector.id), col(Sector.name))
        .order_by(col(Sector.name))
    ).all()
    soon = count_expiring(session, today, "barangay_id", "expiring_soon")
    expired = count_expiring(session, today, "barangay_id", "expired")
    total = count_expiring(session, today, "barangay_id", "any")
    return RecordsOverview(
        residents_active=status_counts.get("active", 0),
        residents_archived=status_counts.get("archived", 0),
        residents_by_sector=[
            SectorCount(sector_id=sid or 0, name=name, residents=n)
            for sid, name, n in by_sector
        ],
        ids_by_status=IdStatusCounts(
            valid=total - soon - expired,
            expiring_soon=soon,
            expired=expired,
            total=total,
        ),
    )
