"""Foundation tables: lookups, officials and the append-only audit log.

Design source: docs/09-Issuance-Form-Data-Map.md. Resident and issuance tables
come in later migrations and will reference these.
"""

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Column,
    DateTime,
    Identity,
    Index,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel

from app.models import get_datetime_utc


class DocumentType(SQLModel, table=True):
    """The nine document kinds. Mirrors frontend ``documentConfig.ts``."""

    __tablename__ = "document_types"
    __table_args__ = (
        CheckConstraint(
            "category IN ('clearance', 'certification', 'id')",
            name="ck_document_types_category",
        ),
        CheckConstraint(
            "print_mode IN ('overlay', 'full_page')",
            name="ck_document_types_print_mode",
        ),
        CheckConstraint(
            "validity_months IS NULL OR validity_months > 0",
            name="ck_document_types_validity_positive",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    code: str = Field(max_length=40, unique=True, index=True)
    name: str = Field(max_length=120)
    category: str = Field(max_length=20)
    print_mode: str = Field(max_length=20)
    validity_months: int | None = Field(default=None)
    one_per_resident: bool = Field(default=False)
    signatory_default_position: str | None = Field(default=None, max_length=100)


class Sector(SQLModel, table=True):
    __tablename__ = "sectors"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=100, unique=True)


class IdType(SQLModel, table=True):
    __tablename__ = "id_types"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=50, unique=True)


class IssuancePurpose(SQLModel, table=True):
    __tablename__ = "issuance_purposes"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=150, unique=True)


class TricycleAssociation(SQLModel, table=True):
    __tablename__ = "tricycle_associations"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=150, unique=True)


class Street(SQLModel, table=True):
    __tablename__ = "streets"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=150, unique=True)


class Official(SQLModel, table=True):
    """Barangay officials who sign or witness documents.

    Mark an official as not current instead of deleting: later issuance rows
    reference this table with ``ON DELETE RESTRICT``.
    """

    __tablename__ = "officials"
    __table_args__ = (
        CheckConstraint(
            "term_end IS NULL OR term_end >= term_start",
            name="ck_officials_term_order",
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    full_name: str = Field(max_length=255)
    position: str = Field(max_length=100)
    term_start: date
    term_end: date | None = None
    is_elected: bool = Field(default=False)
    is_current: bool = Field(default=True)


class AuditLog(SQLModel, table=True):
    """Append-only history. A database trigger blocks UPDATE, DELETE, TRUNCATE.

    The only allowed change is ``actor_user_id`` becoming NULL when the account
    is deleted (``ON DELETE SET NULL``); the actor's email stays in the row.
    """

    __tablename__ = "audit_log"
    __table_args__ = (
        CheckConstraint(
            "outcome IN ('success', 'failed', 'denied')",
            name="ck_audit_log_outcome",
        ),
        Index("ix_audit_log_record", "record_type", "record_id"),
    )

    id: int | None = Field(
        default=None,
        sa_column=Column(BigInteger, Identity(always=True), primary_key=True),
    )
    occurred_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            server_default=text("now()"),
            index=True,
        ),
    )
    actor_user_id: uuid.UUID | None = Field(
        default=None, foreign_key="user.id", ondelete="SET NULL"
    )
    actor_email: str | None = Field(default=None, max_length=255)
    action: str = Field(max_length=80)
    module: str | None = Field(default=None, max_length=60)
    record_type: str | None = Field(default=None, max_length=60)
    record_id: str | None = Field(default=None, max_length=80)
    outcome: str = Field(default="success", max_length=10)
    reason: str | None = None
    details: dict[str, Any] | None = Field(default=None, sa_column=Column(JSONB))
