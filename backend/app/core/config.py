import warnings
from typing import Literal, Self

from pydantic import (
    EmailStr,
    Field,
    HttpUrl,
    PostgresDsn,
    computed_field,
    field_validator,
    model_validator,
)
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # Use top level .env file (one level above ./backend/)
        env_file="../.env",
        env_ignore_empty=True,
        extra="ignore",
    )
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str
    # A sign-in lasts one working day: 60 minutes * 8 hours = 8 hours. After that
    # the person signs in again (a shorter life limits what a left-open or stolen
    # session can read).
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=60 * 8, gt=0)
    LOGIN_MAX_FAILED_ATTEMPTS: int = Field(default=5, gt=0)
    LOGIN_LOCKOUT_MINUTES: int = Field(default=15, gt=0)
    PASSWORD_RECOVERY_WINDOW_MINUTES: int = Field(default=15, gt=0)
    PASSWORD_RECOVERY_MAX_ATTEMPTS_PER_EMAIL: int = Field(default=5, gt=0)
    PASSWORD_RECOVERY_MAX_ATTEMPTS_PER_IP: int = Field(default=30, gt=0)
    FRONTEND_HOST: str = "http://localhost:5173"
    # Comma-separated trusted origins, useful for production and selected previews.
    # FRONTEND_HOST remains as a backwards-compatible local/default origin.
    FRONTEND_HOSTS: str | None = None
    # Barangay system: only an admin creates accounts. Keep False unless the
    # client explicitly wants public self-registration.
    USERS_OPEN_REGISTRATION: bool = False
    FASTAPI_ENV: Literal["development"] | None = None
    # Mounts unauthenticated test helpers (POST /private/users/, password-recovery
    # HTML preview). Only for local development and automated tests; needs
    # FASTAPI_ENV=development as well. Never set it on a real deployment.
    ENABLE_DEV_ROUTES: bool = False
    # How many days back a clerk may date a new issuance (0 = today only).
    ISSUANCE_BACKDATE_MAX_DAYS: int = Field(default=7, ge=0)
    # Longest validity a Barangay ID may be given, counted from its issue date.
    BARANGAY_ID_MAX_VALID_YEARS: int = Field(default=5, gt=0)

    # Database backups (D-35). The backend container writes dumps to BACKUP_DIR,
    # which compose.yml mounts from the host's ./backups folder.
    BACKUP_DIR: str = "/backups"
    BACKUP_KEEP_COPIES: int = Field(default=14, gt=0)
    PG_DUMP_BIN: str = "pg_dump"
    PG_RESTORE_BIN: str = "pg_restore"

    PROJECT_NAME: str
    SENTRY_DSN: HttpUrl | None = None
    DATABASE_URL: PostgresDsn

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def _use_psycopg_driver(cls, value: str | PostgresDsn | None) -> str | None:
        if value is None:
            return None
        database_url = str(value)
        for scheme in ("postgres://", "postgresql://"):
            if database_url.startswith(scheme):
                return database_url.replace(scheme, "postgresql+psycopg://", 1)
        return database_url

    @property
    def frontend_origins(self) -> list[str]:
        """Return explicitly trusted browser origins for CORS."""
        if self.FRONTEND_HOSTS:
            origins = list(
                dict.fromkeys(
                    origin.strip()
                    for origin in self.FRONTEND_HOSTS.split(",")
                    if origin.strip()
                )
            )
            if origins:
                return origins
        return [self.FRONTEND_HOST]

    SMTP_TLS: bool = True
    SMTP_SSL: bool = False
    SMTP_PORT: int = Field(default=587, gt=0, le=65535)
    SMTP_HOST: str | None = None
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    EMAILS_FROM_EMAIL: EmailStr | None = None
    EMAILS_FROM_NAME: str | None = None

    @model_validator(mode="after")
    def _set_default_emails_from(self) -> Self:
        if not self.EMAILS_FROM_NAME:
            self.EMAILS_FROM_NAME = self.PROJECT_NAME
        return self

    EMAIL_RESET_TOKEN_EXPIRE_HOURS: int = Field(default=48, gt=0)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def emails_enabled(self) -> bool:
        return bool(self.SMTP_HOST and self.EMAILS_FROM_EMAIL)

    EMAIL_TEST_USER: EmailStr = "test@example.com"
    FIRST_SUPERUSER: EmailStr
    FIRST_SUPERUSER_PASSWORD: str
    # Optional first Staff account, created at startup if it does not exist.
    # Set both or neither. Staff cannot manage accounts (see core/permissions.py).
    FIRST_STAFF: EmailStr | None = None
    FIRST_STAFF_PASSWORD: str | None = None

    def _check_default_secret(self, var_name: str, value: str | None) -> None:
        # "changethis" is the template default; "replace-with-..." is what
        # .env.example ships, so a copied example is never taken as a real secret.
        if value == "changethis" or (value or "").startswith("replace-with-"):
            message = (
                f"The value of {var_name} is still a placeholder, "
                "for security, please change it, at least for deployments."
            )
            if self.FASTAPI_ENV == "development":
                warnings.warn(message, stacklevel=1)
            else:
                raise ValueError(message)

    @model_validator(mode="after")
    def _enforce_non_default_secrets(self) -> Self:
        if self.ENABLE_DEV_ROUTES and self.FASTAPI_ENV != "development":
            raise ValueError(
                "ENABLE_DEV_ROUTES=true needs FASTAPI_ENV=development; "
                "remove ENABLE_DEV_ROUTES for a real deployment."
            )
        self._check_default_secret("SECRET_KEY", self.SECRET_KEY)
        if len(self.SECRET_KEY.encode("utf-8")) < 32:
            message = (
                "SECRET_KEY must be at least 32 bytes long for secure HS256 signing."
            )
            if self.FASTAPI_ENV == "development":
                warnings.warn(message, stacklevel=1)
            else:
                raise ValueError(message)

        for host in self.DATABASE_URL.hosts():
            self._check_default_secret("DATABASE_URL password", host["password"])
        self._check_default_secret(
            "FIRST_SUPERUSER_PASSWORD", self.FIRST_SUPERUSER_PASSWORD
        )
        if bool(self.FIRST_STAFF) != bool(self.FIRST_STAFF_PASSWORD):
            raise ValueError("Set both FIRST_STAFF and FIRST_STAFF_PASSWORD, or neither.")
        self._check_default_secret("FIRST_STAFF_PASSWORD", self.FIRST_STAFF_PASSWORD)

        return self


settings = Settings()  # type: ignore # ty: ignore[unused-ignore-comment]
