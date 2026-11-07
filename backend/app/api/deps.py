from collections.abc import Callable, Generator
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from pydantic import ValidationError
from sqlmodel import Session

from app.core import security
from app.core.config import settings
from app.core.db import engine
from app.core.permissions import Permission, has_permission, is_admin
from app.models import TokenPayload, User

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/login/access-token"
)


def get_db() -> Generator[Session]:
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_db)]
TokenDep = Annotated[str, Depends(reusable_oauth2)]


def get_current_user_allow_temporary(session: SessionDep, token: TokenDep) -> User:
    """Resolve the signed-in user even while a password change is required.

    Only "read me" and "change my own password" may use this."""
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
    except InvalidTokenError, ValidationError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    user = session.get(User, token_data.sub)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not security.verify_password_fingerprint(token_data.pwdv, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return user


def get_current_user(
    user: Annotated[User, Depends(get_current_user_allow_temporary)],
) -> User:
    """Resolve the signed-in user and refuse every request until a temporary
    password has been replaced (D-12)."""
    if user.must_change_password:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "password_change_required",
                "message": "You must change your temporary password first.",
            },
        )
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentUserAllowTemporary = Annotated[User, Depends(get_current_user_allow_temporary)]


def require_permission(permission: Permission) -> Callable[[User], User]:
    """Build a dependency that allows only roles holding ``permission``.

    The role is read from the database on every request, so a role change or
    deactivation takes effect immediately, not when the token expires.
    """

    def dependency(current_user: CurrentUser) -> User:
        if not has_permission(current_user, permission):
            raise HTTPException(
                status_code=403, detail="The user doesn't have enough privileges"
            )
        return current_user

    return dependency


def require_admin(current_user: CurrentUser) -> User:
    """Require the System Administrator role."""
    if not is_admin(current_user):
        raise HTTPException(
            status_code=403, detail="The user doesn't have enough privileges"
        )
    return current_user


def get_current_active_superuser(current_user: CurrentUser) -> User:
    """Backward-compatible name for existing template routes."""
    return require_admin(current_user)
