"""Create, check and tidy PostgreSQL backups (D-35).

The backend container runs ``pg_dump`` against the ``db`` container and writes
a custom-format archive into ``BACKUP_DIR`` (the host's ``backups`` folder).
Restoring is deliberately **not** done here: a restore replaces the user and
session tables of the person who clicked it and cannot report back once the
database is replaced, so it stays an offline PowerShell step
(``scripts/restore-db.ps1``).

The database password is passed to the tools through the ``PGPASSWORD``
environment variable, never on a command line, in a log, or in an audit row.
"""

import hashlib
import logging
import os
import re
import shutil
import subprocess
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import unquote

from sqlalchemy import text
from sqlmodel import Session, col, select

from app.core.audit import record_audit_event
from app.core.config import settings
from app.core.dates import MANILA_TZ
from app.core.db import engine
from app.models import User
from app.models_backup import BackupRun

logger = logging.getLogger("app.backup")

# The same name pattern backup-db.ps1 uses, so retention treats both alike and
# never touches a file somebody else put in the folder.
BACKUP_FILE_PATTERN = re.compile(r"^mayondon-db-\d{8}-\d{6}-\d{3}\.dump$")
_LOCK_KEY = 0x4D415942  # "MAYB": one backup at a time, across both workers
_TOOL_TIMEOUT_SECONDS = 600
_ERROR_LIMIT = 500


class BackupError(Exception):
    """A backup step failed. The message is safe to show to an administrator."""


class BackupBusy(Exception):
    """Another backup is already running."""


class BackupUnavailable(Exception):
    """pg_dump is missing or the backup folder cannot be written."""


def backup_dir() -> Path:
    return Path(settings.BACKUP_DIR)


def backup_path(file_name: str) -> Path:
    """Path of a backup file; refuses names that could escape the folder."""
    if not BACKUP_FILE_PATTERN.fullmatch(file_name):
        raise BackupError("Not a backup file name.")
    return backup_dir() / file_name


def tool_available() -> bool:
    """True when backups can actually be made on this computer."""
    if shutil.which(settings.PG_DUMP_BIN) is None:
        return False
    if shutil.which(settings.PG_RESTORE_BIN) is None:
        return False
    try:
        backup_dir().mkdir(parents=True, exist_ok=True)
    except OSError:
        return False
    return os.access(backup_dir(), os.W_OK)


def _connection() -> tuple[list[str], dict[str, str]]:
    """Host, port, user and database arguments plus an environment with the password."""
    url = settings.DATABASE_URL
    host = url.hosts()[0]
    database = (url.path or "/app").lstrip("/")
    args = [
        "-h",
        host.get("host") or "localhost",
        "-p",
        str(host.get("port") or 5432),
        "-U",
        unquote(host.get("username") or "postgres"),
        "-d",
        database,
    ]
    env = dict(os.environ)
    password = host.get("password")
    if password:
        env["PGPASSWORD"] = unquote(password)
    return args, env


def _clean(message: str) -> str:
    """Trim tool output and make sure the password can never appear in it."""
    password = settings.DATABASE_URL.hosts()[0].get("password")
    if password:
        message = message.replace(unquote(password), "***").replace(password, "***")
    message = " ".join(message.split())
    return message[:_ERROR_LIMIT] or "No details were reported."


def run_dump(destination: Path) -> None:
    """Write a custom-format dump of the database to ``destination``."""
    args, env = _connection()
    try:
        result = subprocess.run(  # noqa: S603
            [settings.PG_DUMP_BIN, *args, "-Fc", "-f", str(destination)],
            env=env,
            capture_output=True,
            text=True,
            timeout=_TOOL_TIMEOUT_SECONDS,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise BackupError(_clean(f"pg_dump could not run: {exc}")) from exc
    if result.returncode != 0:
        raise BackupError(_clean(f"pg_dump failed: {result.stderr}"))


def list_archive(path: Path) -> None:
    """Make sure PostgreSQL can read the archive (``pg_restore --list``)."""
    try:
        result = subprocess.run(  # noqa: S603
            [settings.PG_RESTORE_BIN, "--list", str(path)],
            capture_output=True,
            text=True,
            timeout=_TOOL_TIMEOUT_SECONDS,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise BackupError(_clean(f"pg_restore could not run: {exc}")) from exc
    if result.returncode != 0:
        raise BackupError(_clean(f"The file is not a readable backup: {result.stderr}"))


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _new_file_name() -> str:
    now = datetime.now(UTC).astimezone(MANILA_TZ)
    return f"mayondon-db-{now:%Y%m%d-%H%M%S}-{now.microsecond // 1000:03d}.dump"


def _acquire_lock():  # noqa: ANN202
    """Hold a database-wide lock on a dedicated connection; None if it is taken."""
    connection = engine.connect()
    got = connection.execute(
        text("SELECT pg_try_advisory_lock(:key)"), {"key": _LOCK_KEY}
    ).scalar()
    if not got:
        connection.close()
        return None
    return connection


def _release_lock(connection) -> None:  # noqa: ANN001
    try:
        connection.execute(text("SELECT pg_advisory_unlock(:key)"), {"key": _LOCK_KEY})
    finally:
        connection.close()


def create_backup(
    session: Session, *, kind: str, actor: User | None = None
) -> BackupRun:
    """Make, check and record one backup. Returns the finished history row.

    Raises ``BackupUnavailable`` or ``BackupBusy`` before anything is written.
    A failed dump is recorded as a failed row and returned, not raised.
    """
    if not tool_available():
        raise BackupUnavailable("Backups are not set up on this computer.")
    lock = _acquire_lock()
    if lock is None:
        raise BackupBusy("A backup is already running.")
    try:
        # Holding the lock proves no other backup is live, so any row still
        # marked running belongs to a process that stopped halfway.
        for stale in session.exec(
            select(BackupRun).where(col(BackupRun.status) == "running")
        ).all():
            stale.status = "failed"
            stale.finished_at = datetime.now(UTC)
            stale.error = "Interrupted before it finished."
            session.add(stale)

        file_name = _new_file_name()
        final_path = backup_dir() / file_name
        partial_path = backup_dir() / f"{file_name}.part"
        run = BackupRun(
            kind=kind,
            status="running",
            file_name=file_name,
            created_by=actor.id if actor else None,
            created_by_email=actor.email if actor else None,
        )
        session.add(run)
        session.commit()
        session.refresh(run)

        try:
            run_dump(partial_path)
            list_archive(partial_path)
            size = partial_path.stat().st_size
            if size <= 0:
                raise BackupError("The backup file is empty.")
            checksum = file_sha256(partial_path)
            partial_path.replace(final_path)
        except Exception as exc:
            partial_path.unlink(missing_ok=True)
            message = str(exc) if isinstance(exc, BackupError) else _clean(repr(exc))
            run.status = "failed"
            run.error = message
            run.finished_at = datetime.now(UTC)
            session.add(run)
            record_audit_event(
                session,
                action="backup.create",
                actor=actor,
                outcome="failed",
                module="backup",
                record_type="backup",
                record_id=run.id,
                reason=message,
                details={"kind": kind},
            )
            session.commit()
            session.refresh(run)
            logger.warning("backup failed: %s", message)
            return run

        now = datetime.now(UTC)
        run.status = "ok"
        run.size_bytes = size
        run.sha256 = checksum
        run.finished_at = now
        run.verified_at = now  # the archive was just read back with pg_restore --list
        session.add(run)
        record_audit_event(
            session,
            action="backup.create",
            actor=actor,
            module="backup",
            record_type="backup",
            record_id=run.id,
            details={"kind": kind, "file_name": file_name, "size_bytes": size},
        )
        session.commit()
        session.refresh(run)
        apply_retention(session)
        return run
    finally:
        _release_lock(lock)


def verify_backup(session: Session, run: BackupRun, *, actor: User | None) -> BackupRun:
    """Re-read a stored backup and compare its checksum with the one recorded."""
    problem: str | None = None
    if run.status != "ok" or not run.file_name:
        problem = "Only a finished backup can be checked."
    else:
        try:
            path = backup_path(run.file_name)
            if not path.is_file():
                raise BackupError("The backup file is no longer in the folder.")
            list_archive(path)
            if run.sha256 and file_sha256(path) != run.sha256:
                raise BackupError(
                    "The file has changed since it was created (checksum mismatch)."
                )
        except BackupError as exc:
            problem = str(exc)

    if problem is None:
        run.verified_at = datetime.now(UTC)
        run.error = None
    else:
        run.status = "failed"
        run.error = problem
        run.verified_at = None
    session.add(run)
    record_audit_event(
        session,
        action="backup.verify",
        actor=actor,
        outcome="success" if problem is None else "failed",
        module="backup",
        record_type="backup",
        record_id=run.id,
        reason=problem,
        details={"file_name": run.file_name},
    )
    session.commit()
    session.refresh(run)
    return run


def apply_retention(session: Session) -> list[str]:
    """Delete the oldest backup files beyond ``BACKUP_KEEP_COPIES``.

    Only files with the backup name pattern are considered. The newest backup
    that was checked and recorded as good is always kept, even when newer
    files exist that are not.
    """
    folder = backup_dir()
    if not folder.is_dir():
        return []
    files = sorted(
        (p.name for p in folder.iterdir() if BACKUP_FILE_PATTERN.fullmatch(p.name)),
        reverse=True,
    )
    keep = set(files[: settings.BACKUP_KEEP_COPIES])
    good = session.exec(
        select(BackupRun.file_name)
        .where(col(BackupRun.status) == "ok", col(BackupRun.verified_at).is_not(None))
        .order_by(col(BackupRun.started_at).desc())
    ).all()
    for name in good:
        if name in files:
            keep.add(name)
            break
    removed: list[str] = []
    for name in files:
        if name in keep:
            continue
        try:
            (folder / name).unlink()
        except OSError:
            logger.warning("could not remove old backup %s", name)
            continue
        removed.append(name)
    return removed
