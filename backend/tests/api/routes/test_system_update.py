"""Update notice and the Update button's request (patch 206).

The program only reads what the computer's update scripts wrote into the backups
folder and leaves one request file; these tests play the scripts' part by writing
those files into a throw-away folder.
"""

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, col, select

from app.core.config import settings
from app.models_foundation import AuditLog

API = settings.API_V1_STR
STATUS = f"{API}/system/update"
REQUEST = f"{API}/system/update/request"
OLD = "1111111"
NEW = "2222222"


@pytest.fixture(autouse=True)
def backups(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Path:
    folder = tmp_path / "backups"
    folder.mkdir()
    monkeypatch.setattr(settings, "BACKUP_DIR", str(folder))
    return folder


def _write(folder: Path, name: str, body: dict, *, bom: bool = False) -> None:
    # PowerShell's "Set-Content -Encoding UTF8" writes a byte order mark.
    (folder / name).write_text(
        json.dumps(body), encoding="utf-8-sig" if bom else "utf-8"
    )


def _watcher(folder: Path, *, age: timedelta = timedelta()) -> None:
    _write(folder, "update-watcher.json", {"alive_at": (_now() - age).isoformat()})


def _state(
    folder: Path,
    state: str,
    *,
    age: timedelta = timedelta(),
    message: str = "",
    **extra: object,
) -> None:
    _write(
        folder,
        "update-state.json",
        {
            "checked_at": (_now() - age).isoformat(),
            "state": state,
            "installed": OLD,
            "target": NEW,
            "message": message,
            **extra,
        },
        bom=True,
    )


def _now() -> datetime:
    return datetime.now(UTC)


def test_only_administrators_see_or_press_it(
    client: TestClient,
    staff_token_headers: dict[str, str],
    superuser_token_headers: dict[str, str],
    backups: Path,
) -> None:
    _watcher(backups)
    _state(backups, "available")
    assert client.get(STATUS).status_code == 401
    assert client.post(REQUEST).status_code == 401
    assert client.get(STATUS, headers=staff_token_headers).status_code == 403
    assert client.post(REQUEST, headers=staff_token_headers).status_code == 403
    assert not (backups / "update-request.json").exists()
    assert client.get(STATUS, headers=superuser_token_headers).status_code == 200


def test_a_computer_without_the_scripts_reports_nothing(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    body = client.get(STATUS, headers=superuser_token_headers).json()
    assert body["watcher_running"] is False
    assert body["state"] == "unknown"
    assert body["requested"] is False
    assert body["checked_at"] is None


def test_an_available_version_is_reported(
    client: TestClient, superuser_token_headers: dict[str, str], backups: Path
) -> None:
    _watcher(backups)
    _state(backups, "available", message="Version 2222222 is ready.")
    body = client.get(STATUS, headers=superuser_token_headers).json()
    assert body["watcher_running"] is True
    assert body["state"] == "available"
    assert body["installed"] == OLD
    assert body["target"] == NEW
    assert body["message"] == "Version 2222222 is ready."
    assert body["requested"] is False


def test_a_stopped_watcher_is_not_running(
    client: TestClient, superuser_token_headers: dict[str, str], backups: Path
) -> None:
    _watcher(backups, age=timedelta(minutes=10))
    _state(backups, "available")
    body = client.get(STATUS, headers=superuser_token_headers).json()
    assert body["watcher_running"] is False


@pytest.mark.parametrize(
    ("state", "age", "expected"),
    [
        ("up_to_date", timedelta(hours=1), "up_to_date"),
        ("updating", timedelta(minutes=5), "updating"),
        ("updating", timedelta(minutes=50), "failed"),  # the script died midway
        ("available", timedelta(days=3), "unknown"),  # nobody has looked for days
        ("surprise", timedelta(), "unknown"),
    ],
)
def test_state_names_and_staleness(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    backups: Path,
    state: str,
    age: timedelta,
    expected: str,
) -> None:
    _watcher(backups)
    _state(backups, state, age=age)
    body = client.get(STATUS, headers=superuser_token_headers).json()
    assert body["state"] == expected


def test_unreadable_files_never_break_the_page(
    client: TestClient, superuser_token_headers: dict[str, str], backups: Path
) -> None:
    (backups / "update-watcher.json").write_text("{not json", encoding="utf-8")
    (backups / "update-state.json").write_text("[1, 2, 3]", encoding="utf-8")
    r = client.get(STATUS, headers=superuser_token_headers)
    assert r.status_code == 200
    assert r.json()["state"] == "unknown"


def test_odd_values_in_the_state_file_are_cleaned(
    client: TestClient, superuser_token_headers: dict[str, str], backups: Path
) -> None:
    _watcher(backups)
    _write(
        backups,
        "update-state.json",
        {
            "checked_at": _now().isoformat(),
            "state": "available",
            "installed": "not-a-commit",
            "target": NEW + "f" * 33,  # a full 40-character commit is shortened
            "message": "x" * 1000,
        },
    )
    body = client.get(STATUS, headers=superuser_token_headers).json()
    assert body["installed"] == ""
    assert body["target"] == NEW
    assert len(body["message"]) == 300


def test_pressing_update_leaves_one_request_and_an_audit_row(
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
    backups: Path,
) -> None:
    _watcher(backups)
    _state(backups, "available")
    before = db.exec(
        select(AuditLog).where(col(AuditLog.action) == "system.update_requested")
    ).all()
    r = client.post(REQUEST, headers=superuser_token_headers)
    assert r.status_code == 200, r.text
    assert r.json()["requested"] is True
    request = json.loads((backups / "update-request.json").read_text("utf-8"))
    assert set(request) == {"requested_at"}
    assert list(backups.glob("*.tmp")) == []

    db.expire_all()
    rows = db.exec(
        select(AuditLog).where(col(AuditLog.action) == "system.update_requested")
    ).all()
    assert len(rows) == len(before) + 1
    row = rows[-1]
    assert row.outcome == "success"
    assert row.details == {"target": NEW, "installed": OLD}

    again = client.post(REQUEST, headers=superuser_token_headers)
    assert again.status_code == 409
    assert "already" in again.json()["detail"]
    db.expire_all()
    after = db.exec(
        select(AuditLog).where(col(AuditLog.action) == "system.update_requested")
    ).all()
    assert len(after) == len(rows)


@pytest.mark.parametrize(
    ("watcher", "state", "words"),
    [
        (False, "available", "not running"),
        (True, "up_to_date", "no new version"),
        (True, "failed", "no new version"),
        (True, "unknown", "no new version"),
        (True, "updating", "already"),
    ],
)
def test_no_request_when_it_cannot_help(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    backups: Path,
    watcher: bool,
    state: str,
    words: str,
) -> None:
    if watcher:
        _watcher(backups)
    _state(backups, state)
    r = client.post(REQUEST, headers=superuser_token_headers)
    assert r.status_code == 409
    assert words in r.json()["detail"].lower()
    assert not (backups / "update-request.json").exists()


def test_an_unwritable_folder_gives_a_plain_message(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    backups: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _watcher(backups)
    _state(backups, "available")

    def refuse(*_args: object, **_kwargs: object) -> int:
        raise PermissionError("read-only")

    monkeypatch.setattr(Path, "write_text", refuse)
    r = client.post(REQUEST, headers=superuser_token_headers)
    assert r.status_code == 409
    assert "not writable" in r.json()["detail"]
