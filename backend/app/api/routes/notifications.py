"""Notification bell: the audit log, told as short notices (patch 75).

Everything here is read from the append-only ``audit_log``; nothing in it is
changed or deleted. Who may see what:

- Administrators see every action in ``ADMIN_ACTIONS`` (any actor, their own
  too).
- Staff see only (a) things an administrator did to THEIR account and (b)
  their own security events. They never see backup, import, configuration or
  other people's accounts.

A notice carries the action, who did it, who it was done to and the time, and
nothing else: never the ``reason``, the ``details`` (a failed backup's server
message lives there), file names, record ids, or anything personal. Reading
the bell writes no audit row.
"""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlalchemy import func as sa_func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlmodel import Session, col, select

from app.api.deps import CurrentUser, SessionDep
from app.core.permissions import is_admin
from app.models import Message, User
from app.models_foundation import AuditLog
from app.models_notification import (
    NotificationItem,
    NotificationRead,
    NotificationsPublic,
    NotificationState,
)

router = APIRouter(prefix="/notifications", tags=["notifications"])

WINDOW_DAYS = 30
MAX_NOTICES = 50
# Rows read per request before the in-code filter trims them to MAX_NOTICES.
CANDIDATES = 300

CATEGORIES: dict[str, str] = {
    "user.create": "account",
    "user.update": "account",
    "user.role_change": "account",
    "user.delete": "account",
    "user.delete_self": "account",
    "user.temp_password_set": "account",
    "user.unlock": "account",
    "user.password_change": "security",
    "auth.mfa_enabled": "security",
    "auth.mfa_disabled": "security",
    "auth.mfa_codes_renewed": "security",
    "auth.mfa_reset_by_admin": "security",
    "auth.mfa_required_set": "security",
    "auth.mfa_required_cleared": "security",
    "auth.recovery_questions_set": "security",
    "auth.recovery_reset_by_admin": "security",
    "auth.recovery_success": "security",
    "auth.mfa_recovery_code_used": "security",
    "auth.secrets_rotate": "security",
    "auth.account_locked": "security",
    "backup.create": "backup",
    "backup.verify": "backup",
    "backup.restore_requested": "backup",
    "import.upload": "import",
    "import.commit": "import",
    "import.cancel": "import",
    "id_series.update": "configuration",
    "official.create": "configuration",
    "official.update": "configuration",
    "street.create": "configuration",
    "street.rename": "configuration",
    "street.delete": "configuration",
    "tricycle_association.create": "configuration",
    "tricycle_association.rename": "configuration",
    "tricycle_association.delete": "configuration",
}
ADMIN_ACTIONS = tuple(CATEGORIES)

# Staff (a): done TO their account by somebody else.
STAFF_ABOUT_ME = (
    "user.update",
    "user.role_change",
    "user.temp_password_set",
    "user.unlock",
    "auth.mfa_reset_by_admin",
    "auth.mfa_required_set",
    "auth.mfa_required_cleared",
    "auth.recovery_reset_by_admin",
)
# Staff (b): their own security events.
STAFF_OWN = (
    "user.password_change",
    "auth.mfa_enabled",
    "auth.mfa_disabled",
    "auth.mfa_codes_renewed",
    "auth.recovery_questions_set",
    "auth.recovery_success",
    "auth.account_locked",
)
# Notices that are about one account (the target is named in the sentence).
TARGETED = (
    *STAFF_ABOUT_ME,
    "user.create",
    "user.delete",
    "user.activated",
    "user.deactivated",
)


def _visible_stmt(user: User) -> Any:
    since = datetime.now(UTC) - timedelta(days=WINDOW_DAYS)
    stmt = select(AuditLog).where(col(AuditLog.occurred_at) >= since)
    if is_admin(user):
        return stmt.where(col(AuditLog.action).in_(ADMIN_ACTIONS))
    about_me = (
        col(AuditLog.action).in_(STAFF_ABOUT_ME)
        & (col(AuditLog.record_type) == "user")
        & (col(AuditLog.record_id) == str(user.id))
        & col(AuditLog.actor_user_id).is_distinct_from(user.id)
    )
    own = col(AuditLog.action).in_(STAFF_OWN) & (col(AuditLog.actor_user_id) == user.id)
    return stmt.where(about_me | own)


def _shape(row: AuditLog) -> tuple[str, bool] | None:
    """(action to show, keep). ``None`` hides a row that would only repeat or
    confuse: the temporary password written when an account is created, and a
    ``user.update`` with nothing of its own to say."""
    details = row.details or {}
    if row.action == "user.temp_password_set":
        if details.get("reason") != "password_reset":
            return None
        return row.action, True
    if row.action == "user.update":
        if "is_active" in details:
            return (
                "user.activated" if details["is_active"] else "user.deactivated"
            ), True
        fields = {str(f) for f in details.get("fields") or []}
        # A role change has its own row; a password reset or unlock has its own.
        if not fields - {"role"}:
            return None
        return row.action, True
    return row.action, True


def _ensure_state(session: Session, user: User) -> NotificationState:
    """First visit: everything up to the day the account was made counts as
    read, so a new account does not start with the whole history unread."""
    state = session.get(NotificationState, user.id)
    if state is not None:
        return state
    created = user.created_at or datetime.now(UTC)
    start = session.exec(
        select(sa_func.max(col(AuditLog.id))).where(
            col(AuditLog.occurred_at) <= created
        )
    ).one()
    session.exec(
        pg_insert(NotificationState)
        .values(user_id=user.id, read_upto=int(start or 0))
        .on_conflict_do_nothing(index_elements=["user_id"])
    )
    session.commit()
    state = session.get(NotificationState, user.id)
    assert state is not None
    return state


def _names(session: Session, ids: set[uuid.UUID]) -> dict[uuid.UUID, str]:
    if not ids:
        return {}
    rows = session.exec(
        select(User.id, User.full_name, User.email).where(col(User.id).in_(ids))
    ).all()
    return {uid: (full_name or email) for uid, full_name, email in rows}


def _as_uuid(value: str | None) -> uuid.UUID | None:
    try:
        return uuid.UUID(value) if value else None
    except ValueError:
        return None


def _visible_rows(session: Session, user: User) -> list[tuple[AuditLog, str]]:
    rows = session.exec(
        _visible_stmt(user).order_by(col(AuditLog.id).desc()).limit(CANDIDATES)
    ).all()
    shown: list[tuple[AuditLog, str]] = []
    for row in rows:
        shaped = _shape(row)
        if shaped is None:
            continue
        shown.append((row, shaped[0]))
        if len(shown) == MAX_NOTICES:
            break
    return shown


@router.get("/", response_model=NotificationsPublic)
def list_notifications(session: SessionDep, current_user: CurrentUser) -> Any:
    """Newest first, last 30 days, at most 50. Role decides what is visible."""
    state = _ensure_state(session, current_user)
    shown = _visible_rows(session, current_user)
    ids = [row.id for row, _ in shown if row.id is not None]
    read_ids: set[int] = set()
    if ids:
        read_ids = set(
            session.exec(
                select(NotificationRead.audit_id).where(
                    NotificationRead.user_id == current_user.id,
                    col(NotificationRead.audit_id).in_(ids),
                )
            ).all()
        )
    wanted: set[uuid.UUID] = set()
    for row, action in shown:
        if row.actor_user_id:
            wanted.add(row.actor_user_id)
        if action in TARGETED:
            target = _as_uuid(row.record_id)
            if target:
                wanted.add(target)
    names = _names(session, wanted)
    data: list[NotificationItem] = []
    for row, action in shown:
        rid = row.id or 0
        target = _as_uuid(row.record_id) if action in TARGETED else None
        data.append(
            NotificationItem(
                id=rid,
                occurred_at=row.occurred_at,
                action=action,
                category=CATEGORIES[row.action],
                outcome=row.outcome,
                actor_name=names.get(row.actor_user_id) if row.actor_user_id else None,
                actor_is_me=row.actor_user_id == current_user.id,
                target_name=names.get(target) if target else None,
                target_is_me=target == current_user.id,
                read=rid <= state.read_upto or rid in read_ids,
            )
        )
    return NotificationsPublic(
        data=data, unread_count=sum(1 for item in data if not item.read)
    )


@router.post("/read-all", response_model=Message)
def mark_all_notifications_read(session: SessionDep, current_user: CurrentUser) -> Any:
    """Everything visible now counts as read."""
    state = _ensure_state(session, current_user)
    shown = _visible_rows(session, current_user)
    newest = max((row.id or 0 for row, _ in shown), default=0)
    if newest > state.read_upto:
        state.read_upto = newest
        state.updated_at = datetime.now(UTC)
        session.add(state)
        # Single marks below the new line are no longer needed.
        for read in session.exec(
            select(NotificationRead).where(
                NotificationRead.user_id == current_user.id,
                col(NotificationRead.audit_id) <= newest,
            )
        ).all():
            session.delete(read)
        session.commit()
    return Message(message="All notifications marked as read")


@router.post("/{notification_id}/read", response_model=Message)
def mark_notification_read(
    notification_id: int, session: SessionDep, current_user: CurrentUser
) -> Any:
    """Mark one notice read. Only a notice this person can see is accepted."""
    state = _ensure_state(session, current_user)
    visible = any(
        row.id == notification_id for row, _ in _visible_rows(session, current_user)
    )
    if not visible:
        raise HTTPException(status_code=404, detail="Notification not found")
    if notification_id > state.read_upto:
        session.exec(
            pg_insert(NotificationRead)
            .values(user_id=current_user.id, audit_id=notification_id)
            .on_conflict_do_nothing(index_elements=["user_id", "audit_id"])
        )
        session.commit()
    return Message(message="Notification marked as read")
