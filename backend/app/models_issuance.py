"""Issuance core: the document record, its shared parts and per-type details.

Design source: docs/09-Issuance-Form-Data-Map.md. Implemented here: Barangay
Clearance, Franchise Clearance, Utility (Electrical/Water) Clearance and
Certificate of Indigency. The other document types follow in later patches.

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
}
ALL_SECTIONS = (
    "identification",
    "payment",
    "sectors",
    "utility",
    "indigency",
    "franchise",
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
        Index(
            "ix_issuances_resident_type_status",
            "resident_id",
            "document_type_id",
            "status",
        ),
        Index("ix_issuances_issue_date", "issue_date"),
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


class ReasonRequest(SQLModel):
    reason: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=3, max_length=500)
    ]


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


class SnapshotPublic(SQLModel):
    full_name: str
    address_line: str | None
    birth_date: date | None
    birth_place: str | None
    sex: str | None
    civil_status: str | None
    resident_since_year: int | None
    resident_since_birth: bool


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
    snapshot: SnapshotPublic | None = None


class IssuancesPublic(SQLModel):
    data: list[IssuanceListItem]
    count: int
