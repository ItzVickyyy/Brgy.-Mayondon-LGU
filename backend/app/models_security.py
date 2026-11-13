"""Security-question answers for offline password recovery (step 13).

Three rows per person, one per chosen question. The answer is never stored:
only an Argon2 hash of the normalised answer (see ``core/security_questions``).
"""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, text
from sqlmodel import Field, SQLModel

from app.models import get_datetime_utc


class SecurityAnswer(SQLModel, table=True):
    __tablename__ = "security_answers"

    user_id: uuid.UUID = Field(
        sa_column=Column(
            ForeignKey("user.id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        )
    )
    question_id: str = Field(
        sa_column=Column(String(8), primary_key=True, nullable=False)
    )
    answer_hash: str = Field(sa_column=Column(String(255), nullable=False))
    updated_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_column=Column(
            DateTime(timezone=True), nullable=False, server_default=text("now()")
        ),
    )


class SecurityAnswerIn(SQLModel):
    question_id: str = Field(max_length=8)
    answer: str = Field(min_length=1, max_length=200)


class SecurityQuestionsSet(SQLModel):
    """Body of PUT /users/me/security-questions: exactly three questions."""

    current_password: str = Field(min_length=1, max_length=128)
    answers: list[SecurityAnswerIn] = Field(min_length=3, max_length=3)


class SecurityQuestionsStatus(SQLModel):
    configured: bool
    question_ids: list[str] = []
    updated_at: datetime | None = None


class SecurityQuestionsConfigured(SQLModel):
    configured: bool


class RecoveryQuestionsRequest(SQLModel):
    email: str = Field(min_length=3, max_length=255)


class RecoveryQuestions(SQLModel):
    question_ids: list[str]


class RecoveryReset(SQLModel):
    email: str = Field(min_length=3, max_length=255)
    answers: list[SecurityAnswerIn] = Field(min_length=3, max_length=3)
    new_password: str = Field(min_length=12, max_length=128)


# ----- two-factor sign-in (step 14) ------------------------------------------


class MfaRecoveryCode(SQLModel, table=True):
    """One of the ten one-time codes given when two-factor is switched on.

    Only an Argon2 hash is stored; a used code keeps its row (``used_at``) so
    the person can see how many are left.
    """

    __tablename__ = "mfa_recovery_codes"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        sa_column=Column(
            ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True
        )
    )
    code_hash: str = Field(sa_column=Column(String(255), nullable=False))
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_column=Column(
            DateTime(timezone=True), nullable=False, server_default=text("now()")
        ),
    )
    used_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )


class MfaStatus(SQLModel):
    # False while the server has no MFA_ENCRYPTION_KEY: nothing can be set up.
    available: bool
    enabled: bool
    # A secret was made but never confirmed with a code.
    setup_pending: bool = False
    enrolled_at: datetime | None = None
    recovery_codes_remaining: int = 0
    # The server's clock, so a wrong phone clock is easy to spot.
    server_time: datetime


class MfaConfigured(SQLModel):
    enabled: bool


class MfaSetupRequest(SQLModel):
    current_password: str = Field(min_length=1, max_length=128)


class MfaSetup(SQLModel):
    """Shown once while setting up: the QR code is drawn from ``otpauth_uri``."""

    secret: str
    otpauth_uri: str
    server_time: datetime


class MfaCode(SQLModel):
    code: str = Field(min_length=1, max_length=40)


class MfaCodeWithPassword(SQLModel):
    current_password: str = Field(min_length=1, max_length=128)
    code: str = Field(min_length=1, max_length=40)


class MfaRecoveryCodes(SQLModel):
    """Plain recovery codes: shown this once, never readable again."""

    recovery_codes: list[str]


class MfaLogin(SQLModel):
    mfa_token: str = Field(min_length=1, max_length=2000)
    code: str = Field(min_length=1, max_length=40)
