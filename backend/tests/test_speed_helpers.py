"""Speed helpers (patch 221): the cached data-protection status, text-only compression and the
cache rule for the program's own files."""

import itertools

import pytest
from fastapi import FastAPI
from fastapi.responses import JSONResponse, Response
from fastapi.testclient import TestClient

from app.core import field_crypto
from app.core.config import settings
from app.main import _HASHED_ASSET, CompressTextOnly


@pytest.fixture
def counted(monkeypatch: pytest.MonkeyPatch) -> list[int]:
    """Replace the slow status check with a counter, and start with an empty cache."""
    calls: list[int] = []
    numbers = itertools.count(1)

    def fake(_session: object) -> field_crypto.DataProtection:
        calls.append(next(numbers))
        return field_crypto.DataProtection(True, len(calls), 0)

    monkeypatch.setattr(field_crypto, "protection_status", fake)
    monkeypatch.setattr(field_crypto, "_protection_cache", None)
    return calls


def test_status_is_reused_within_the_cache_time(
    monkeypatch: pytest.MonkeyPatch, counted: list[int]
) -> None:
    monkeypatch.setattr(field_crypto, "PROTECTION_CACHE_SECONDS", 300.0)
    first = field_crypto.protection_status_cached(None)  # type: ignore[arg-type]
    second = field_crypto.protection_status_cached(None)  # type: ignore[arg-type]
    assert first == second
    assert counted == [1]


def test_status_is_recomputed_when_the_cache_time_is_zero(
    monkeypatch: pytest.MonkeyPatch, counted: list[int]
) -> None:
    monkeypatch.setattr(field_crypto, "PROTECTION_CACHE_SECONDS", 0.0)
    field_crypto.protection_status_cached(None)  # type: ignore[arg-type]
    field_crypto.protection_status_cached(None)  # type: ignore[arg-type]
    assert counted == [1, 2]


def test_status_is_recomputed_when_the_key_changes(
    monkeypatch: pytest.MonkeyPatch, counted: list[int]
) -> None:
    monkeypatch.setattr(field_crypto, "PROTECTION_CACHE_SECONDS", 300.0)
    monkeypatch.setattr(settings, "DATA_ENCRYPTION_KEY", "first-key-" + "x" * 40)
    field_crypto.protection_status_cached(None)  # type: ignore[arg-type]
    monkeypatch.setattr(settings, "DATA_ENCRYPTION_KEY", "second-key-" + "y" * 40)
    field_crypto.protection_status_cached(None)  # type: ignore[arg-type]
    assert counted == [1, 2]


def test_status_is_recomputed_after_the_cache_time(
    monkeypatch: pytest.MonkeyPatch, counted: list[int]
) -> None:
    monkeypatch.setattr(field_crypto, "PROTECTION_CACHE_SECONDS", 300.0)
    field_crypto.protection_status_cached(None)  # type: ignore[arg-type]
    cached = field_crypto._protection_cache
    assert cached is not None
    monkeypatch.setattr(
        field_crypto, "_protection_cache", (cached[0] - 301.0, cached[1], cached[2])
    )
    field_crypto.protection_status_cached(None)  # type: ignore[arg-type]
    assert counted == [1, 2]


def test_hashed_files_are_recognised_and_others_are_not() -> None:
    assert _HASHED_ASSET.match("/assets/index-BjYv4E_E.js")
    assert _HASHED_ASSET.match("/assets/useAuth-BjYv4E_E.css")
    assert not _HASHED_ASSET.match("/assets/images/brgy-icon.svg")
    assert not _HASHED_ASSET.match("/assets/print-forms/residency.png")
    assert not _HASHED_ASSET.match("/index.html")
    assert not _HASHED_ASSET.match("/assets/logo.svg")


def _compressing_app() -> FastAPI:
    app = FastAPI()
    big = "x" * 5000

    @app.get("/text")
    def text() -> JSONResponse:
        return JSONResponse({"value": big})

    @app.get("/small")
    def small() -> JSONResponse:
        return JSONResponse({"value": "ok"})

    @app.get("/api/v1/residents/abc/photo")
    def photo() -> Response:
        return Response(b"\x89PNG" + b"0" * 5000, media_type="image/png")

    @app.get("/api/v1/backups/abc/download")
    def backup() -> Response:
        return Response(b"0" * 5000, media_type="application/octet-stream")

    @app.get("/assets/logo.png")
    def picture() -> Response:
        return Response(b"0" * 5000, media_type="image/png")

    app.add_middleware(CompressTextOnly)
    return app


def test_text_is_compressed_when_the_browser_accepts_it() -> None:
    client = TestClient(_compressing_app())
    response = client.get("/text", headers={"Accept-Encoding": "gzip"})
    assert response.headers["content-encoding"] == "gzip"
    assert response.json() == {"value": "x" * 5000}
    plain = client.get("/text", headers={"Accept-Encoding": "identity"})
    assert "content-encoding" not in plain.headers


def test_small_answers_are_not_compressed() -> None:
    response = TestClient(_compressing_app()).get(
        "/small", headers={"Accept-Encoding": "gzip"}
    )
    assert "content-encoding" not in response.headers


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/residents/abc/photo",
        "/api/v1/backups/abc/download",
        "/assets/logo.png",
    ],
)
def test_photos_pictures_and_backups_are_never_compressed(path: str) -> None:
    response = TestClient(_compressing_app()).get(
        path, headers={"Accept-Encoding": "gzip"}
    )
    assert response.status_code == 200
    assert "content-encoding" not in response.headers
    assert len(response.content) > 5000 - 100


def test_photo_cut_out_files_are_kept_one_day_not_forever() -> None:
    from app import main

    assert not main._HASHED_ASSET.match(
        "/vision/selfie-segmentation/selfie_segmentation_solution_simd_wasm_bin.wasm"
    )
    with TestClient(main.app) as client:
        found = client.get("/vision/selfie-segmentation/selfie_segmentation.tflite")
        missing = client.get("/vision/selfie-segmentation/not-there.wasm")
    if found.headers.get("content-type", "").startswith("text/html"):
        pytest.skip("the frontend build with the cut-out files is not in this checkout")
    assert found.headers["cache-control"] == "public, max-age=86400"
    # A missing path answers with index.html: it must be re-checked, never kept for a day.
    assert missing.headers.get("cache-control") == "no-cache"
