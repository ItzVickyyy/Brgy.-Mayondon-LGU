"""Response shapes for the dashboard and reports. Counts only: no health
condition and no personal values in any total (decision 3). The expiring lists
name the resident because they are work lists for the office, not totals."""

import uuid
from datetime import date, datetime
from typing import Literal

from sqlmodel import SQLModel


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


class DashboardPublic(SQLModel):
    period: PeriodInfo
    summary: DashboardSummary
    issuances_over_time: list[MonthCount]
    by_document_type: list[DocumentTypeCount]
    total_issued: int  # in the period; equals the sum of by_document_type
    expiring: list[ExpiringItem]  # soonest first, at most 10


class ReportSummary(SQLModel):
    period: PeriodInfo
    documents_issued: int
    records_expiring: int  # expiring soon or already expired, latest record each


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
