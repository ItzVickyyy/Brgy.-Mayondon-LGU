"""Database backup history (D-35).

One row per backup attempt. The dump file itself lives in ``BACKUP_DIR``; this
table records who made it, when, how big it is and whether it was checked.
Rows are kept even after retention removes an old file, so the history stays
complete (``file_exists`` on the API tells the two apart).
"""

import uuid
from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, Column, DateTime, Text, text
from sqlmodel import Field, SQLModel

from app.models import get_datetime_utc


class BackupRun(SQLModel, table=True):
    __tablename__ = "backup_runs"
    __table_args__ = (
        CheckConstraint("kind IN ('scheduled', 'manual')", name="ck_backup_runs_kind"),
        CheckConstraint(
            "status IN ('running', 'ok', 'failed')", name="ck_backup_runs_status"
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    started_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            server_default=text("now()"),
            index=True,
        ),
    )
    finished_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    kind: str = Field(max_length=10)
    status: str = Field(default="running", max_length=10)
    file_name: str | None = Field(default=None, max_length=80)
    size_bytes: int | None = Field(
        default=None, sa_column=Column(BigInteger, nullable=True)
    )
    sha256: str | None = Field(default=None, max_length=64)
    verified_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    created_by: uuid.UUID | None = Field(
        default=None, foreign_key="user.id", ondelete="SET NULL"
    )
    # Kept so the history still names the person after the account is removed.
    created_by_email: str | None = Field(default=None, max_length=255)
    error: str | None = Field(default=None, sa_column=Column(Text, nullable=True))


class BackupRunPublic(SQLModel):
    id: uuid.UUID
    started_at: datetime
    finished_at: datetime | None
    kind: str
    status: str
    file_name: str | None
    size_bytes: int | None
    sha256: str | None
    verified_at: datetime | None
    created_by_email: str | None
    error: str | None
    file_exists: bool


class BackupListPublic(SQLModel):
    data: list[BackupRunPublic]
    count: int
    # False when pg_dump is missing or the backup folder cannot be written.
    tool_available: bool
    keep_copies: int


class RestoreRequestPublic(SQLModel):
    """What the administrator must run on the server computer to restore."""

    file_name: str
    command: str
