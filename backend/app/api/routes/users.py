import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import col, func, select

from app import crud
from app.api.deps import (
    CurrentUser,
    CurrentUserAllowTemporary,
    SessionDep,
    require_permission,
)
from app.core.audit import record_admin_action, record_audit_event
from app.core.config import settings
from app.core.permissions import Permission, has_permission, is_admin
from app.core.security import DEFAULT_PASSWORD, get_password_hash, verify_password
from app.models import (
    Message,
    UpdatePassword,
    User,
    UserCreate,
    UserCreateByAdmin,
    UserPublic,
    UserRegister,
    UserRole,
    UsersPublic,
    UserUpdate,
    UserUpdateMe,
)
from app.models_issuance import Issuance
from app.utils import (
    generate_new_account_email,
    generate_password_reset_token,
    send_email,
)

router = APIRouter(prefix="/users", tags=["users"])

# Every account-management endpoint below requires this permission (admin only).
require_user_admin = require_permission(Permission.USERS_MANAGE)


@router.get(
    "/",
    dependencies=[Depends(require_user_admin)],
    response_model=UsersPublic,
)
def read_users(
    session: SessionDep,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=100),
) -> Any:
    """
    Retrieve users.
    """

    count_statement = select(func.count()).select_from(User)
    count = session.exec(count_statement).one()

    statement = (
        select(User).order_by(col(User.created_at).desc()).offset(skip).limit(limit)
    )
    users = session.exec(statement).all()

    users_public = [UserPublic.model_validate(user) for user in users]
    return UsersPublic(data=users_public, count=count)


@router.post(
    "/", dependencies=[Depends(require_user_admin)], response_model=UserPublic
)
def create_user(
    *, session: SessionDep, user_in: UserCreateByAdmin, current_user: CurrentUser
) -> Any:
    """
    Create new user. The account starts with the default password and must
    change it at the first sign-in; no password is accepted in the request.
    """
    user = crud.get_user_by_email(session=session, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system.",
        )

    user = crud.create_user(
        session=session,
        user_create=UserCreate(
            **user_in.model_dump(), password=DEFAULT_PASSWORD
        ),
        temporary=True,
    )
    record_admin_action(actor_id=current_user.id, action="user.create", target_type="user", target_id=user.id)
    record_audit_event(
        session,
        action="user.create",
        actor=current_user,
        module="users",
        record_type="user",
        record_id=user.id,
        details={"role": str(user.role)},
    )
    record_audit_event(
        session,
        action="user.temp_password_set",
        actor=current_user,
        module="users",
        record_type="user",
        record_id=user.id,
        details={"reason": "account_created"},
        commit=True,
    )
    if settings.emails_enabled and user_in.email:
        setup_token = generate_password_reset_token(
            email=user.email, hashed_password=user.hashed_password
        )
        email_data = generate_new_account_email(
            email_to=user.email, username=user.email, token=setup_token
        )
        send_email(
            email_to=user_in.email,
            subject=email_data.subject,
            html_content=email_data.html_content,
        )
    return user


@router.patch("/me", response_model=UserPublic)
def update_user_me(
    *, session: SessionDep, user_in: UserUpdateMe, current_user: CurrentUser
) -> Any:
    """
    Update own user.
    """

    if user_in.email:
        existing_user = crud.get_user_by_email(session=session, email=user_in.email)
        if existing_user and existing_user.id != current_user.id:
            raise HTTPException(
                status_code=409, detail="User with this email already exists"
            )
    user_data = user_in.model_dump(exclude_unset=True)
    current_user.sqlmodel_update(user_data)
    session.add(current_user)
    record_audit_event(
        session,
        action="user.update_self",
        actor=current_user,
        module="users",
        record_type="user",
        record_id=current_user.id,
        details={"fields": sorted(user_data)},
    )
    session.commit()
    session.refresh(current_user)
    return current_user


@router.patch("/me/password", response_model=Message)
def update_password_me(
    *, session: SessionDep, body: UpdatePassword, current_user: CurrentUserAllowTemporary
) -> Any:
    """
    Update own password.
    """
    verified, _ = verify_password(body.current_password, current_user.hashed_password)
    if not verified:
        raise HTTPException(status_code=400, detail="Incorrect password")
    if body.current_password == body.new_password:
        raise HTTPException(
            status_code=400, detail="New password cannot be the same as the current one"
        )
    hashed_password = get_password_hash(body.new_password)
    current_user.hashed_password = hashed_password
    replaced_temporary = current_user.must_change_password
    current_user.must_change_password = False
    # A password change releases any failed-login lockout for this account.
    current_user.failed_login_attempts = 0
    current_user.locked_until = None
    session.add(current_user)
    record_audit_event(
        session,
        action="user.password_change",
        actor=current_user,
        module="users",
        record_type="user",
        record_id=current_user.id,
        details={"replaced_temporary": True} if replaced_temporary else None,
    )
    session.commit()
    return Message(message="Password updated successfully")


@router.get("/me", response_model=UserPublic)
def read_user_me(current_user: CurrentUserAllowTemporary) -> Any:
    """
    Get current user.
    """
    return current_user


def _require_no_issued_documents(session: SessionDep, user: User) -> None:
    """An account that issued documents is deactivated, never deleted (decision 24)."""
    if session.exec(
        select(Issuance.id).where(Issuance.issued_by_user_id == user.id).limit(1)
    ).first():
        raise HTTPException(
            status_code=409,
            detail="This account has issued documents, so it cannot be deleted. "
            "Deactivate it instead.",
        )


@router.delete("/me", response_model=Message)
def delete_user_me(session: SessionDep, current_user: CurrentUser) -> Any:
    """
    Delete own user.
    """
    if is_admin(current_user):
        raise HTTPException(
            status_code=403, detail="Super users are not allowed to delete themselves"
        )
    _require_no_issued_documents(session, current_user)
    # Same transaction as the delete: the actor link becomes NULL afterwards,
    # and the email stays in the row.
    record_audit_event(
        session,
        action="user.delete_self",
        actor=current_user,
        module="users",
        record_type="user",
        record_id=current_user.id,
    )
    session.delete(current_user)
    session.commit()
    return Message(message="User deleted successfully")


@router.post("/signup", response_model=UserPublic)
def register_user(session: SessionDep, user_in: UserRegister) -> Any:
    """
    Create new user without the need to be logged in.

    Disabled by default (USERS_OPEN_REGISTRATION=False): accounts are created
    by an admin from the Admin page.
    """
    if not settings.USERS_OPEN_REGISTRATION:
        raise HTTPException(status_code=403, detail="Open registration is disabled")
    user = crud.get_user_by_email(session=session, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system",
        )
    user_create = UserCreate.model_validate(user_in)
    user = crud.create_user(session=session, user_create=user_create)
    return user


@router.get("/{user_id}", response_model=UserPublic)
def read_user_by_id(
    user_id: uuid.UUID, session: SessionDep, current_user: CurrentUser
) -> Any:
    """
    Get a specific user by id.
    """
    user = session.get(User, user_id)
    if user == current_user:
        return user
    if not has_permission(current_user, Permission.USERS_MANAGE):
        raise HTTPException(
            status_code=403,
            detail="The user doesn't have enough privileges",
        )
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch(
    "/{user_id}",
    dependencies=[Depends(require_user_admin)],
    response_model=UserPublic,
)
def update_user(
    *,
    session: SessionDep,
    user_id: uuid.UUID,
    user_in: UserUpdate,
    current_user: CurrentUser,
) -> Any:
    """
    Update a user.
    """

    db_user = session.get(User, user_id)
    if not db_user:
        raise HTTPException(
            status_code=404,
            detail="The user with this id does not exist in the system",
        )
    if user_in.email:
        existing_user = crud.get_user_by_email(session=session, email=user_in.email)
        if existing_user and existing_user.id != user_id:
            raise HTTPException(
                status_code=409, detail="User with this email already exists"
            )

    previous_role = db_user.role
    loses_admin = user_in.is_active is False or (
        user_in.role is not None and user_in.role != UserRole.admin
    )
    if loses_admin and crud.is_last_active_admin(session=session, user=db_user):
        raise HTTPException(
            status_code=400,
            detail="At least one active System Administrator must remain.",
        )

    changed_fields = sorted(user_in.model_dump(exclude_unset=True))
    is_self = db_user.id == current_user.id
    if user_in.password and user_in.password == DEFAULT_PASSWORD:
        raise HTTPException(
            status_code=400,
            detail="The default password cannot be chosen as a password.",
        )
    if user_in.password and not is_self:
        raise HTTPException(
            status_code=400,
            detail="Another account's password can only be reset to the default.",
        )
    if user_in.reset_to_default_password and is_self:
        raise HTTPException(
            status_code=400,
            detail="Use Change password to change your own password.",
        )
    if user_in.unlock and is_self:
        raise HTTPException(
            status_code=400, detail="An account cannot unlock itself."
        )
    temporary = user_in.reset_to_default_password and not is_self
    if temporary:
        # Never keep the flag or the default in the stored fields or the log.
        user_in = user_in.model_copy(update={"password": DEFAULT_PASSWORD})
    changed_fields = sorted(
        f
        for f in changed_fields
        if f not in ("password", "reset_to_default_password", "unlock")
    )
    previous_active = db_user.is_active
    db_user = crud.update_user(
        session=session, db_user=db_user, user_in=user_in, temporary=temporary
    )
    unlock_only = user_in.unlock and not changed_fields and not temporary
    if not unlock_only:
        record_admin_action(actor_id=current_user.id, action="user.update", target_type="user", target_id=db_user.id)
        record_audit_event(
            session,
            action="user.update",
            actor=current_user,
            module="users",
            record_type="user",
            record_id=db_user.id,
            details={
                "fields": changed_fields,
                # Lets the notification bell say activated or deactivated.
                **(
                    {"is_active": db_user.is_active}
                    if db_user.is_active != previous_active
                    else {}
                ),
            },
        )
    if user_in.unlock:
        record_audit_event(
            session,
            action="user.unlock",
            actor=current_user,
            module="users",
            record_type="user",
            record_id=db_user.id,
        )
    if temporary:
        record_audit_event(
            session,
            action="user.temp_password_set",
            actor=current_user,
            module="users",
            record_type="user",
            record_id=db_user.id,
            details={"reason": "password_reset"},
        )
    if db_user.role != previous_role:
        record_admin_action(actor_id=current_user.id, action="user.role_change", target_type="user", target_id=db_user.id)
        record_audit_event(
            session,
            action="user.role_change",
            actor=current_user,
            module="users",
            record_type="user",
            record_id=db_user.id,
            details={"from": str(previous_role), "to": str(db_user.role)},
        )
    session.commit()
    return db_user


@router.delete("/{user_id}", dependencies=[Depends(require_user_admin)])
def delete_user(
    session: SessionDep, current_user: CurrentUser, user_id: uuid.UUID
) -> Message:
    """
    Delete a user.
    """
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user == current_user:
        raise HTTPException(
            status_code=403, detail="Super users are not allowed to delete themselves"
        )
    if crud.is_last_active_admin(session=session, user=user):
        raise HTTPException(
            status_code=400,
            detail="At least one active System Administrator must remain.",
        )
    _require_no_issued_documents(session, user)
    record_audit_event(
        session,
        action="user.delete",
        actor=current_user,
        module="users",
        record_type="user",
        record_id=user_id,
    )
    session.delete(user)
    session.commit()
    record_admin_action(actor_id=current_user.id, action="user.delete", target_type="user", target_id=user_id)
    return Message(message="User deleted successfully")
