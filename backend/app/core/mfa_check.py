"""Checking a typed two-factor code against a person (step 14).

One place for the rules, used by sign-in, turning two-factor off and making
new recovery codes: an authenticator code works once (replay protection), a
recovery code works once, and wrong codes count toward the SAME lock-out as
wrong passwords. Nothing here commits except ``register_failure``; callers
commit when their whole action succeeds.
"""

from datetime import UTC, datetime, timedelta
from typing import Literal

from sqlalchemy import or_, update
from sqlmodel import Session, col, select

from app.core import mfa
from app.core.audit import record_audit_event
from app.core.config import settings
from app.models import User
from app.models_security import MfaRecoveryCode

CodeKind = Literal["authenticator", "recovery"]


def is_locked(user: User) -> bool:
    locked_until = user.locked_until
    if locked_until is None:
        return False
    if locked_until.tzinfo is None:
        locked_until = locked_until.replace(tzinfo=UTC)
    return locked_until > datetime.now(UTC)


def _try_authenticator(session: Session, user: User, code: str) -> bool:
    if not user.mfa_secret_encrypted:
        return False
    secret = mfa.decrypt_secret(user.mfa_secret_encrypted, user.id)
    if secret is None:
        return False
    step = mfa.match_step(secret, code)
    if step is None:
        return False
    # Replay protection: the step must be newer than the last accepted one.
    # Done in the database so two requests at once cannot both win.
    result = session.execute(
        update(User)
        .where(
            col(User.id) == user.id,
            or_(col(User.mfa_last_step).is_(None), col(User.mfa_last_step) < step),
        )
        .values(mfa_last_step=step)
    )
    if result.rowcount != 1:  # type: ignore[attr-defined]
        return False
    session.refresh(user)
    return True


def _try_recovery(session: Session, user: User, code: str) -> bool:
    rows = session.exec(
        select(MfaRecoveryCode).where(
            col(MfaRecoveryCode.user_id) == user.id,
            col(MfaRecoveryCode.used_at).is_(None),
        )
    ).all()
    matched: MfaRecoveryCode | None = None
    for row in rows:  # every unused code is checked: no early exit
        if mfa.verify_recovery_code(code, row.code_hash) and matched is None:
            matched = row
    if matched is None:
        return False
    result = session.execute(
        update(MfaRecoveryCode)
        .where(
            col(MfaRecoveryCode.id) == matched.id,
            col(MfaRecoveryCode.used_at).is_(None),
        )
        .values(used_at=datetime.now(UTC))
    )
    return bool(result.rowcount == 1)  # type: ignore[attr-defined]


def check_code(session: Session, user: User, code: str) -> CodeKind | None:
    """Which kind of code this is, if it is valid right now (and use it up)."""
    if mfa.looks_like_totp(code):
        return "authenticator" if _try_authenticator(session, user, code) else None
    return "recovery" if _try_recovery(session, user, code) else None


def register_failure(session: Session, user: User, *, reason: str) -> None:
    """Count a wrong code toward the sign-in lock-out and record it."""
    session.rollback()
    session.refresh(user)
    user.failed_login_attempts += 1
    if user.failed_login_attempts >= settings.LOGIN_MAX_FAILED_ATTEMPTS:
        user.locked_until = datetime.now(UTC) + timedelta(
            minutes=settings.LOGIN_LOCKOUT_MINUTES
        )
    session.add(user)
    record_audit_event(
        session,
        action="auth.mfa_failed",
        actor=user,
        outcome="failed",
        module="auth",
        details={"reason": reason},
    )
    session.commit()


def register_success(user: User) -> None:
    """A correct code clears the failures (the password step does not)."""
    user.failed_login_attempts = 0
    user.locked_until = None
