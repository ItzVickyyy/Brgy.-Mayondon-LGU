"""Change the system's secrets safely (dry run unless you say otherwise).

Run it from the repository root in PowerShell. The repository folder is mounted
into the container as /work so the tool can rewrite ``.env``:

    docker compose -f compose.yml run --rm -v "${PWD}:/work" backend \\
        python -m app.rotate_secrets_cli plan

    docker compose -f compose.yml run --rm -v "${PWD}:/work" backend \\
        python -m app.rotate_secrets_cli apply --confirm ROTATE

    docker compose -f compose.yml run --rm -v "${PWD}:/work" backend \\
        python -m app.rotate_secrets_cli rollback --old-env /work/.env.before-rotation-<time> \\
        --confirm ROLLBACK

``plan`` (the default) changes nothing: it checks the set-up and lists what
``apply`` would change, by name, never by value. ``apply`` needs a recent
backup (encrypted when backup encryption is set up), saves the old ``.env``
beside the new one, changes the database password inside the running database,
proves the new password works, and only then replaces ``.env``. If anything
fails after the database password changed, the old password is put back.

Parts (``--parts``, default all three):

* ``secret-key``     new ``SECRET_KEY``. Everyone is signed out once.
* ``db-password``    new ``POSTGRES_PASSWORD`` (and the same password inside
                     ``DATABASE_URL`` when ``.env`` has one).
* ``admin-password`` the administrator types a new password (never shown, never
                     written to ``.env``). ``FIRST_SUPERUSER_PASSWORD`` in
                     ``.env`` becomes a random value that belongs to no account.

* ``mfa-key``        (not in the default) a new ``MFA_ENCRYPTION_KEY``: the key
                     that locks everyone's authenticator-app secret. Every stored
                     secret is re-encrypted with the new key in ONE database
                     transaction that is saved only after ``.env`` is replaced.
                     When ``.env`` has no such key yet, this part makes one (use
                     it once to set two-factor up). Rollback puts the secrets back.

Nothing here prints a secret. Afterwards restart the backend (``apply`` prints
the exact command). Exit codes: 0 = done (or plan fine), 1 = failed or refused,
2 = bad option.
"""

import argparse
import getpass
import os
import re
import secrets
import shutil
import sys
import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from pathlib import Path

import psycopg
from psycopg import sql
from sqlalchemy.engine import URL, Engine, make_url
from sqlmodel import Session, create_engine, select

from app.core import mfa
from app.core.audit import record_audit_event
from app.core.security import DEFAULT_PASSWORD, get_password_hash
from app.models import User, UserRole

PARTS = ("secret-key", "db-password", "admin-password")
# Chosen only by name (--parts mfa-key): it is not part of "everything".
OPTIONAL_PARTS = ("mfa-key",)
MIN_ADMIN_PASSWORD_LENGTH = 12
DEFAULT_MAX_BACKUP_AGE_MINUTES = 120
BACKUP_FILE = re.compile(r"^mayondon-db-\d{8}-\d{6}-\d{3}\.dump(\.enc)?$")
ENV_LINE = re.compile(
    r"^(?P<key>[A-Za-z_][A-Za-z0-9_]*)=(?P<value>.*?)(?P<eol>\r?\n)?$"
)
AUDIT_ACTION = "auth.secrets_rotate"


class RotationError(Exception):
    """A check failed or a step failed; the message is safe to show."""


def say(message: str, *, error: bool = False) -> None:
    print(message, file=sys.stderr if error else sys.stdout)  # noqa: T201


# --------------------------------------------------------------------------
# .env handling (text in, text out; never prints a value)
# --------------------------------------------------------------------------


def env_get(text: str, key: str) -> str | None:
    """Value of the first active ``KEY=value`` line (surrounding quotes removed)."""
    for line in text.splitlines(keepends=True):
        found = ENV_LINE.match(line)
        if found and found["key"] == key:
            return _unquote(found["value"])
    return None


def _unquote(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        return value[1:-1]
    return value


def env_set(text: str, key: str, value: str) -> str:
    """Replace the first active ``KEY=`` line, keeping comments and line endings."""
    newline = "\r\n" if "\r\n" in text else "\n"
    lines = text.splitlines(keepends=True)
    for index, line in enumerate(lines):
        found = ENV_LINE.match(line)
        if found and found["key"] == key:
            lines[index] = f"{key}={value}{found['eol'] or ''}"
            return "".join(lines)
    if lines and not lines[-1].endswith(("\n", "\r")):
        lines[-1] += newline
    lines.append(f"{key}={value}{newline}")
    return "".join(lines)


def new_secret_key() -> str:
    return secrets.token_urlsafe(48)


def new_database_password() -> str:
    # Letters, digits, "-" and "_" only: safe inside a URL and a shell.
    return secrets.token_urlsafe(32)


# --------------------------------------------------------------------------
# Plan
# --------------------------------------------------------------------------


@dataclass
class Plan:
    parts: tuple[str, ...]
    lines: list[str] = field(default_factory=list)
    problems: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.problems


def database_url_from_env_text(text: str, fallback: str | None) -> URL:
    """The URL the tool uses to reach the database: the container's own setting."""
    raw = fallback or os.environ.get("DATABASE_URL") or env_get(text, "DATABASE_URL")
    if not raw:
        raise RotationError(
            "DATABASE_URL is not set, so the database cannot be reached."
        )
    url = make_url(raw.replace("postgresql+psycopg://", "postgresql://"))
    return url.set(drivername="postgresql")


def check_env(
    text: str, parts: tuple[str, ...], current_db_password: str | None
) -> list[str]:
    problems: list[str] = []
    required = {
        "secret-key": ["SECRET_KEY"],
        "db-password": ["POSTGRES_PASSWORD"],
        "admin-password": ["FIRST_SUPERUSER", "FIRST_SUPERUSER_PASSWORD"],
        "mfa-key": [],
    }
    for part in parts:
        for key in required[part]:
            if not env_get(text, key):
                problems.append(f".env has no value for {key}.")
    if "db-password" in parts and current_db_password is not None:
        in_env = env_get(text, "POSTGRES_PASSWORD")
        if in_env and in_env != current_db_password:
            problems.append(
                "POSTGRES_PASSWORD in .env is not the password the running backend "
                "uses. Restart the stack first (docker compose -f compose.yml up -d) "
                "so .env and the database agree, then try again."
            )
    return problems


def newest_backup(
    directory: Path, *, now: datetime | None = None
) -> tuple[Path, timedelta] | None:
    now = now or datetime.now(UTC)
    best: tuple[Path, float] | None = None
    if directory.is_dir():
        for path in directory.iterdir():
            if path.is_file() and BACKUP_FILE.match(path.name):
                modified = path.stat().st_mtime
                if best is None or modified > best[1]:
                    best = (path, modified)
    if best is None:
        return None
    return best[0], now - datetime.fromtimestamp(best[1], UTC)


def check_backup(
    directory: Path,
    *,
    max_age_minutes: int,
    need_encrypted: bool,
    now: datetime | None = None,
) -> str | None:
    """Return a problem text, or None when a recent enough backup exists."""
    found = newest_backup(directory, now=now)
    if found is None:
        return "There is no backup yet. Make one first (Backup and Restore page)."
    path, age = found
    if age > timedelta(minutes=max_age_minutes):
        minutes = int(age.total_seconds() // 60)
        return (
            f"The newest backup is {minutes} minutes old (limit {max_age_minutes}). "
            "Make a fresh one first."
        )
    if need_encrypted and not path.name.endswith(".enc"):
        return (
            "Backup encryption is set up, but the newest backup is not encrypted. "
            "Make a fresh encrypted backup first."
        )
    return None


def build_plan(
    text: str,
    parts: tuple[str, ...],
    *,
    backups: Path,
    max_backup_age_minutes: int,
    current_db_password: str | None,
    need_encrypted: bool,
    now: datetime | None = None,
) -> Plan:
    plan = Plan(parts=parts)
    plan.problems.extend(check_env(text, parts, current_db_password))
    problem = check_backup(
        backups,
        max_age_minutes=max_backup_age_minutes,
        need_encrypted=need_encrypted,
        now=now,
    )
    if problem:
        plan.problems.append(problem)
    if "secret-key" in parts:
        plan.lines.append(
            "SECRET_KEY: replaced with a new random value. Everyone is signed out "
            "once, and any unused password-reset link stops working."
        )
    if "db-password" in parts:
        plan.lines.append(
            "POSTGRES_PASSWORD: replaced with a new random value; the same change "
            "is made to the database user inside the running database (ALTER ROLE) "
            "and checked before .env is touched."
        )
        if env_get(text, "DATABASE_URL"):
            plan.lines.append("DATABASE_URL in .env: the password inside it follows.")
    if "admin-password" in parts:
        plan.lines.append(
            "Administrator password: you type a new one (at least "
            f"{MIN_ADMIN_PASSWORD_LENGTH} characters, not shown, not saved in .env). "
            "FIRST_SUPERUSER_PASSWORD in .env becomes a random value that belongs "
            "to no account."
        )
        plan.lines.append("This change is not undone by rollback.")
    if "mfa-key" in parts:
        plan.lines.append(
            "MFA_ENCRYPTION_KEY: a new random value (made when .env has none). "
            "Every stored authenticator secret is re-encrypted with it in one "
            "transaction, saved only after .env is replaced. Nobody has to set "
            "two-factor up again."
        )
    plan.lines.append(
        "The old .env is saved first as .env.before-rotation-<time> next to it."
    )
    plan.lines.append(
        "One row, 'System secrets changed', is added to the Activity Log (names only)."
    )
    plan.lines.append(
        "Not touched: backup keys, backup files, resident data, other accounts."
    )
    return plan


# --------------------------------------------------------------------------
# Database steps (psycopg, explicit URL; never the app's own engine)
# --------------------------------------------------------------------------


def connect(url: URL, password: str) -> psycopg.Connection:
    return psycopg.connect(
        host=url.host,
        port=url.port or 5432,
        dbname=url.database,
        user=url.username,
        password=password,
        connect_timeout=10,
        autocommit=True,
    )


def can_connect(url: URL, password: str) -> bool:
    try:
        with connect(url, password):
            return True
    except psycopg.Error:
        return False


def set_role_password(url: URL, using_password: str, new_password: str) -> None:
    with connect(url, using_password) as connection:
        connection.execute(
            sql.SQL("ALTER ROLE {} WITH PASSWORD {}").format(
                sql.Identifier(url.username or "postgres"), sql.Literal(new_password)
            )
        )


def _engine(url: URL, password: str) -> Engine:
    return create_engine(
        url.set(drivername="postgresql+psycopg", password=password), pool_pre_ping=True
    )


def read_mfa_secrets(url: URL, password: str) -> list[tuple[uuid.UUID, str]]:
    """Every stored (still encrypted) authenticator secret."""
    with connect(url, password) as connection:
        rows = connection.execute(
            'SELECT id, mfa_secret_encrypted FROM "user" '
            "WHERE mfa_secret_encrypted IS NOT NULL ORDER BY id"
        ).fetchall()
    return [(row[0], row[1]) for row in rows]


def begin_mfa_reencrypt(
    url: URL, password: str, from_key: str, to_key: str
) -> psycopg.Connection:
    """Re-encrypt every authenticator secret, but do NOT save yet.

    Returns the open transaction; the caller commits it once ``.env`` has the
    new key (or rolls it back). Raises RotationError (and rolls back) if any
    secret cannot be read with ``from_key``.
    """
    connection = psycopg.connect(
        host=url.host,
        port=url.port or 5432,
        dbname=url.database,
        user=url.username,
        password=password,
        connect_timeout=10,
        autocommit=False,
    )
    try:
        rows = connection.execute(
            'SELECT id, mfa_secret_encrypted FROM "user" '
            "WHERE mfa_secret_encrypted IS NOT NULL FOR UPDATE"
        ).fetchall()
        for user_id, stored in rows:
            plain = mfa.decrypt_secret(stored, user_id, key=from_key)
            if plain is None:
                raise RotationError(
                    "A stored authenticator secret cannot be read with the "
                    "current MFA_ENCRYPTION_KEY. Nothing was changed."
                )
            connection.execute(
                'UPDATE "user" SET mfa_secret_encrypted = %s WHERE id = %s',
                (mfa.encrypt_secret(plain, user_id, key=to_key), user_id),
            )
    except BaseException:
        connection.rollback()
        connection.close()
        raise
    return connection


def check_mfa_secrets_readable(url: URL, password: str, key: str) -> int:
    """How many secrets exist; raises when any cannot be read with ``key``."""
    rows = read_mfa_secrets(url, password)
    if rows and not key:
        raise RotationError(
            f"{len(rows)} authenticator secret(s) are stored but .env has no "
            "MFA_ENCRYPTION_KEY, so they cannot be re-encrypted. Nothing was changed."
        )
    for user_id, stored in rows:
        if mfa.decrypt_secret(stored, user_id, key=key) is None:
            raise RotationError(
                "A stored authenticator secret cannot be read with the "
                "MFA_ENCRYPTION_KEY in .env. Nothing was changed."
            )
    return len(rows)


def write_admin_password(
    url: URL, password: str, admin_email: str, new_password: str
) -> None:
    engine = _engine(url, password)
    try:
        with Session(engine) as session:
            user = session.exec(select(User).where(User.email == admin_email)).first()
            if user is None or user.role != UserRole.admin:
                raise RotationError(
                    "The administrator account named in FIRST_SUPERUSER was not found."
                )
            user.hashed_password = get_password_hash(new_password)
            user.must_change_password = False
            session.add(user)
            record_audit_event(
                session,
                action="user.password_change",
                actor=user,
                module="users",
                record_type="user",
                record_id=user.id,
                reason="Administrator password changed with the rotation tool",
            )
            session.commit()
    finally:
        engine.dispose()


def write_audit(url: URL, password: str, changed: list[str]) -> None:
    engine = _engine(url, password)
    try:
        with Session(engine) as session:
            record_audit_event(
                session,
                action=AUDIT_ACTION,
                module="auth",
                reason="Changed: " + ", ".join(changed),
            )
            session.commit()
    finally:
        engine.dispose()


# --------------------------------------------------------------------------
# Apply and rollback
# --------------------------------------------------------------------------


def read_text_exact(path: Path) -> str:
    """Read a file without turning Windows line endings into Unix ones."""
    return path.read_bytes().decode("utf-8")


def _stamp(now: datetime | None = None) -> str:
    return (now or datetime.now(UTC)).strftime("%Y%m%d-%H%M%S")


def _replace_env(path: Path, text: str) -> None:
    """Write the new text. Replace the file, or fall back to writing in place."""
    temporary = path.with_name(path.name + ".new")
    temporary.write_text(text, encoding="utf-8", newline="")
    try:
        os.replace(temporary, path)
    except OSError:
        # A bind-mounted file cannot always be swapped; write into it instead.
        path.write_text(text, encoding="utf-8", newline="")
        temporary.unlink(missing_ok=True)


def valid_admin_password(candidate: str, old_hint: str | None) -> str | None:
    if len(candidate) < MIN_ADMIN_PASSWORD_LENGTH:
        return f"Use at least {MIN_ADMIN_PASSWORD_LENGTH} characters."
    if candidate == DEFAULT_PASSWORD or candidate.startswith("replace-with-"):
        return "That is a placeholder, not a password."
    if old_hint and candidate == old_hint:
        return "That is the old password."
    return None


@dataclass
class Result:
    old_env_copy: Path
    changed: list[str]


def apply_rotation(
    env_file: Path,
    parts: tuple[str, ...],
    *,
    url: URL,
    current_db_password: str,
    backups: Path,
    max_backup_age_minutes: int,
    need_encrypted: bool,
    ask_admin_password: Callable[[], str],
    now: datetime | None = None,
) -> Result:
    text = read_text_exact(env_file)
    plan = build_plan(
        text,
        parts,
        backups=backups,
        max_backup_age_minutes=max_backup_age_minutes,
        current_db_password=current_db_password,
        need_encrypted=need_encrypted,
        now=now,
    )
    if not plan.ok:
        raise RotationError("Not done. " + " ".join(plan.problems))
    if not can_connect(url, current_db_password):
        raise RotationError(
            "Not done: the database does not accept the current password."
        )

    old_mfa_key = env_get(text, "MFA_ENCRYPTION_KEY") or ""
    if "mfa-key" in parts:
        # Prove every stored secret can be read BEFORE anything changes.
        check_mfa_secrets_readable(url, current_db_password, old_mfa_key)

    # Ask for the administrator's new password BEFORE changing anything.
    admin_password: str | None = None
    admin_email = env_get(text, "FIRST_SUPERUSER") or ""
    if "admin-password" in parts:
        admin_password = ask_admin_password()
        why = valid_admin_password(
            admin_password, env_get(text, "FIRST_SUPERUSER_PASSWORD")
        )
        if why:
            raise RotationError(f"Not done: {why}")

    new_text = text
    changed: list[str] = []
    new_db_password = current_db_password
    if "secret-key" in parts:
        new_text = env_set(new_text, "SECRET_KEY", new_secret_key())
        changed.append("SECRET_KEY")
    if "db-password" in parts:
        new_db_password = new_database_password()
        new_text = env_set(new_text, "POSTGRES_PASSWORD", new_db_password)
        database_url = env_get(new_text, "DATABASE_URL")
        if database_url and current_db_password in database_url:
            new_text = env_set(
                new_text,
                "DATABASE_URL",
                database_url.replace(current_db_password, new_db_password),
            )
        changed.append("POSTGRES_PASSWORD")
    if "admin-password" in parts:
        new_text = env_set(
            new_text, "FIRST_SUPERUSER_PASSWORD", new_database_password()
        )
        changed.append("administrator password")
    new_mfa_key = ""
    if "mfa-key" in parts:
        new_mfa_key = new_secret_key()
        new_text = env_set(new_text, "MFA_ENCRYPTION_KEY", new_mfa_key)
        changed.append("MFA_ENCRYPTION_KEY")

    old_copy = env_file.with_name(f"{env_file.name}.before-rotation-{_stamp(now)}")
    shutil.copy2(env_file, old_copy)
    old_copy.chmod(0o600)

    database_changed = False
    mfa_transaction: psycopg.Connection | None = None
    env_replaced = False
    try:
        if "db-password" in parts:
            set_role_password(url, current_db_password, new_db_password)
            database_changed = True
            if not can_connect(url, new_db_password):
                raise RotationError("the database did not accept the new password")
            if can_connect(url, current_db_password):
                raise RotationError("the database still accepts the old password")
        if "mfa-key" in parts:
            mfa_transaction = begin_mfa_reencrypt(
                url, new_db_password, old_mfa_key, new_mfa_key
            )
        _replace_env(env_file, new_text)
        env_replaced = True
        if mfa_transaction is not None:
            mfa_transaction.commit()
    except Exception as exc:
        if mfa_transaction is not None:
            try:
                mfa_transaction.rollback()
            except psycopg.Error:
                pass
        if env_replaced:
            _replace_env(env_file, text)
        if database_changed:
            try:
                set_role_password(url, new_db_password, current_db_password)
            except psycopg.Error as undo_error:
                raise RotationError(
                    f"FAILED ({exc}) and the old database password could NOT be put back "
                    f"({type(undo_error).__name__}). .env is unchanged. Use rollback with "
                    f"{old_copy.name} (docs/06, secret rotation)."
                ) from exc
        raise RotationError(
            f"Not done ({exc}). Nothing was changed; the old password is back in place."
            if database_changed
            else f"Not done ({exc}). Nothing was changed."
        ) from exc

    try:
        if admin_password is not None:
            write_admin_password(url, new_db_password, admin_email, admin_password)
        write_audit(url, new_db_password, changed)
    except Exception as exc:
        raise RotationError(
            f"The secrets in .env and the database were changed, but the last step failed "
            f"({type(exc).__name__}: {exc}). Restart the backend, then run again with "
            "--parts admin-password if the administrator password still needs changing."
        ) from exc
    return Result(old_env_copy=old_copy, changed=changed)


def rollback_rotation(
    env_file: Path, old_env: Path, *, url: URL, current_db_password: str
) -> list[str]:
    """Put the old .env back and the old database password with it."""
    old_text = read_text_exact(old_env)
    old_password = env_get(old_text, "POSTGRES_PASSWORD")
    if not old_password:
        raise RotationError(
            "The old .env file has no POSTGRES_PASSWORD; it is not a saved copy."
        )
    steps: list[str] = []
    current_mfa_key = env_get(read_text_exact(env_file), "MFA_ENCRYPTION_KEY") or ""
    old_mfa_key = env_get(old_text, "MFA_ENCRYPTION_KEY") or ""
    mfa_transaction: psycopg.Connection | None = None
    if old_password != current_db_password:
        if not can_connect(url, current_db_password):
            raise RotationError(
                "The database does not accept the password the backend is using now; "
                "nothing was changed."
            )
        set_role_password(url, current_db_password, old_password)
        steps.append("database password set back")
    if not can_connect(url, old_password):
        raise RotationError(
            "The database does not accept the old password after the change."
        )
    if current_mfa_key != old_mfa_key:
        stored = read_mfa_secrets(url, old_password)
        if stored and not old_mfa_key:
            raise RotationError(
                f"The old .env has no MFA_ENCRYPTION_KEY but {len(stored)} "
                "authenticator secret(s) exist. Turn their two-factor off first "
                "(account_recovery_cli reset-mfa), then roll back."
            )
        if stored:
            mfa_transaction = begin_mfa_reencrypt(
                url, old_password, current_mfa_key, old_mfa_key
            )
    try:
        _replace_env(env_file, old_text)
        if mfa_transaction is not None:
            mfa_transaction.commit()
            steps.append("authenticator secrets put back under the old key")
    except Exception:
        if mfa_transaction is not None:
            mfa_transaction.rollback()
        raise
    steps.append(".env restored")
    return steps


# --------------------------------------------------------------------------
# Command line
# --------------------------------------------------------------------------


def parse_parts(value: str) -> tuple[str, ...]:
    chosen = tuple(
        dict.fromkeys(item.strip() for item in value.split(",") if item.strip())
    )
    allowed = PARTS + OPTIONAL_PARTS
    unknown = [item for item in chosen if item not in allowed]
    if unknown or not chosen:
        raise argparse.ArgumentTypeError(f"--parts takes some of: {', '.join(allowed)}")
    return chosen


def prompt_admin_password() -> str:
    first = getpass.getpass("New administrator password (not shown): ")
    if getpass.getpass("Type it again: ") != first:
        raise RotationError("Not done: the two passwords are not the same.")
    return first


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="rotate_secrets_cli", description=__doc__.split("\n")[0]
    )
    parser.add_argument(
        "command", nargs="?", default="plan", choices=("plan", "apply", "rollback")
    )
    parser.add_argument("--env-file", default="/work/.env")
    parser.add_argument("--parts", type=parse_parts, default=PARTS)
    parser.add_argument("--confirm", default="")
    parser.add_argument("--old-env", default="")
    parser.add_argument(
        "--backup-dir", default=os.environ.get("BACKUP_DIR", "/backups")
    )
    parser.add_argument(
        "--max-backup-age-minutes", type=int, default=DEFAULT_MAX_BACKUP_AGE_MINUTES
    )
    args = parser.parse_args(argv)

    env_file = Path(args.env_file)
    if not env_file.is_file():
        say(
            f'{env_file} was not found. Run with -v "${{PWD}}:/work" from the repository '
            "folder, or pass --env-file.",
            error=True,
        )
        return 2
    backups = Path(args.backup_dir)
    need_encrypted = (backups / "backup-public.pem").exists()
    text = read_text_exact(env_file)
    try:
        url = database_url_from_env_text(text, os.environ.get("DATABASE_URL"))
        current_password = url.password or ""
        if args.command == "plan":
            plan = build_plan(
                text,
                args.parts,
                backups=backups,
                max_backup_age_minutes=args.max_backup_age_minutes,
                current_db_password=current_password,
                need_encrypted=need_encrypted,
            )
            say("DRY RUN. Nothing is changed. 'apply' would do this:")
            for line in plan.lines:
                say(f"  - {line}")
            if plan.problems:
                say("It would NOT start yet:", error=True)
                for problem in plan.problems:
                    say(f"  ! {problem}", error=True)
                return 1
            if not can_connect(url, current_password):
                say(
                    "  ! The database does not accept the current password.", error=True
                )
                return 1
            say("Checks passed. Run 'apply --confirm ROTATE' when you are ready.")
            return 0
        if args.command == "apply":
            if args.confirm != "ROTATE":
                say("Not done: add --confirm ROTATE (read 'plan' first).", error=True)
                return 2
            result = apply_rotation(
                env_file,
                args.parts,
                url=url,
                current_db_password=current_password,
                backups=backups,
                max_backup_age_minutes=args.max_backup_age_minutes,
                need_encrypted=need_encrypted,
                ask_admin_password=prompt_admin_password,
            )
            say("Done. Changed: " + ", ".join(result.changed) + ".")
            say(f"The old .env is saved as {result.old_env_copy.name}. Move it to your")
            say("USB drive (it holds the OLD secrets) and delete it from this computer")
            say("once you have checked the system works.")
            say("NEXT: docker compose -f compose.yml up -d --force-recreate")
            say("Then sign in again and make a new encrypted backup.")
            return 0
        if args.confirm != "ROLLBACK" or not args.old_env:
            say("Not done: give --old-env FILE and --confirm ROLLBACK.", error=True)
            return 2
        steps = rollback_rotation(
            env_file, Path(args.old_env), url=url, current_db_password=current_password
        )
        say("Done: " + ", ".join(steps) + ".")
        say("NEXT: docker compose -f compose.yml up -d --force-recreate")
        return 0
    except RotationError as exc:
        say(str(exc), error=True)
        return 1


if __name__ == "__main__":
    sys.exit(main())
