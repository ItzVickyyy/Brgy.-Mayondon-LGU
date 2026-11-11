from fastapi.testclient import TestClient

from app.core.config import settings


def test_api_responses_include_baseline_security_headers(client: TestClient) -> None:
    response = client.get(f"{settings.API_V1_STR}/utils/health-check/")

    assert response.status_code == 200
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert (
        response.headers["referrer-policy"] == "strict-origin-when-cross-origin"
    )


def test_api_responses_are_not_cached(client: TestClient) -> None:
    response = client.get(f"{settings.API_V1_STR}/utils/health-check/")

    assert response.headers["cache-control"] == "no-store"


def test_sign_in_lasts_one_working_day_by_default() -> None:
    assert settings.ACCESS_TOKEN_EXPIRE_MINUTES == 60 * 8
