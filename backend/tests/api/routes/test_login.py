from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from fastapi.testclient import TestClient
from pwdlib.hashers.bcrypt import BcryptHasher
from sqlmodel import Session

from app.core.config import settings
from app.core.password_recovery import is_password_recovery_rate_limited
from app.api.routes.login import recover_password_html_content
from app.core.security import get_password_hash, verify_password
from app.crud import create_user
from app.models import PasswordRecoveryRateLimit, User, UserCreate
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
        patch("app.core.config.settings.EMAILS_FROM_EMAIL", "admin@example.com"),
        patch("app.api.routes.login.send_email", return_value=None),
    ):
        email = "test@example.com"
        r = client.post(
            f"{settings.API_V1_STR}/password-recovery",
            headers=normal_user_token_headers,
            json={"email": email},
        )
        assert r.status_code == 200
        assert r.json() == {
            "message": "If that email is registered, we sent a password recovery link"
        }


def test_recovery_password_user_not_exits(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    email = "jVgQr@example.com"
    with (
        patch("app.core.config.settings.SMTP_HOST", "smtp.example.com"),
        patch("app.core.config.settings.EMAILS_FROM_EMAIL", "admin@example.com"),
    ):
        r = client.post(
            f"{settings.API_V1_STR}/password-recovery",
            headers=normal_user_token_headers,
            json={"email": email},
        )
    # Configured email returns the same generic response for unknown accounts.
    assert r.status_code == 200
    assert r.json() == {
        "message": "If that email is registered, we sent a password recovery link"
    }


def test_recovery_password_when_email_is_disabled_offline(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    with (
        patch("app.core.config.settings.SMTP_HOST", None),
        patch("app.core.config.settings.EMAILS_FROM_EMAIL", None),
        patch("app.api.routes.login.send_email") as send_email_mock,
    ):
        r = client.post(
            f"{settings.API_V1_STR}/password-recovery",
            headers=normal_user_token_headers,
            json={"email": settings.EMAIL_TEST_USER},
        )

    assert r.status_code == 200
    assert r.json() == {
        "message": (
            "Email-based password recovery is unavailable in this offline "
            "installation. Contact the system administrator."
        )
    }
    send_email_mock.assert_not_called()


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
    user.failed_login_attempts = settings.LOGIN_MAX_FAILED_ATTEMPTS
    user.locked_until = datetime.now(UTC) + timedelta(minutes=settings.LOGIN_LOCKOUT_MINUTES)
    db.add(user)
    db.commit()
    token = generate_password_reset_token(email=email, hashed_password=user.hashed_password)
    data = {"new_password": new_password, "token": token}

    r = client.post(
        f"{settings.API_V1_STR}/reset-password/",
        json=data,
    )

    assert r.status_code == 200
    assert r.json() == {"message": "Password updated successfully"}

    db.refresh(user)
    verified, _ = verify_password(new_password, user.hashed_password)
    assert verified
    assert user.failed_login_attempts == 0
    assert user.locked_until is None


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
        response = client.post(f"{settings.API_V1_STR}/password-recovery", json={"email": email})

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
        response = client.post(f"{settings.API_V1_STR}/password-recovery", json={"email": email})

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

def test_development_password_recovery_preview_generates_bound_token(
    db: Session,
) -> None:
    email = random_email()
    create_user(
        session=db,
        user_create=UserCreate(email=email, password=random_lower_string()),
    )

    response = recover_password_html_content(email=email, session=db)

    assert response.status_code == 200
    assert "reset-password" in response.body.decode()

def test_password_recovery_throttles_email_delivery(
    client: TestClient, db: Session
) -> None:
    email = random_email()
    create_user(
        session=db,
        user_create=UserCreate(email=email, password=random_lower_string()),
    )

    with (
        patch("app.api.routes.login.send_email") as send_email_mock,
        patch("app.core.config.settings.PASSWORD_RECOVERY_MAX_ATTEMPTS_PER_EMAIL", 2),
        patch("app.core.config.settings.PASSWORD_RECOVERY_MAX_ATTEMPTS_PER_IP", 1000),
    ):
        responses = [
            client.post(f"{settings.API_V1_STR}/password-recovery", json={"email": email})
            for _ in range(3)
        ]

    assert all(response.status_code == 200 for response in responses)
    assert all(
        response.json()
        == {
            "message": "If that email is registered, we sent a password recovery link"
        }
        for response in responses
    )
    assert send_email_mock.call_count == 2



def test_password_recovery_cleans_up_old_rate_limit_buckets(
    client: TestClient, db: Session
) -> None:
    stale_key = "a" * 64
    db.add(
        PasswordRecoveryRateLimit(
            bucket_key=stale_key,
            window_started_at=datetime.now(UTC) - timedelta(hours=1),
            attempts=1,
        )
    )
    db.commit()

    response = client.post(
        f"{settings.API_V1_STR}/password-recovery",
        json={"email": random_email()},
    )

    assert response.status_code == 200
    assert db.get(PasswordRecoveryRateLimit, stale_key) is None


def test_password_recovery_throttles_shared_client_ip(
    db: Session,
) -> None:
    client_ip = f"test-ip-{random_lower_string()}"
    emails = [random_email() for _ in range(3)]

    with (
        patch("app.core.config.settings.PASSWORD_RECOVERY_MAX_ATTEMPTS_PER_EMAIL", 100),
        patch("app.core.config.settings.PASSWORD_RECOVERY_MAX_ATTEMPTS_PER_IP", 2),
    ):
        results = [
            is_password_recovery_rate_limited(
                session=db, email=email, client_ip=client_ip
            )
            for email in emails
        ]

    assert results == [False, False, True]



def test_access_token_is_invalidated_after_password_reset(
    client: TestClient, db: Session
) -> None:
    email = random_email()
    old_password = random_lower_string()
    user = create_user(
        session=db,
        user_create=UserCreate(email=email, password=old_password),
    )
    login_response = client.post(
        f"{settings.API_V1_STR}/login/access-token",
        data={"username": email, "password": old_password},
    )
    assert login_response.status_code == 200
    old_access_token = login_response.json()["access_token"]

    reset_token = generate_password_reset_token(
        email=email, hashed_password=user.hashed_password
    )
    reset_response = client.post(
        f"{settings.API_V1_STR}/reset-password/",
        json={"new_password": random_lower_string(), "token": reset_token},
    )
    assert reset_response.status_code == 200

    protected_response = client.post(
        f"{settings.API_V1_STR}/login/test-token",
        headers={"Authorization": f"Bearer {old_access_token}"},
    )
    assert protected_response.status_code == 403
    assert protected_response.json() == {
        "detail": "Could not validate credentials"
    }
