"""Bring the database up to date before the application starts.

``scripts/entrypoint.sh`` runs this every time the backend container starts, so
installing an update is just "rebuild and start": nobody has to remember
``alembic upgrade head``. What it does, in order:

1. Wait for the database to accept connections.
2. Compare the database's revision with the newest revision in this code.
3. Already up to date: do nothing.
4. Brand-new, empty database: run the migrations.
5. Database behind the code and holding data: first write a safety copy
   (``mayondon-premigrate-<time>-from-<revision>.dump``) into ``BACKUP_DIR``,
   check that PostgreSQL can read it, then run the migrations.
6. Database NEWER than this code (an old image was started by mistake) or a
   database that has tables but no migration history: refuse to start, change
   nothing, and say why.

If anything fails the process exits with a non-zero code, so the app does not
start on a half-migrated database; the reason is in ``docker compose logs
backend``. Migrations run inside a transaction, so a failed one leaves the
database as it was.

Settings (environment variables):
``MIGRATE_ON_START`` (default true) and ``PRE_MIGRATION_BACKUP`` (default
true). Turn the second off only if you take your own backup first.

This does NOT create the first administrator: run ``python app/initial_data.py``
once on a new installation (docs/06). Running it on every start would recreate
the first account, with the password from ``.env``, if it had been renamed.

Output uses ``print`` on purpose: Alembic's ``env.py`` reconfigures logging when
it runs and would silence our own log lines.
"""

import os
import sys
import time
from collections.abc import Callable, Sequence
from datetime import UTC, datetime
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from alembic.script.revision import RevisionError
from alembic.util.exc import CommandError
from sqlalchemy import inspect, text

from app.core.backup import BackupError, backup_dir, list_archive, run_dump
from app.core.dates import MANILA_TZ
from app.core.db import engine

BACKEND_DIR = Path(__file__).resolve().parents[1]
CONNECT_ATTEMPTS = 30
CONNECT_WAIT_SECONDS = 2

# What to do, decided from the database and the code alone (see ``decide``).
CURRENT = "current"
FRESH = "fresh"
UPGRADE = "upgrade"
NEWER = "newer"
UNMANAGED = "unmanaged"


def say(message: str) -> None:
    print(f"[migrate] {message}", flush=True)  # noqa: T201 (see module docstring)


def env_flag(name: str, default: bool = True) -> bool:
    value = os.environ.get(name)
    if value is None or not value.strip():
        return default
    return value.strip().lower() not in {"0", "false", "no", "off"}


def alembic_config() -> Config:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "app" / "alembic"))
    return config


def decide(
    current: Sequence[str],
    heads: Sequence[str],
    known: Callable[[str], bool],
    has_tables: bool,
) -> str:
    """Pick the action. ``current`` is the database's revision(s), ``heads`` the code's."""
    if not current:
        return UNMANAGED if has_tables else FRESH
    if not all(known(revision) for revision in current):
        return NEWER
    if set(current) == set(heads):
        return CURRENT
    return UPGRADE


def read_database() -> tuple[tuple[str, ...], bool]:
    """Return the database's revision(s) and whether it holds any tables."""
    with engine.connect() as connection:
        tables = inspect(connection).get_table_names()
        if "alembic_version" not in tables:
            return (), bool(tables)
        rows = connection.execute(text("SELECT version_num FROM alembic_version"))
        return tuple(sorted(row[0] for row in rows)), True


def wait_for_database() -> None:
    for attempt in range(1, CONNECT_ATTEMPTS + 1):
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            return
        except Exception as exc:  # noqa: BLE001 (any failure means "not ready yet")
            if attempt == CONNECT_ATTEMPTS:
                raise
            say(
                f"Waiting for the database ({attempt}/{CONNECT_ATTEMPTS}): {type(exc).__name__}"
            )
            time.sleep(CONNECT_WAIT_SECONDS)


def safety_copy(from_revision: str) -> Path:
    """Dump the database into BACKUP_DIR and check the file can be read back."""
    folder = backup_dir()
    folder.mkdir(parents=True, exist_ok=True)
    now = datetime.now(UTC).astimezone(MANILA_TZ)
    final = (
        folder / f"mayondon-premigrate-{now:%Y%m%d-%H%M%S}-from-{from_revision}.dump"
    )
    partial = final.with_name(final.name + ".partial")
    try:
        run_dump(partial)
        list_archive(partial)
        os.replace(partial, final)
    finally:
        partial.unlink(missing_ok=True)
    return final


def main() -> int:
    if not env_flag("MIGRATE_ON_START"):
        say("MIGRATE_ON_START is off: not touching the database.")
        return 0

    config = alembic_config()
    script = ScriptDirectory.from_config(config)
    heads = tuple(sorted(script.get_heads()))

    def known(revision: str) -> bool:
        try:
            return script.get_revision(revision) is not None
        except CommandError, RevisionError:
            return False

    try:
        wait_for_database()
        current, has_tables = read_database()
    except Exception as exc:  # noqa: BLE001
        say(f"STOP: cannot read the database: {type(exc).__name__}: {exc}")
        return 1

    action = decide(current, heads, known, has_tables)
    shown = ", ".join(current) or "none"

    if action == CURRENT:
        say(f"Database is up to date ({shown}).")
        return 0
    if action == NEWER:
        say(
            f"STOP: the database is at revision {shown}, which this version of the "
            "program does not know. An older program was probably started against a "
            "newer database. Nothing was changed. Start the newer version, or restore "
            "a backup made before the update."
        )
        return 1
    if action == UNMANAGED:
        say(
            "STOP: the database has tables but no migration history (no "
            "alembic_version table), so it is not safe to migrate automatically. "
            "Nothing was changed."
        )
        return 1

    if action == UPGRADE:
        if env_flag("PRE_MIGRATION_BACKUP"):
            say(
                f"Database is behind the program ({shown} -> {', '.join(heads)}). Saving a safety copy first."
            )
            try:
                saved = safety_copy(current[0])
            except (BackupError, OSError) as exc:
                say(
                    f"STOP: could not make the safety copy ({exc}). The database was not "
                    "changed and the program will not start. Fix the problem, or set "
                    "PRE_MIGRATION_BACKUP=false only if you have your own recent backup."
                )
                return 1
            say(f"Safety copy saved: {saved.name} (in the backups folder).")
        else:
            say("PRE_MIGRATION_BACKUP is off: migrating without a safety copy.")
    else:
        say("New empty database: creating the tables.")

    try:
        command.upgrade(config, "head")
    except Exception as exc:  # noqa: BLE001
        say(
            f"STOP: the migration failed and was rolled back: {type(exc).__name__}: {exc}"
        )
        return 1

    say(f"Database is now up to date ({', '.join(heads)}).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
