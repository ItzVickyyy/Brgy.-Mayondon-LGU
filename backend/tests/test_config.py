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
