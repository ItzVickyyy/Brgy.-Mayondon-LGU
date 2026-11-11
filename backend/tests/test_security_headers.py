from fastapi.testclient import TestClient

from app.core.config import settings


def test_api_responses_include_baseline_security_headers(client: TestClient) -> None:
    response = client.get(f"{settings.API_V1_STR}/utils/health-check/")

    assert response.status_code == 200
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "strict-origin-when-cross-origin"


def test_api_responses_are_not_cached(client: TestClient) -> None:
    response = client.get(f"{settings.API_V1_STR}/utils/health-check/")

    assert response.headers["cache-control"] == "no-store"


def test_sign_in_lasts_one_working_day_by_default() -> None:
    assert settings.ACCESS_TOKEN_EXPIRE_MINUTES == 60 * 8


def test_hsts_is_sent_over_https_only(client: TestClient) -> None:
    url = f"{settings.API_V1_STR}/utils/health-check/"
    assert "strict-transport-security" not in client.get(url).headers
    from app.main import app

    with TestClient(app, base_url="https://testserver") as secure_client:
        secure = secure_client.get(url)
    assert secure.headers["strict-transport-security"] == "max-age=2592000"


def test_compose_https_proxy_is_off_by_default() -> None:
    import re
    from pathlib import Path

    root = Path(__file__).resolve().parents[2]
    compose = (root / "compose.yml").read_text(encoding="utf-8")
    block = compose[compose.index("  caddy:") : compose.index("\nvolumes:")]
    assert 'profiles: ["https"]' in block
    assert re.search(r"\$\{APP_BIND:-0\.0\.0\.0\}", compose)
    assert "FORWARDED_ALLOW_IPS: ${FORWARDED_ALLOW_IPS:-127.0.0.1}" in compose
    caddyfile = (root / "deploy" / "Caddyfile").read_text(encoding="utf-8")
    assert "tls internal" in caddyfile and "reverse_proxy backend:8000" in caddyfile
