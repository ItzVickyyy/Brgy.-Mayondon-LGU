"""Temporary passwords set by an administrator must be changed at next sign-in (D-12)."""

import re
import uuid
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.core.security import DEFAULT_PASSWORD
from app.main import app
from app.models import User, UserRole
from app.utils import generate_password_reset_token
from tests.utils.user import create_user_with_role, user_authentication_headers
from tests.utils.utils import random_email, random_lower_string

API = settings.API_V1_STR
Headers = dict[str, str]

# The only endpoints a user with a temporary password may call.
EXEMPT = {("GET", f"{API}/users/me"), ("PATCH", f"{API}/users/me/password")}


def _create_temp_user(client: TestClient, admin: Headers) -> tuple[str, str, str]:
    email, password = random_email(), DEFAULT_PASSWORD
    with patch("app.api.routes.users.send_email", return_value=None):
        r = client.post(
            f"{API}/users/",
            headers=admin,
            json={"email": email},
        )
    assert r.status_code == 200, r.text
    return r.json()["id"], email, password


def _activity(client: TestClient, admin: Headers, uid: str) -> list[dict]:
    r = client.get(
        f"{API}/activity/", headers=admin, params={"record_id": uid, "module": "users"}
    )
    assert r.status_code == 200, r.text
    return r.json()["data"]


def _assert_blocked(response) -> None:  # noqa: ANN001
    assert response.status_code == 403, response.text
    assert response.json()["detail"]["code"] == "password_change_required"


def test_admin_created_user_must_change_password(
    client: TestClient, superuser_token_headers: Headers
) -> None:
    uid, _, password = _create_temp_user(client, superuser_token_headers)
    r = client.get(f"{API}/users/{uid}", headers=superuser_token_headers)
    assert r.json()["must_change_password"] is True
    rows = _activity(client, superuser_token_headers, uid)
    temp = [row for row in rows if row["action"] == "user.temp_password_set"]
    assert len(temp) == 1
    assert temp[0]["details"] == {"reason": "account_created"}
    assert password not in str(rows)


def test_user_with_temporary_password_can_only_read_me_and_change_password(
    client: TestClient, superuser_token_headers: Headers
) -> None:
    _, email, password = _create_temp_user(client, superuser_token_headers)
    headers = user_authentication_headers(client=client, email=email, password=password)
    r = client.get(f"{API}/users/me", headers=headers)
    assert r.status_code == 200
    assert r.json()["must_change_password"] is True
    for path in ("/users/", "/residents/", "/activity/", "/dashboard/"):
        _assert_blocked(client.get(f"{API}{path}", headers=headers))
    _assert_blocked(client.patch(f"{API}/users/me", headers=headers, json={}))
    _assert_blocked(client.delete(f"{API}/users/me", headers=headers))


def test_every_authenticated_route_enforces_the_password_change(
    client: TestClient, superuser_token_headers: Headers
) -> None:
    """A future route that forgets the check fails here.

    Every operation the OpenAPI schema marks as needing a sign-in must refuse a
    user with a temporary password, except the two exempt endpoints.
    """
    _, email, password = _create_temp_user(client, superuser_token_headers)
    headers = user_authentication_headers(client=client, email=email, password=password)
    checked = 0
    exempt_seen = set()
    for path, operations in app.openapi()["paths"].items():
        for method, operation in operations.items():
            if method.upper() not in {"GET", "POST", "PUT", "PATCH", "DELETE"}:
                continue
            if not operation.get("security"):
                continue  # public route
            key = (method.upper(), path)
            if key in EXEMPT:
                exempt_seen.add(key)
                continue
            url = re.sub(r"\{[^}]+\}", str(uuid.uuid4()), path)
            r = client.request(method.upper(), url, headers=headers)
            _assert_blocked(r)
            checked += 1
    assert exempt_seen == EXEMPT
    assert checked > 20


def test_changing_the_temporary_password_clears_the_flag(
    client: TestClient, superuser_token_headers: Headers
) -> None:
    uid, email, password = _create_temp_user(client, superuser_token_headers)
    old_headers = user_authentication_headers(
        client=client, email=email, password=password
    )
    new_password = random_lower_string()
    r = client.patch(
        f"{API}/users/me/password",
        headers=old_headers,
        json={"current_password": password, "new_password": new_password},
    )
    assert r.status_code == 200, r.text
    # The old token is tied to the old password and stops working.
    assert client.get(f"{API}/users/me", headers=old_headers).status_code == 403

    new_headers = user_authentication_headers(
        client=client, email=email, password=new_password
    )
    me = client.get(f"{API}/users/me", headers=new_headers).json()
    assert me["must_change_password"] is False
    assert client.get(f"{API}/residents/", headers=new_headers).status_code == 200

    rows = _activity(client, superuser_token_headers, uid)
    change = [row for row in rows if row["action"] == "user.password_change"]
    assert len(change) == 1
    assert change[0]["details"] == {"replaced_temporary": True}
    assert password not in str(rows) and new_password not in str(rows)


def test_temporary_password_cannot_be_kept(
    client: TestClient, superuser_token_headers: Headers
) -> None:
    _, email, password = _create_temp_user(client, superuser_token_headers)
    headers = user_authentication_headers(client=client, email=email, password=password)
    r = client.patch(
        f"{API}/users/me/password",
        headers=headers,
        json={"current_password": password, "new_password": password},
    )
    assert r.status_code == 400
    me = client.get(f"{API}/users/me", headers=headers).json()
    assert me["must_change_password"] is True


def test_admin_reset_of_another_account_is_temporary(
    client: TestClient, db: Session, superuser_token_headers: Headers
) -> None:
    user, password = create_user_with_role(db, UserRole.staff)
    assert user.must_change_password is False
    r = client.patch(
        f"{API}/users/{user.id}",
        headers=superuser_token_headers,
        json={"password": password},
    )
    assert r.status_code == 400  # a typed password for another account
    new_temp = DEFAULT_PASSWORD
    r = client.patch(
        f"{API}/users/{user.id}",
        headers=superuser_token_headers,
        json={"reset_to_default_password": True},
    )
    assert r.status_code == 200, r.text
    assert r.json()["must_change_password"] is True
    headers = user_authentication_headers(
        client=client, email=user.email, password=new_temp
    )
    _assert_blocked(client.get(f"{API}/residents/", headers=headers))
    reasons = [
        row["details"]["reason"]
        for row in _activity(client, superuser_token_headers, str(user.id))
        if row["action"] == "user.temp_password_set"
    ]
    assert reasons == ["password_reset"]


def test_admin_changing_own_password_is_not_temporary(
    client: TestClient, db: Session
) -> None:
    admin, password = create_user_with_role(db, UserRole.admin)
    headers = user_authentication_headers(
        client=client, email=admin.email, password=password
    )
    r = client.patch(
        f"{API}/users/{admin.id}",
        headers=headers,
        json={"password": random_lower_string()},
    )
    assert r.status_code == 200, r.text
    assert r.json()["must_change_password"] is False


def test_staff_cannot_set_another_users_password(
    client: TestClient, db: Session, staff_token_headers: Headers
) -> None:
    target, _ = create_user_with_role(db, UserRole.staff)
    r = client.patch(
        f"{API}/users/{target.id}",
        headers=staff_token_headers,
        json={"reset_to_default_password": True},
    )
    assert r.status_code == 403
    db.refresh(target)
    assert target.must_change_password is False


def test_clients_cannot_set_or_clear_the_flag(
    client: TestClient, db: Session, superuser_token_headers: Headers
) -> None:
    # Sending the field to the update endpoint is ignored.
    user, _ = create_user_with_role(db, UserRole.staff)
    r = client.patch(
        f"{API}/users/{user.id}",
        headers=superuser_token_headers,
        json={"must_change_password": True, "full_name": "Test Person"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["must_change_password"] is False

    uid, _, _ = _create_temp_user(client, superuser_token_headers)
    r = client.patch(
        f"{API}/users/{uid}",
        headers=superuser_token_headers,
        json={"must_change_password": False, "full_name": "Test Person"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["must_change_password"] is True

    # Creating with the field set to false still creates a temporary account.
    r = client.post(
        f"{API}/users/",
        headers=superuser_token_headers,
        json={
            "email": random_email(),
            "password": random_lower_string(),
            "must_change_password": False,
        },
    )
    assert r.status_code == 200, r.text
    assert r.json()["must_change_password"] is True


def test_reset_link_clears_the_flag(
    client: TestClient, db: Session, superuser_token_headers: Headers
) -> None:
    uid, email, _ = _create_temp_user(client, superuser_token_headers)
    user = db.get(User, uuid.UUID(uid))
    assert user is not None
    token = generate_password_reset_token(
        email=user.email, hashed_password=user.hashed_password
    )
    new_password = random_lower_string()
    r = client.post(
        f"{API}/reset-password/", json={"token": token, "new_password": new_password}
    )
    assert r.status_code == 200, r.text
    db.refresh(user)
    assert user.must_change_password is False
