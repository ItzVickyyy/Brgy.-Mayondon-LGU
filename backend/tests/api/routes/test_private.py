from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.api.main import create_api_router
from app.core.config import settings
from app.models import User


def test_create_user(client: TestClient, db: Session) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/private/users/",
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


def _client_for_environment(fastapi_env: str | None) -> TestClient:
    app = FastAPI()
    app.include_router(create_api_router(fastapi_env=fastapi_env))
    return TestClient(app)


def test_private_routes_are_excluded_outside_development() -> None:
    client = _client_for_environment(fastapi_env=None)

    response = client.get("/private/users/")

    assert response.status_code == 404


def test_private_routes_are_registered_in_development() -> None:
    client = _client_for_environment(fastapi_env="development")

    response = client.get("/private/users/")

    assert response.status_code == 405


def test_password_recovery_preview_is_excluded_outside_development() -> None:
    client = _client_for_environment(fastapi_env=None)

    response = client.get("/password-recovery-html-content/test@example.com")

    assert response.status_code == 404


def test_password_recovery_preview_is_registered_in_development() -> None:
    client = _client_for_environment(fastapi_env="development")

    response = client.get("/password-recovery-html-content/test@example.com")

    assert response.status_code == 405
