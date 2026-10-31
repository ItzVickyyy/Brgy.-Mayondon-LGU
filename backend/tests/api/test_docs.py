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
