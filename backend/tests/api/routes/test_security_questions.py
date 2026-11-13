"""Offline password recovery by security questions (step 13)."""

from fastapi.testclient import TestClient
from sqlmodel import Session, col, select

from app.core.config import settings
from app.core.password_recovery import clear_recovery_questions_failures
from app.core.security_questions import (
    QUESTION_IDS,
    decoy_question_ids,
    normalize_answer,
)
from app.models import User, UserRole
from app.models_foundation import AuditLog
from app.models_security import SecurityAnswer
from tests.utils.user import create_user_with_role, user_authentication_headers

API = settings.API_V1_STR
ANSWERS = {"q01": "Maria Santos", "q04": "Nagcarlan", "q07": "Blue Bird"}


def _set(client: TestClient, headers, password: str, answers=None, expect=200):
    answers = answers or ANSWERS
    body = {
        "current_password": password,
        "answers": [{"question_id": q, "answer": a} for q, a in answers.items()],
    }
    r = client.put(f"{API}/users/me/security-questions", headers=headers, json=body)
    assert r.status_code == expect, r.text
    return r


def _user_with_questions(client: TestClient, db: Session):
    user, password = create_user_with_role(db, UserRole.staff)
    headers = user_authentication_headers(
        client=client, email=user.email, password=password
    )
    _set(client, headers, password)
    return user, password, headers


def _reset(client: TestClient, email: str, answers=None, new="a brand new password"):
    answers = answers or ANSWERS
    return client.post(
        f"{API}/password-recovery/reset",
        json={
            "email": email,
            "answers": [{"question_id": q, "answer": a} for q, a in answers.items()],
            "new_password": new,
        },
    )


def _audit(db: Session, action: str, user: User) -> list[AuditLog]:
    db.expire_all()
    return list(
        db.exec(
            select(AuditLog).where(
                col(AuditLog.action) == action,
                col(AuditLog.actor_user_id) == user.id,
            )
        ).all()
    )


def test_normalize_answer() -> None:
    assert normalize_answer("  María   de la Cruz! ") == "maria de la cruz"
    assert normalize_answer("Peña, Jr.") == "pena jr"
    assert normalize_answer("---") == ""


def test_decoy_is_stable_and_valid() -> None:
    a = decoy_question_ids("nobody@example.com")
    assert a == decoy_question_ids(" NOBODY@example.com ")
    assert len(set(a)) == 3 and all(q in QUESTION_IDS for q in a)


def test_status_before_and_after_setting(client: TestClient, db: Session) -> None:
    user, password = create_user_with_role(db, UserRole.staff)
    headers = user_authentication_headers(
        client=client, email=user.email, password=password
    )
    r = client.get(f"{API}/users/me/security-questions", headers=headers)
    assert r.json() == {"configured": False, "question_ids": [], "updated_at": None}
    _set(client, headers, password)
    body = client.get(f"{API}/users/me/security-questions", headers=headers).json()
    assert body["configured"] is True
    assert body["question_ids"] == ["q01", "q04", "q07"]
    assert "answer" not in str(body).lower().replace("question", "")
    assert len(_audit(db, "auth.recovery_questions_set", user)) == 1


def test_answers_are_stored_hashed(client: TestClient, db: Session) -> None:
    user, _, _ = _user_with_questions(client, db)
    rows = db.exec(
        select(SecurityAnswer).where(col(SecurityAnswer.user_id) == user.id)
    ).all()
    assert len(rows) == 3
    for row in rows:
        assert row.answer_hash.startswith("$argon2")
        assert "nagcarlan" not in row.answer_hash.lower()
    entry = _audit(db, "auth.recovery_questions_set", user)[0]
    assert "nagcarlan" not in str(entry.details).lower()


def test_set_needs_correct_password(client: TestClient, db: Session) -> None:
    user, password = create_user_with_role(db, UserRole.staff)
    headers = user_authentication_headers(
        client=client, email=user.email, password=password
    )
    _set(client, headers, "not the password", expect=400)


def test_set_validation(client: TestClient, db: Session) -> None:
    user, password = create_user_with_role(db, UserRole.staff)
    headers = user_authentication_headers(
        client=client, email=user.email, password=password
    )
    _set(client, headers, password, {"q01": "a", "q02": "bb", "q03": "cc"}, 422)
    _set(client, headers, password, {"q01": "same", "q02": "Same!", "q03": "x y"}, 422)
    _set(client, headers, password, {"q01": "aa", "q02": "bb", "q99": "cc"}, 422)
    _set(client, headers, password, {"q01": "aa", "q02": "bb"}, 422)


def test_set_requires_sign_in(client: TestClient) -> None:
    r = client.get(f"{API}/users/me/security-questions")
    assert r.status_code == 401


def test_recovery_happy_path_ends_open_sign_ins(
    client: TestClient, db: Session
) -> None:
    user, password, headers = _user_with_questions(client, db)
    q = client.post(f"{API}/password-recovery/questions", json={"email": user.email})
    assert q.json() == {"question_ids": ["q01", "q04", "q07"]}
    # Answers are forgiving about case, accents, punctuation and spacing.
    r = _reset(
        client,
        user.email,
        {"q01": "  maria   SANTOS ", "q04": "Nagcárlan!", "q07": "blue-bird"},
    )
    assert r.status_code == 200, r.text
    # The old session and the old password stop working.
    assert client.get(f"{API}/users/me", headers=headers).status_code == 403
    bad = client.post(
        f"{API}/login/access-token",
        data={"username": user.email, "password": password},
    )
    assert bad.status_code == 400
    ok = client.post(
        f"{API}/login/access-token",
        data={"username": user.email, "password": "a brand new password"},
    )
    assert ok.status_code == 200
    assert len(_audit(db, "auth.recovery_success", user)) == 1
    clear_recovery_questions_failures(db, email=user.email)


def test_wrong_answer_is_generic_and_audited(client: TestClient, db: Session) -> None:
    user, _, _ = _user_with_questions(client, db)
    wrong = dict(ANSWERS, q04="Manila")
    r = _reset(client, user.email, wrong)
    assert r.status_code == 400
    wrong_other = dict(ANSWERS, q07="Red Bird")
    r2 = _reset(client, user.email, wrong_other)
    assert r.json() == r2.json()  # never says which answer was wrong
    entries = _audit(db, "auth.recovery_failed", user)
    assert len(entries) == 2
    assert all("manila" not in str(e.details).lower() for e in entries)
    clear_recovery_questions_failures(db, email=user.email)


def test_unknown_email_looks_the_same(client: TestClient, db: Session) -> None:
    email = "ghost.person@nowhere.test"
    q = client.post(f"{API}/password-recovery/questions", json={"email": email})
    assert q.status_code == 200
    assert len(q.json()["question_ids"]) == 3
    r = _reset(client, email)
    assert r.status_code == 400
    assert r.json()["detail"] == "The answers were not accepted."
    clear_recovery_questions_failures(db, email=email)


def test_user_without_questions_gets_decoys_and_cannot_reset(
    client: TestClient, db: Session
) -> None:
    user, _ = create_user_with_role(db, UserRole.staff)
    q = client.post(f"{API}/password-recovery/questions", json={"email": user.email})
    assert q.json()["question_ids"] == decoy_question_ids(user.email)
    assert _reset(client, user.email).status_code == 400
    clear_recovery_questions_failures(db, email=user.email)


def test_five_wrong_attempts_lock_recovery_not_sign_in(
    client: TestClient, db: Session
) -> None:
    user, password, _ = _user_with_questions(client, db)
    wrong = dict(ANSWERS, q04="Manila")
    for _ in range(settings.RECOVERY_QUESTIONS_MAX_FAILED_ATTEMPTS):
        assert _reset(client, user.email, wrong).status_code == 400
    # Even the right answers are refused while locked.
    assert _reset(client, user.email).status_code == 429
    # Normal sign-in is not locked.
    ok = client.post(
        f"{API}/login/access-token",
        data={"username": user.email, "password": password},
    )
    assert ok.status_code == 200
    clear_recovery_questions_failures(db, email=user.email)


def test_default_password_refused(client: TestClient, db: Session) -> None:
    user, _, _ = _user_with_questions(client, db)
    r = _reset(client, user.email, new="ChangeThisPassword")
    assert r.status_code == 400
    clear_recovery_questions_failures(db, email=user.email)


def test_inactive_user_cannot_recover(client: TestClient, db: Session) -> None:
    user, _, _ = _user_with_questions(client, db)
    user.is_active = False
    db.add(user)
    db.commit()
    assert _reset(client, user.email).status_code == 400
    clear_recovery_questions_failures(db, email=user.email)


def test_admin_status_and_clear(
    client: TestClient, db: Session, superuser_token_headers: dict[str, str]
) -> None:
    user, _, _ = _user_with_questions(client, db)
    r = client.get(
        f"{API}/users/{user.id}/security-questions", headers=superuser_token_headers
    )
    assert r.json() == {"configured": True}
    r = client.delete(
        f"{API}/users/{user.id}/security-questions", headers=superuser_token_headers
    )
    assert r.status_code == 200
    r = client.get(
        f"{API}/users/{user.id}/security-questions", headers=superuser_token_headers
    )
    assert r.json() == {"configured": False}
    admin = db.exec(
        select(User).where(col(User.email) == settings.FIRST_SUPERUSER)
    ).one()
    db.expire_all()
    rows = db.exec(
        select(AuditLog).where(
            col(AuditLog.action) == "auth.recovery_reset_by_admin",
            col(AuditLog.record_id) == str(user.id),
        )
    ).all()
    assert len(rows) == 1 and rows[0].actor_user_id == admin.id
    # Cleared questions can no longer recover the account.
    assert _reset(client, user.email).status_code == 400
    clear_recovery_questions_failures(db, email=user.email)


def test_admin_cannot_clear_own_questions(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    me = client.get(f"{API}/users/me", headers=superuser_token_headers).json()
    r = client.delete(
        f"{API}/users/{me['id']}/security-questions", headers=superuser_token_headers
    )
    assert r.status_code == 400


def test_staff_cannot_use_admin_endpoints(
    client: TestClient, db: Session, staff_token_headers: dict[str, str]
) -> None:
    user, _ = create_user_with_role(db, UserRole.staff)
    for method in (client.get, client.delete):
        r = method(
            f"{API}/users/{user.id}/security-questions", headers=staff_token_headers
        )
        assert r.status_code == 403


def test_deleting_a_user_removes_their_answers(
    client: TestClient, db: Session, superuser_token_headers: dict[str, str]
) -> None:
    user, _, _ = _user_with_questions(client, db)
    user_id = user.id
    r = client.delete(f"{API}/users/{user_id}", headers=superuser_token_headers)
    assert r.status_code == 200, r.text
    db.expire_all()
    left = db.exec(
        select(SecurityAnswer).where(col(SecurityAnswer.user_id) == user_id)
    ).all()
    assert left == []
