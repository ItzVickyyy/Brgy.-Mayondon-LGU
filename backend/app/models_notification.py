"""Read state and response shapes for the notification bell (patch 75).

The bell is fed by the append-only ``audit_log``; nothing here changes it. Only
who has read what is stored, per person:

- ``notification_state``: one row per person, ``read_upto`` = every audit id up
  to and including it counts as read ("mark all as read" moves it forward).
- ``notification_reads``: single items marked as read above that line.
"""

import uuid
from datetime import datetime

from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, text
from sqlmodel import Field, SQLModel

from app.models import get_datetime_utc


class NotificationState(SQLModel, table=True):
    __tablename__ = "notification_state"

    user_id: uuid.UUID = Field(
        sa_column=Column(
            ForeignKey("user.id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        )
    )
    read_upto: int = Field(
        default=0,
        sa_column=Column(
            BigInteger, nullable=False, server_default=text("0"), default=0
        ),
    )
    updated_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_column=Column(
            DateTime(timezone=True), nullable=False, server_default=text("now()")
        ),
    )


class NotificationRead(SQLModel, table=True):
    __tablename__ = "notification_reads"

    user_id: uuid.UUID = Field(
        sa_column=Column(
            ForeignKey("user.id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        )
    )
    audit_id: int = Field(
        sa_column=Column(BigInteger, primary_key=True, nullable=False)
    )
    read_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_column=Column(
            DateTime(timezone=True), nullable=False, server_default=text("now()")
        ),
    )


class NotificationItem(SQLModel):
    """One notice. Never carries ``reason``, ``details``, file names or ids."""

    id: int
    occurred_at: datetime
    # The audit action, except that ``user.update`` is split into
    # ``user.activated`` / ``user.deactivated`` when that is what changed.
    action: str
    category: str  # account | security | backup | import | configuration
    outcome: str  # success | failed | denied
    actor_name: str | None  # full name, else e-mail; None when the account is gone
    actor_is_me: bool
    target_name: str | None  # same rule; only for notices about an account
    target_is_me: bool
    read: bool


class NotificationsPublic(SQLModel):
    data: list[NotificationItem]
    unread_count: int
