import logging
import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app import crud
from app.core.config import settings
from app.core.security import DEFAULT_PASSWORD, verify_password
from app.models import User, UserCreate
from tests.utils.user import create_random_user
from tests.utils.utils import random_email, random_lower_string


def test_get_users_superuser_me(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.get(f"{settings.API_V1_STR}/users/me", headers=superuser_token_headers)
    current_user = r.json()
    assert current_user
    assert current_user["is_active"] is True
    assert current_user["is_superuser"]
    assert current_user["email"] == settings.FIRST_SUPERUSER


def test_get_users_normal_user_me(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    r = client.get(f"{settings.API_V1_STR}/users/me", headers=normal_user_token_headers)
    current_user = r.json()
    assert current_user
    assert current_user["is_active"] is True
    assert current_user["is_superuser"] is False
    assert current_user["email"] == settings.EMAIL_TEST_USER


def _mail_settings():
    return (
        patch("app.core.config.settings.SMTP_HOST", "smtp.example.com"),
        patch("app.core.config.settings.SMTP_USER", "admin@example.com"),
        patch("app.core.config.settings.EMAILS_FROM_EMAIL", "admin@example.com"),
    )


def test_create_user_new_email(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO, logger="app.audit")
    m1, m2, m3 = _mail_settings()
    with (
        patch("app.api.routes.users.send_email", return_value=True) as send_email_mock,
        m1,
        m2,
        m3,
    ):
        username = random_email()
        data = {
            "email": username,
            "first_name": "  Maria ",
            "middle_name": "Reyes",
            "last_name": "Santos",
            "extension_name": "Jr.",
            "password": "ignored-typed-password-1",
        }
        r = client.post(
            f"{settings.API_V1_STR}/users/",
            headers=superuser_token_headers,
            json=data,
        )
        assert 200 <= r.status_code < 300
        created_user = r.json()
        user = crud.get_user_by_email(session=db, email=username)
        assert user
        assert user.email == created_user["email"]
        assert created_user["password_emailed"] is True
        assert created_user["must_change_password"] is True
        assert created_user["first_name"] == "Maria"
        assert created_user["full_name"] == "Maria Reyes Santos Jr."
        send_email_mock.assert_called_once()
        sent_html = send_email_mock.call_args.kwargs["html_content"]
        assert DEFAULT_PASSWORD in sent_html
        assert "ignored-typed-password-1" not in sent_html
        assert "reset-password?token=" not in sent_html
        assert '"action":"user.create"' in caplog.text
        assert '"target_type":"user"' in caplog.text
        # The audit entry records how the password was handed over, never the
        # password itself.
        rows = client.get(
            f"{settings.API_V1_STR}/activity/",
            headers=superuser_token_headers,
            params={"record_id": created_user["id"], "module": "users"},
        ).json()["data"]
        created = [row for row in rows if row["action"] == "user.create"]
        assert len(created) == 1
        assert created[0]["details"] == {"role": "staff", "password_emailed": True}
        assert DEFAULT_PASSWORD not in str(rows)
        assert DEFAULT_PASSWORD not in caplog.text
        # The default password really signs the account in.
        assert verify_password(DEFAULT_PASSWORD, user.hashed_password)


def test_create_user_without_mail_server_reports_not_emailed(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    with patch("app.api.routes.users.send_email") as send_email_mock:
        r = client.post(
            f"{settings.API_V1_STR}/users/",
            headers=superuser_token_headers,
            json={"email": random_email(), "first_name": "Ana", "last_name": "Cruz"},
        )
    assert r.status_code == 200, r.text
    assert r.json()["password_emailed"] is False
    assert r.json()["full_name"] == "Ana Cruz"
    send_email_mock.assert_not_called()


@pytest.mark.parametrize("failure", ["refused", "error"])
def test_create_user_survives_a_failed_email(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    failure: str,
) -> None:
    m1, m2, m3 = _mail_settings()
    mock_kwargs = (
        {"return_value": False} if failure == "refused" else {"side_effect": OSError}
    )
    with patch("app.api.routes.users.send_email", **mock_kwargs), m1, m2, m3:
        email = random_email()
        r = client.post(
            f"{settings.API_V1_STR}/users/",
            headers=superuser_token_headers,
            json={"email": email, "first_name": "Ana", "last_name": "Cruz"},
        )
    assert r.status_code == 200, r.text
    assert r.json()["password_emailed"] is False
    assert crud.get_user_by_email(session=db, email=email) is not None


def test_create_user_keeps_a_sent_full_name_when_no_name_parts(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/users/",
        headers=superuser_token_headers,
        json={"email": random_email(), "full_name": "Old Style"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["full_name"] == "Old Style"


def test_get_existing_user_as_superuser(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    username = random_email()
    password = random_lower_string()
    user_in = UserCreate(email=username, password=password)
    user = crud.create_user(session=db, user_create=user_in)
    user_id = user.id
    r = client.get(
        f"{settings.API_V1_STR}/users/{user_id}",
        headers=superuser_token_headers,
    )
    assert 200 <= r.status_code < 300
    api_user = r.json()
    existing_user = crud.get_user_by_email(session=db, email=username)
    assert existing_user
    assert existing_user.email == api_user["email"]


def test_get_non_existing_user_as_superuser(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.get(
        f"{settings.API_V1_STR}/users/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404
    assert r.json() == {"detail": "User not found"}


def test_get_existing_user_current_user(client: TestClient, db: Session) -> None:
    username = random_email()
    password = random_lower_string()
    user_in = UserCreate(email=username, password=password)
    user = crud.create_user(session=db, user_create=user_in)
    user_id = user.id

    login_data = {
        "username": username,
        "password": password,
    }
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    tokens = r.json()
    a_token = tokens["access_token"]
    headers = {"Authorization": f"Bearer {a_token}"}

    r = client.get(
        f"{settings.API_V1_STR}/users/{user_id}",
        headers=headers,
    )
    assert 200 <= r.status_code < 300
    api_user = r.json()
    existing_user = crud.get_user_by_email(session=db, email=username)
    assert existing_user
    assert existing_user.email == api_user["email"]


def test_get_existing_user_permissions_error(
    db: Session,
    client: TestClient,
    normal_user_token_headers: dict[str, str],
) -> None:
    user = create_random_user(db)

    r = client.get(
        f"{settings.API_V1_STR}/users/{user.id}",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 403
    assert r.json() == {"detail": "The user doesn't have enough privileges"}


def test_get_non_existing_user_permissions_error(
    client: TestClient,
    normal_user_token_headers: dict[str, str],
) -> None:
    user_id = uuid.uuid4()

    r = client.get(
        f"{settings.API_V1_STR}/users/{user_id}",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 403
    assert r.json() == {"detail": "The user doesn't have enough privileges"}


def test_create_user_existing_username(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    username = random_email()
    # username = email
    password = random_lower_string()
    user_in = UserCreate(email=username, password=password)
    crud.create_user(session=db, user_create=user_in)
    data = {"email": username, "password": password}
    r = client.post(
        f"{settings.API_V1_STR}/users/",
        headers=superuser_token_headers,
        json=data,
    )
    created_user = r.json()
    assert r.status_code == 400
    assert "_id" not in created_user


def test_create_user_by_normal_user(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    username = random_email()
    password = random_lower_string()
    data = {"email": username, "password": password}
    r = client.post(
        f"{settings.API_V1_STR}/users/",
        headers=normal_user_token_headers,
        json=data,
    )
    assert r.status_code == 403


def test_retrieve_users(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    username = random_email()
    password = random_lower_string()
    user_in = UserCreate(email=username, password=password)
    crud.create_user(session=db, user_create=user_in)

    username2 = random_email()
    password2 = random_lower_string()
    user_in2 = UserCreate(email=username2, password=password2)
    crud.create_user(session=db, user_create=user_in2)

    r = client.get(f"{settings.API_V1_STR}/users/", headers=superuser_token_headers)
    all_users = r.json()

    assert len(all_users["data"]) > 1
    assert "count" in all_users
    for item in all_users["data"]:
        assert "email" in item


def test_update_user_me(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    full_name = "Updated Name"
    email = random_email()
    data = {"full_name": full_name, "email": email}
    r = client.patch(
        f"{settings.API_V1_STR}/users/me",
        headers=normal_user_token_headers,
        json=data,
    )
    assert r.status_code == 200
    updated_user = r.json()
    assert updated_user["email"] == email
    assert updated_user["full_name"] == full_name

    user_query = select(User).where(User.email == email)
    user_db = db.exec(user_query).first()
    assert user_db
    assert user_db.email == email
    assert user_db.full_name == full_name


def test_update_password_me(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    new_password = random_lower_string()
    user_db = db.exec(
        select(User).where(User.email == settings.FIRST_SUPERUSER)
    ).first()
    assert user_db
    user_db.failed_login_attempts = settings.LOGIN_MAX_FAILED_ATTEMPTS
    user_db.locked_until = datetime.now(UTC) + timedelta(
        minutes=settings.LOGIN_LOCKOUT_MINUTES
    )
    db.add(user_db)
    db.commit()

    data = {
        "current_password": settings.FIRST_SUPERUSER_PASSWORD,
        "new_password": new_password,
    }
    r = client.patch(
        f"{settings.API_V1_STR}/users/me/password",
        headers=superuser_token_headers,
        json=data,
    )
    assert r.status_code == 200
    updated_user = r.json()
    assert updated_user["message"] == "Password updated successfully"

    user_query = select(User).where(User.email == settings.FIRST_SUPERUSER)
    user_db = db.exec(user_query).first()
    assert user_db
    assert user_db.email == settings.FIRST_SUPERUSER
    verified, _ = verify_password(new_password, user_db.hashed_password)
    assert verified
    assert user_db.failed_login_attempts == 0
    assert user_db.locked_until is None

    stale_token_response = client.post(
        f"{settings.API_V1_STR}/login/test-token",
        headers=superuser_token_headers,
    )
    assert stale_token_response.status_code == 403

    # Revert to the old password to keep consistency in test
    fresh_login = client.post(
        f"{settings.API_V1_STR}/login/access-token",
        data={"username": settings.FIRST_SUPERUSER, "password": new_password},
    )
    assert fresh_login.status_code == 200
    fresh_headers = {"Authorization": f"Bearer {fresh_login.json()['access_token']}"}
    old_data = {
        "current_password": new_password,
        "new_password": settings.FIRST_SUPERUSER_PASSWORD,
    }
    r = client.patch(
        f"{settings.API_V1_STR}/users/me/password",
        headers=fresh_headers,
        json=old_data,
    )
    db.refresh(user_db)

    assert r.status_code == 200
    verified, _ = verify_password(
        settings.FIRST_SUPERUSER_PASSWORD, user_db.hashed_password
    )
    assert verified


def test_update_password_me_incorrect_password(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    new_password = random_lower_string()
    data = {"current_password": new_password, "new_password": new_password}
    r = client.patch(
        f"{settings.API_V1_STR}/users/me/password",
        headers=superuser_token_headers,
        json=data,
    )
    assert r.status_code == 400
    updated_user = r.json()
    assert updated_user["detail"] == "Incorrect password"


def test_update_user_me_email_exists(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    username = random_email()
    password = random_lower_string()
    user_in = UserCreate(email=username, password=password)
    user = crud.create_user(session=db, user_create=user_in)

    data = {"email": user.email}
    r = client.patch(
        f"{settings.API_V1_STR}/users/me",
        headers=normal_user_token_headers,
        json=data,
    )
    assert r.status_code == 409
    assert r.json()["detail"] == "User with this email already exists"


def test_update_password_me_same_password_error(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    data = {
        "current_password": settings.FIRST_SUPERUSER_PASSWORD,
        "new_password": settings.FIRST_SUPERUSER_PASSWORD,
    }
    r = client.patch(
        f"{settings.API_V1_STR}/users/me/password",
        headers=superuser_token_headers,
        json=data,
    )
    assert r.status_code == 400
    updated_user = r.json()
    assert (
        updated_user["detail"] == "New password cannot be the same as the current one"
    )


def test_register_user_disabled_by_default(client: TestClient) -> None:
    data = {
        "email": random_email(),
        "password": random_lower_string(),
        "full_name": random_lower_string(),
    }
    r = client.post(f"{settings.API_V1_STR}/users/signup", json=data)
    assert r.status_code == 403
    assert r.json()["detail"] == "Open registration is disabled"


def test_register_user(
    client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "USERS_OPEN_REGISTRATION", True)
    username = random_email()
    password = random_lower_string()
    full_name = random_lower_string()
    data = {"email": username, "password": password, "full_name": full_name}
    r = client.post(
        f"{settings.API_V1_STR}/users/signup",
        json=data,
    )
    assert r.status_code == 200
    created_user = r.json()
    assert created_user["email"] == username
    assert created_user["full_name"] == full_name

    user_query = select(User).where(User.email == username)
    user_db = db.exec(user_query).first()
    assert user_db
    assert user_db.email == username
    assert user_db.full_name == full_name
    verified, _ = verify_password(password, user_db.hashed_password)
    assert verified


def test_register_user_already_exists_error(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "USERS_OPEN_REGISTRATION", True)
    password = random_lower_string()
    full_name = random_lower_string()
    data = {
        "email": settings.FIRST_SUPERUSER,
        "password": password,
        "full_name": full_name,
    }
    r = client.post(
        f"{settings.API_V1_STR}/users/signup",
        json=data,
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "The user with this email already exists in the system"


def test_update_user(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    username = random_email()
    password = random_lower_string()
    user_in = UserCreate(email=username, password=password)
    user = crud.create_user(session=db, user_create=user_in)

    data = {"full_name": "Updated_full_name"}
    r = client.patch(
        f"{settings.API_V1_STR}/users/{user.id}",
        headers=superuser_token_headers,
        json=data,
    )
    assert r.status_code == 200
    updated_user = r.json()

    assert updated_user["full_name"] == "Updated_full_name"

    user_query = select(User).where(User.email == username)
    user_db = db.exec(user_query).first()
    db.refresh(user_db)
    assert user_db
    assert user_db.full_name == "Updated_full_name"


def test_admin_password_change_clears_login_lockout(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    user = crud.create_user(
        session=db,
        user_create=UserCreate(email=random_email(), password=random_lower_string()),
    )
    user.failed_login_attempts = settings.LOGIN_MAX_FAILED_ATTEMPTS
    user.locked_until = datetime.now(UTC) + timedelta(
        minutes=settings.LOGIN_LOCKOUT_MINUTES
    )
    db.add(user)
    db.commit()

    response = client.patch(
        f"{settings.API_V1_STR}/users/{user.id}",
        headers=superuser_token_headers,
        json={"reset_to_default_password": True},
    )

    assert response.status_code == 200
    db.refresh(user)
    assert user.failed_login_attempts == 0
    assert user.locked_until is None


def test_create_user_uses_default_password_and_forces_change(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    email = random_email()
    r = client.post(
        f"{settings.API_V1_STR}/users/",
        headers=superuser_token_headers,
        json={"email": email, "is_active": True, "role": "staff"},
    )
    assert r.status_code == 200
    user = crud.get_user_by_email(session=db, email=email)
    assert user
    assert user.must_change_password is True
    verified, _ = verify_password(DEFAULT_PASSWORD, user.hashed_password)
    assert verified
    login = client.post(
        f"{settings.API_V1_STR}/login/access-token",
        data={"username": email, "password": DEFAULT_PASSWORD},
    )
    assert login.status_code == 200


def test_create_user_ignores_typed_password(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    email = random_email()
    typed = "Typed-by-admin-12345"
    r = client.post(
        f"{settings.API_V1_STR}/users/",
        headers=superuser_token_headers,
        json={"email": email, "password": typed},
    )
    assert r.status_code == 200
    user = crud.get_user_by_email(session=db, email=email)
    assert user
    assert verify_password(typed, user.hashed_password)[0] is False
    assert verify_password(DEFAULT_PASSWORD, user.hashed_password)[0] is True


def test_reset_to_default_password_for_other_user(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    old = random_lower_string()
    user = crud.create_user(
        session=db, user_create=UserCreate(email=random_email(), password=old)
    )
    r = client.patch(
        f"{settings.API_V1_STR}/users/{user.id}",
        headers=superuser_token_headers,
        json={"reset_to_default_password": True},
    )
    assert r.status_code == 200
    db.refresh(user)
    assert user.must_change_password is True
    assert verify_password(DEFAULT_PASSWORD, user.hashed_password)[0] is True
    assert verify_password(old, user.hashed_password)[0] is False


def test_admin_cannot_type_password_for_other_user(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    user = crud.create_user(
        session=db,
        user_create=UserCreate(email=random_email(), password=random_lower_string()),
    )
    r = client.patch(
        f"{settings.API_V1_STR}/users/{user.id}",
        headers=superuser_token_headers,
        json={"password": "Another-typed-pass-1"},
    )
    assert r.status_code == 400


def test_default_password_cannot_be_chosen(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    me = crud.get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
    assert me
    r = client.patch(
        f"{settings.API_V1_STR}/users/{me.id}",
        headers=superuser_token_headers,
        json={"password": DEFAULT_PASSWORD},
    )
    assert r.status_code == 400


def test_reset_to_default_on_own_account_rejected(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    me = crud.get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
    assert me
    r = client.patch(
        f"{settings.API_V1_STR}/users/{me.id}",
        headers=superuser_token_headers,
        json={"reset_to_default_password": True},
    )
    assert r.status_code == 400


def test_default_password_not_in_audit_details(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO, logger="app.audit")
    email = random_email()
    client.post(
        f"{settings.API_V1_STR}/users/",
        headers=superuser_token_headers,
        json={"email": email},
    )
    assert DEFAULT_PASSWORD not in caplog.text


def test_update_user_not_exists(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    data = {"full_name": "Updated_full_name"}
    r = client.patch(
        f"{settings.API_V1_STR}/users/{uuid.uuid4()}",
        headers=superuser_token_headers,
        json=data,
    )
    assert r.status_code == 404
    assert r.json()["detail"] == "The user with this id does not exist in the system"


def test_update_user_email_exists(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    username = random_email()
    password = random_lower_string()
    user_in = UserCreate(email=username, password=password)
    user = crud.create_user(session=db, user_create=user_in)

    username2 = random_email()
    password2 = random_lower_string()
    user_in2 = UserCreate(email=username2, password=password2)
    user2 = crud.create_user(session=db, user_create=user_in2)

    data = {"email": user2.email}
    r = client.patch(
        f"{settings.API_V1_STR}/users/{user.id}",
        headers=superuser_token_headers,
        json=data,
    )
    assert r.status_code == 409
    assert r.json()["detail"] == "User with this email already exists"


def test_delete_user_me(client: TestClient, db: Session) -> None:
    username = random_email()
    password = random_lower_string()
    user_in = UserCreate(email=username, password=password)
    user = crud.create_user(session=db, user_create=user_in)
    user_id = user.id

    login_data = {
        "username": username,
        "password": password,
    }
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    tokens = r.json()
    a_token = tokens["access_token"]
    headers = {"Authorization": f"Bearer {a_token}"}

    r = client.delete(
        f"{settings.API_V1_STR}/users/me",
        headers=headers,
    )
    assert r.status_code == 200
    deleted_user = r.json()
    assert deleted_user["message"] == "User deleted successfully"
    result = db.exec(select(User).where(User.id == user_id)).first()
    assert result is None

    user_query = select(User).where(User.id == user_id)
    user_db = db.execute(user_query).first()
    assert user_db is None


def test_delete_user_me_as_superuser(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.delete(
        f"{settings.API_V1_STR}/users/me",
        headers=superuser_token_headers,
    )
    assert r.status_code == 403
    response = r.json()
    assert response["detail"] == "Super users are not allowed to delete themselves"


def test_delete_user_super_user(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    username = random_email()
    password = random_lower_string()
    user_in = UserCreate(email=username, password=password)
    user = crud.create_user(session=db, user_create=user_in)
    user_id = user.id
    r = client.delete(
        f"{settings.API_V1_STR}/users/{user_id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    deleted_user = r.json()
    assert deleted_user["message"] == "User deleted successfully"
    result = db.exec(select(User).where(User.id == user_id)).first()
    assert result is None


def test_delete_user_not_found(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.delete(
        f"{settings.API_V1_STR}/users/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404
    assert r.json()["detail"] == "User not found"


def test_delete_user_current_super_user_error(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    super_user = crud.get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
    assert super_user
    user_id = super_user.id

    r = client.delete(
        f"{settings.API_V1_STR}/users/{user_id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 403
    assert r.json()["detail"] == "Super users are not allowed to delete themselves"


def test_delete_user_without_privileges(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    username = random_email()
    password = random_lower_string()
    user_in = UserCreate(email=username, password=password)
    user = crud.create_user(session=db, user_create=user_in)

    r = client.delete(
        f"{settings.API_V1_STR}/users/{user.id}",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 403
    assert r.json()["detail"] == "The user doesn't have enough privileges"


def test_normal_user_cannot_escalate_privileges_through_profile_update(
    client: TestClient,
    normal_user_token_headers: dict[str, str],
) -> None:
    response = client.patch(
        f"{settings.API_V1_STR}/users/me",
        headers=normal_user_token_headers,
        json={"full_name": "Updated Name", "is_superuser": True, "is_active": True},
    )

    assert response.status_code == 200
    assert response.json()["is_superuser"] is False
    assert response.json()["is_active"] is True


def test_admin_user_list_rejects_unauthenticated_requests(
    client: TestClient,
) -> None:
    response = client.get(f"{settings.API_V1_STR}/users/")

    assert response.status_code == 401


def test_retrieve_users_rejects_invalid_pagination(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    negative_skip = client.get(
        f"{settings.API_V1_STR}/users/?skip=-1",
        headers=superuser_token_headers,
    )
    excessive_limit = client.get(
        f"{settings.API_V1_STR}/users/?limit=101",
        headers=superuser_token_headers,
    )

    assert negative_skip.status_code == 422
    assert excessive_limit.status_code == 422


def test_admin_edit_of_name_parts_rebuilds_the_display_name(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    created = client.post(
        f"{settings.API_V1_STR}/users/",
        headers=superuser_token_headers,
        json={
            "email": random_email(),
            "first_name": "Maria",
            "middle_name": "Reyes",
            "last_name": "Santos",
        },
    ).json()
    assert created["full_name"] == "Maria Reyes Santos"
    r = client.patch(
        f"{settings.API_V1_STR}/users/{created['id']}",
        headers=superuser_token_headers,
        json={"last_name": " Cruz ", "middle_name": "", "extension_name": "Jr."},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["first_name"] == "Maria"
    assert body["middle_name"] is None
    assert body["last_name"] == "Cruz"
    assert body["full_name"] == "Maria Cruz Jr."
