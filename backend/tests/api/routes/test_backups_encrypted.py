"""Backups made while a backup public key is set up (step 15)."""

import itertools
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core import backup as backup_service
from app.core import backup_crypto as crypto
from app.core.config import settings

API = settings.API_V1_STR
DUMP_BYTES = b"PGDMP-fake-archive-for-tests"
PASSPHRASE = "correct horse battery staple"


@pytest.fixture(autouse=True)
def backup_folder(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Path:
    folder = tmp_path / "backups"
    folder.mkdir()
    counter = itertools.count(1)
    monkeypatch.setattr(settings, "BACKUP_DIR", str(folder))
    monkeypatch.setattr(settings, "BACKUP_KEEP_COPIES", 2)
    monkeypatch.setattr(settings, "BACKUP_PUBLIC_KEY_FILE", str(folder / "pub.pem"))
    monkeypatch.setattr(backup_service, "tool_available", lambda: True)
    monkeypatch.setattr(
        backup_service,
        "_new_file_name",
        lambda: f"mayondon-db-20261108-120000-{next(counter):03d}.dump",
    )
    monkeypatch.setattr(
        backup_service, "run_dump", lambda dest: dest.write_bytes(DUMP_BYTES)
    )
    monkeypatch.setattr(backup_service, "list_archive", lambda path: None)
    return folder


@pytest.fixture
def private_key(backup_folder: Path) -> Path:
    public_pem, private_pem = crypto.generate_keypair(PASSPHRASE)
    (backup_folder / "pub.pem").write_bytes(public_pem)
    private = backup_folder.parent / "private.pem"  # kept OUT of the backups folder
    private.write_bytes(private_pem)
    return private


def _make(client: TestClient, headers: dict[str, str]) -> dict:
    response = client.post(f"{API}/backups/", headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def test_backup_is_encrypted_and_no_plain_copy_is_left(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    backup_folder: Path,
    private_key: Path,
    tmp_path: Path,
) -> None:
    made = _make(client, superuser_token_headers)
    assert made["status"] == "ok" and made["file_name"].endswith(".dump.enc")
    assert sorted(p.name for p in backup_folder.iterdir()) == sorted(
        ["pub.pem", made["file_name"]]
    )
    sealed = backup_folder / made["file_name"]
    assert DUMP_BYTES not in sealed.read_bytes()
    assert made["size_bytes"] == sealed.stat().st_size

    out = tmp_path / "opened.dump"
    key = crypto.load_private_key(private_key, PASSPHRASE)
    crypto.decrypt_file(sealed, out, key)
    assert out.read_bytes() == DUMP_BYTES

    verified = client.post(
        f"{API}/backups/{made['id']}/verify", headers=superuser_token_headers
    )
    assert verified.status_code == 200 and verified.json()["status"] == "ok"
    request = client.post(
        f"{API}/backups/{made['id']}/restore-request", headers=superuser_token_headers
    )
    assert "-KeyFile" in request.json()["command"]
    assert made["file_name"] in request.json()["command"]


@pytest.mark.usefixtures("private_key")
def test_a_changed_encrypted_backup_fails_verification(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    backup_folder: Path,
) -> None:
    made = _make(client, superuser_token_headers)
    path = backup_folder / made["file_name"]
    data = bytearray(path.read_bytes())
    data[-1] ^= 0xFF
    path.write_bytes(bytes(data))
    verified = client.post(
        f"{API}/backups/{made['id']}/verify", headers=superuser_token_headers
    )
    assert verified.json()["status"] == "failed"
    assert "checksum" in verified.json()["error"]


@pytest.mark.usefixtures("private_key")
def test_retention_counts_encrypted_files(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    backup_folder: Path,
) -> None:
    for _ in range(4):
        _make(client, superuser_token_headers)
    assert len(list(backup_folder.glob("*.dump.enc"))) == 2


def test_required_encryption_refuses_a_backup_without_a_key(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    backup_folder: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "BACKUP_REQUIRE_ENCRYPTION", True)
    response = client.post(f"{API}/backups/", headers=superuser_token_headers)
    assert response.status_code == 503
    assert "make-key" in response.json()["detail"]
    assert list(backup_folder.iterdir()) == []


def test_without_a_key_and_not_required_backups_stay_plain(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    backup_folder: Path,
) -> None:
    made = _make(client, superuser_token_headers)
    assert made["file_name"].endswith(".dump")
    assert (backup_folder / made["file_name"]).read_bytes() == DUMP_BYTES


@pytest.mark.usefixtures("private_key")
def test_start_up_safety_copy_is_encrypted_when_a_key_exists(
    monkeypatch: pytest.MonkeyPatch, backup_folder: Path
) -> None:
    from app import migrate_on_start as m

    monkeypatch.setattr(m, "run_dump", lambda dest: dest.write_bytes(DUMP_BYTES))
    monkeypatch.setattr(m, "list_archive", lambda path: None)
    saved = m.safety_copy("abc123")
    assert saved.name.endswith("-from-abc123.dump.enc")
    assert DUMP_BYTES not in saved.read_bytes()
    assert sorted(p.name for p in backup_folder.iterdir()) == sorted(
        ["pub.pem", saved.name]
    )
