"""Wrong sign-ins are also counted per computer, so one password cannot be tried on every account."""

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings

API = settings.API_V1_STR


def _login(client: TestClient, email: str, password: str) -> int:
    return client.post(
        f"{API}/login/access-token", data={"username": email, "password": password}
    ).status_code


def test_unknown_emails_count_and_lock_the_computer(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "LOGIN_MAX_FAILED_ATTEMPTS_PER_IP", 4)
    for number in range(4):
        assert _login(client, f"nobody{number}@example.com", "wrong") == 400
    # Limit reached: even the right password is refused until the wait is over.
    assert (
        _login(client, settings.FIRST_SUPERUSER, settings.FIRST_SUPERUSER_PASSWORD)
        == 429
    )


def test_one_password_on_many_accounts_is_stopped(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "LOGIN_MAX_FAILED_ATTEMPTS_PER_IP", 3)
    # Each account is tried once, so no single account would ever lock.
    for email in ("a@example.com", "b@example.com", settings.FIRST_SUPERUSER):
        assert _login(client, email, "ChangeThisPassword") == 400
    assert _login(client, "c@example.com", "ChangeThisPassword") == 429


def test_a_good_sign_in_does_not_reset_the_count(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "LOGIN_MAX_FAILED_ATTEMPTS_PER_IP", 3)
    assert _login(client, "x@example.com", "wrong") == 400
    assert (
        _login(client, settings.FIRST_SUPERUSER, settings.FIRST_SUPERUSER_PASSWORD)
        == 200
    )
    assert _login(client, "y@example.com", "wrong") == 400
    assert _login(client, "z@example.com", "wrong") == 400
    assert _login(client, "w@example.com", "wrong") == 429


def test_normal_use_is_not_affected(client: TestClient) -> None:
    assert _login(client, "x@example.com", "wrong") == 400
    assert (
        _login(client, settings.FIRST_SUPERUSER, settings.FIRST_SUPERUSER_PASSWORD)
        == 200
    )
