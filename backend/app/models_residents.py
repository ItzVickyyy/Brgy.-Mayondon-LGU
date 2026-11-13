"""Resident records: the person, their sectors and their photo.

Design source: docs/09-Issuance-Form-Data-Map.md (``residents``,
``resident_sectors``, ``resident_photos``). Residents are archived, never deleted.
"""

import uuid
from datetime import date, datetime
from typing import Annotated, Any, Literal

from pydantic import StringConstraints, field_validator, model_validator
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Index,
    LargeBinary,
    SmallInteger,
    text,
)
from sqlmodel import Field, SQLModel

from app.core.dates import today_manila
from app.models import get_datetime_utc

SUFFIXES = ("Jr.", "Sr.", "II", "III", "IV", "V")
SEXES = ("Male", "Female")
CIVIL_STATUSES = ("Single", "Married", "Legally Separated", "Widow/Widower")
VOTER_STATUSES = ("registered", "unregistered")
RESIDENCY_TYPES = ("regular", "new", "renting")
STATUSES = ("active", "archived")
PHOTO_TYPES = ("image/png", "image/webp")
MAX_PHOTO_BYTES = 307200


def _in_list(column: str, values: tuple[str, ...]) -> str:
    quoted = ", ".join(f"'{v}'" for v in values)
    return f"{column} IN ({quoted})"


def _timestamp(**kwargs: Any) -> Column[datetime]:
    return Column(
        DateTime(timezone=True), nullable=False, server_default=text("now()"), **kwargs
    )


class Resident(SQLModel, table=True):
    __tablename__ = "residents"
    __table_args__ = (
        CheckConstraint(
            "suffix IS NULL OR " + _in_list("suffix", SUFFIXES),
            name="ck_residents_suffix",
        ),
        CheckConstraint(
            "sex IS NULL OR " + _in_list("sex", SEXES), name="ck_residents_sex"
        ),
        CheckConstraint(
            "civil_status IS NULL OR " + _in_list("civil_status", CIVIL_STATUSES),
            name="ck_residents_civil_status",
        ),
        CheckConstraint(
            "voter_registration IS NULL OR "
            + _in_list("voter_registration", VOTER_STATUSES),
            name="ck_residents_voter_registration",
        ),
        CheckConstraint(
            "residency_type IS NULL OR " + _in_list("residency_type", RESIDENCY_TYPES),
            name="ck_residents_residency_type",
        ),
        # The verifying account may later be deleted (ON DELETE SET NULL), so only
        # "an account is named without a date" is refused.
        CheckConstraint(
            "voter_proof_verified_by_user_id IS NULL OR "
            "voter_proof_verified_at IS NOT NULL",
            name="ck_residents_voter_proof",
        ),
        CheckConstraint(_in_list("status", STATUSES), name="ck_residents_status"),
        CheckConstraint("purok IS NULL OR purok > 0", name="ck_residents_purok"),
        CheckConstraint(
            "resident_since_year IS NULL OR resident_since_year BETWEEN 1900 AND 2200",
            name="ck_residents_since_year",
        ),
        CheckConstraint(
            "NOT (resident_since_birth AND resident_since_year IS NOT NULL)",
            name="ck_residents_since_not_both",
        ),
        # The archiving account may later be deleted (ON DELETE SET NULL), so the
        # account link is not required here; reason and time always are.
        CheckConstraint(
            "(status = 'archived' AND archive_reason IS NOT NULL "
            "AND archived_at IS NOT NULL) OR "
            "(status = 'active' AND archive_reason IS NULL "
            "AND archived_at IS NULL AND archived_by_user_id IS NULL)",
            name="ck_residents_archive_fields",
        ),
        Index(
            "ix_residents_name_lower",
            text("lower(last_name)"),
            text("lower(first_name)"),
        ),
        Index("ix_residents_birthdate", "birthdate"),
        Index(
            "uq_residents_id_number",
            "id_number",
            unique=True,
            postgresql_where=text("id_number IS NOT NULL"),
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    first_name: str = Field(max_length=100)
    middle_name: str | None = Field(default=None, max_length=100)
    last_name: str = Field(max_length=100)
    suffix: str | None = Field(default=None, max_length=10)
    birthdate: date | None = None
    birth_place: str | None = Field(default=None, max_length=255)
    sex: str | None = Field(default=None, max_length=10)
    civil_status: str | None = Field(default=None, max_length=30)
    house_number: str | None = Field(default=None, max_length=50)
    street_id: int | None = Field(
        default=None, foreign_key="streets.id", ondelete="RESTRICT"
    )
    purok: int | None = Field(default=None, sa_column=Column(SmallInteger))
    resident_since_year: int | None = Field(
        default=None, sa_column=Column(SmallInteger)
    )
    resident_since_birth: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, server_default=text("false")),
    )
    resident_type: str | None = Field(default=None, max_length=100)  # open: D-48
    id_number: str | None = Field(default=None, max_length=50)
    voter_registration: str | None = Field(default=None, max_length=20)
    # regular / new / renting; empty counts as regular (patch 61).
    residency_type: str | None = Field(default=None, max_length=10)
    # The day staff saw proof of voter registration. Empty = not verified.
    voter_proof_verified_at: date | None = None
    voter_proof_verified_by_user_id: uuid.UUID | None = Field(
        default=None, foreign_key="user.id", ondelete="SET NULL"
    )
    emergency_contact_name: str | None = Field(default=None, max_length=255)
    emergency_contact_address: str | None = Field(default=None, max_length=500)
    emergency_contact_phone: str | None = Field(default=None, max_length=30)
    status: str = Field(
        default="active", max_length=10, sa_column_kwargs={"server_default": "active"}
    )
    archive_reason: str | None = None
    archived_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True))
    )
    archived_by_user_id: uuid.UUID | None = Field(
        default=None, foreign_key="user.id", ondelete="SET NULL"
    )
    created_at: datetime = Field(
        default_factory=get_datetime_utc, sa_column=_timestamp()
    )
    updated_at: datetime = Field(
        default_factory=get_datetime_utc, sa_column=_timestamp()
    )
    created_by_user_id: uuid.UUID | None = Field(
        default=None, foreign_key="user.id", ondelete="SET NULL"
    )
    updated_by_user_id: uuid.UUID | None = Field(
        default=None, foreign_key="user.id", ondelete="SET NULL"
    )


class ResidentSector(SQLModel, table=True):
    __tablename__ = "resident_sectors"

    resident_id: uuid.UUID = Field(
        foreign_key="residents.id", primary_key=True, ondelete="CASCADE"
    )
    sector_id: int = Field(
        foreign_key="sectors.id", primary_key=True, ondelete="RESTRICT"
    )


class ResidentPhoto(SQLModel, table=True):
    """Processed PNG/WebP, at most 300 KB. Kept apart so lists never load bytes."""

    __tablename__ = "resident_photos"
    __table_args__ = (
        CheckConstraint(
            _in_list("content_type", PHOTO_TYPES), name="ck_resident_photos_type"
        ),
        CheckConstraint(
            f"byte_size > 0 AND byte_size <= {MAX_PHOTO_BYTES}",
            name="ck_resident_photos_size",
        ),
    )

    resident_id: uuid.UUID = Field(
        foreign_key="residents.id", primary_key=True, ondelete="CASCADE"
    )
    content: bytes = Field(sa_column=Column(LargeBinary, nullable=False))
    content_type: str = Field(max_length=20)
    byte_size: int
    updated_at: datetime = Field(
        default_factory=get_datetime_utc, sa_column=_timestamp()
    )
    updated_by_user_id: uuid.UUID | None = Field(
        default=None, foreign_key="user.id", ondelete="SET NULL"
    )


# --- API shapes -------------------------------------------------------------

Text100 = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)
]
OptText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]


def build_full_name(resident: Resident) -> str:
    """The one place that builds the display and printed name.

    Format: First Middle Last Suffix. Change it here and lists and prints agree.
    """
    parts = [
        resident.first_name,
        resident.middle_name,
        resident.last_name,
        resident.suffix,
    ]
    return " ".join(p.strip() for p in parts if p and p.strip())


class ResidentFields(SQLModel):
    """Editable fields shared by create and the public shape."""

    first_name: Text100
    middle_name: str | None = Field(default=None, max_length=100)
    last_name: Text100
    suffix: Literal["Jr.", "Sr.", "II", "III", "IV", "V"] | None = None
    birthdate: date | None = None
    birth_place: str | None = Field(default=None, max_length=255)
    sex: Literal["Male", "Female"] | None = None
    civil_status: (
        Literal["Single", "Married", "Legally Separated", "Widow/Widower"] | None
    ) = None
    house_number: str | None = Field(default=None, max_length=50)
    street_id: int | None = None
    purok: int | None = Field(default=None, gt=0, le=32767)
    resident_since_year: int | None = Field(default=None, ge=1900, le=2200)
    resident_since_birth: bool = False
    resident_type: str | None = Field(default=None, max_length=100)
    id_number: str | None = Field(default=None, max_length=50)
    voter_registration: Literal["registered", "unregistered"] | None = None
    residency_type: Literal["regular", "new", "renting"] | None = None
    emergency_contact_name: str | None = Field(default=None, max_length=255)
    emergency_contact_address: str | None = Field(default=None, max_length=500)
    emergency_contact_phone: str | None = Field(default=None, max_length=30)

    @field_validator("birthdate")
    @classmethod
    def _not_future(cls, value: date | None) -> date | None:
        if value is not None and value > today_manila():
            raise ValueError("birthdate cannot be in the future")
        return value

    @field_validator(
        "middle_name",
        "birth_place",
        "house_number",
        "resident_type",
        "id_number",
        "emergency_contact_name",
        "emergency_contact_address",
        "emergency_contact_phone",
    )
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None

    @model_validator(mode="after")
    def _since_not_both(self) -> ResidentFields:
        if self.resident_since_birth and self.resident_since_year is not None:
            raise ValueError(
                "resident_since_year and resident_since_birth cannot both be set"
            )
        return self


class ResidentCreate(ResidentFields):
    sector_ids: list[int] = Field(default_factory=list, max_length=20)


class ResidentUpdate(SQLModel):
    """Every field optional; only the fields sent are changed."""

    first_name: Text100 | None = None
    middle_name: str | None = Field(default=None, max_length=100)
    last_name: Text100 | None = None
    suffix: Literal["Jr.", "Sr.", "II", "III", "IV", "V"] | None = None
    birthdate: date | None = None
    birth_place: str | None = Field(default=None, max_length=255)
    sex: Literal["Male", "Female"] | None = None
    civil_status: (
        Literal["Single", "Married", "Legally Separated", "Widow/Widower"] | None
    ) = None
    house_number: str | None = Field(default=None, max_length=50)
    street_id: int | None = None
    purok: int | None = Field(default=None, gt=0, le=32767)
    resident_since_year: int | None = Field(default=None, ge=1900, le=2200)
    resident_since_birth: bool | None = None
    resident_type: str | None = Field(default=None, max_length=100)
    id_number: str | None = Field(default=None, max_length=50)
    voter_registration: Literal["registered", "unregistered"] | None = None
    residency_type: Literal["regular", "new", "renting"] | None = None
    emergency_contact_name: str | None = Field(default=None, max_length=255)
    emergency_contact_address: str | None = Field(default=None, max_length=500)
    emergency_contact_phone: str | None = Field(default=None, max_length=30)
    sector_ids: list[int] | None = Field(default=None, max_length=20)

    @field_validator("birthdate")
    @classmethod
    def _not_future(cls, value: date | None) -> date | None:
        if value is not None and value > today_manila():
            raise ValueError("birthdate cannot be in the future")
        return value


class ArchiveRequest(SQLModel):
    reason: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=3, max_length=500)
    ]


def id_validity_months(
    residency_type: str | None, voter_proof_verified_at: date | None
) -> Literal[6, 12]:
    """How long the NEXT Barangay ID is normally valid (derived, never stored).

    New or renting residents get 6 months until proof of voter registration is
    verified; everyone else gets 12. An ID already issued is never changed by
    this: the rule only sets the default of a new issuance.
    """
    if residency_type in ("new", "renting") and voter_proof_verified_at is None:
        return 6
    return 12


class VoterProofRequest(SQLModel):
    """Day the proof was seen; the server uses today (Manila) when it is left out."""

    verified_on: date | None = None


class ResidentPublic(ResidentFields):
    id: uuid.UUID
    full_name: str
    age: int | None
    sector_ids: list[int]
    has_photo: bool
    id_status: Literal["none", "valid", "expiring_soon", "expired"]
    id_valid_until: date | None = None
    id_validity_months: Literal[6, 12] = 12
    voter_proof_verified_at: date | None = None
    voter_proof_verified_by_name: str | None = None
    status: str
    archive_reason: str | None
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ResidentsPublic(SQLModel):
    data: list[ResidentPublic]
    count: int


class ResidentSectorCount(SQLModel):
    """One sector and how many active residents belong to it."""

    sector_id: int
    name: str
    active_residents: int


class SectorSummary(SQLModel):
    data: list[ResidentSectorCount]
    residents_with_sector: int
