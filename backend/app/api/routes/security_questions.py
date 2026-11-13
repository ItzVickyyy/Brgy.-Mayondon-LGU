"""Offline password recovery by security questions (step 13).

Signed-out pair: ``POST /password-recovery/questions`` shows an account's three
questions, ``POST /password-recovery/reset`` checks the answers and sets a new
password. Signed-in: set your own questions, read their status; an
administrator can clear another person's questions.

Answers are normalised and stored only as Argon2 hashes. Nothing here ever
logs or returns an answer, and no response says which answer was wrong.
"""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import col, delete, select

from app import crud
from app.api.deps import CurrentUser, SessionDep, require_permission
from app.core import security_questions as sq
from app.core.audit import record_admin_action, record_audit_event
from app.core.password_recovery import (
    clear_recovery_questions_failures,
    is_password_recovery_rate_limited,
    record_recovery_questions_failure,
    recovery_questions_locked,
)
from app.core.permissions import Permission
from app.core.security import DEFAULT_PASSWORD, verify_password
from app.models import Message, User, UserUpdate
from app.models_security import (
    RecoveryQuestions,
    RecoveryQuestionsRequest,
    RecoveryReset,
    SecurityAnswer,
    SecurityAnswerIn,
    SecurityQuestionsConfigured,
    SecurityQuestionsSet,
    SecurityQuestionsStatus,
)

router = APIRouter(tags=["security-questions"])
require_user_admin = require_permission(Permission.USERS_MANAGE)

GENERIC_FAILURE = "The answers were not accepted."
TOO_MANY = "Too many attempts. Try again later."


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _stored_answers(session: SessionDep, user_id: uuid.UUID) -> list[SecurityAnswer]:
    rows = session.exec(
        select(SecurityAnswer)
        .where(col(SecurityAnswer.user_id) == user_id)
        .order_by(col(SecurityAnswer.question_id))
    ).all()
    return list(rows)


def _validate_answers(answers: list[SecurityAnswerIn]) -> None:
    ids = [a.question_id for a in answers]
    if len(set(ids)) != sq.QUESTIONS_REQUIRED or any(
        i not in sq.QUESTION_IDS for i in ids
    ):
        raise HTTPException(
            status_code=422, detail="Choose three different questions from the list."
        )
    normalized = [sq.normalize_answer(a.answer) for a in answers]
    if any(len(n) < sq.MIN_ANSWER_LENGTH for n in normalized):
        raise HTTPException(
            status_code=422,
            detail="Each answer needs at least two letters or digits.",
        )
    if len(set(normalized)) != len(normalized):
        raise HTTPException(
            status_code=422, detail="The three answers must be different."
        )


# ----- signed in -----------------------------------------------------------


@router.get("/users/me/security-questions", response_model=SecurityQuestionsStatus)
def read_my_security_questions(
    session: SessionDep, current_user: CurrentUser
) -> SecurityQuestionsStatus:
    """Which questions the signed-in person chose (never the answers)."""
    rows = _stored_answers(session, current_user.id)
    if len(rows) != sq.QUESTIONS_REQUIRED:
        return SecurityQuestionsStatus(configured=False)
    return SecurityQuestionsStatus(
        configured=True,
        question_ids=[r.question_id for r in rows],
        updated_at=max(r.updated_at for r in rows),
    )


@router.put("/users/me/security-questions", response_model=Message)
def set_my_security_questions(
    session: SessionDep, current_user: CurrentUser, body: SecurityQuestionsSet
) -> Message:
    """Choose three questions and answers. Needs the current password."""
    verified, _ = verify_password(body.current_password, current_user.hashed_password)
    if not verified:
        raise HTTPException(status_code=400, detail="Incorrect password")
    _validate_answers(body.answers)
    session.execute(
        delete(SecurityAnswer).where(col(SecurityAnswer.user_id) == current_user.id)
    )
    now = datetime.now(UTC)
    for item in body.answers:
        session.add(
            SecurityAnswer(
                user_id=current_user.id,
                question_id=item.question_id,
                answer_hash=sq.hash_answer(item.question_id, item.answer),
                updated_at=now,
            )
        )
    record_audit_event(
        session,
        action="auth.recovery_questions_set",
        actor=current_user,
        module="auth",
        record_type="user",
        record_id=current_user.id,
        details={"question_ids": sorted(a.question_id for a in body.answers)},
    )
    session.commit()
    return Message(message="Security questions saved")


@router.get(
    "/users/{user_id}/security-questions",
    response_model=SecurityQuestionsConfigured,
    dependencies=[Depends(require_user_admin)],
)
def read_user_security_questions(
    session: SessionDep, user_id: uuid.UUID
) -> SecurityQuestionsConfigured:
    """Administrator only: are this person's questions set? (never the answers)"""
    if not session.get(User, user_id):
        raise HTTPException(status_code=404, detail="User not found")
    return SecurityQuestionsConfigured(
        configured=len(_stored_answers(session, user_id)) == sq.QUESTIONS_REQUIRED
    )


@router.delete(
    "/users/{user_id}/security-questions",
    response_model=Message,
    dependencies=[Depends(require_user_admin)],
)
def clear_user_security_questions(
    session: SessionDep, user_id: uuid.UUID, current_user: CurrentUser
) -> Message:
    """Administrator only: clear another person's questions (they set them again)."""
    target = session.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="Change your own questions in My Account instead.",
        )
    session.execute(
        delete(SecurityAnswer).where(col(SecurityAnswer.user_id) == target.id)
    )
    record_admin_action(
        actor_id=current_user.id,
        action="auth.recovery_reset_by_admin",
        target_type="user",
        target_id=target.id,
    )
    record_audit_event(
        session,
        action="auth.recovery_reset_by_admin",
        actor=current_user,
        module="auth",
        record_type="user",
        record_id=target.id,
    )
    session.commit()
    return Message(message="Security questions cleared")


# ----- signed out ----------------------------------------------------------


@router.post("/password-recovery/questions", response_model=RecoveryQuestions)
def recovery_questions(
    body: RecoveryQuestionsRequest, request: Request, session: SessionDep
) -> RecoveryQuestions:
    """Show the three questions of an account.

    An unknown account, or one with no questions set, gets three questions
    chosen from the e-mail itself, so this page never reveals which accounts
    exist. Same limiter as the e-mail recovery request.
    """
    email = body.email.strip().lower()
    if is_password_recovery_rate_limited(
        session=session, email=email, client_ip=_client_ip(request)
    ):
        raise HTTPException(status_code=429, detail=TOO_MANY)
    user = crud.get_user_by_email(session=session, email=email)
    rows = _stored_answers(session, user.id) if user and user.is_active else []
    if len(rows) == sq.QUESTIONS_REQUIRED:
        return RecoveryQuestions(question_ids=[r.question_id for r in rows])
    return RecoveryQuestions(question_ids=sq.decoy_question_ids(email))


@router.post("/password-recovery/reset", response_model=Message)
def recovery_reset(
    body: RecoveryReset, request: Request, session: SessionDep
) -> Message:
    """Check all three answers and set a new password.

    Every failure looks the same. Five wrong attempts lock recovery for the
    account (and 30 per computer) for 30 minutes; normal sign-in is not locked.
    """
    email = body.email.strip().lower()
    client_ip = _client_ip(request)
    if recovery_questions_locked(session, email=email, client_ip=client_ip):
        raise HTTPException(status_code=429, detail=TOO_MANY)

    user = crud.get_user_by_email(session=session, email=email)
    rows = _stored_answers(session, user.id) if user and user.is_active else []
    by_id = {r.question_id: r for r in rows}
    given = {a.question_id: a.answer for a in body.answers}

    ok = (
        user is not None
        and len(rows) == sq.QUESTIONS_REQUIRED
        and set(given) == set(by_id)
        and len(body.answers) == sq.QUESTIONS_REQUIRED
    )
    if ok:
        # Check every answer (no early exit) so timing does not say which failed.
        results = [
            sq.verify_answer(qid, given[qid], by_id[qid].answer_hash) for qid in by_id
        ]
        ok = all(results)
    else:
        sq.spend_dummy_verification([a.answer for a in body.answers])

    if not ok or user is None:
        record_recovery_questions_failure(session, email=email, client_ip=client_ip)
        if user is not None:
            record_audit_event(
                session,
                action="auth.recovery_failed",
                actor=user,
                outcome="failed",
                module="auth",
                details={"method": "security_questions"},
                commit=True,
            )
        raise HTTPException(status_code=400, detail=GENERIC_FAILURE)

    if body.new_password == DEFAULT_PASSWORD:
        raise HTTPException(
            status_code=400,
            detail="The default password cannot be chosen as a password.",
        )
    # A new password replaces the stored hash, so every open sign-in for this
    # account stops working (the token carries a password fingerprint).
    crud.update_user(
        session=session,
        db_user=user,
        user_in=UserUpdate(password=body.new_password),
    )
    record_audit_event(
        session,
        action="auth.recovery_success",
        actor=user,
        module="auth",
        record_type="user",
        record_id=user.id,
        details={"method": "security_questions"},
        commit=True,
    )
    clear_recovery_questions_failures(session, email=email)
    return Message(message="Password updated successfully")
