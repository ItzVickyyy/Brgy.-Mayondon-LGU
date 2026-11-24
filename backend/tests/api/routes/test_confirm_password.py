"""Typing the password again before Restore and Download copy (patch 253)."""

from datetime import UTC, datetime, timedelta

import jwt
from fastapi.testclient import TestClient
from sqlmodel import Session, col, select

from app.core import security
from app.core.config import settings
from app.core.db import engine
from app.models import User
from app.models_foundation import AuditLog
from tests.utils.utils import confirmed_headers

API = settings.API_V1_STR
CONFIRM = f"{API}/login/confirm-password"
FAKE_ID = "00000000-0000-0000-0000-000000000001"


def _failed_events() -> list[AuditLog]:
    with Session(engine) as session:
        return list(
            session.exec(
                select(AuditLog).where(col(AuditLog.action) == "auth.confirm_failed")
            ).all()
        )


def _admin() -> User:
    with Session(engine) as session:
        user = session.exec(
            select(User).where(col(User.email) == settings.FIRST_SUPERUSER)
        ).one()
        session.expunge(user)
        return user


def _ask(
    client: TestClient,
    headers: dict[str, str],
    password: str,
    scope: str = "backup.restore",
):
    return client.post(
        CONFIRM, headers=headers, json={"password": password, "scope": scope}
    )


def test_right_password_gives_a_short_token_for_one_scope(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    response = _ask(client, superuser_token_headers, settings.FIRST_SUPERUSER_PASSWORD)
    assert response.status_code == 200
    body = response.json()
    assert body["expires_in_seconds"] == settings.CONFIRM_TOKEN_EXPIRE_SECONDS
    payload = jwt.decode(
        body["confirm_token"], settings.SECRET_KEY, algorithms=[security.ALGORITHM]
    )
    assert payload["purpose"] == "confirm" and payload["scope"] == "backup.restore"
    assert "password" not in str(payload)


def test_wrong_password_is_refused_and_recorded(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    before = len(_failed_events())
    response = _ask(
        client, superuser_token_headers, "definitely-not-it", "backup.download"
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Incorrect password"
    events = _failed_events()
    assert len(events) == before + 1
    assert events[-1].details == {
        "scope": "backup.download",
        "reason": "incorrect_password",
    }
    assert "definitely-not-it" not in str(events[-1].details)


def test_wrong_passwords_count_toward_the_account_lock(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    for _ in range(settings.LOGIN_MAX_FAILED_ATTEMPTS):
        response = _ask(client, superuser_token_headers, "nope-nope-nope")
        assert response.status_code == 400
    assert "Too many wrong attempts" in response.json()["detail"]
    # Even the right password waits while the account is locked.
    still = _ask(client, superuser_token_headers, settings.FIRST_SUPERUSER_PASSWORD)
    assert still.status_code == 400
    with Session(engine) as session:  # leave the shared admin account usable
        user = session.exec(
            select(User).where(col(User.email) == settings.FIRST_SUPERUSER)
        ).one()
        user.locked_until = None
        user.failed_login_attempts = 0
        session.add(user)
        session.commit()


def test_scope_must_be_one_of_the_known_actions(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    response = _ask(
        client,
        superuser_token_headers,
        settings.FIRST_SUPERUSER_PASSWORD,
        "users.delete",
    )
    assert response.status_code == 422


def test_confirm_needs_a_sign_in(client: TestClient) -> None:
    response = client.post(CONFIRM, json={"password": "x", "scope": "backup.restore"})
    assert response.status_code == 401


def test_restore_and_download_refuse_without_the_token(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    for method, suffix in [("get", "download"), ("post", "restore-request")]:
        response = client.request(
            method,
            f"{API}/backups/{FAKE_ID}/{suffix}",
            headers=superuser_token_headers,
        )
        assert response.status_code == 403
        assert response.json()["detail"]["code"] == "password_confirmation_required"


def test_a_token_for_the_other_action_is_refused(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    download = confirmed_headers(client, superuser_token_headers, "backup.download")
    refused = client.post(f"{API}/backups/{FAKE_ID}/restore-request", headers=download)
    assert refused.status_code == 403
    assert refused.json()["detail"]["code"] == "password_confirmation_required"
    # The matching token gets past the check (this backup simply does not exist).
    restore = confirmed_headers(client, superuser_token_headers, "backup.restore")
    assert (
        client.post(
            f"{API}/backups/{FAKE_ID}/restore-request", headers=restore
        ).status_code
        == 404
    )


def test_an_expired_or_stale_or_foreign_token_is_refused(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    admin = _admin()
    url = f"{API}/backups/{FAKE_ID}/restore-request"

    def with_claims(**changes: object) -> dict[str, str]:
        claims: dict[str, object] = {
            "exp": datetime.now(UTC) + timedelta(minutes=2),
            "sub": str(admin.id),
            "pwdv": security.password_fingerprint(admin.hashed_password),
            "purpose": "confirm",
            "scope": "backup.restore",
        }
        claims.update(changes)
        token = jwt.encode(claims, settings.SECRET_KEY, algorithm=security.ALGORITHM)
        return {**superuser_token_headers, "X-Confirm-Token": token}

    # Sanity: the same claims, untouched, are accepted.
    assert client.post(url, headers=with_claims()).status_code == 404
    refused = {
        "expired": with_claims(exp=datetime.now(UTC) - timedelta(seconds=5)),
        "stale password": with_claims(pwdv="old-password-fingerprint"),
        "someone else": with_claims(sub=FAKE_ID),
        "not a confirm token": with_claims(purpose=None),
    }
    for name, headers in refused.items():
        response = client.post(url, headers=headers)
        assert response.status_code == 403, name
        assert response.json()["detail"]["code"] == "password_confirmation_required"
    garbage = {**superuser_token_headers, "X-Confirm-Token": "not-a-token"}
    assert client.post(url, headers=garbage).status_code == 403


def test_a_confirm_token_is_never_a_sign_in(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    token = confirmed_headers(client, superuser_token_headers, "backup.restore")[
        "X-Confirm-Token"
    ]
    response = client.get(
        f"{API}/users/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 403


def test_staff_still_get_the_privileges_answer(
    client: TestClient, staff_token_headers: dict[str, str]
) -> None:
    response = client.post(
        f"{API}/backups/{FAKE_ID}/restore-request", headers=staff_token_headers
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "The user doesn't have enough privileges"
