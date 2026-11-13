"""Issuance core: the document record, its shared parts and per-type details.

Design source: docs/09-Issuance-Form-Data-Map.md. Implemented here: Barangay
Clearance, Franchise Clearance, Utility (Electrical/Water) Clearance,
Certificate of Indigency, Residency, Assistance, Marginalized Sector,
First-Time Jobseeker and Barangay ID.

Rules that shape the tables:
- An issued row is never edited or deleted. A correction is a new row that
  points back with ``corrects_issuance_id``; voiding sets ``status = 'voided'``.
- Nothing cascades down from a resident, document type, official or account to
  an issued document (``RESTRICT``). Only the *detail* rows of an issuance
  cascade, so a discarded draft takes its own parts with it.
- ``reference_no`` comes from the ``issuance_reference_seq`` sequence, so
  deleting a draft can never repeat a number.
"""

import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import StringConstraints, field_validator, model_validator
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Index,
    SmallInteger,
    text,
)
from sqlmodel import Field, SQLModel

from app.core.dates import today_manila
from app.models import get_datetime_utc

STATUSES = ("draft", "issued", "voided")
CONNECTION_TYPES = ("new", "reconnection")
CLASSIFICATIONS = ("residential", "commercial")
FREE_RECEIPT = "FOC"
DEFAULT_PLACE_OF_ISSUE = "Los Baños, Laguna"
DEFAULT_CLEARANCE_REMARKS = "NO DEROGATORY RECORD ON FILE"

# Document types this patch can issue, with the parts each one needs.
# Keys are ``document_types.code``. Resident fields are checked when issuing
# (docs/09, "Values saved back to residents").
ADDRESS_FIELDS = ("house_number", "street_id", "purok")
# ``sections`` are required to issue; ``optional_sections`` may be saved too.
# ``resident_fields`` must be filled on the resident record to issue. The pseudo
# field ``resident_since`` means "residing since" year or "since birth".
DOCUMENT_RULES: dict[str, dict[str, tuple[str, ...]]] = {
    "BARANGAY_CLEARANCE": {
        "sections": ("identification", "payment"),
        "resident_fields": (
            "birthdate",
            "birth_place",
            "civil_status",
            *ADDRESS_FIELDS,
        ),
    },
    "FRANCHISE_CLEARANCE": {
        "sections": ("identification", "payment", "franchise"),
        "resident_fields": ADDRESS_FIELDS,
    },
    "UTILITY_CLEARANCE": {
        "sections": ("identification", "payment", "utility"),
        "resident_fields": ADDRESS_FIELDS,
    },
    "INDIGENCY": {
        "sections": ("indigency", "sectors"),
        "resident_fields": ("birthdate", *ADDRESS_FIELDS),
    },
    "RESIDENCY": {
        "sections": (),
        "optional_sections": ("identification", "payment"),
        "resident_fields": ("resident_since", *ADDRESS_FIELDS),
    },
    "ASSISTANCE": {
        "sections": ("assistance", "sectors"),
        "resident_fields": ("resident_since", *ADDRESS_FIELDS),
    },
    "MARGINALIZED_SECTOR": {
        "sections": ("marginalized", "sectors"),
        "resident_fields": ADDRESS_FIELDS,
    },
    "FIRST_TIME_JOBSEEKER": {
        "sections": ("jobseeker",),
        "resident_fields": (
            "birthdate",
            "civil_status",
            "sex",
            "resident_since",
            *ADDRESS_FIELDS,
        ),
    },
    "BARANGAY_ID": {
        "sections": ("barangay_id",),
        # ``photo`` means a row in resident_photos (docs/09, "Values saved back").
        "resident_fields": (
            "birthdate",
            "birth_place",
            "civil_status",
            "sex",
            *ADDRESS_FIELDS,
            "emergency_contact_name",
            "emergency_contact_address",
            "emergency_contact_phone",
            "photo",
        ),
    },
}
# (minimum, maximum) number of sectors on the document (docs/09).
SECTOR_LIMITS: dict[str, tuple[int, int]] = {
    "INDIGENCY": (1, 2),
    "ASSISTANCE": (1, 1),
    "MARGINALIZED_SECTOR": (1, 1),
}
ASSISTANCE_TYPES = ("financial", "medical", "burial")
ID_TRANSACTION_TYPES = ("new", "renewal", "replacement")
# An ID counts as "expiring soon" this many days before ``valid_until``. The
# real threshold is open (D-21); change it here only.
ID_EXPIRING_SOON_DAYS = 30
# Same idea for Barangay Clearances (reports and dashboard); also open (D-21).
CLEARANCE_EXPIRING_SOON_DAYS = 30
RESTRICTED = "[restricted]"  # shown instead of the health condition (decision 3)
ALL_SECTIONS = (
    "identification",
    "payment",
    "sectors",
    "utility",
    "indigency",
    "franchise",
    "marginalized",
    "assistance",
    "jobseeker",
    "barangay_id",
)


def _in_list(column: str, values: tuple[str, ...]) -> str:
    quoted = ", ".join(f"'{v}'" for v in values)
    return f"{column} IN ({quoted})"


def _timestamp() -> Column[datetime]:
    return Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))


# --- Tables -----------------------------------------------------------------


class Tricycle(SQLModel, table=True):
    """A tricycle is stored once and reused by every franchise issued for it."""

    __tablename__ = "tricycles"

    id: int | None = Field(default=None, primary_key=True)
    association_id: int = Field(
        foreign_key="tricycle_associations.id", ondelete="RESTRICT"
    )
    make: str = Field(max_length=100)
    body_type: str = Field(max_length=100)
    motor_number: str = Field(max_length=100, unique=True)
    color: str = Field(max_length=50)
    plate_number: str = Field(max_length=30, unique=True)


class Issuance(SQLModel, table=True):
    __tablename__ = "issuances"
    __table_args__ = (
        CheckConstraint(_in_list("status", STATUSES), name="ck_issuances_status"),
        CheckConstraint(
            "status = 'draft' OR (reference_no IS NOT NULL AND issued_at IS NOT NULL "
            "AND issued_by_user_id IS NOT NULL)",
            name="ck_issuances_issued_fields",
        ),
        CheckConstraint(
            "(status = 'voided') = (void_reason IS NOT NULL)",
            name="ck_issuances_void_reason",
        ),
        CheckConstraint(
            "(corrects_issuance_id IS NULL) = (correction_reason IS NULL)",
            name="ck_issuances_correction_reason",
        ),
        # Archiving hides a record; it never changes ``status``. The account may
        # later be deleted (SET NULL), so only time, reason and the status the
        # record had are required.
        CheckConstraint(
            "(archived_at IS NULL AND archive_reason IS NULL "
            "AND original_status IS NULL AND archived_by_user_id IS NULL) OR "
            "(archived_at IS NOT NULL AND archive_reason IS NOT NULL "
            "AND original_status IN ('issued', 'voided') "
            "AND original_status = status)",
            name="ck_issuances_archive_fields",
        ),
        Index(
            "ix_issuances_resident_type_status",
            "resident_id",
            "document_type_id",
            "status",
        ),
        Index("ix_issuances_issue_date", "issue_date"),
        Index(
            "ix_issuances_archived_at",
            "archived_at",
            postgresql_where=text("archived_at IS NOT NULL"),
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    reference_no: str | None = Field(default=None, max_length=30, unique=True)
    document_type_id: int = Field(foreign_key="document_types.id", ondelete="RESTRICT")
    resident_id: uuid.UUID = Field(foreign_key="residents.id", ondelete="RESTRICT")
    issue_date: date
    purpose_id: int | None = Field(
        default=None, foreign_key="issuance_purposes.id", ondelete="RESTRICT"
    )
    remarks: str | None = Field(default=None, max_length=500)
    signatory_official_id: uuid.UUID | None = Field(
        default=None, foreign_key="officials.id", ondelete="RESTRICT"
    )
    status: str = Field(
        default="draft", max_length=10, sa_column_kwargs={"server_default": "draft"}
    )
    issued_by_user_id: uuid.UUID | None = Field(
        default=None, foreign_key="user.id", ondelete="RESTRICT"
    )
    issued_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True))
    )
    expires_on: date | None = None
    corrects_issuance_id: uuid.UUID | None = Field(
        default=None, foreign_key="issuances.id", ondelete="RESTRICT"
    )
    correction_reason: str | None = None
    void_reason: str | None = None
    archived_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True))
    )
    archived_by_user_id: uuid.UUID | None = Field(
        default=None, foreign_key="user.id", ondelete="SET NULL"
    )
    archive_reason: str | None = None
    original_status: str | None = Field(default=None, max_length=10)
    created_by_user_id: uuid.UUID | None = Field(
        default=None, foreign_key="user.id", ondelete="SET NULL"
    )
    created_at: datetime = Field(
        default_factory=get_datetime_utc, sa_column=_timestamp()
    )
    updated_at: datetime = Field(
        default_factory=get_datetime_utc, sa_column=_timestamp()
    )


class IssuanceIdentification(SQLModel, table=True):
    """The valid ID the applicant presented (Clearance, Franchise, Utility)."""

    __tablename__ = "issuance_identification"

    issuance_id: uuid.UUID = Field(
        foreign_key="issuances.id", primary_key=True, ondelete="CASCADE"
    )
    id_type_id: int = Field(foreign_key="id_types.id", ondelete="RESTRICT")
    id_number: str = Field(max_length=100)
    place_of_issue: str = Field(max_length=150)
    date_of_issue: date


class IssuancePayment(SQLModel, table=True):
    __tablename__ = "issuance_payments"
    __table_args__ = (
        CheckConstraint(
            f"NOT is_free OR official_receipt_no = '{FREE_RECEIPT}'",
            name="ck_issuance_payments_free_receipt",
        ),
    )

    issuance_id: uuid.UUID = Field(
        foreign_key="issuances.id", primary_key=True, ondelete="CASCADE"
    )
    is_free: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, server_default=text("false")),
    )
    official_receipt_no: str = Field(max_length=50)
    date_of_payment: date
    certified_by: str | None = Field(default=None, max_length=50)


class IssuanceSector(SQLModel, table=True):
    __tablename__ = "issuance_sectors"

    issuance_id: uuid.UUID = Field(
        foreign_key="issuances.id", primary_key=True, ondelete="CASCADE"
    )
    sector_id: int = Field(
        foreign_key="sectors.id", primary_key=True, ondelete="RESTRICT"
    )
    sector_id_number: str | None = Field(default=None, max_length=50)


class IssuanceResidentSnapshot(SQLModel, table=True):
    """The resident's printed values, copied at the moment of issue."""

    __tablename__ = "issuance_resident_snapshot"

    issuance_id: uuid.UUID = Field(
        foreign_key="issuances.id", primary_key=True, ondelete="CASCADE"
    )
    full_name: str = Field(max_length=400)
    address_line: str | None = Field(default=None, max_length=400)
    birth_date: date | None = None
    birth_place: str | None = Field(default=None, max_length=255)
    sex: str | None = Field(default=None, max_length=10)
    civil_status: str | None = Field(default=None, max_length=30)
    resident_since_year: int | None = Field(
        default=None, sa_column=Column(SmallInteger)
    )
    resident_since_birth: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, server_default=text("false")),
    )
    # Printed on the back of the Barangay ID only; empty for other documents.
    emergency_contact_name: str | None = Field(default=None, max_length=255)
    emergency_contact_address: str | None = Field(default=None, max_length=500)
    emergency_contact_phone: str | None = Field(default=None, max_length=30)


class IssuanceUtility(SQLModel, table=True):
    __tablename__ = "issuance_utility"
    __table_args__ = (
        CheckConstraint(
            "has_electric OR has_water", name="ck_issuance_utility_service"
        ),
        CheckConstraint(
            _in_list("connection_type", CONNECTION_TYPES),
            name="ck_issuance_utility_connection",
        ),
        CheckConstraint(
            _in_list("classification", CLASSIFICATIONS),
            name="ck_issuance_utility_classification",
        ),
    )

    issuance_id: uuid.UUID = Field(
        foreign_key="issuances.id", primary_key=True, ondelete="CASCADE"
    )
    has_electric: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, server_default=text("false")),
    )
    has_water: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, server_default=text("false")),
    )
    connection_type: str = Field(max_length=20)
    classification: str = Field(max_length=20)
    location: str = Field(max_length=255)


class IssuanceIndigency(SQLModel, table=True):
    __tablename__ = "issuance_indigency"

    issuance_id: uuid.UUID = Field(
        foreign_key="issuances.id", primary_key=True, ondelete="CASCADE"
    )
    addressed_to_office: str = Field(max_length=200)
    requested_by: str | None = Field(default=None, max_length=255)


class IssuanceFranchise(SQLModel, table=True):
    __tablename__ = "issuance_franchise"

    issuance_id: uuid.UUID = Field(
        foreign_key="issuances.id", primary_key=True, ondelete="CASCADE"
    )
    tricycle_id: int = Field(foreign_key="tricycles.id", ondelete="RESTRICT")


class IssuanceMarginalizedSector(SQLModel, table=True):
    """Sensitive: the health condition is masked everywhere except the audited
    single-issuance read (decision 3). Never log or export it."""

    __tablename__ = "issuance_marginalized_sector"

    issuance_id: uuid.UUID = Field(
        foreign_key="issuances.id", primary_key=True, ondelete="CASCADE"
    )
    health_condition: str = Field(max_length=500)


class IssuanceAssistance(SQLModel, table=True):
    __tablename__ = "issuance_assistance"
    __table_args__ = (
        CheckConstraint(
            _in_list("assistance_type", ASSISTANCE_TYPES),
            name="ck_issuance_assistance_type",
        ),
        CheckConstraint(
            "for_self OR (beneficiary_name IS NOT NULL "
            "AND beneficiary_relationship IS NOT NULL)",
            name="ck_issuance_assistance_beneficiary",
        ),
    )

    issuance_id: uuid.UUID = Field(
        foreign_key="issuances.id", primary_key=True, ondelete="CASCADE"
    )
    assistance_type: str = Field(max_length=20)
    for_self: bool = Field(
        default=True,
        sa_column=Column(Boolean, nullable=False, server_default=text("true")),
    )
    beneficiary_name: str | None = Field(default=None, max_length=255)
    beneficiary_relationship: str | None = Field(default=None, max_length=100)


class IssuanceFirstTimeJobseeker(SQLModel, table=True):
    """One issued row per resident is enforced in the API (the issue route locks
    the resident), because a partial index cannot name a seeded document type."""

    __tablename__ = "issuance_first_time_jobseeker"

    issuance_id: uuid.UUID = Field(
        foreign_key="issuances.id", primary_key=True, ondelete="CASCADE"
    )
    educational_attainment: str = Field(max_length=150)
    course: str = Field(max_length=150)
    is_jobstart_beneficiary: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, server_default=text("false")),
    )
    witness_official_id: uuid.UUID | None = Field(
        default=None, foreign_key="officials.id", ondelete="RESTRICT"
    )


class IssuanceBarangayId(SQLModel, table=True):
    """One row per ID card (new, renewal or replacement), so history is kept.

    ``id_number`` may stay empty on a draft; it is fixed when the card is
    issued and is then copied to ``residents.id_number`` (docs/09, decision 2).
    """

    __tablename__ = "issuance_barangay_id"
    __table_args__ = (
        CheckConstraint(
            _in_list("transaction_type", ID_TRANSACTION_TYPES),
            name="ck_issuance_barangay_id_transaction",
        ),
        Index("ix_issuance_barangay_id_number", "id_number"),
    )

    issuance_id: uuid.UUID = Field(
        foreign_key="issuances.id", primary_key=True, ondelete="CASCADE"
    )
    transaction_type: str = Field(max_length=20)
    valid_until: date
    id_number: str | None = Field(default=None, max_length=50)


class IdNumberSeries(SQLModel, table=True):
    """The Barangay ID numbering series: one row, set once by an administrator.

    Off by default, so staff type the number as before. When on, the next number
    is reserved inside the transaction that issues a new card (the row is
    locked), so two clerks can never receive the same number.
    """

    __tablename__ = "id_number_series"
    __table_args__ = (
        CheckConstraint("id = 1", name="ck_id_number_series_single_row"),
        CheckConstraint(
            "digit_width >= 0 AND digit_width <= 12", name="ck_id_number_series_width"
        ),
        CheckConstraint("next_number >= 1", name="ck_id_number_series_next"),
        CheckConstraint(
            "NOT restart_yearly OR include_year", name="ck_id_number_series_restart"
        ),
    )

    id: int = Field(default=1, primary_key=True)
    prefix: str = Field(default="", max_length=30)
    include_year: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, server_default=text("false")),
    )
    digit_width: int = Field(
        default=0, sa_column=Column(SmallInteger, nullable=False, server_default="0")
    )
    restart_yearly: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, server_default=text("false")),
    )
    next_number: int = Field(default=1)
    # Year the counter belongs to; used only when numbering restarts each year.
    counter_year: int | None = Field(default=None)
    enabled: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, server_default=text("false")),
    )
    updated_at: datetime = Field(
        default_factory=get_datetime_utc, sa_column=_timestamp()
    )
    updated_by_user_id: uuid.UUID | None = Field(
        default=None, foreign_key="user.id", ondelete="SET NULL"
    )


def format_id_number(
    series: IdNumberSeries, number: int, year: int | None = None
) -> str:
    """Text of one number: prefix, optional year, then the running number."""
    digits = (
        str(number).zfill(series.digit_width) if series.digit_width else str(number)
    )
    middle = f"{year}-" if series.include_year and year is not None else ""
    return f"{series.prefix}{middle}{digits}"


def series_preview(series: IdNumberSeries, year: int) -> str:
    """The number the next new card would receive (taken numbers are skipped
    only when it is really handed out)."""
    number = (
        1
        if series.restart_yearly and series.counter_year != year
        else series.next_number
    )
    return format_id_number(series, number, year)


# --- API shapes -------------------------------------------------------------

Req = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)
]


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


class IdentificationIn(SQLModel):
    id_type_id: int
    id_number: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)
    ]
    place_of_issue: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=150)
    ] = DEFAULT_PLACE_OF_ISSUE
    date_of_issue: date | None = None  # default: today (Manila)

    @field_validator("date_of_issue")
    @classmethod
    def _not_future(cls, value: date | None) -> date | None:
        if value is not None and value > today_manila():
            raise ValueError("date_of_issue cannot be in the future")
        return value


class PaymentIn(SQLModel):
    is_free: bool = False
    official_receipt_no: str | None = Field(default=None, max_length=50)
    date_of_payment: date | None = None  # default: today (Manila)
    certified_by: str | None = Field(default=None, max_length=50)

    @field_validator("official_receipt_no", "certified_by")
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        return _clean(value)

    @field_validator("date_of_payment")
    @classmethod
    def _not_future(cls, value: date | None) -> date | None:
        if value is not None and value > today_manila():
            raise ValueError("date_of_payment cannot be in the future")
        return value

    @model_validator(mode="after")
    def _receipt_rule(self) -> PaymentIn:
        if self.is_free:
            if self.official_receipt_no not in (None, FREE_RECEIPT):
                raise ValueError(f"a free document uses receipt number {FREE_RECEIPT}")
        else:
            if self.official_receipt_no is None:
                raise ValueError(
                    "official_receipt_no is required unless free of charge"
                )
            if self.official_receipt_no.upper() == FREE_RECEIPT:
                raise ValueError(f"{FREE_RECEIPT} is only for documents free of charge")
        return self


class SectorIn(SQLModel):
    sector_id: int
    sector_id_number: str | None = Field(default=None, max_length=50)

    @field_validator("sector_id_number")
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        return _clean(value)


class UtilityIn(SQLModel):
    has_electric: bool = False
    has_water: bool = False
    connection_type: Literal["new", "reconnection"]
    classification: Literal["residential", "commercial"]
    location: Req

    @model_validator(mode="after")
    def _one_service(self) -> UtilityIn:
        if not (self.has_electric or self.has_water):
            raise ValueError("choose at least one service (electric or water)")
        return self


class IndigencyIn(SQLModel):
    addressed_to_office: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)
    ]
    requested_by: str | None = Field(default=None, max_length=255)

    @field_validator("requested_by")
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        return _clean(value)


class FranchiseIn(SQLModel):
    association_id: int
    make: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)
    ]
    body_type: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)
    ]
    motor_number: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)
    ]
    color: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)
    ]
    plate_number: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=30)
    ]


class MarginalizedIn(SQLModel):
    health_condition: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)
    ]


class AssistanceIn(SQLModel):
    assistance_type: Literal["financial", "medical", "burial"]
    for_self: bool = True
    beneficiary_name: str | None = Field(default=None, max_length=255)
    beneficiary_relationship: str | None = Field(default=None, max_length=100)

    @field_validator("beneficiary_name", "beneficiary_relationship")
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        return _clean(value)

    @model_validator(mode="after")
    def _beneficiary_rule(self) -> AssistanceIn:
        if self.for_self:
            # The form hides these when the resident asks for themselves.
            self.beneficiary_name = None
            self.beneficiary_relationship = None
        elif not (self.beneficiary_name and self.beneficiary_relationship):
            raise ValueError(
                "beneficiary_name and beneficiary_relationship are required "
                "when the assistance is not for the resident"
            )
        return self


class JobseekerIn(SQLModel):
    educational_attainment: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=150)
    ]
    course: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=150)
    ] = "N/A"
    is_jobstart_beneficiary: bool = False
    witness_official_id: uuid.UUID | None = None


class BarangayIdIn(SQLModel):
    transaction_type: Literal["new", "renewal", "replacement"]
    valid_until: date
    id_number: str | None = Field(default=None, max_length=50)

    @field_validator("id_number")
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        return _clean(value)


class IssuanceCreate(SQLModel):
    document_type_id: int
    resident_id: uuid.UUID
    issue_date: date | None = None  # default: today (Manila)
    purpose_id: int | None = None
    remarks: str | None = Field(default=None, max_length=500)
    signatory_official_id: uuid.UUID | None = None
    identification: IdentificationIn | None = None
    payment: PaymentIn | None = None
    sectors: list[SectorIn] | None = Field(default=None, max_length=2)
    utility: UtilityIn | None = None
    indigency: IndigencyIn | None = None
    franchise: FranchiseIn | None = None
    marginalized: MarginalizedIn | None = None
    assistance: AssistanceIn | None = None
    jobseeker: JobseekerIn | None = None
    barangay_id: BarangayIdIn | None = None

    @field_validator("issue_date")
    @classmethod
    def _not_future(cls, value: date | None) -> date | None:
        if value is not None and value > today_manila():
            raise ValueError("issue_date cannot be in the future")
        return value

    @field_validator("remarks")
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        return _clean(value)


class IssuanceUpdate(SQLModel):
    """Only the fields sent change. A section sent as ``null`` is removed.

    The document type and the resident cannot change: start a new draft.
    """

    issue_date: date | None = None
    purpose_id: int | None = None
    remarks: str | None = Field(default=None, max_length=500)
    signatory_official_id: uuid.UUID | None = None
    identification: IdentificationIn | None = None
    payment: PaymentIn | None = None
    sectors: list[SectorIn] | None = Field(default=None, max_length=2)
    utility: UtilityIn | None = None
    indigency: IndigencyIn | None = None
    franchise: FranchiseIn | None = None
    marginalized: MarginalizedIn | None = None
    assistance: AssistanceIn | None = None
    jobseeker: JobseekerIn | None = None
    barangay_id: BarangayIdIn | None = None

    @field_validator("issue_date")
    @classmethod
    def _not_future(cls, value: date | None) -> date | None:
        if value is not None and value > today_manila():
            raise ValueError("issue_date cannot be in the future")
        return value

    @field_validator("remarks")
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        return _clean(value)


class IssueRequest(SQLModel):
    """Optional body of ``POST /issuances/{id}/issue``."""

    purpose_name: str | None = Field(default=None, max_length=150)
    confirm_duplicate: bool = Field(
        default=False,
        description=(
            "Set to true to issue even though the same resident already has "
            "the same document dated the same day. The earlier one stays valid."
        ),
    )


class ReasonRequest(SQLModel):
    reason: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=3, max_length=500)
    ]


class PrintedRequest(SQLModel):
    """What the browser reports just before it opens the print dialog."""

    mode: Literal["data", "form"]


class IdentificationPublic(SQLModel):
    id_type_id: int
    id_number: str
    place_of_issue: str
    date_of_issue: date


class PaymentPublic(SQLModel):
    is_free: bool
    official_receipt_no: str
    date_of_payment: date
    certified_by: str | None


class SectorPublic(SQLModel):
    sector_id: int
    sector_id_number: str | None


class UtilityPublic(SQLModel):
    has_electric: bool
    has_water: bool
    connection_type: str
    classification: str
    location: str


class IndigencyPublic(SQLModel):
    addressed_to_office: str
    requested_by: str | None


class FranchisePublic(SQLModel):
    tricycle_id: int
    association_id: int
    make: str
    body_type: str
    motor_number: str
    color: str
    plate_number: str


class MarginalizedPublic(SQLModel):
    health_condition: str  # "[restricted]" except on the audited single read


class AssistancePublic(SQLModel):
    assistance_type: str
    for_self: bool
    beneficiary_name: str | None
    beneficiary_relationship: str | None


class JobseekerPublic(SQLModel):
    educational_attainment: str
    course: str
    is_jobstart_beneficiary: bool
    witness_official_id: uuid.UUID | None


class BarangayIdPublic(SQLModel):
    transaction_type: str
    valid_until: date
    id_number: str | None


class SnapshotPublic(SQLModel):
    full_name: str
    address_line: str | None
    birth_date: date | None
    birth_place: str | None
    sex: str | None
    civil_status: str | None
    resident_since_year: int | None
    resident_since_birth: bool
    emergency_contact_name: str | None = None
    emergency_contact_address: str | None = None
    emergency_contact_phone: str | None = None


class IssuanceListItem(SQLModel):
    id: uuid.UUID
    reference_no: str | None
    status: str
    document_type_id: int
    document_type_code: str
    resident_id: uuid.UUID
    resident_name: str
    issue_date: date
    purpose_id: int | None
    expires_on: date | None
    issued_at: datetime | None
    corrects_issuance_id: uuid.UUID | None
    created_at: datetime
    # Filled only while the record is archived.
    archived_at: datetime | None = None
    archived_by_name: str | None = None
    archive_reason: str | None = None
    original_status: str | None = None


class IssuancePublic(IssuanceListItem):
    remarks: str | None
    signatory_official_id: uuid.UUID | None
    issued_by_user_id: uuid.UUID | None
    correction_reason: str | None
    void_reason: str | None
    updated_at: datetime
    identification: IdentificationPublic | None = None
    payment: PaymentPublic | None = None
    sectors: list[SectorPublic] = Field(default_factory=list)
    utility: UtilityPublic | None = None
    indigency: IndigencyPublic | None = None
    franchise: FranchisePublic | None = None
    marginalized: MarginalizedPublic | None = None
    assistance: AssistancePublic | None = None
    jobseeker: JobseekerPublic | None = None
    barangay_id: BarangayIdPublic | None = None
    snapshot: SnapshotPublic | None = None


class IssuancesPublic(SQLModel):
    data: list[IssuanceListItem]
    count: int


class BarangayIdListItem(SQLModel):
    """The latest issued ID card of one resident (Records Management tab)."""

    issuance_id: uuid.UUID
    reference_no: str
    resident_id: uuid.UUID
    resident_name: str
    resident_status: str
    id_number: str
    transaction_type: str
    issue_date: date
    valid_until: date
    status: Literal["valid", "expiring_soon", "expired"]


class BarangayIdsPublic(SQLModel):
    data: list[BarangayIdListItem]
    count: int


class IdSeriesIn(SQLModel):
    prefix: Annotated[str, StringConstraints(strip_whitespace=True, max_length=30)] = ""
    include_year: bool = False
    digit_width: int = Field(default=0, ge=0, le=12)
    restart_yearly: bool = False
    next_number: int = Field(ge=1, le=999_999_999)
    enabled: bool = False

    @model_validator(mode="after")
    def _restart_needs_year(self) -> IdSeriesIn:
        if self.restart_yearly and not self.include_year:
            raise ValueError("Restarting each year needs the year in the number")
        return self


class IdSeriesPublic(SQLModel):
    prefix: str
    include_year: bool
    digit_width: int
    restart_yearly: bool
    next_number: int
    enabled: bool
    preview: str  # the number the next new card would receive
    updated_at: datetime | None = None
    updated_by_name: str | None = None


class IdSeriesStatus(SQLModel):
    """What the issue form needs: is numbering automatic, and what comes next."""

    enabled: bool
    preview: str | None = None
