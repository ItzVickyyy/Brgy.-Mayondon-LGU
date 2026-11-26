import uuid
from datetime import UTC, datetime
from enum import StrEnum
from typing import Literal, Self

from pydantic import EmailStr, field_validator, model_validator
from sqlalchemy import JSON, CheckConstraint, DateTime, Enum, false
from sqlmodel import Field, SQLModel


def get_datetime_utc() -> datetime:
    return datetime.now(UTC)


class UserRole(StrEnum):
    """Account roles. ``admin`` is shown in the UI as System Administrator."""

    admin = "admin"
    staff = "staff"


def _reconcile_role(model: UserBase | UserUpdate) -> None:
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


class UserCreateByAdmin(UserBase):
    """Body of POST /users/. There is no password: the account starts with the
    default password and must change it at first sign-in."""

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
    # Name parts; when any is sent the display name is rebuilt from them.
    first_name: str | None = Field(default=None, max_length=100)
    middle_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    extension_name: str | None = Field(default=None, max_length=20)
    password: str | None = Field(default=None, min_length=12, max_length=128)
    # Administrator only, for another account: back to the default password,
    # with a forced change at the next sign-in.
    reset_to_default_password: bool = False
    # Administrator only, for another account: clear a failed-sign-in lockout
    # and leave the password as it is.
    unlock: bool = False

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


class UserPreferences(SQLModel):
    """Display preferences of one account. ``theme`` stays empty until the
    person has chosen one, so a new computer keeps following its own system."""

    theme: Literal["light", "dark", "system"] | None = None
    accent: Literal[
        "navy",
        "teal",
        "green",
        "purple",
        "maroon",
        "rose",
        "bronze",
        "olive",
        "sky",
        "slate",
    ] = "purple"
    font_size: Literal["small", "medium", "large"] = "medium"
    # Gold highlights (page-title bar, dialog edge, table header rule, active
    # menu icon). On unless the person switched them off.
    gold_accent: bool = True


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
    # When the password was last set. The password expires PASSWORD_MAX_AGE_DAYS
    # after this (patch 282). Every code path that sets a password stamps it.
    password_changed_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),
        nullable=True,
    )

    @property
    def password_expires_at(self) -> datetime | None:
        from app.core.security import password_expires_at

        return password_expires_at(self.password_changed_at)

    @property
    def password_expired(self) -> bool:
        from app.core.security import password_is_expired

        return password_is_expired(self.password_changed_at)

    # Two-factor sign-in (step 14). The secret is stored encrypted (see
    # core/mfa.py) and is never part of any response model. While
    # ``mfa_enabled`` is false a stored secret is a half-finished set-up.
    mfa_enabled: bool = Field(
        default=False,
        sa_column_kwargs={"server_default": false()},
    )
    mfa_secret_encrypted: str | None = Field(default=None, max_length=255)
    # The last 30-second step that was accepted: one code works only once.
    mfa_last_step: int | None = Field(default=None)
    mfa_enrolled_at: datetime | None = Field(
        default=None, sa_type=DateTime(timezone=True)
    )
    # An administrator asked this STAFF person to use two-factor (patch 77).
    # It is a request, never a block: it does not stop a sign-in.
    mfa_required: bool = Field(
        default=False,
        sa_column_kwargs={"server_default": false()},
    )
    # Display preferences (theme, accent, font size), kept per account so they
    # follow the person to any computer. Never part of UserPublic: they are read
    # and written only through /users/me/preferences.
    preferences: dict[str, str] | None = Field(default=None, sa_type=JSON)
    # The ``jti`` of the one sign-in token this account may use now (patch 259). A newer
    # sign-in replaces it, so the older computer is signed out. Never part of UserPublic.
    active_session_jti: str | None = Field(default=None, max_length=64)


class PasswordRecoveryRateLimit(SQLModel, table=True):
    bucket_key: str = Field(primary_key=True, max_length=64)
    window_started_at: datetime = Field(sa_type=DateTime(timezone=True), index=True)
    attempts: int = Field(default=1, nullable=False)


class RevokedToken(SQLModel, table=True):
    """A sign-in token ended by signing out; kept until the token would have expired anyway."""

    jti: str = Field(primary_key=True, max_length=64)
    expires_at: datetime = Field(sa_type=DateTime(timezone=True), index=True)


# Properties to return via API, id is always required
class UserPublic(UserBase):
    id: uuid.UUID
    created_at: datetime | None = None
    must_change_password: bool = False
    # True when the password is older than PASSWORD_MAX_AGE_DAYS (patch 282).
    password_expired: bool = False
    password_expires_at: datetime | None = None
    mfa_enabled: bool = False
    # Set only while the account is locked after too many failed sign-ins.
    locked_until: datetime | None = None

    @field_validator("locked_until")
    @classmethod
    def _only_while_locked(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        aware = value if value.tzinfo else value.replace(tzinfo=UTC)
        return value if aware > datetime.now(UTC) else None


class UserCreated(UserPublic):
    """Response of POST /users/: the new account plus whether the default
    password was sent to the person by e-mail. When it was not (no mail server,
    or the send failed) the administrator hands the default password over in
    person, so the screen shows it once."""

    password_emailed: bool = False


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


# Answer of the password step. Either a finished sign-in (``access_token``) or,
# for a person with two-factor on, only ``mfa_token``: a short single-purpose
# token that is good for nothing except POST /login/mfa.
class LoginResult(SQLModel):
    access_token: str | None = None
    token_type: str = "bearer"
    mfa_required: bool = False
    mfa_token: str | None = None


# Contents of JWT token
class TokenPayload(SQLModel):
    sub: str | None = None
    pwdv: str | None = None
    # Set only on the short two-factor token. A full sign-in token has none.
    purpose: str | None = None
    # Id of this sign-in token, so signing out can end it. Tokens made before it was added have none.
    jti: str | None = None
    # Only on the short "typed my password again" token: the one action it covers.
    scope: str | None = None


class ConfirmPasswordRequest(SQLModel):
    password: str = Field(min_length=1, max_length=128)
    scope: Literal["backup.restore", "backup.download"]


class ConfirmPasswordResult(SQLModel):
    confirm_token: str
    expires_in_seconds: int


class PasswordRecoveryRequest(SQLModel):
    email: EmailStr


class NewPassword(SQLModel):
    token: str
    new_password: str = Field(min_length=12, max_length=128)


# Foundation tables (lookups, officials, audit log). Imported last so they can
# reuse helpers above and so Alembic sees every table through ``app.models``.
# Registration order matters: keep isort off for this block.
# isort: off
from app import models_foundation  # noqa: E402,F401
from app import models_residents  # noqa: E402,F401
from app import models_issuance  # noqa: E402,F401
from app import models_backup  # noqa: E402,F401
from app import models_import  # noqa: E402,F401
from app import models_security  # noqa: E402,F401
from app import models_notification  # noqa: E402,F401
# isort: on
