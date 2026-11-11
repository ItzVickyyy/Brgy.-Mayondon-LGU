"""An administrator can see a locked account and unlock it without a new password (C12)."""

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import UserRole
from tests.utils.user import create_user_with_role, user_authentication_headers

API = settings.API_V1_STR
Headers = dict[str, str]


def _lock(client: TestClient, email: str) -> None:
    for _ in range(settings.LOGIN_MAX_FAILED_ATTEMPTS):
        r = client.post(
            f"{API}/login/access-token",
            data={"username": email, "password": "definitely-wrong-password"},
        )
        assert r.status_code == 400


def _user_row(client: TestClient, admin: Headers, uid: str) -> dict:
    r = client.get(f"{API}/users/", headers=admin, params={"limit": 100})
    assert r.status_code == 200, r.text
    return next(u for u in r.json()["data"] if u["id"] == uid)


def test_locked_account_is_visible_and_unlock_keeps_password(
    client: TestClient, db: Session, superuser_token_headers: Headers
) -> None:
    user, password = create_user_with_role(db, UserRole.staff)
    assert (
        _user_row(client, superuser_token_headers, str(user.id))["locked_until"] is None
    )

    _lock(client, user.email)
    assert _user_row(client, superuser_token_headers, str(user.id))["locked_until"]
    # The right password is refused while locked.
    r = client.post(
        f"{API}/login/access-token",
        data={"username": user.email, "password": password},
    )
    assert r.status_code == 400

    r = client.patch(
        f"{API}/users/{user.id}",
        headers=superuser_token_headers,
        json={"unlock": True},
    )
    assert r.status_code == 200, r.text
    assert r.json()["locked_until"] is None
    assert (
        _user_row(client, superuser_token_headers, str(user.id))["locked_until"] is None
    )
    # Same password works again.
    headers = user_authentication_headers(
        client=client, email=user.email, password=password
    )
    assert client.get(f"{API}/users/me", headers=headers).status_code == 200

    actions = [
        row["action"]
        for row in client.get(
            f"{API}/activity/",
            headers=superuser_token_headers,
            params={"record_id": str(user.id), "module": "users"},
        ).json()["data"]
    ]
    assert "user.unlock" in actions
    assert "user.update" not in actions  # no empty update row for unlock only


def test_staff_cannot_unlock(
    client: TestClient, db: Session, staff_token_headers: Headers
) -> None:
    user, _ = create_user_with_role(db, UserRole.staff)
    _lock(client, user.email)
    r = client.patch(
        f"{API}/users/{user.id}", headers=staff_token_headers, json={"unlock": True}
    )
    assert r.status_code == 403
    db.refresh(user)
    assert user.locked_until is not None


def test_admin_cannot_unlock_own_account(client: TestClient, db: Session) -> None:
    admin, password = create_user_with_role(db, UserRole.admin)
    headers = user_authentication_headers(
        client=client, email=admin.email, password=password
    )
    r = client.patch(f"{API}/users/{admin.id}", headers=headers, json={"unlock": True})
    assert r.status_code == 400
