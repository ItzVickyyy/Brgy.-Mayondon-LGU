"""A write to an API path that does not exist answers 404 and names it (handover step 1)."""

from fastapi.testclient import TestClient

from app.core.config import settings

API = settings.API_V1_STR


def test_unknown_post_is_404_and_names_the_route(client: TestClient) -> None:
    r = client.post(f"{API}/does-not-exist/")
    assert r.status_code == 404
    assert f"POST {API}/does-not-exist/" in r.json()["detail"]


def test_wrong_method_on_a_real_path_is_still_405(client: TestClient) -> None:
    r = client.delete(f"{API}/login/access-token")
    assert r.status_code == 405
    assert "POST" in r.headers["allow"]


def test_real_post_still_works(client: TestClient) -> None:
    r = client.post(
        f"{API}/login/access-token",
        data={"username": "nobody@example.com", "password": "wrong-password-1"},
    )
    assert r.status_code == 400
