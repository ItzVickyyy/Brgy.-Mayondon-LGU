from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from fastapi.testclient import TestClient
from pwdlib.hashers.bcrypt import BcryptHasher
from sqlmodel import Session

from app.core.config import settings
from app.core.security import get_password_hash, verify_password
from app.crud import create_user
from app.models import User, UserCreate
from app.utils import generate_password_reset_token
from tests.utils.user import user_authentication_headers
from tests.utils.utils import random_email, random_lower_string


def test_get_access_token(client: TestClient) -> None:
    login_data = {
        "username": settings.FIRST_SUPERUSER,
        "password": settings.FIRST_SUPERUSER_PASSWORD,
    }
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    tokens = r.json()
    assert r.status_code == 200
    assert "access_token" in tokens
    assert tokens["access_token"]


def test_get_access_token_incorrect_password(client: TestClient) -> None:
    login_data = {
        "username": settings.FIRST_SUPERUSER,
        "password": "incorrect",
    }
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    assert r.status_code == 400


def test_get_access_token_unknown_email(client: TestClient) -> None:
    login_data = {
        "username": "unknown-account@example.com",
        "password": "some-incorrect-password",
    }

    response = client.post(
        f"{settings.API_V1_STR}/login/access-token", data=login_data
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Incorrect email or password"}


def test_use_access_token(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/login/test-token",
        headers=superuser_token_headers,
    )
    result = r.json()
    assert r.status_code == 200
    assert "email" in result


def test_recovery_password(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    with (
        patch("app.core.config.settings.SMTP_HOST", "smtp.example.com"),
        patch("app.core.config.settings.SMTP_USER", "admin@example.com"),
    ):
        email = "test@example.com"
        r = client.post(
            f"{settings.API_V1_STR}/password-recovery/{email}",
            headers=normal_user_token_headers,
        )
        assert r.status_code == 200
        assert r.json() == {
            "message": "If that email is registered, we sent a password recovery link"
        }


def test_recovery_password_user_not_exits(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    email = "jVgQr@example.com"
    r = client.post(
        f"{settings.API_V1_STR}/password-recovery/{email}",
        headers=normal_user_token_headers,
    )
    # Should return 200 with generic message to prevent email enumeration attacks
    assert r.status_code == 200
    assert r.json() == {
        "message": "If that email is registered, we sent a password recovery link"
    }


def test_reset_password(client: TestClient, db: Session) -> None:
    email = random_email()
    password = random_lower_string()
    new_password = random_lower_string()

    user_create = UserCreate(
        email=email,
        full_name="Test User",
        password=password,
        is_active=True,
        is_superuser=False,
    )
    user = create_user(session=db, user_create=user_create)
    token = generate_password_reset_token(email=email, hashed_password=user.hashed_password)
    headers = user_authentication_headers(client=client, email=email, password=password)
    data = {"new_password": new_password, "token": token}

    r = client.post(
        f"{settings.API_V1_STR}/reset-password/",
        headers=headers,
        json=data,
    )

    assert r.status_code == 200
    assert r.json() == {"message": "Password updated successfully"}

    db.refresh(user)
    verified, _ = verify_password(new_password, user.hashed_password)
    assert verified


def test_reset_password_invalid_token(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    data = {"new_password": "not-a-valid-reset-password-123", "token": "invalid"}
    r = client.post(
        f"{settings.API_V1_STR}/reset-password/",
        headers=superuser_token_headers,
        json=data,
    )
    response = r.json()

    assert "detail" in response
    assert r.status_code == 400
    assert response["detail"] == "Invalid token"


def test_login_with_bcrypt_password_upgrades_to_argon2(
    client: TestClient, db: Session
) -> None:
    """Test that logging in with a bcrypt password hash upgrades it to argon2."""
    email = random_email()
    password = random_lower_string()

    # Create a bcrypt hash directly (simulating legacy password)
    bcrypt_hasher = BcryptHasher()
    bcrypt_hash = bcrypt_hasher.hash(password)
    assert bcrypt_hash.startswith("$2")  # bcrypt hashes start with $2

    user = User(email=email, hashed_password=bcrypt_hash, is_active=True)
    db.add(user)
    db.commit()
    db.refresh(user)

    assert user.hashed_password.startswith("$2")

    login_data = {"username": email, "password": password}
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    assert r.status_code == 200
    tokens = r.json()
    assert "access_token" in tokens

    db.refresh(user)

    # Verify the hash was upgraded to argon2
    assert user.hashed_password.startswith("$argon2")

    verified, updated_hash = verify_password(password, user.hashed_password)
    assert verified
    # Should not need another update since it's already argon2
    assert updated_hash is None


def test_login_with_argon2_password_keeps_hash(client: TestClient, db: Session) -> None:
    """Test that logging in with an argon2 password hash does not update it."""
    email = random_email()
    password = random_lower_string()

    # Create an argon2 hash (current default)
    argon2_hash = get_password_hash(password)
    assert argon2_hash.startswith("$argon2")

    # Create user with argon2 hash
    user = User(email=email, hashed_password=argon2_hash, is_active=True)
    db.add(user)
    db.commit()
    db.refresh(user)

    original_hash = user.hashed_password

    login_data = {"username": email, "password": password}
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    assert r.status_code == 200
    tokens = r.json()
    assert "access_token" in tokens

    db.refresh(user)

    assert user.hashed_password == original_hash
    assert user.hashed_password.startswith("$argon2")



def test_login_locks_account_after_failed_attempts(
    client: TestClient, db: Session
) -> None:
    email = random_email()
    password = random_lower_string()
    user = create_user(
        session=db,
        user_create=UserCreate(email=email, password=password),
    )
    login_data = {"username": email, "password": "wrong-password"}

    for _ in range(settings.LOGIN_MAX_FAILED_ATTEMPTS):
        response = client.post(
            f"{settings.API_V1_STR}/login/access-token", data=login_data
        )
        assert response.status_code == 400

    db.refresh(user)
    assert user.failed_login_attempts == settings.LOGIN_MAX_FAILED_ATTEMPTS
    assert user.locked_until is not None

    response = client.post(
        f"{settings.API_V1_STR}/login/access-token",
        data={"username": email, "password": password},
    )
    assert response.status_code == 400


def test_successful_login_clears_expired_lockout(
    client: TestClient, db: Session
) -> None:
    email = random_email()
    password = random_lower_string()
    user = create_user(
        session=db,
        user_create=UserCreate(email=email, password=password),
    )
    user.failed_login_attempts = 4
    user.locked_until = datetime.now(UTC) - timedelta(minutes=1)
    db.add(user)
    db.commit()

    response = client.post(
        f"{settings.API_V1_STR}/login/access-token",
        data={"username": email, "password": password},
    )
    assert response.status_code == 200

    db.refresh(user)
    assert user.failed_login_attempts == 0
    assert user.locked_until is None

def test_password_recovery_sends_email_for_registered_user(
    client: TestClient, db: Session
) -> None:
    email = random_email()
    user = create_user(
        session=db,
        user_create=UserCreate(email=email, password=random_lower_string()),
    )
    with patch("app.api.routes.login.send_email") as send_email_mock:
        response = client.post(f"{settings.API_V1_STR}/password-recovery/{email}")

    assert response.status_code == 200
    assert response.json() == {
        "message": "If that email is registered, we sent a password recovery link"
    }
    send_email_mock.assert_called_once()
    assert send_email_mock.call_args.kwargs["email_to"] == user.email


def test_password_recovery_does_not_send_email_for_unknown_user(
    client: TestClient,
) -> None:
    email = "unknown-recovery-target@example.com"
    with patch("app.api.routes.login.send_email") as send_email_mock:
        response = client.post(f"{settings.API_V1_STR}/password-recovery/{email}")

    assert response.status_code == 200
    assert response.json() == {
        "message": "If that email is registered, we sent a password recovery link"
    }
    send_email_mock.assert_not_called()


def test_reset_password_token_cannot_be_reused(
    client: TestClient, db: Session
) -> None:
    email = random_email()
    user = create_user(
        session=db,
        user_create=UserCreate(email=email, password=random_lower_string()),
    )
    token = generate_password_reset_token(
        email=email, hashed_password=user.hashed_password
    )
    url = f"{settings.API_V1_STR}/reset-password/"
    first_response = client.post(
        url,
        json={"new_password": random_lower_string(), "token": token},
    )
    second_response = client.post(
        url,
        json={"new_password": random_lower_string(), "token": token},
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 400
    assert second_response.json() == {"detail": "Invalid token"}

