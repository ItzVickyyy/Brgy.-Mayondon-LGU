"""Dashboard numbers for both roles: operational cards, charts, expiring work.

Counts only, plus a short work list of records about to expire (the office
needs the resident's name to act on it). Recent activity is not repeated here:
the page calls ``GET /activity?limit=5``, which already limits Staff to their
own rows. Nothing is stored; every figure is computed on read.
"""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func as sa_func
from sqlmodel import select

from app.api.deps import SessionDep, require_permission
from app.core.dates import today_manila
from app.core.periods import Period, months_in, resolve_period
from app.core.permissions import Permission
from app.core.report_queries import (
    count_by_type,
    count_expiring,
    document_types,
    expiring_item,
    expiring_records,
    first_issue_date,
    monthly_issued,
    period_info,
)
from app.models import User
from app.models_issuance import (
    CLEARANCE_EXPIRING_SOON_DAYS,
    ID_EXPIRING_SOON_DAYS,
    Issuance,
)
from app.models_reports import (
    DashboardPublic,
    DashboardSummary,
    DocumentTypeCount,
    MonthCount,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

# The dashboard shows what Staff and Admin can already read: issuance work.
DashboardUser = Annotated[User, Depends(require_permission(Permission.ISSUANCE_WRITE))]

MAX_EXPIRING = 10
MAX_MONTHS = 24  # the bar chart shows at most this many of the latest months


@router.get("/", response_model=DashboardPublic)
def dashboard(
    session: SessionDep,
    _user: DashboardUser,
    period: Annotated[
        Period, Query(description="Reporting period for the charts")
    ] = "overall",
) -> Any:
    today = today_manila()
    current = resolve_period(period, today)
    month_start = resolve_period("month", today)

    # Cards
    issued_this_month = sum(
        count_by_type(session, month_start, status="issued").values()
    )
    open_drafts = session.exec(
        select(sa_func.count()).select_from(Issuance).where(Issuance.status == "draft")
    ).one()
    summary = DashboardSummary(
        documents_issued_this_month=issued_this_month,
        clearances_expiring=count_expiring(
            session, today, "clearance", "expiring_soon"
        ),
        barangay_ids_expiring=count_expiring(
            session, today, "barangay_id", "expiring_soon"
        ),
        clearance_window_days=CLEARANCE_EXPIRING_SOON_DAYS,
        id_window_days=ID_EXPIRING_SOON_DAYS,
        open_drafts=open_drafts,
    )

    # Documents by type for the selected period (every type, zeros included)
    counts = count_by_type(session, current, status="issued")
    by_type = [
        DocumentTypeCount(
            document_type_id=t.id or 0,
            code=t.code,
            name=t.name,
            count=counts.get(t.id or 0, 0),
        )
        for t in document_types(session)
    ]

    # Monthly bars: the months of the period (overall: from the first issue)
    if period in ("today", "week", "month"):
        first_month = month_start.start
    elif current.start is not None:
        first_month = current.start
    else:
        first_month = first_issue_date(session) or month_start.start
    assert first_month is not None
    months = months_in(first_month, today)[-MAX_MONTHS:]
    per_month = monthly_issued(session, resolve_period("overall", today))
    over_time = [
        MonthCount(month=f"{m:%Y-%m}", count=per_month.get(f"{m:%Y-%m}", 0))
        for m in months
    ]

    # Soonest-expiring work list (clearances and cards, not yet expired)
    stmt, kind_of_type = expiring_records(session, today, status="expiring_soon")
    rows = session.exec(stmt.limit(MAX_EXPIRING)).all()
    expiring = [
        expiring_item(i, r, kind_of_type[i.document_type_id], today) for i, r in rows
    ]

    return DashboardPublic(
        period=period_info(period, today),
        summary=summary,
        issuances_over_time=over_time,
        by_document_type=by_type,
        total_issued=sum(item.count for item in by_type),
        expiring=expiring,
    )
