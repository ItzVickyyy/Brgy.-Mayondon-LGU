"""The start-up migration step (handover step 1): when it migrates, when it
makes a safety copy, and when it refuses to touch the database."""

from pathlib import Path

import pytest

from app import migrate_on_start as m
from app.core.backup import BackupError

OLD = "a1c4e8b27d93"  # a real, older revision in this code base


def heads() -> tuple[str, ...]:
    from alembic.script import ScriptDirectory

    return tuple(sorted(ScriptDirectory.from_config(m.alembic_config()).get_heads()))


class Recorder:
    def __init__(self) -> None:
        self.calls: list[str] = []


@pytest.fixture
def rec(monkeypatch: pytest.MonkeyPatch) -> Recorder:
    r = Recorder()
    monkeypatch.delenv("MIGRATE_ON_START", raising=False)
    monkeypatch.delenv("PRE_MIGRATION_BACKUP", raising=False)
    monkeypatch.setattr(m, "wait_for_database", lambda: None)
    monkeypatch.setattr(
        m.command, "upgrade", lambda config, rev: r.calls.append(f"upgrade:{rev}")
    )

    def fake_copy(from_revision: str) -> Path:
        r.calls.append(f"copy:{from_revision}")
        return Path(f"mayondon-premigrate-test-from-{from_revision}.dump")

    monkeypatch.setattr(m, "safety_copy", fake_copy)
    return r


def database(
    monkeypatch: pytest.MonkeyPatch, current: tuple[str, ...], tables: bool
) -> None:
    monkeypatch.setattr(m, "read_database", lambda: (current, tables))


def test_decide() -> None:
    known = lambda rev: rev != "unknown"  # noqa: E731
    assert m.decide((), ("h",), known, has_tables=False) == m.FRESH
    assert m.decide((), ("h",), known, has_tables=True) == m.UNMANAGED
    assert m.decide(("h",), ("h",), known, has_tables=True) == m.CURRENT
    assert m.decide(("old",), ("h",), known, has_tables=True) == m.UPGRADE
    assert m.decide(("unknown",), ("h",), known, has_tables=True) == m.NEWER


def test_env_flag(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("X_FLAG", raising=False)
    assert m.env_flag("X_FLAG") is True
    for off in ("false", "FALSE", "0", "no", "off"):
        monkeypatch.setenv("X_FLAG", off)
        assert m.env_flag("X_FLAG") is False
    for on in ("true", "1", "yes", ""):
        monkeypatch.setenv("X_FLAG", on)
        assert m.env_flag("X_FLAG") is True


def test_up_to_date_does_nothing(
    rec: Recorder, monkeypatch: pytest.MonkeyPatch
) -> None:
    database(monkeypatch, heads(), True)
    assert m.main() == 0
    assert rec.calls == []


def test_behind_makes_a_safety_copy_before_migrating(
    rec: Recorder, monkeypatch: pytest.MonkeyPatch
) -> None:
    database(monkeypatch, (OLD,), True)
    assert m.main() == 0
    assert rec.calls == [f"copy:{OLD}", "upgrade:head"]


def test_failed_safety_copy_stops_before_migrating(
    rec: Recorder, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    database(monkeypatch, (OLD,), True)

    def broken(_from: str) -> Path:
        raise BackupError("pg_dump failed")

    monkeypatch.setattr(m, "safety_copy", broken)
    assert m.main() == 1
    assert rec.calls == []
    assert "STOP" in capsys.readouterr().out


def test_safety_copy_can_be_turned_off(
    rec: Recorder, monkeypatch: pytest.MonkeyPatch
) -> None:
    database(monkeypatch, (OLD,), True)
    monkeypatch.setenv("PRE_MIGRATION_BACKUP", "false")
    assert m.main() == 0
    assert rec.calls == ["upgrade:head"]


def test_new_empty_database_is_migrated_without_a_copy(
    rec: Recorder, monkeypatch: pytest.MonkeyPatch
) -> None:
    database(monkeypatch, (), False)
    assert m.main() == 0
    assert rec.calls == ["upgrade:head"]


def test_database_newer_than_the_program_is_refused(
    rec: Recorder, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    database(monkeypatch, ("ffffffffffff",), True)
    assert m.main() == 1
    assert rec.calls == []
    assert "does not know" in capsys.readouterr().out


def test_tables_without_history_are_refused(
    rec: Recorder, monkeypatch: pytest.MonkeyPatch
) -> None:
    database(monkeypatch, (), True)
    assert m.main() == 1
    assert rec.calls == []


@pytest.mark.usefixtures("rec")
def test_failed_migration_exits_nonzero(monkeypatch: pytest.MonkeyPatch) -> None:
    database(monkeypatch, (OLD,), True)

    def boom(_config: object, _rev: str) -> None:
        raise RuntimeError("bad migration")

    monkeypatch.setattr(m.command, "upgrade", boom)
    assert m.main() == 1


def test_switched_off_leaves_the_database_alone(
    rec: Recorder, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("MIGRATE_ON_START", "false")
    database(monkeypatch, (OLD,), True)
    assert m.main() == 0
    assert rec.calls == []
