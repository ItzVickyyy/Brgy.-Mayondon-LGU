import random
import string

from fastapi.testclient import TestClient

from app.core.config import settings


def random_lower_string() -> str:
    return "".join(random.choices(string.ascii_lowercase, k=32))


def random_email() -> str:
    return f"{random_lower_string()}@{random_lower_string()}.com"


def get_superuser_token_headers(client: TestClient) -> dict[str, str]:
    login_data = {
        "username": settings.FIRST_SUPERUSER,
        "password": settings.FIRST_SUPERUSER_PASSWORD,
    }
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    tokens = r.json()
    a_token = tokens["access_token"]
    headers = {"Authorization": f"Bearer {a_token}"}
    return headers


def confirmed_headers(
    client: TestClient,
    headers: dict[str, str],
    scope: str,
    password: str = settings.FIRST_SUPERUSER_PASSWORD,
) -> dict[str, str]:
    """``headers`` plus a fresh ``X-Confirm-Token`` for ``scope`` (password typed again)."""
    response = client.post(
        f"{settings.API_V1_STR}/login/confirm-password",
        headers=headers,
        json={"password": password, "scope": scope},
    )
    assert response.status_code == 200, response.text
    return {**headers, "X-Confirm-Token": response.json()["confirm_token"]}
