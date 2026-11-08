"""Masterlist import staging (D-19).

An upload is parsed into ``import_rows`` first. Nothing reaches ``residents``
until the System Administrator confirms the batch. Staged personal data (the raw
and mapped row values) is wiped when the batch is committed, cancelled or
expires; only counts, row numbers and error reasons stay behind.
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Integer,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel

from app.models import get_datetime_utc

BATCH_STATUSES = ("uploaded", "mapped", "committed", "cancelled", "expired", "failed")
FILE_TYPES = ("csv", "xlsx")
DATE_ORDERS = ("ymd", "mdy", "dmy")
DUPLICATE_ACTIONS = ("skip", "update")
CLASSIFICATIONS = ("new", "duplicate", "error")
OUTCOMES = ("created", "updated", "skipped", "failed")


def _in_list(column: str, values: tuple[str, ...]) -> str:
    quoted = ", ".join(f"'{v}'" for v in values)
    return f"{column} IN ({quoted})"


class ImportBatch(SQLModel, table=True):
    __tablename__ = "import_batches"
    __table_args__ = (
        CheckConstraint(
            _in_list("status", BATCH_STATUSES), name="ck_import_batches_status"
        ),
        CheckConstraint(
            _in_list("file_type", FILE_TYPES), name="ck_import_batches_file_type"
        ),
        CheckConstraint(
            _in_list("date_order", DATE_ORDERS), name="ck_import_batches_date_order"
        ),
        CheckConstraint(
            _in_list("duplicate_action", DUPLICATE_ACTIONS),
            name="ck_import_batches_duplicate_action",
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            server_default=text("now()"),
            index=True,
        ),
    )
    created_by: uuid.UUID | None = Field(
        default=None, foreign_key="user.id", ondelete="SET NULL"
    )
    created_by_email: str | None = Field(default=None, max_length=255)
    file_name: str = Field(max_length=255)
    file_type: str = Field(max_length=10)
    status: str = Field(default="uploaded", max_length=10)
    total_rows: int = Field(default=0)
    # Column titles from the first row of the file, in order.
    headers: list[str] = Field(
        default_factory=list, sa_column=Column(JSONB, nullable=False)
    )
    # Column title -> resident field name. Null until the admin maps the columns.
    mapping: dict[str, str] | None = Field(
        default=None, sa_column=Column(JSONB, nullable=True)
    )
    date_order: str = Field(default="ymd", max_length=3)
    duplicate_action: str = Field(default="skip", max_length=10)
    # {"new": n, "duplicate": n, "error": n} from the last check.
    counts: dict[str, int] | None = Field(
        default=None, sa_column=Column(JSONB, nullable=True)
    )
    # {"created": n, "updated": n, "skipped": n, "failed": n} after commit.
    result: dict[str, int] | None = Field(
        default=None, sa_column=Column(JSONB, nullable=True)
    )
    committed_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )


class ImportRow(SQLModel, table=True):
    __tablename__ = "import_rows"
    __table_args__ = (
        CheckConstraint(
            "classification IS NULL OR " + _in_list("classification", CLASSIFICATIONS),
            name="ck_import_rows_classification",
        ),
        CheckConstraint(
            "outcome IS NULL OR " + _in_list("outcome", OUTCOMES),
            name="ck_import_rows_outcome",
        ),
        Index("uq_import_rows_batch_row", "batch_id", "row_number", unique=True),
    )

    id: int | None = Field(
        default=None,
        sa_column=Column(BigInteger, Identity(), primary_key=True),
    )
    batch_id: uuid.UUID = Field(
        sa_column=Column(
            ForeignKey("import_batches.id", ondelete="CASCADE"), nullable=False
        )
    )
    # 1-based position in the file, counting the header row as row 1.
    row_number: int = Field(sa_column=Column(Integer, nullable=False))
    # Personal data: wiped when the batch ends.
    raw: dict[str, Any] | None = Field(default=None, sa_column=Column(JSONB))
    mapped: dict[str, Any] | None = Field(default=None, sa_column=Column(JSONB))
    # [{"field": ..., "message": ...}]; messages never contain cell values.
    errors: list[dict[str, str]] | None = Field(default=None, sa_column=Column(JSONB))
    classification: str | None = Field(default=None, max_length=10)
    duplicate_resident_id: uuid.UUID | None = None
    duplicate_scope: str | None = Field(default=None, max_length=10)  # existing | file
    outcome: str | None = Field(default=None, max_length=10)
