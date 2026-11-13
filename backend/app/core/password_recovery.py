"""Shared, database-backed throttling for password recovery requests."""

import hashlib
import hmac
from datetime import UTC, datetime, timedelta

from sqlalchemy import case, delete
from sqlalchemy.dialects.postgresql import insert
from sqlmodel import Session

from app.core.config import settings
from app.models import PasswordRecoveryRateLimit


def _bucket_key(kind: str, value: str) -> str:
    """Create a keyed, non-reversible identifier for a rate-limit bucket."""
    message = f"password-recovery:{kind}:{value}".encode("utf-8")
    return hmac.new(
        settings.SECRET_KEY.encode("utf-8"), message, hashlib.sha256
    ).hexdigest()


def _increment_bucket(
    session: Session, *, key: str, now: datetime, cutoff: datetime
) -> int:
    """Atomically increment a fixed-window bucket across app instances."""
    table = PasswordRecoveryRateLimit.__table__
    statement = insert(PasswordRecoveryRateLimit).values(
        bucket_key=key,
        window_started_at=now,
        attempts=1,
    )
    statement = statement.on_conflict_do_update(
        index_elements=[table.c.bucket_key],
        set_={
            "window_started_at": case(
                (table.c.window_started_at <= cutoff, now),
                else_=table.c.window_started_at,
            ),
            "attempts": case(
                (table.c.window_started_at <= cutoff, 1),
                else_=table.c.attempts + 1,
            ),
        },
    ).returning(table.c.attempts)
    return int(session.execute(statement).scalar_one())


def is_password_recovery_rate_limited(
    session: Session, *, email: str, client_ip: str | None
) -> bool:
    """Record an attempt and report whether either configured limit was exceeded."""
    now = datetime.now(UTC)
    cutoff = now - timedelta(minutes=settings.PASSWORD_RECOVERY_WINDOW_MINUTES)
    normalized_email = email.strip().casefold()
    ip_value = client_ip or "unknown"

    email_attempts = _increment_bucket(
        session,
        key=_bucket_key("email", normalized_email),
        now=now,
        cutoff=cutoff,
    )
    ip_attempts = _increment_bucket(
        session,
        key=_bucket_key("ip", ip_value),
        now=now,
        cutoff=cutoff,
    )
    # Opportunistically remove inactive buckets so the table does not grow forever.
    # Keep one extra full window as a buffer for recently expired buckets.
    cleanup_cutoff = now - timedelta(
        minutes=settings.PASSWORD_RECOVERY_WINDOW_MINUTES * 2
    )
    session.execute(
        delete(PasswordRecoveryRateLimit).where(
            PasswordRecoveryRateLimit.window_started_at <= cleanup_cutoff
        )
    )
    session.commit()

    return (
        email_attempts > settings.PASSWORD_RECOVERY_MAX_ATTEMPTS_PER_EMAIL
        or ip_attempts > settings.PASSWORD_RECOVERY_MAX_ATTEMPTS_PER_IP
    )


def _questions_key(kind: str, value: str) -> str:
    return _bucket_key(f"questions-{kind}", value)


def recovery_questions_locked(
    session: Session, *, email: str, client_ip: str | None
) -> bool:
    """True while wrong answers have locked recovery for this account or computer.

    Read only: checking never adds an attempt, so a lock does not extend itself.
    """
    cutoff = datetime.now(UTC) - timedelta(
        minutes=settings.RECOVERY_QUESTIONS_LOCKOUT_MINUTES
    )
    table = PasswordRecoveryRateLimit
    for key, limit in (
        (
            _questions_key("email", email.strip().casefold()),
            settings.RECOVERY_QUESTIONS_MAX_FAILED_ATTEMPTS,
        ),
        (
            _questions_key("ip", client_ip or "unknown"),
            settings.RECOVERY_QUESTIONS_MAX_FAILED_ATTEMPTS_PER_IP,
        ),
    ):
        row = session.get(table, key)
        if row is None:
            continue
        started = (
            row.window_started_at
            if row.window_started_at.tzinfo
            else row.window_started_at.replace(tzinfo=UTC)
        )
        if started > cutoff and row.attempts >= limit:
            return True
    return False


def record_recovery_questions_failure(
    session: Session, *, email: str, client_ip: str | None
) -> None:
    """Count one wrong set of answers against the account and the computer."""
    now = datetime.now(UTC)
    cutoff = now - timedelta(minutes=settings.RECOVERY_QUESTIONS_LOCKOUT_MINUTES)
    _increment_bucket(
        session,
        key=_questions_key("email", email.strip().casefold()),
        now=now,
        cutoff=cutoff,
    )
    _increment_bucket(
        session,
        key=_questions_key("ip", client_ip or "unknown"),
        now=now,
        cutoff=cutoff,
    )
    session.commit()


def clear_recovery_questions_failures(session: Session, *, email: str) -> None:
    """Forget the failures of one account after a successful recovery."""
    row = session.get(
        PasswordRecoveryRateLimit, _questions_key("email", email.strip().casefold())
    )
    if row is not None:
        session.delete(row)
        session.commit()
