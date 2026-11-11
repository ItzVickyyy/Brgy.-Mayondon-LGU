import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.api.main import create_api_router
from app.core.config import Settings
from app.models import User


def test_create_user(db: Session) -> None:
    client = _client_for_environment(fastapi_env="development", enable_dev_routes=True)
    r = client.post(
        "/private/users/",
        json={
            "email": "pollo@listo.com",
            "password": "password123",
            "full_name": "Pollo Listo",
        },
    )

    assert r.status_code == 200

    data = r.json()

    user = db.exec(select(User).where(User.id == data["id"])).first()

    assert user
    assert user.email == "pollo@listo.com"
    assert user.full_name == "Pollo Listo"


def _client_for_environment(
    fastapi_env: str | None, enable_dev_routes: bool = False
) -> TestClient:
    app = FastAPI()
    app.include_router(
        create_api_router(fastapi_env=fastapi_env, enable_dev_routes=enable_dev_routes)
    )
    return TestClient(app)


def test_private_routes_are_excluded_outside_development() -> None:
    client = _client_for_environment(fastapi_env=None)

    response = client.get("/private/users/")

    assert response.status_code == 404


def test_private_routes_stay_closed_in_development_without_the_flag() -> None:
    client = _client_for_environment(fastapi_env="development")

    assert client.get("/private/users/").status_code == 404
    assert (
        client.get("/password-recovery-html-content/test@example.com").status_code
        == 404
    )


def test_dev_routes_flag_alone_never_opens_them() -> None:
    client = _client_for_environment(fastapi_env=None, enable_dev_routes=True)

    assert client.get("/private/users/").status_code == 404


def test_dev_routes_flag_without_development_env_refuses_to_start() -> None:
    with pytest.raises(ValueError, match="ENABLE_DEV_ROUTES"):
        Settings(  # type: ignore[call-arg]
            ENABLE_DEV_ROUTES=True,
            FASTAPI_ENV=None,
            SECRET_KEY="x" * 40,
            PROJECT_NAME="t",
            DATABASE_URL="postgresql://u:strongpw@localhost/db",
            FIRST_SUPERUSER="a@mayondon-lgu.ph",
            FIRST_SUPERUSER_PASSWORD="strong-pass-1",
        )


def test_private_routes_are_registered_in_development() -> None:
    client = _client_for_environment(fastapi_env="development", enable_dev_routes=True)

    response = client.get("/private/users/")

    assert response.status_code == 405


def test_password_recovery_preview_is_excluded_outside_development() -> None:
    client = _client_for_environment(fastapi_env=None)

    response = client.get("/password-recovery-html-content/test@example.com")

    assert response.status_code == 404


def test_password_recovery_preview_is_registered_in_development() -> None:
    client = _client_for_environment(fastapi_env="development", enable_dev_routes=True)

    response = client.get("/password-recovery-html-content/test@example.com")

    assert response.status_code == 405
