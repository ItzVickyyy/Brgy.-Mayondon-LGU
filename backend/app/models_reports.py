"""Response shapes for the dashboard and reports. Counts only: no health
condition and no personal values in any total (decision 3). The expiring lists
name the resident because they are work lists for the office, not totals."""

import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import StringConstraints
from sqlmodel import SQLModel


class ReportExportedRequest(SQLModel):
    """What the browser reports just before it saves or prints a report."""

    report: Literal[
        "issuances", "purpose", "expiry", "imports", "accounts", "utilization"
    ]
    period: Literal[
        "today", "week", "month", "quarter", "3months", "6months", "year", "overall"
    ]
    mode: Literal["csv", "xlsx", "docx", "pdf", "print"]


class PeriodInfo(SQLModel):
    period: str
    start: date | None  # None for "overall"
    end: date  # inclusive, today in Manila
    previous_start: date | None
    previous_end: date | None


class DocumentTypeCount(SQLModel):
    document_type_id: int
    code: str
    name: str
    count: int


class MonthCount(SQLModel):
    month: str  # "YYYY-MM"
    count: int


class DayCount(SQLModel):
    day: str  # "YYYY-MM-DD"
    count: int


class ExpiringItem(SQLModel):
    kind: Literal["clearance", "barangay_id"]
    issuance_id: uuid.UUID
    reference_no: str
    resident_id: uuid.UUID
    resident_name: str
    expires_on: date
    days_left: int  # negative once expired
    status: Literal["expiring_soon", "expired"]


class DashboardSummary(SQLModel):
    documents_issued_this_month: int
    clearances_expiring: int
    barangay_ids_expiring: int
    clearance_window_days: int
    id_window_days: int
    open_drafts: int  # drafts not yet issued ("pending document requests")


class AgeBracketCount(SQLModel):
    bracket: str  # "0-17", "18-29", "30-49", "50-64", "65+"
    count: int


class PurokCount(SQLModel):
    purok: int
    count: int


class CivilStatusCount(SQLModel):
    status: str  # as stored: Single, Married, Widow/Widower, Legally Separated
    count: int


class SectoralIndicators(SQLModel):
    children: int  # age 0 to 12
    teens: int  # age 13 to 17
    adults: int  # age 18 to 59
    senior_citizens: int  # 60 or older, or in the Senior Citizens sector
    pwd: int
    solo_parents: int
    urban_poor: int
    indigenous_people: int


class DashboardPopulation(SQLModel):
    """Active residents only; not affected by the dashboard period."""

    total_population: int
    total_households: int  # distinct street + house number (no household record)
    total_voters: int
    # Percent more than 30 days ago (new records / earlier records); None when
    # nothing was added or there is no earlier base.
    population_growth_percent: float | None
    household_growth_percent: float | None
    voter_growth_percent: float | None
    male: int
    female: int
    age_brackets: list[AgeBracketCount]
    by_purok: list[PurokCount]
    civil_status: list[CivilStatusCount]
    sectoral: SectoralIndicators


class DashboardPublic(SQLModel):
    period: PeriodInfo
    summary: DashboardSummary
    issuances_over_time: list[MonthCount]
    # Only filled for the "week" period: Sunday to Saturday, one entry per day
    # (days after today are zero). Empty for every other period.
    issuances_by_day: list[DayCount] = []
    by_document_type: list[DocumentTypeCount]
    total_issued: int  # in the period; equals the sum of by_document_type
    expiring: list[ExpiringItem]  # soonest first, at most 10
    population: DashboardPopulation


class ReportSummary(SQLModel):
    period: PeriodInfo
    documents_issued: int
    records_expiring: int  # expiring soon or already expired, latest record each
    imports_committed: int  # masterlist imports finished in the period


class IssuanceTypeRow(SQLModel):
    document_type_id: int
    code: str
    name: str
    issued: int  # documents currently in force
    voided: int
    corrections: int  # issued documents that replace an earlier one
    share_percent: float | None  # of all issued; None when nothing was issued
    previous_issued: int | None  # None for "overall"
    change_percent: float | None  # None when there is no earlier figure


class IssuancesByTypePublic(SQLModel):
    period: PeriodInfo
    data: list[IssuanceTypeRow]
    total_issued: int
    total_voided: int
    total_corrections: int


class PurposeRow(SQLModel):
    purpose_id: int | None  # None groups documents without a purpose
    purpose: str
    issued: int
    share_percent: float | None


class IssuancesByPurposePublic(SQLModel):
    period: PeriodInfo
    data: list[PurposeRow]
    total_issued: int


class ExpiringPublic(SQLModel):
    data: list[ExpiringItem]
    count: int


class AccountActivityRow(SQLModel):
    user_id: uuid.UUID
    email: str
    full_name: str | None
    role: str
    is_active: bool
    documents_issued: int
    records_changed: int  # resident create/update/archive/restore/photo audit rows
    last_activity: datetime | None  # latest audit row in the period


class AccountActivityPublic(SQLModel):
    period: PeriodInfo
    data: list[AccountActivityRow]


class SectorCount(SQLModel):
    sector_id: int
    name: str
    residents: int


class IdStatusCounts(SQLModel):
    valid: int
    expiring_soon: int
    expired: int
    total: int  # residents whose latest issued card is counted


class RecordsOverview(SQLModel):
    residents_active: int
    residents_archived: int
    residents_by_sector: list[SectorCount]  # active residents only
    ids_by_status: IdStatusCounts


class UtilizationMonthRow(SQLModel):
    """One calendar month of the Utilization Report (counts only)."""

    month: str  # "YYYY-MM"
    month_start: date
    month_end: date  # inclusive; clipped to the report period and to today
    clients_served: int
    documents_issued: int


class UtilizationReportPublic(SQLModel):
    """The Utilization Report in Management Reports: clients served and documents
    issued per month of the chosen period. ``total_clients`` counts each resident
    once for the whole period, so it is not the sum of the monthly rows."""

    period: PeriodInfo
    data: list[UtilizationMonthRow]
    total_clients: int
    total_documents: int


class UtilizationCertificate(SQLModel):
    """The figures the monthly Certificate of Utilization fills in itself.

    Counts only: no resident is named. ``clients_served`` is the number of
    different residents who received at least one issued document in the month
    (a resident who came three times counts once)."""

    month: str  # "YYYY-MM"
    month_start: date
    month_end: date  # inclusive; today for the current month
    clients_served: int
    documents_issued: int
    punong_barangay: str | None  # name of the current Punong Barangay, if any


class UtilizationPrintedRequest(SQLModel):
    """What the browser reports just before it opens the print dialog."""

    month: Annotated[str, StringConstraints(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")]
