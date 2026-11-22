"""Limits wrong sign-in attempts from one computer.

The account lock-out (``LOGIN_MAX_FAILED_ATTEMPTS``) protects one account. It does not stop
someone from trying one password on every account, or from guessing at e-mail addresses that do
not exist, so wrong attempts are also counted per computer. Known and unknown e-mails count
alike. A correct sign-in never resets the count, so signing in to an own account cannot be used to
start over. Uses the same keyed, non-reversible buckets as password recovery (no raw address is
stored).
"""

from datetime import UTC, datetime, timedelta

from sqlmodel import Session

from app.core.config import settings
from app.core.password_recovery import _bucket_key, _increment_bucket
from app.models import PasswordRecoveryRateLimit


def login_ip_key(client_ip: str | None) -> str:
    return _bucket_key("login-ip", client_ip or "unknown")


def login_ip_locked(session: Session, *, client_ip: str | None) -> bool:
    """True while this computer has used up its wrong attempts. Read only, so a lock never extends itself."""
    row = session.get(PasswordRecoveryRateLimit, login_ip_key(client_ip))
    if row is None:
        return False
    started = (
        row.window_started_at
        if row.window_started_at.tzinfo
        else row.window_started_at.replace(tzinfo=UTC)
    )
    cutoff = datetime.now(UTC) - timedelta(minutes=settings.LOGIN_LOCKOUT_MINUTES)
    return (
        started > cutoff and row.attempts >= settings.LOGIN_MAX_FAILED_ATTEMPTS_PER_IP
    )


def record_login_failure(session: Session, *, client_ip: str | None) -> None:
    """Count one wrong sign-in against this computer."""
    now = datetime.now(UTC)
    _increment_bucket(
        session,
        key=login_ip_key(client_ip),
        now=now,
        cutoff=now - timedelta(minutes=settings.LOGIN_LOCKOUT_MINUTES),
    )
    session.commit()
