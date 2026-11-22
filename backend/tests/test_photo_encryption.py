"""Resident photos are encrypted in the database (patch 216).

The API behaves as before (upload, download, replace, delete); only the stored bytes change.
"""

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, text

from app.core import field_crypto as fc
from app.core.config import settings
from tests.api.routes.test_residents import API, PNG, WEBP, Headers, _create

KEY = "photo-test-data-key-0123456789-0123456789-abcdef"
OTHER_KEY = "another-photo-test-key-0123456789-0123456789-xyz"


def _stored(db: Session, resident_id: str) -> bytes:
    db.rollback()
    value = (
        db.connection()
        .execute(
            text("SELECT content FROM resident_photos WHERE resident_id = :i"),
            {"i": resident_id},
        )
        .scalar()
    )
    assert value is not None
    return bytes(value)


def _forget_other_photos(db: Session) -> None:
    """Other tests leave photos saved under other keys; start from none."""
    db.connection().execute(text("DELETE FROM resident_photos"))
    db.commit()


def test_bytes_round_trip_and_never_equal_the_plain_photo() -> None:
    stored = fc.encrypt_bytes(PNG, key=KEY)
    assert stored.startswith(fc.BYTES_PREFIX) and PNG not in stored
    assert stored != fc.encrypt_bytes(PNG, key=KEY)  # a new nonce every time
    assert fc.decrypt_bytes(stored, key=KEY) == PNG
    assert fc.decrypt_bytes(stored, key=OTHER_KEY) is None
    assert fc.decrypt_bytes(stored[:-1], key=KEY) is None  # damaged
    assert fc.decrypt_bytes(PNG, key=KEY) is None  # not encrypted


def test_photo_is_stored_encrypted_and_served_unchanged(
    client: TestClient,
    staff_token_headers: Headers,
    db: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _forget_other_photos(db)
    monkeypatch.setattr(settings, "DATA_ENCRYPTION_KEY", KEY)
    rid = _create(client, staff_token_headers)["id"]
    url = f"{API}/residents/{rid}/photo"

    assert client.put(url, headers=staff_token_headers, content=PNG).status_code == 200
    stored = _stored(db, rid)
    assert stored.startswith(fc.BYTES_PREFIX) and PNG not in stored
    got = client.get(url, headers=staff_token_headers)
    assert got.status_code == 200 and got.content == PNG
    assert got.headers["content-type"] == "image/png"

    # Replacing the photo stores the new one encrypted too.
    assert client.put(url, headers=staff_token_headers, content=WEBP).status_code == 200
    assert WEBP not in _stored(db, rid)
    assert client.get(url, headers=staff_token_headers).content == WEBP
    assert client.delete(url, headers=staff_token_headers).json()["has_photo"] is False


def test_without_a_key_the_photo_is_stored_as_before(
    client: TestClient,
    staff_token_headers: Headers,
    db: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "DATA_ENCRYPTION_KEY", "")
    rid = _create(client, staff_token_headers)["id"]
    url = f"{API}/residents/{rid}/photo"
    assert client.put(url, headers=staff_token_headers, content=PNG).status_code == 200
    assert _stored(db, rid) == PNG
    assert client.get(url, headers=staff_token_headers).content == PNG


def test_a_photo_that_cannot_be_decrypted_answers_409_and_can_be_replaced(
    client: TestClient,
    staff_token_headers: Headers,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "DATA_ENCRYPTION_KEY", KEY)
    rid = _create(client, staff_token_headers)["id"]
    url = f"{API}/residents/{rid}/photo"
    assert client.put(url, headers=staff_token_headers, content=PNG).status_code == 200

    monkeypatch.setattr(settings, "DATA_ENCRYPTION_KEY", OTHER_KEY)  # key changed
    got = client.get(url, headers=staff_token_headers)
    assert got.status_code == 409
    assert "cannot be read" in got.json()["detail"]
    assert client.get(f"{API}/residents/{rid}", headers=staff_token_headers).json()[
        "has_photo"
    ]

    monkeypatch.setattr(settings, "DATA_ENCRYPTION_KEY", "")  # key missing
    assert client.get(url, headers=staff_token_headers).status_code == 409

    monkeypatch.setattr(settings, "DATA_ENCRYPTION_KEY", OTHER_KEY)
    assert client.put(url, headers=staff_token_headers, content=WEBP).status_code == 200
    assert client.get(url, headers=staff_token_headers).content == WEBP


def test_start_up_encrypts_photos_saved_before_the_key_and_is_repeatable(
    client: TestClient,
    staff_token_headers: Headers,
    db: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _forget_other_photos(db)
    monkeypatch.setattr(settings, "DATA_ENCRYPTION_KEY", "")
    rid = _create(client, staff_token_headers)["id"]
    url = f"{API}/residents/{rid}/photo"
    assert client.put(url, headers=staff_token_headers, content=PNG).status_code == 200
    assert _stored(db, rid) == PNG

    assert fc.encrypt_existing(db) == 0  # still no key: nothing changes
    assert _stored(db, rid) == PNG

    monkeypatch.setattr(settings, "DATA_ENCRYPTION_KEY", KEY)
    # The plain photo is still shown while the key is set but the row is not converted.
    assert client.get(url, headers=staff_token_headers).content == PNG
    assert fc.encrypt_existing(db) >= 1
    assert _stored(db, rid).startswith(fc.BYTES_PREFIX)
    assert fc.encrypt_existing(db) == 0
    assert client.get(url, headers=staff_token_headers).content == PNG
