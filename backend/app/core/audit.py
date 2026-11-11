"""Small, privacy-conscious audit events for administrative writes."""

import json
import logging
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any
from uuid import UUID

if TYPE_CHECKING:
    from sqlmodel import Session

    from app.models import User
    from app.models_foundation import AuditLog

logger = logging.getLogger("app.audit")


def record_admin_action(
    *,
    actor_id: UUID,
    action: str,
    target_type: str,
    target_id: UUID | str,
) -> None:
    """Write a structured audit event without recording personal field values."""
    event: dict[str, Any] = {
        "event": "admin_action",
        "timestamp": datetime.now(UTC).isoformat(),
        "actor_id": str(actor_id),
        "action": action,
        "target_type": target_type,
        "target_id": str(target_id),
    }
    logger.info(json.dumps(event, separators=(",", ":")))


def record_audit_event(
    session: Session,
    *,
    action: str,
    actor: User | None = None,
    outcome: str = "success",
    module: str | None = None,
    record_type: str | None = None,
    record_id: UUID | str | int | None = None,
    reason: str | None = None,
    details: dict[str, Any] | None = None,
    commit: bool = False,
) -> AuditLog:
    """Add a row to the append-only ``audit_log`` table.

    By default the row is only added to the session, so it is saved in the same
    transaction as the change it records. Pass ``commit=True`` for denied or
    failed attempts, where the main transaction is rolled back.
    Never put passwords, tokens, health conditions or unneeded personal data
    in ``details``.
    """
    from app.models_foundation import AuditLog

    entry = AuditLog(
        actor_user_id=actor.id if actor else None,
        actor_email=actor.email if actor else None,
        action=action,
        outcome=outcome,
        module=module,
        record_type=record_type,
        record_id=None if record_id is None else str(record_id),
        reason=reason,
        details=details,
    )
    session.add(entry)
    if commit:
        session.commit()
        session.refresh(entry)
    return entry


READ_AUDIT_WINDOW_MINUTES = 10

# Actions that only record a READ. The Dashboard leaves them out of "recent
# activity" so changes stay visible; the Activity Log page shows them.
READ_ACTIONS = ("resident.view", "resident.list", "barangay_id.list")


def record_read_event(
    session: Session,
    *,
    action: str,
    actor: User,
    module: str,
    record_type: str | None = None,
    record_id: UUID | str | int | None = None,
    details: dict[str, Any] | None = None,
    window_minutes: int = READ_AUDIT_WINDOW_MINUTES,
) -> bool:
    """Log that ``actor`` READ personal data, at most once per window.

    Reading is audited so staff looking at more than their work needs can be
    noticed. Opening the same profile or list again within ``window_minutes``
    adds no second row, so the Activity Log is not flooded. The row is saved at
    once (``commit``). Returns True when a row was written.
    """
    from sqlmodel import col, select

    from app.models_foundation import AuditLog

    since = datetime.now(UTC) - timedelta(minutes=window_minutes)
    stmt = (
        select(col(AuditLog.id))
        .where(
            col(AuditLog.actor_user_id) == actor.id,
            col(AuditLog.action) == action,
            col(AuditLog.occurred_at) >= since,
        )
        .limit(1)
    )
    if record_id is None:
        stmt = stmt.where(col(AuditLog.record_id).is_(None))
    else:
        stmt = stmt.where(col(AuditLog.record_id) == str(record_id))
    if session.exec(stmt).first() is not None:
        return False
    record_audit_event(
        session,
        action=action,
        actor=actor,
        module=module,
        record_type=record_type,
        record_id=record_id,
        details=details,
        commit=True,
    )
    return True
