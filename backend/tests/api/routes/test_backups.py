"""Backup history, manual backups, verification, download and retention (D-35).

Most tests replace the two external tools (``pg_dump`` and ``pg_restore
--list``) with small fakes so they run anywhere. One test at the end runs the
real tools when they are installed.
"""

import itertools
import shutil
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlmodel import Session, col, select

from app import backup_cli
from app.core import backup as backup_service
from app.core.config import settings
from app.core.db import engine
from app.models_backup import BackupRun
from app.models_foundation import AuditLog

API = settings.API_V1_STR
DUMP_BYTES = b"PGDMP-fake-archive-for-tests"


@pytest.fixture(autouse=True)
def backup_folder(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Path:
    """Fake tools, a private folder, and file names that never collide."""
    folder = tmp_path / "backups"
    folder.mkdir()
    counter = itertools.count(1)
    monkeypatch.setattr(settings, "BACKUP_DIR", str(folder))
    monkeypatch.setattr(settings, "BACKUP_KEEP_COPIES", 14)
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


def _audit(action: str, record_id: uuid.UUID | str) -> list[AuditLog]:
    with Session(engine) as session:
        return list(
            session.exec(
                select(AuditLog).where(
                    col(AuditLog.action) == action,
                    col(AuditLog.record_id) == str(record_id),
                )
            ).all()
        )


def _make(client: TestClient, headers: dict[str, str]) -> dict:
    response = client.post(f"{API}/backups/", headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


# --- Access ---------------------------------------------------------------


def test_backups_are_admin_only(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    staff_token_headers: dict[str, str],
) -> None:
    made = _make(client, superuser_token_headers)
    some_id = made["id"]
    calls = [
        ("get", f"{API}/backups/"),
        ("post", f"{API}/backups/"),
        ("post", f"{API}/backups/{some_id}/verify"),
        ("get", f"{API}/backups/{some_id}/download"),
        ("post", f"{API}/backups/{some_id}/restore-request"),
    ]
    for method, url in calls:
        assert (
            client.request(method, url, headers=staff_token_headers).status_code == 403
        )
        assert client.request(method, url).status_code == 401


# --- Creating -------------------------------------------------------------


def test_manual_backup_is_recorded_and_listed(
    client: TestClient, superuser_token_headers: dict[str, str], backup_folder: Path
) -> None:
    made = _make(client, superuser_token_headers)
    assert made["status"] == "ok"
    assert made["kind"] == "manual"
    assert made["size_bytes"] == len(DUMP_BYTES)
    assert len(made["sha256"]) == 64
    assert made["verified_at"] is not None
    assert made["file_exists"] is True
    assert (backup_folder / made["file_name"]).read_bytes() == DUMP_BYTES
    assert not list(backup_folder.glob("*.part"))

    listing = client.get(f"{API}/backups/", headers=superuser_token_headers).json()
    assert listing["tool_available"] is True
    assert listing["keep_copies"] == 14
    assert listing["count"] >= 1
    assert listing["data"][0]["id"] == made["id"]  # newest first

    events = _audit("backup.create", made["id"])
    assert len(events) == 1 and events[0].outcome == "success"
    assert events[0].module == "backup"
    assert events[0].details == {
        "kind": "manual",
        "file_name": made["file_name"],
        "size_bytes": len(DUMP_BYTES),
    }


def test_failed_dump_is_recorded_and_leaves_no_file(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    backup_folder: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def broken(dest: Path) -> None:
        dest.write_bytes(b"half")
        raise backup_service.BackupError("pg_dump failed: connection refused")

    monkeypatch.setattr(backup_service, "run_dump", broken)
    made = _make(client, superuser_token_headers)
    assert made["status"] == "failed"
    assert made["error"] == "pg_dump failed: connection refused"
    assert made["size_bytes"] is None
    assert made["file_exists"] is False
    assert list(backup_folder.iterdir()) == []
    events = _audit("backup.create", made["id"])
    assert len(events) == 1 and events[0].outcome == "failed"


def test_unreadable_archive_is_a_failed_backup(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    backup_folder: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def refuse(_path: Path) -> None:
        raise backup_service.BackupError("The file is not a readable backup.")

    monkeypatch.setattr(backup_service, "list_archive", refuse)
    made = _make(client, superuser_token_headers)
    assert made["status"] == "failed"
    assert list(backup_folder.iterdir()) == []


def test_a_second_backup_while_one_runs_is_refused(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    with engine.connect() as holder:
        got = holder.execute(
            text("SELECT pg_try_advisory_lock(:k)"), {"k": backup_service._LOCK_KEY}
        ).scalar()
        assert got
        try:
            response = client.post(f"{API}/backups/", headers=superuser_token_headers)
            assert response.status_code == 409
            assert "already running" in response.json()["detail"]
        finally:
            holder.execute(
                text("SELECT pg_advisory_unlock(:k)"), {"k": backup_service._LOCK_KEY}
            )
    # The lock is free again afterwards.
    assert _make(client, superuser_token_headers)["status"] == "ok"


def test_backup_without_tools_is_unavailable(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(backup_service, "tool_available", lambda: False)
    response = client.post(f"{API}/backups/", headers=superuser_token_headers)
    assert response.status_code == 503
    listing = client.get(f"{API}/backups/", headers=superuser_token_headers).json()
    assert listing["tool_available"] is False


def test_a_run_left_running_is_marked_interrupted(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    stale = BackupRun(kind="manual", status="running", file_name=None)
    db.add(stale)
    db.commit()
    stale_id = stale.id
    _make(client, superuser_token_headers)
    with Session(engine) as session:
        row = session.get(BackupRun, stale_id)
        assert row is not None
        assert row.status == "failed"
        assert row.error == "Interrupted before it finished."


# --- Verify, download, restore request -------------------------------------


def test_verify_passes_then_catches_a_changed_file(
    client: TestClient, superuser_token_headers: dict[str, str], backup_folder: Path
) -> None:
    made = _make(client, superuser_token_headers)
    url = f"{API}/backups/{made['id']}/verify"
    ok = client.post(url, headers=superuser_token_headers).json()
    assert ok["status"] == "ok" and ok["verified_at"] is not None
    assert [e.outcome for e in _audit("backup.verify", made["id"])] == ["success"]

    (backup_folder / made["file_name"]).write_bytes(b"tampered")
    bad = client.post(url, headers=superuser_token_headers).json()
    assert bad["status"] == "failed"
    assert "checksum" in bad["error"]
    assert bad["verified_at"] is None
    assert [e.outcome for e in _audit("backup.verify", made["id"])] == [
        "success",
        "failed",
    ]


def test_verify_reports_a_missing_file(
    client: TestClient, superuser_token_headers: dict[str, str], backup_folder: Path
) -> None:
    made = _make(client, superuser_token_headers)
    (backup_folder / made["file_name"]).unlink()
    result = client.post(
        f"{API}/backups/{made['id']}/verify", headers=superuser_token_headers
    ).json()
    assert result["status"] == "failed"
    assert "no longer in the folder" in result["error"]
    assert result["file_exists"] is False


def test_unknown_backup_is_404(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    missing = uuid.uuid4()
    for method, suffix in [
        ("post", "verify"),
        ("get", "download"),
        ("post", "restore-request"),
    ]:
        response = client.request(
            method, f"{API}/backups/{missing}/{suffix}", headers=superuser_token_headers
        )
        assert response.status_code == 404


def test_download_streams_the_file_and_is_audited(
    client: TestClient, superuser_token_headers: dict[str, str], backup_folder: Path
) -> None:
    made = _make(client, superuser_token_headers)
    response = client.get(
        f"{API}/backups/{made['id']}/download", headers=superuser_token_headers
    )
    assert response.status_code == 200
    assert response.content == DUMP_BYTES
    assert made["file_name"] in response.headers["content-disposition"]
    assert len(_audit("backup.download", made["id"])) == 1

    (backup_folder / made["file_name"]).unlink()
    gone = client.get(
        f"{API}/backups/{made['id']}/download", headers=superuser_token_headers
    )
    assert gone.status_code == 404


def test_failed_backup_cannot_be_downloaded(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        backup_service,
        "run_dump",
        lambda dest: (_ for _ in ()).throw(backup_service.BackupError("nope")),
    )
    made = _make(client, superuser_token_headers)
    response = client.get(
        f"{API}/backups/{made['id']}/download", headers=superuser_token_headers
    )
    assert response.status_code == 404


def test_restore_request_checks_the_file_and_gives_the_command(
    client: TestClient, superuser_token_headers: dict[str, str], backup_folder: Path
) -> None:
    made = _make(client, superuser_token_headers)
    url = f"{API}/backups/{made['id']}/restore-request"
    response = client.post(url, headers=superuser_token_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["file_name"] == made["file_name"]
    assert body["command"] == (
        f".\\scripts\\restore-db.ps1 -BackupFile .\\backups\\{made['file_name']}"
    )
    events = _audit("backup.restore_requested", made["id"])
    assert len(events) == 1 and events[0].details == {"file_name": made["file_name"]}

    # A changed file is refused and no restore request is logged for it.
    (backup_folder / made["file_name"]).write_bytes(b"tampered")
    refused = client.post(url, headers=superuser_token_headers)
    assert refused.status_code == 409
    assert len(_audit("backup.restore_requested", made["id"])) == 1


# --- Retention and safety ---------------------------------------------------


def test_retention_keeps_only_the_newest_copies_and_the_history(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    backup_folder: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "BACKUP_KEEP_COPIES", 2)
    stranger = backup_folder / "notes.txt"
    stranger.write_text("not a backup")
    runs = [_make(client, superuser_token_headers) for _ in range(4)]
    remaining = sorted(p.name for p in backup_folder.glob("*.dump"))
    assert remaining == sorted(r["file_name"] for r in runs[2:])
    assert stranger.exists()  # never touches files it did not create
    listing = client.get(f"{API}/backups/", headers=superuser_token_headers).json()
    by_id = {row["id"]: row for row in listing["data"]}
    assert [by_id[r["id"]]["file_exists"] for r in runs] == [False, False, True, True]


def test_retention_never_removes_the_newest_good_backup(
    backup_folder: Path, monkeypatch: pytest.MonkeyPatch, db: Session
) -> None:
    monkeypatch.setattr(settings, "BACKUP_KEEP_COPIES", 1)
    good = BackupRun(
        kind="manual",
        status="ok",
        file_name="mayondon-db-20261108-110000-001.dump",
        verified_at=datetime.now(UTC),
        started_at=datetime.now(UTC) + timedelta(days=3650),
    )
    db.add(good)
    db.commit()
    try:
        (backup_folder / good.file_name).write_bytes(DUMP_BYTES)
        newer = backup_folder / "mayondon-db-20261108-130000-001.dump"
        newer.write_bytes(b"unchecked")
        assert backup_service.apply_retention(db) == []
        assert (backup_folder / good.file_name).exists() and newer.exists()
    finally:
        db.delete(good)
        db.commit()


@pytest.mark.parametrize(
    "name", ["../evil.dump", "..\\evil.dump", "a.txt", "mayondon-db-1.dump", ""]
)
def test_backup_path_refuses_names_outside_the_pattern(name: str) -> None:
    with pytest.raises(backup_service.BackupError):
        backup_service.backup_path(name)


def test_error_text_never_contains_the_database_password() -> None:
    password = settings.DATABASE_URL.hosts()[0].get("password")
    assert password
    cleaned = backup_service._clean(f"pg_dump: could not connect, password={password}")
    assert password not in cleaned
    assert "***" in cleaned
    assert len(backup_service._clean("x" * 5000)) <= 500


# --- Command line (Windows scheduled task) ----------------------------------


def test_cli_makes_a_scheduled_backup(backup_folder: Path) -> None:
    assert backup_cli.main(["--kind", "scheduled"]) == 0
    with Session(engine) as session:
        latest = session.exec(
            select(BackupRun).order_by(col(BackupRun.started_at).desc())
        ).first()
    assert latest is not None
    assert latest.kind == "scheduled" and latest.status == "ok"
    assert latest.created_by is None
    assert (backup_folder / str(latest.file_name)).exists()


def test_cli_exit_codes(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(backup_service, "tool_available", lambda: False)
    assert backup_cli.main([]) == 2
    monkeypatch.setattr(backup_service, "tool_available", lambda: True)
    monkeypatch.setattr(
        backup_service,
        "run_dump",
        lambda dest: (_ for _ in ()).throw(backup_service.BackupError("boom")),
    )
    assert backup_cli.main([]) == 1


# --- The real tools -----------------------------------------------------------


@pytest.mark.skipif(
    shutil.which("pg_dump") is None or shutil.which("pg_restore") is None,
    reason="PostgreSQL client tools are not installed",
)
def test_real_pg_dump_round_trip(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    backup_folder: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Undo the fakes so the real pg_dump and pg_restore --list run.
    monkeypatch.undo()
    monkeypatch.setattr(settings, "BACKUP_DIR", str(backup_folder))
    made = client.post(f"{API}/backups/", headers=superuser_token_headers).json()
    if made["status"] == "failed" and "version mismatch" in (made["error"] or ""):
        pytest.skip("pg_dump is older than the database server")
    assert made["status"] == "ok", made["error"]
    assert made["size_bytes"] > 1000
    path = backup_folder / made["file_name"]
    assert path.read_bytes()[:5] == b"PGDMP"  # PostgreSQL custom-format archive
    again = client.post(
        f"{API}/backups/{made['id']}/verify", headers=superuser_token_headers
    ).json()
    assert again["status"] == "ok"
