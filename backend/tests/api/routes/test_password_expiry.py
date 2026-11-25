"""A password is good for 90 days; after that only the change-password calls work (patch 282)."""

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, col, update

from app.core.config import settings
from app.core.security import DEFAULT_PASSWORD
from app.models import User, UserRole
from tests.utils.user import create_user_with_role, user_authentication_headers
from tests.utils.utils import random_lower_string

API = settings.API_V1_STR
Headers = dict[str, str]


def _age_password(db: Session, user: User, days: int) -> None:
    """Make the account's password ``days`` old (a real UPDATE, then forget the cache)."""
    db.exec(
        update(User)
        .where(col(User.id) == user.id)
        .values(password_changed_at=datetime.now(UTC) - timedelta(days=days))
    )
    db.commit()
    db.expire_all()


def test_new_password_is_valid_for_ninety_days(client: TestClient, db: Session) -> None:
    user, password = create_user_with_role(db, UserRole.staff)
    headers = user_authentication_headers(
        client=client, email=user.email, password=password
    )
    me = client.get(f"{API}/users/me", headers=headers).json()
    assert me["password_expired"] is False
    expires = datetime.fromisoformat(me["password_expires_at"])
    left = expires - datetime.now(UTC)
    assert timedelta(days=89) < left <= timedelta(days=90)
    assert client.get(f"{API}/residents/", headers=headers).status_code == 200


def test_old_password_blocks_everything_but_the_change(
    client: TestClient, db: Session
) -> None:
    user, password = create_user_with_role(db, UserRole.staff)
    headers = user_authentication_headers(
        client=client, email=user.email, password=password
    )
    _age_password(db, user, 91)

    # Signed in with the old password: allowed to read who they are, nothing else.
    me = client.get(f"{API}/users/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["password_expired"] is True
    assert me.json()["must_change_password"] is False
    for path in ("/residents/", "/activity/", "/dashboard/"):
        blocked = client.get(f"{API}{path}", headers=headers)
        assert blocked.status_code == 403, path
        assert blocked.json()["detail"]["code"] == "password_change_required"

    # The change itself is allowed, and afterwards the account works again.
    new_password = random_lower_string()
    changed = client.patch(
        f"{API}/users/me/password",
        headers=headers,
        json={"current_password": password, "new_password": new_password},
    )
    assert changed.status_code == 200, changed.text
    fresh = user_authentication_headers(
        client=client, email=user.email, password=new_password
    )
    me = client.get(f"{API}/users/me", headers=fresh).json()
    assert me["password_expired"] is False
    assert client.get(f"{API}/residents/", headers=fresh).status_code == 200


def test_ninety_day_limit_is_exact(client: TestClient, db: Session) -> None:
    user, password = create_user_with_role(db, UserRole.staff)
    headers = user_authentication_headers(
        client=client, email=user.email, password=password
    )
    _age_password(db, user, 89)
    assert client.get(f"{API}/residents/", headers=headers).status_code == 200
    _age_password(db, user, 91)
    assert client.get(f"{API}/residents/", headers=headers).status_code == 403


def test_the_rule_can_be_switched_off(
    client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "PASSWORD_MAX_AGE_DAYS", 0)
    user, password = create_user_with_role(db, UserRole.staff)
    headers = user_authentication_headers(
        client=client, email=user.email, password=password
    )
    _age_password(db, user, 400)
    me = client.get(f"{API}/users/me", headers=headers).json()
    assert me["password_expired"] is False
    assert me["password_expires_at"] is None
    assert client.get(f"{API}/residents/", headers=headers).status_code == 200


def test_account_with_no_recorded_date_is_not_locked_out(
    client: TestClient, db: Session
) -> None:
    user, password = create_user_with_role(db, UserRole.staff)
    headers = user_authentication_headers(
        client=client, email=user.email, password=password
    )
    db.exec(
        update(User).where(col(User.id) == user.id).values(password_changed_at=None)
    )
    db.commit()
    db.expire_all()
    assert client.get(f"{API}/residents/", headers=headers).status_code == 200


def test_administrator_reset_starts_a_new_period(
    client: TestClient, db: Session, superuser_token_headers: Headers
) -> None:
    user, _ = create_user_with_role(db, UserRole.staff)
    _age_password(db, user, 200)
    r = client.patch(
        f"{API}/users/{user.id}",
        headers=superuser_token_headers,
        json={"reset_to_default_password": True},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["must_change_password"] is True
    assert body["password_expired"] is False
    headers = user_authentication_headers(
        client=client, email=user.email, password=DEFAULT_PASSWORD
    )
    me = client.get(f"{API}/users/me", headers=headers).json()
    assert me["password_expired"] is False
