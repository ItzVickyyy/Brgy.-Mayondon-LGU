import uuid
from datetime import UTC, datetime
from enum import StrEnum
from typing import Self

from pydantic import EmailStr, model_validator
from sqlalchemy import CheckConstraint, DateTime, Enum, false
from sqlmodel import Field, SQLModel


def get_datetime_utc() -> datetime:
    return datetime.now(UTC)


class UserRole(StrEnum):
    """Account roles. ``admin`` is shown in the UI as System Administrator."""

    admin = "admin"
    staff = "staff"


def _reconcile_role(model: UserCreate | UserUpdate) -> None:
    """Keep ``role`` and the legacy ``is_superuser`` flag describing the same thing.

    Clients may send either field. ``role`` is the source of truth; the flag is
    only kept for older API clients. Sending both with conflicting values is
    rejected instead of guessing which one was meant.
    """
    sent = model.model_fields_set
    role = model.role
    flag = model.is_superuser
    if "role" in sent and role is not None:
        if "is_superuser" in sent and flag is not None:
            if flag != (role == UserRole.admin):
                raise ValueError("role and is_superuser disagree")
        model.is_superuser = role == UserRole.admin
    elif "is_superuser" in sent and flag is not None:
        model.role = UserRole.admin if flag else UserRole.staff


# Shared properties
class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    # Legacy flag, always equal to (role == admin). Do not set it independently.
    is_superuser: bool = False
    role: UserRole = Field(
        default=UserRole.staff,
        sa_type=Enum(
            UserRole,
            native_enum=False,
            length=20,
            create_constraint=False,
            values_callable=lambda roles: [r.value for r in roles],
        ),
        sa_column_kwargs={"server_default": UserRole.staff.value},
    )
    full_name: str | None = Field(default=None, max_length=255)
    first_name: str | None = Field(default=None, max_length=100)
    middle_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    extension_name: str | None = Field(default=None, max_length=20)
    sex: str | None = Field(default=None, max_length=30)
    civil_status: str | None = Field(default=None, max_length=30)
    birthdate: str | None = Field(default=None, max_length=10)
    birthplace: str | None = Field(default=None, max_length=255)
    phone_number: str | None = Field(default=None, max_length=30)
    address: str | None = Field(default=None, max_length=500)
    governing_lgu: str | None = Field(default=None, max_length=255)
    profile_photo_url: str | None = Field(default=None, max_length=1000)


# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str = Field(min_length=12, max_length=128)

    @model_validator(mode="after")
    def _sync_role(self) -> Self:
        _reconcile_role(self)
        return self


class UserRegister(SQLModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=12, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on update, all are optional
class UserUpdate(SQLModel):
    email: EmailStr | None = Field(default=None, max_length=255)
    is_active: bool | None = None
    is_superuser: bool | None = None
    role: UserRole | None = None
    full_name: str | None = Field(default=None, max_length=255)
    password: str | None = Field(default=None, min_length=12, max_length=128)

    @model_validator(mode="after")
    def _sync_role(self) -> Self:
        _reconcile_role(self)
        return self


class UserUpdateMe(SQLModel):
    full_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)
    first_name: str | None = Field(default=None, max_length=100)
    middle_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    extension_name: str | None = Field(default=None, max_length=20)
    sex: str | None = Field(default=None, max_length=30)
    civil_status: str | None = Field(default=None, max_length=30)
    birthdate: str | None = Field(default=None, max_length=10)
    birthplace: str | None = Field(default=None, max_length=255)
    phone_number: str | None = Field(default=None, max_length=30)
    address: str | None = Field(default=None, max_length=500)
    governing_lgu: str | None = Field(default=None, max_length=255)
    profile_photo_url: str | None = Field(default=None, max_length=1000)


class UpdatePassword(SQLModel):
    current_password: str = Field(min_length=12, max_length=128)
    new_password: str = Field(min_length=12, max_length=128)


# Database model, database table inferred from class name
class User(UserBase, table=True):
    __table_args__ = (
        CheckConstraint("role IN ('admin', 'staff')", name="ck_user_role_valid"),
        CheckConstraint(
            "(role = 'admin') = is_superuser", name="ck_user_role_matches_superuser"
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str
    created_at: datetime | None = Field(default_factory=get_datetime_utc)
    failed_login_attempts: int = Field(default=0, nullable=False)
    locked_until: datetime | None = Field(default=None, nullable=True)
    # True while the password is a temporary one set by an administrator (D-12).
    # Not part of any create/update model, so clients can never set or clear it.
    must_change_password: bool = Field(
        default=False,
        sa_column_kwargs={"server_default": false()},
    )


class PasswordRecoveryRateLimit(SQLModel, table=True):
    bucket_key: str = Field(primary_key=True, max_length=64)
    window_started_at: datetime = Field(sa_type=DateTime(timezone=True), index=True)
    attempts: int = Field(default=1, nullable=False)


# Properties to return via API, id is always required
class UserPublic(UserBase):
    id: uuid.UUID
    created_at: datetime | None = None
    must_change_password: bool = False


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int


# Generic message
class Message(SQLModel):
    message: str


# JSON payload containing access token
class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


# Contents of JWT token
class TokenPayload(SQLModel):
    sub: str | None = None
    pwdv: str | None = None


class PasswordRecoveryRequest(SQLModel):
    email: EmailStr


class NewPassword(SQLModel):
    token: str
    new_password: str = Field(min_length=12, max_length=128)


# Foundation tables (lookups, officials, audit log). Imported last so they can
# reuse helpers above and so Alembic sees every table through ``app.models``.
from app import models_foundation  # noqa: E402,F401
from app import models_residents  # noqa: E402,F401
from app import models_issuance  # noqa: E402,F401
from app import models_backup  # noqa: E402,F401
from app import models_import  # noqa: E402,F401
