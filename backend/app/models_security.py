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
