import pytest
from fastapi.testclient import TestClient


def test_docs_uses_barangay_favicon(client: TestClient) -> None:
    response = client.get("/docs")

    assert response.status_code == 200
    assert 'href="/favicon.svg"' in response.text


def test_barangay_favicon_is_served(client: TestClient) -> None:
    response = client.get("/favicon.svg")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("image/svg+xml")
    assert "<svg" in response.text


def test_docs_page_is_hidden_on_a_real_installation(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.main.DOCS_ENABLED", False)

    assert client.get("/docs").status_code == 404


def test_app_pages_carry_a_content_security_policy(client: TestClient) -> None:
    policy = client.get("/favicon.svg").headers["content-security-policy"]

    assert "default-src 'self'" in policy
    assert "frame-ancestors 'none'" in policy
    assert "object-src 'none'" in policy
    # Nothing may come from another site, and no blanket permission to run inline scripts.
    assert "http" not in policy
    assert "script-src 'self'" in policy
    assert "'unsafe-inline'" not in policy.split("style-src")[0]


def test_api_answers_carry_no_page_policy_but_stay_uncached(
    client: TestClient,
) -> None:
    response = client.get("/api/v1/utils/health-check/")

    assert "content-security-policy" not in response.headers
    assert response.headers["cache-control"] == "no-store"
