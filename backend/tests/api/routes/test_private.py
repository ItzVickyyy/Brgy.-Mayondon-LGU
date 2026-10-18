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


def test_private_routes_are_excluded_outside_development() -> None:
    router = create_api_router(fastapi_env=None)

    assert all(not route.path.startswith("/private") for route in router.routes)


def test_private_routes_are_registered_in_development() -> None:
    router = create_api_router(fastapi_env="development")

    assert any(route.path == "/private/users/" for route in router.routes)
