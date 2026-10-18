import pytest
from pydantic import ValidationError

from app.core.config import Settings


def make_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "SECRET_KEY": "a-local-test-secret",
        "PROJECT_NAME": "Configuration Tests",
        "DATABASE_URL": "postgresql://postgres:secure-db-password@localhost:5432/app",
        "FIRST_SUPERUSER": "admin@example.com",
        "FIRST_SUPERUSER_PASSWORD": "secure-admin-password",
        "FASTAPI_ENV": None,
        "_env_file": None,
    }
    values.update(overrides)
    return Settings(**values)  # type: ignore[arg-type]


def test_rejects_default_password_in_migration_database_url() -> None:
    with pytest.raises(ValidationError, match="MIGRATION_DATABASE_URL password"):
        make_settings(
            MIGRATION_DATABASE_URL=(
                "postgresql://postgres:changethis@localhost:5432/app"
            )
        )


def test_accepts_non_default_migration_database_password() -> None:
    settings = make_settings(
        MIGRATION_DATABASE_URL=(
            "postgresql://postgres:secure-migration-password@localhost:5432/app"
        )
    )

    assert settings.MIGRATION_DATABASE_URL is not None


@pytest.mark.parametrize(
    ("setting", "invalid_value"),
    [
        ("ACCESS_TOKEN_EXPIRE_MINUTES", 0),
        ("ACCESS_TOKEN_EXPIRE_MINUTES", -1),
        ("LOGIN_MAX_FAILED_ATTEMPTS", 0),
        ("LOGIN_MAX_FAILED_ATTEMPTS", -1),
        ("LOGIN_LOCKOUT_MINUTES", 0),
        ("LOGIN_LOCKOUT_MINUTES", -1),
        ("EMAIL_RESET_TOKEN_EXPIRE_HOURS", 0),
        ("EMAIL_RESET_TOKEN_EXPIRE_HOURS", -1),
        ("SMTP_PORT", 0),
        ("SMTP_PORT", -1),
        ("SMTP_PORT", 65536),
    ],
)
def test_rejects_non_positive_authentication_settings(
    setting: str, invalid_value: int
) -> None:
    with pytest.raises(ValidationError):
        make_settings(**{setting: invalid_value})


def test_accepts_positive_authentication_settings() -> None:
    settings = make_settings(
        ACCESS_TOKEN_EXPIRE_MINUTES=1,
        LOGIN_MAX_FAILED_ATTEMPTS=1,
        LOGIN_LOCKOUT_MINUTES=1,
        EMAIL_RESET_TOKEN_EXPIRE_HOURS=1,
        SMTP_PORT=65535,
    )

    assert settings.ACCESS_TOKEN_EXPIRE_MINUTES == 1
    assert settings.LOGIN_MAX_FAILED_ATTEMPTS == 1
    assert settings.LOGIN_LOCKOUT_MINUTES == 1
    assert settings.EMAIL_RESET_TOKEN_EXPIRE_HOURS == 1
    assert settings.SMTP_PORT == 65535
