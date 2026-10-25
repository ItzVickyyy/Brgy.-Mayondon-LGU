import pytest
from pydantic import ValidationError

from app.core.config import Settings


def make_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "SECRET_KEY": "a-local-test-secret-that-is-long-enough",
        "PROJECT_NAME": "Configuration Tests",
        "DATABASE_URL": "postgresql://postgres:secure-db-password@localhost:5432/app",
        "FIRST_SUPERUSER": "admin@example.com",
        "FIRST_SUPERUSER_PASSWORD": "secure-admin-password",
        "FASTAPI_ENV": None,
        "_env_file": None,
    }
    values.update(overrides)
    return Settings(**values)  # type: ignore[arg-type]


def test_rejects_short_secret_key_outside_development() -> None:
    with pytest.raises(ValidationError, match="SECRET_KEY must be at least 32 bytes"):
        make_settings(SECRET_KEY="short-secret")


def test_warns_about_short_secret_key_in_development() -> None:
    with pytest.warns(UserWarning, match="SECRET_KEY must be at least 32 bytes"):
        settings = make_settings(SECRET_KEY="short-secret", FASTAPI_ENV="development")

    assert settings.SECRET_KEY == "short-secret"


def test_accepts_secret_key_of_at_least_32_bytes() -> None:
    settings = make_settings(SECRET_KEY="x" * 32)

    assert len(settings.SECRET_KEY.encode("utf-8")) == 32


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


def test_frontend_origins_trims_and_deduplicates_configured_hosts() -> None:
    settings = make_settings(
        FRONTEND_HOST="http://localhost:5173",
        FRONTEND_HOSTS=(
            " https://example.com,https://preview.example.com, "
            "https://example.com "
        ),
    )

    assert settings.frontend_origins == [
        "https://example.com",
        "https://preview.example.com",
    ]


def test_frontend_origins_fall_back_when_configured_hosts_are_empty() -> None:
    settings = make_settings(
        FRONTEND_HOST="http://localhost:5173",
        FRONTEND_HOSTS=" ,  , ",
    )

    assert settings.frontend_origins == ["http://localhost:5173"]
