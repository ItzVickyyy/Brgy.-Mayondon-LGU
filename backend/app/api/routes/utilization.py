"""Certificate of Utilization (monthly, requested by the LSPU extension program).

The office prints one certificate a month stating that the barangay used the
system and how many clients it served. This route only computes the figures;
the browser fills the Word-style page and prints it. Staff and administrators
may both use it, like the dashboard. Nothing is stored.
"""

from datetime import date, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func as sa_func
from sqlmodel import col, select

from app.api.deps import SessionDep, require_permission
from app.core.audit import record_audit_event
from app.core.dates import add_months, today_manila
from app.core.permissions import Permission
from app.models import User
from app.models_foundation import Official
from app.models_issuance import Issuance
from app.models_reports import UtilizationCertificate, UtilizationPrintedRequest

router = APIRouter(prefix="/utilization", tags=["utilization"])

UtilizationUser = Annotated[
    User, Depends(require_permission(Permission.ISSUANCE_WRITE))
]
MONTH_PATTERN = r"^\d{4}-(0[1-9]|1[0-2])$"


def month_range(month: str | None) -> tuple[str, date, date]:
    """``(YYYY-MM, first day, last day)``; the last day is today for this month.

    A month that has not started yet is refused: there is nothing to certify."""
    today = today_manila()
    if month is None:
        month = f"{today.year:04d}-{today.month:02d}"
    first = date(int(month[:4]), int(month[5:7]), 1)
    if first > today:
        raise HTTPException(status_code=422, detail="That month has not started yet.")
    last = add_months(first, 1) - timedelta(days=1)
    return month, first, min(last, today)


@router.get("/", response_model=UtilizationCertificate)
def utilization(
    session: SessionDep,
    _user: UtilizationUser,
    month: Annotated[
        str | None,
        Query(
            pattern=MONTH_PATTERN, description="Month as YYYY-MM; default this month"
        ),
    ] = None,
) -> Any:
    label, first, end = month_range(month)
    # Same rule as the dashboard: documents in force (issued, not hidden).
    in_month = (
        Issuance.status == "issued",
        col(Issuance.archived_at).is_(None),
        col(Issuance.issue_date) >= first,
        col(Issuance.issue_date) <= end,
    )
    clients = session.exec(
        select(sa_func.count(sa_func.distinct(col(Issuance.resident_id)))).where(
            *in_month
        )
    ).one()
    documents = session.exec(
        select(sa_func.count()).select_from(Issuance).where(*in_month)
    ).one()
    punong = session.exec(
        select(Official.full_name)
        .where(Official.position == "Punong Barangay", col(Official.is_current))
        .order_by(col(Official.term_start).desc())
    ).first()
    return UtilizationCertificate(
        month=label,
        month_start=first,
        month_end=end,
        clients_served=clients,
        documents_issued=documents,
        punong_barangay=punong,
    )


@router.post("/printed", status_code=204)
def utilization_printed(
    body: UtilizationPrintedRequest, session: SessionDep, user: UtilizationUser
) -> Response:
    """Write a ``utilization.print`` audit row. The browser calls it just before
    the print dialog opens, so a certificate that leaves the screen is on record.
    The row names the month only."""
    month_range(body.month)
    record_audit_event(
        session,
        action="utilization.print",
        actor=user,
        module="reports",
        details={"period": body.month},
        commit=True,
    )
    return Response(status_code=204)
