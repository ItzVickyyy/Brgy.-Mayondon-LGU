"""Two-factor sign-in with an authenticator app (step 14).

Signed in: see your status, set up (password + a first code), turn off,
get new recovery codes. Administrator: see and reset a STAFF person's
two-factor (an administrator who lost everything uses the server command
``python -m app.account_recovery_cli``, see docs/11).

The authenticator secret is shown once while setting up and never again. No
response ever contains a stored secret or a recovery code after it was made.
"""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import col, delete, select

from app.api.deps import CurrentUser, SessionDep, require_permission
from app.core import mfa, mfa_check
from app.core.audit import record_admin_action, record_audit_event
from app.core.permissions import Permission, is_admin
from app.core.security import verify_password
from app.models import Message, User
from app.models_security import (
    MfaCode,
    MfaCodeWithPassword,
    MfaConfigured,
    MfaRecoveryCode,
    MfaRecoveryCodes,
    MfaSetup,
    MfaSetupRequest,
    MfaStatus,
)

router = APIRouter(tags=["two-factor"])
require_user_admin = require_permission(Permission.USERS_MANAGE)

REFUSED = "The code was not accepted. Check it and try again."
NOT_AVAILABLE = (
    "Two-factor sign-in is not set up on this server yet. "
    "Ask the system administrator (docs/11, two-factor sign-in)."
)


def _remaining(session: SessionDep, user_id: uuid.UUID) -> int:
    rows = session.exec(
        select(MfaRecoveryCode.id).where(
            col(MfaRecoveryCode.user_id) == user_id,
            col(MfaRecoveryCode.used_at).is_(None),
        )
    ).all()
    return len(rows)


def _check_password(user: User, password: str) -> None:
    verified, _ = verify_password(password, user.hashed_password)
    if not verified:
        raise HTTPException(status_code=400, detail="Incorrect password")


def _new_recovery_codes(session: SessionDep, user: User) -> list[str]:
    """Replace every recovery code with ten new ones; return them (plain, once)."""
    session.execute(
        delete(MfaRecoveryCode).where(col(MfaRecoveryCode.user_id) == user.id)
    )
    codes = [mfa.new_recovery_code() for _ in range(mfa.RECOVERY_CODE_COUNT)]
    for code in codes:
        session.add(
            MfaRecoveryCode(user_id=user.id, code_hash=mfa.hash_recovery_code(code))
        )
    return codes


# ----- signed in -------------------------------------------------------------


@router.get("/users/me/mfa", response_model=MfaStatus)
def read_my_mfa(session: SessionDep, current_user: CurrentUser) -> MfaStatus:
    return MfaStatus(
        available=mfa.is_available(),
        enabled=current_user.mfa_enabled,
        setup_pending=(
            not current_user.mfa_enabled and bool(current_user.mfa_secret_encrypted)
        ),
        enrolled_at=current_user.mfa_enrolled_at,
        recovery_codes_remaining=(
            _remaining(session, current_user.id) if current_user.mfa_enabled else 0
        ),
        server_time=datetime.now(UTC),
    )


@router.post("/users/me/mfa/setup", response_model=MfaSetup)
def start_mfa_setup(
    session: SessionDep, current_user: CurrentUser, body: MfaSetupRequest
) -> MfaSetup:
    """Make a new secret (not active yet) to put into the authenticator app."""
    if not mfa.is_available():
        raise HTTPException(status_code=409, detail=NOT_AVAILABLE)
    _check_password(current_user, body.current_password)
    if current_user.mfa_enabled:
        raise HTTPException(status_code=409, detail="Two-factor sign-in is already on.")
    secret = mfa.new_secret()
    current_user.mfa_secret_encrypted = mfa.encrypt_secret(secret, current_user.id)
    current_user.mfa_last_step = None
    session.add(current_user)
    session.commit()
    return MfaSetup(
        secret=secret,
        otpauth_uri=mfa.otpauth_uri(secret, current_user.email),
        server_time=datetime.now(UTC),
    )


@router.post("/users/me/mfa/enable", response_model=MfaRecoveryCodes)
def enable_mfa(
    session: SessionDep, current_user: CurrentUser, body: MfaCode
) -> MfaRecoveryCodes:
    """Prove the app works by typing its current code; then it is switched on
    and the ten recovery codes are shown (this once)."""
    if current_user.mfa_enabled:
        raise HTTPException(status_code=409, detail="Two-factor sign-in is already on.")
    if not current_user.mfa_secret_encrypted:
        raise HTTPException(status_code=409, detail="Start the set-up first.")
    secret = mfa.decrypt_secret(current_user.mfa_secret_encrypted, current_user.id)
    step = mfa.match_step(secret, body.code) if secret else None
    if secret is None or step is None:
        raise HTTPException(status_code=400, detail=REFUSED)
    current_user.mfa_enabled = True
    current_user.mfa_enrolled_at = datetime.now(UTC)
    current_user.mfa_last_step = step  # the code just typed cannot be used again
    session.add(current_user)
    codes = _new_recovery_codes(session, current_user)
    record_audit_event(
        session,
        action="auth.mfa_enabled",
        actor=current_user,
        module="auth",
        record_type="user",
        record_id=current_user.id,
    )
    session.commit()
    return MfaRecoveryCodes(recovery_codes=codes)


@router.post("/users/me/mfa/disable", response_model=Message)
def disable_mfa(
    session: SessionDep, current_user: CurrentUser, body: MfaCodeWithPassword
) -> Message:
    """Turn two-factor off. Needs the password and a valid code (an
    authenticator code or a recovery code)."""
    if not current_user.mfa_enabled:
        raise HTTPException(status_code=409, detail="Two-factor sign-in is not on.")
    _check_password(current_user, body.current_password)
    if mfa_check.is_locked(current_user):
        raise HTTPException(status_code=400, detail=REFUSED)
    if mfa_check.check_code(session, current_user, body.code) is None:
        mfa_check.register_failure(session, current_user, reason="incorrect_code")
        raise HTTPException(status_code=400, detail=REFUSED)
    _clear_mfa(session, current_user)
    mfa_check.register_success(current_user)
    session.add(current_user)
    record_audit_event(
        session,
        action="auth.mfa_disabled",
        actor=current_user,
        module="auth",
        record_type="user",
        record_id=current_user.id,
    )
    session.commit()
    return Message(message="Two-factor sign-in turned off")


@router.post("/users/me/mfa/recovery-codes", response_model=MfaRecoveryCodes)
def new_my_recovery_codes(
    session: SessionDep, current_user: CurrentUser, body: MfaCodeWithPassword
) -> MfaRecoveryCodes:
    """Replace all recovery codes with ten new ones (the old ones stop working)."""
    if not current_user.mfa_enabled:
        raise HTTPException(status_code=409, detail="Two-factor sign-in is not on.")
    _check_password(current_user, body.current_password)
    if mfa_check.is_locked(current_user):
        raise HTTPException(status_code=400, detail=REFUSED)
    if mfa_check.check_code(session, current_user, body.code) is None:
        mfa_check.register_failure(session, current_user, reason="incorrect_code")
        raise HTTPException(status_code=400, detail=REFUSED)
    mfa_check.register_success(current_user)
    session.add(current_user)
    codes = _new_recovery_codes(session, current_user)
    record_audit_event(
        session,
        action="auth.mfa_codes_renewed",
        actor=current_user,
        module="auth",
        record_type="user",
        record_id=current_user.id,
    )
    session.commit()
    return MfaRecoveryCodes(recovery_codes=codes)


def _clear_mfa(session: SessionDep, user: User) -> None:
    session.execute(
        delete(MfaRecoveryCode).where(col(MfaRecoveryCode.user_id) == user.id)
    )
    user.mfa_enabled = False
    user.mfa_secret_encrypted = None
    user.mfa_last_step = None
    user.mfa_enrolled_at = None


# ----- administrator ---------------------------------------------------------


@router.get(
    "/users/{user_id}/mfa",
    response_model=MfaConfigured,
    dependencies=[Depends(require_user_admin)],
)
def read_user_mfa(session: SessionDep, user_id: uuid.UUID) -> MfaConfigured:
    """Administrator only: is this person's two-factor on? (never any secret)"""
    target = session.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    return MfaConfigured(enabled=target.mfa_enabled)


@router.delete(
    "/users/{user_id}/mfa",
    response_model=Message,
    dependencies=[Depends(require_user_admin)],
)
def reset_user_mfa(
    session: SessionDep, user_id: uuid.UUID, current_user: CurrentUser
) -> Message:
    """Administrator only: turn off a STAFF person's two-factor (lost phone).

    Not for yourself, and not for another administrator: an administrator who
    lost the phone uses the server command (docs/11). The person sets
    two-factor up again themselves."""
    target = session.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="Turn off your own two-factor sign-in in My Account instead.",
        )
    if is_admin(target):
        raise HTTPException(
            status_code=400,
            detail=(
                "An administrator's two-factor sign-in can only be reset from "
                "the server computer (docs/11)."
            ),
        )
    _clear_mfa(session, target)
    # Also forget wrong-code lock-outs, so the person can sign in right away.
    target.failed_login_attempts = 0
    target.locked_until = None
    session.add(target)
    record_admin_action(
        actor_id=current_user.id,
        action="auth.mfa_reset_by_admin",
        target_type="user",
        target_id=target.id,
    )
    record_audit_event(
        session,
        action="auth.mfa_reset_by_admin",
        actor=current_user,
        module="auth",
        record_type="user",
        record_id=target.id,
    )
    session.commit()
    return Message(message="Two-factor sign-in turned off for this person")
