"""The server command for a person who is locked out (step 14)."""

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, col, select

from app import account_recovery_cli as cli
from app.core import mfa
from app.core.config import settings
from app.core.security import verify_password
from app.models import User, UserRole
from app.models_foundation import AuditLog
from app.models_security import MfaRecoveryCode
from tests.api.routes.test_mfa import TEST_KEY, _enrol  # noqa: F401
from tests.utils.user import create_user_with_role, user_authentication_headers

API = settings.API_V1_STR


@pytest.fixture(autouse=True)
def _key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "MFA_ENCRYPTION_KEY", TEST_KEY)


def _audit_rows(db: Session, user: User, action: str) -> list[AuditLog]:
    db.expire_all()
    return list(
        db.exec(
            select(AuditLog).where(
                col(AuditLog.action) == action, col(AuditLog.record_id) == str(user.id)
            )
        ).all()
    )


def test_status_shows_what_is_set_up_and_no_secret(
    client: TestClient, db: Session
) -> None:
    user, _, _, secret, codes = _enrol(client, db)
    db.refresh(user)
    text = "\n".join(cli.status_lines(db, user))
    assert "Two-factor sign-in: on" in text and "Unused recovery codes: 10" in text
    assert secret not in text and not any(c in text for c in codes)


def test_reset_mfa_for_an_administrator(client: TestClient, db: Session) -> None:
    user, password, _, _, _ = _enrol(client, db, UserRole.admin)
    db.refresh(user)
    cli.reset_mfa(db, user)
    db.expire_all()
    row = db.get(User, user.id)
    assert row is not None
    assert (row.mfa_enabled, row.mfa_secret_encrypted) == (False, None)
    assert not db.exec(
        select(MfaRecoveryCode).where(col(MfaRecoveryCode.user_id) == user.id)
    ).all()
    entry = _audit_rows(db, user, "auth.mfa_reset_by_admin")
    assert len(entry) == 1 and "server" in (entry[0].reason or "").lower()
    r = client.post(
        f"{API}/login/access-token", data={"username": user.email, "password": password}
    )
    assert r.json()["access_token"]


def test_reset_password_ends_old_sessions_and_is_not_temporary(
    client: TestClient, db: Session
) -> None:
    user, password = create_user_with_role(db, UserRole.admin)
    old = user_authentication_headers(
        client=client, email=user.email, password=password
    )
    assert client.get(f"{API}/users/me", headers=old).status_code == 200
    with pytest.raises(cli.RecoveryError):
        cli.reset_password(db, user, "short")
    with pytest.raises(cli.RecoveryError):
        cli.reset_password(db, user, "ChangeThisPassword")
    cli.reset_password(db, user, "a-new-long-password-here")
    db.expire_all()
    row = db.get(User, user.id)
    assert row is not None and row.must_change_password is False
    assert verify_password("a-new-long-password-here", row.hashed_password)[0]
    assert client.get(f"{API}/users/me", headers=old).status_code == 403
    assert _audit_rows(db, user, "user.password_change")


def test_unlock_and_reset_questions(client: TestClient, db: Session) -> None:
    user, password = create_user_with_role(db, UserRole.staff)
    headers = user_authentication_headers(
        client=client, email=user.email, password=password
    )
    client.put(
        f"{API}/users/me/security-questions",
        headers=headers,
        json={
            "current_password": password,
            "answers": [
                {"question_id": "q01", "answer": "Maria"},
                {"question_id": "q02", "answer": "Pedro"},
                {"question_id": "q03", "answer": "Rizal"},
            ],
        },
    )
    cli.reset_questions(db, user)
    assert (
        client.get(f"{API}/users/me/security-questions", headers=headers).json()[
            "configured"
        ]
        is False
    )
    user.failed_login_attempts = 7
    db.add(user)
    db.commit()
    cli.unlock(db, user)
    db.expire_all()
    row = db.get(User, user.id)
    assert row is not None and row.failed_login_attempts == 0


def test_the_command_line_wants_the_typed_word_and_a_real_account(
    capsys: pytest.CaptureFixture[str],
) -> None:
    assert cli.main(["reset-mfa", "someone@example.com"]) == 2
    assert cli.main(["reset-password", "someone@example.com", "--confirm", "no"]) == 2
    assert "--confirm RESET" in capsys.readouterr().err
    assert cli.main(["status", "nobody-here@example.com"]) == 1
    assert "No account" in capsys.readouterr().err


def test_a_key_made_by_the_tool_is_long_enough() -> None:
    assert len(mfa.new_secret()) == 32
