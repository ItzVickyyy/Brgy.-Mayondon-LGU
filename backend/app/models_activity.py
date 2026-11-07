"""Response shapes for the Activity Log (reads the append-only ``audit_log``)."""

import uuid
from datetime import datetime
from typing import Any

from sqlmodel import SQLModel


class ActivityItem(SQLModel):
    id: int
    occurred_at: datetime
    actor_user_id: uuid.UUID | None
    actor_email: str | None
    is_own: bool  # True when the signed-in user did it
    action: str
    module: str | None
    record_type: str | None
    record_id: str | None
    outcome: str
    reason: str | None
    # Field names, reference numbers and ids only: writers never put personal
    # values here (see app/core/audit.py).
    details: dict[str, Any] | None


class ActivityPublic(SQLModel):
    data: list[ActivityItem]
    count: int


class ActivityActor(SQLModel):
    id: uuid.UUID
    email: str


class ActivityOptions(SQLModel):
    """Values for the filter drop-downs, limited to what the user may see."""

    modules: list[str]
    actions: list[str]
    outcomes: list[str]
    actors: list[ActivityActor]  # empty unless the user may see everyone
