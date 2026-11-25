import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.security import OAuth2PasswordRequestForm
from jwt.exceptions import InvalidTokenError
from pydantic import ValidationError
from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert
from sqlmodel import col, select

from app import crud
from app.api.deps import CurrentUser, SessionDep, TokenDep, require_admin
from app.core import mfa_check, security
from app.core.audit import record_audit_event
from app.core.config import settings
from app.core.login_throttle import login_ip_locked, record_login_failure
from app.core.password_recovery import is_password_recovery_rate_limited
from app.models import (
    ConfirmPasswordRequest,
    ConfirmPasswordResult,
    LoginResult,
    Message,
    NewPassword,
    PasswordRecoveryRequest,
    RevokedToken,
    TokenPayload,
    User,
    UserPublic,
    UserUpdate,
)
from app.models_foundation import AuditLog
from app.models_security import MfaLogin
from app.utils import (
    generate_password_reset_token,
    generate_reset_password_email,
    get_password_reset_token_email,
    send_email,
    verify_password_reset_token,
)

router = APIRouter(tags=["login"])
dev_router = APIRouter(tags=["login"])


@router.post("/login/access-token")
def login_access_token(
    request: Request,
    session: SessionDep,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
) -> LoginResult:
    """
    OAuth2 compatible token login, get an access token for future requests.

    For a person with two-factor on, a correct password returns only a short
    ``mfa_token`` (good for nothing but ``POST /login/mfa``); the access token
    comes after the code.
    """
    email = form_data.username.strip().lower()
    client_ip = request.client.host if request.client else None
    if login_ip_locked(session, client_ip=client_ip):
        raise HTTPException(
            status_code=429,
            detail="Too many wrong sign-in attempts from this computer. Wait a few minutes and try again.",
        )
    existing = crud.get_user_by_email(session=session, email=email)
    was_locked = bool(
        existing
        and existing.locked_until is not None
        and (
            existing.locked_until
            if existing.locked_until.tzinfo
            else existing.locked_until.replace(tzinfo=UTC)
        )
        > datetime.now(UTC)
    )
    user = crud.authenticate(session=session, email=email, password=form_data.password)
    if not user:
        record_login_failure(session, client_ip=client_ip)
        # Only known accounts are recorded, so anonymous guessing cannot fill the
        # log. The typed email and password are never stored.
        if existing:
            record_audit_event(
                session,
                action="auth.login_failed",
                actor=existing,
                outcome="failed",
                module="auth",
                details={"reason": "locked" if was_locked else "incorrect_password"},
                commit=True,
            )
            if not was_locked and _is_locked_now(existing):
                # This failure is the one that locked the account: tell the
                # administrators once (it shows in the notification bell).
                record_audit_event(
                    session,
                    action="auth.account_locked",
                    actor=existing,
                    outcome="failed",
                    module="auth",
                    commit=True,
                )
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    elif not user.is_active:
        record_audit_event(
            session,
            action="auth.login_failed",
            actor=user,
            outcome="denied",
            module="auth",
            details={"reason": "inactive"},
            commit=True,
        )
        raise HTTPException(status_code=400, detail="Inactive user")
    if user.mfa_enabled:
        return LoginResult(
            mfa_required=True,
            mfa_token=security.create_mfa_token(user.id, user.hashed_password),
        )
    return _finish_login(session, user)


@router.post("/login/confirm-password")
def confirm_password(
    session: SessionDep, user: CurrentUser, body: ConfirmPasswordRequest
) -> ConfirmPasswordResult:
    """Check the signed-in person's password again before a risky action.

    Returns a two-minute token for ONE scope (Restore, Download copy); the
    action's own route demands it in ``X-Confirm-Token``. Wrong passwords count
    toward the same lock-out as signing in. The typed password is never stored.
    """
    was_locked = _is_locked_now(user)
    checked = crud.authenticate(
        session=session, email=user.email, password=body.password
    )
    if checked is None:
        session.refresh(user)
        record_audit_event(
            session,
            action="auth.confirm_failed",
            actor=user,
            outcome="failed",
            module="auth",
            details={
                "scope": body.scope,
                "reason": "locked" if was_locked else "incorrect_password",
            },
            commit=True,
        )
        if not was_locked and _is_locked_now(user):
            record_audit_event(
                session,
                action="auth.account_locked",
                actor=user,
                outcome="failed",
                module="auth",
                commit=True,
            )
        raise HTTPException(
            status_code=400,
            detail="Too many wrong attempts. Wait a few minutes and try again."
            if _is_locked_now(user)
            else "Incorrect password",
        )
    return ConfirmPasswordResult(
        confirm_token=security.create_confirm_token(
            checked.id, checked.hashed_password, body.scope
        ),
        expires_in_seconds=settings.CONFIRM_TOKEN_EXPIRE_SECONDS,
    )


def _is_locked_now(user: Any) -> bool:
    until = user.locked_until
    if until is None:
        return False
    if until.tzinfo is None:
        until = until.replace(tzinfo=UTC)
    return bool(until > datetime.now(UTC))


def _replaces_live_session(session: SessionDep, user: Any) -> bool:
    """True when this sign-in cuts off an earlier one that could still have been in use.

    Signing out revokes the old token, and an old token stops working when it expires,
    so only a token that is neither revoked nor older than its lifetime counts.
    """
    previous = user.active_session_jti
    if not settings.SINGLE_SESSION_PER_ACCOUNT or not previous:
        return False
    if session.get(RevokedToken, previous) is not None:
        return False
    last_login = session.exec(
        select(AuditLog.occurred_at)
        .where(
            col(AuditLog.actor_user_id) == user.id,
            col(AuditLog.action) == "auth.login",
        )
        .order_by(col(AuditLog.occurred_at).desc())
        .limit(1)
    ).first()
    if last_login is None:
        return False
    if last_login.tzinfo is None:
        last_login = last_login.replace(tzinfo=UTC)
    lifetime = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return bool(datetime.now(UTC) - last_login < lifetime)


def _finish_login(session: SessionDep, user: Any) -> LoginResult:
    replaced = _replaces_live_session(session, user)
    record_audit_event(
        session, action="auth.login", actor=user, module="auth", commit=True
    )
    if replaced:
        record_audit_event(
            session,
            action="auth.session_replaced",
            actor=user,
            module="auth",
            commit=True,
        )
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    jti = uuid.uuid4().hex
    # The newest sign-in is the only one that works: any older token of this account
    # stops at once (see get_current_user_allow_temporary).
    user.active_session_jti = jti
    session.add(user)
    session.commit()
    return LoginResult(
        access_token=security.create_access_token(
            user.id,
            expires_delta=access_token_expires,
            hashed_password=user.hashed_password,
            jti=jti,
        )
    )


@router.post("/login/logout")
def logout(session: SessionDep, token: TokenDep) -> Message:
    """End this sign-in token now, so a copy of it stops working at once.

    Always answers the same way, whether or not the token was valid: signing out must never
    fail on the screen. Works while a temporary password is still waiting to be changed.
    """
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        data = TokenPayload(**payload)
    except InvalidTokenError, ValidationError:
        return Message(message="Signed out")
    if (
        data.jti
        and data.purpose is None
        and isinstance(payload.get("exp"), int | float)
    ):
        now = datetime.now(UTC)
        session.exec(
            delete(RevokedToken).where(col(RevokedToken.expires_at) < now)
        )  # tokens that would have expired anyway
        statement = (
            insert(RevokedToken)
            .values(
                jti=data.jti,
                expires_at=datetime.fromtimestamp(payload["exp"], UTC),
            )
            .on_conflict_do_nothing()
        )
        session.exec(statement)
        session.commit()
    return Message(message="Signed out")


MFA_REFUSED = "The code was not accepted. Check it and try again."


@router.post("/login/mfa")
def login_mfa(session: SessionDep, body: MfaLogin) -> LoginResult:
    """Second step of sign-in: the code from the authenticator app, or one of
    the ten one-time recovery codes. Wrong codes count toward the same lock-out
    as wrong passwords; a code that was already used is refused."""
    try:
        payload = TokenPayload(
            **jwt.decode(
                body.mfa_token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
            )
        )
    except InvalidTokenError, ValidationError:
        raise HTTPException(
            status_code=400,
            detail="This sign-in step has expired. Start again with your password.",
        )
    if payload.purpose != security.MFA_TOKEN_PURPOSE or not payload.sub:
        raise HTTPException(status_code=400, detail="Invalid token")
    try:
        user = session.get(User, uuid.UUID(payload.sub))
    except ValueError:
        user = None
    if (
        user is None
        or not user.is_active
        or not user.mfa_enabled
        or not security.verify_password_fingerprint(payload.pwdv, user.hashed_password)
    ):
        raise HTTPException(
            status_code=400,
            detail="This sign-in step has expired. Start again with your password.",
        )
    if mfa_check.is_locked(user):
        record_audit_event(
            session,
            action="auth.mfa_failed",
            actor=user,
            outcome="denied",
            module="auth",
            details={"reason": "locked"},
            commit=True,
        )
        raise HTTPException(status_code=400, detail=MFA_REFUSED)
    kind = mfa_check.check_code(session, user, body.code)
    if kind is None:
        mfa_check.register_failure(session, user, reason="incorrect_code")
        raise HTTPException(status_code=400, detail=MFA_REFUSED)
    mfa_check.register_success(user)
    session.add(user)
    if kind == "recovery":
        record_audit_event(
            session,
            action="auth.mfa_recovery_code_used",
            actor=user,
            module="auth",
            record_type="user",
            record_id=user.id,
        )
    session.commit()
    session.refresh(user)
    return _finish_login(session, user)


@router.post("/login/test-token", response_model=UserPublic)
def test_token(current_user: CurrentUser) -> Any:
    """
    Test access token
    """
    return current_user


@router.post("/password-recovery")
def recover_password(
    body: PasswordRecoveryRequest, request: Request, session: SessionDep
) -> Message:
    email = str(body.email)
    """
    Password Recovery
    """
    rate_limited = is_password_recovery_rate_limited(
        session=session,
        email=email,
        client_ip=request.client.host if request.client else None,
    )
    user = (
        None if rate_limited else crud.get_user_by_email(session=session, email=email)
    )

    if not settings.emails_enabled:
        return Message(
            message=(
                "Email-based password recovery is unavailable in this offline "
                "installation. Contact the system administrator."
            )
        )

    # Always return the same response to prevent email enumeration attacks.
    # Do not send email or reveal account existence after a rate limit is reached.
    if user:
        password_reset_token = generate_password_reset_token(
            email=email, hashed_password=user.hashed_password
        )
        email_data = generate_reset_password_email(
            email_to=user.email, email=email, token=password_reset_token
        )
        send_email(
            email_to=user.email,
            subject=email_data.subject,
            html_content=email_data.html_content,
        )
    return Message(
        message="If that email is registered, we sent a password recovery link"
    )


@router.post("/reset-password/")
def reset_password(session: SessionDep, body: NewPassword) -> Message:
    """
    Reset password
    """
    email = get_password_reset_token_email(token=body.token)
    if not email:
        raise HTTPException(status_code=400, detail="Invalid token")
    user = crud.get_user_by_email(session=session, email=email)
    if not user:
        # Don't reveal that the user doesn't exist - use same error as invalid token
        raise HTTPException(status_code=400, detail="Invalid token")
    elif not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    if (
        verify_password_reset_token(
            token=body.token, hashed_password=user.hashed_password
        )
        != user.email
    ):
        raise HTTPException(status_code=400, detail="Invalid token")
    user_in_update = UserUpdate(password=body.new_password)
    crud.update_user(
        session=session,
        db_user=user,
        user_in=user_in_update,
    )
    return Message(message="Password updated successfully")


@dev_router.post(
    "/password-recovery-html-content/{email}",
    dependencies=[Depends(require_admin)],
    response_class=HTMLResponse,
)
def recover_password_html_content(email: str, session: SessionDep) -> Any:
    """
    HTML Content for Password Recovery
    """
    user = crud.get_user_by_email(session=session, email=email)

    if not user:
        raise HTTPException(
            status_code=404,
            detail="The user with this username does not exist in the system.",
        )
    password_reset_token = generate_password_reset_token(
        email=email, hashed_password=user.hashed_password
    )
    email_data = generate_reset_password_email(
        email_to=user.email, email=email, token=password_reset_token
    )

    return HTMLResponse(
        content=email_data.html_content, headers={"subject:": email_data.subject}
    )
