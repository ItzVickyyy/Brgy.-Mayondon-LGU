"""The secret-rotation tool: dry run first, one safe order, a way back.

Everything that touches a database uses a throw-away role (``rot_scratch``) in
the test database, never the account the test suite itself signs in with.
"""

import os
import time
from collections.abc import Generator
from datetime import UTC, datetime
from pathlib import Path

import psycopg
import pytest
from psycopg import sql
from sqlalchemy.engine import URL, make_url
from sqlmodel import Session, col, select

from app import rotate_secrets_cli as r
from app.core.config import settings
from app.core.security import verify_password
from app.models import User, UserRole
from app.models_foundation import AuditLog

SCRATCH_ROLE = "rot_scratch"
SCRATCH_PASSWORD = "scratch-old-password"
ADMIN_EMAIL = "rotation-admin@example.com"
OLD_SECRET_KEY = "old-secret-key-0123456789-0123456789-0123456789"
NEW_ADMIN_PASSWORD = "a-new-strong-admin-password"


def admin_url() -> URL:
    url = make_url(str(settings.DATABASE_URL).replace("+psycopg", ""))
    return url.set(drivername="postgresql")


def scratch_url() -> URL:
    return admin_url().set(username=SCRATCH_ROLE, password=None)


def env_text(db_password: str) -> str:
    return (
        "# comment kept\r\n"
        "PROJECT_NAME=Test\r\n"
        f"SECRET_KEY={OLD_SECRET_KEY}\r\n"
        f"POSTGRES_PASSWORD={db_password}\r\n"
        f"DATABASE_URL=postgresql://{SCRATCH_ROLE}:{db_password}@localhost:5432/app\r\n"
        f"FIRST_SUPERUSER={ADMIN_EMAIL}\r\n"
        "FIRST_SUPERUSER_PASSWORD=the-old-admin-password\r\n"
    )


@pytest.fixture
def scratch(db: Session) -> Generator[None]:
    """A superuser role of its own, so its password can change freely."""
    owner = admin_url()
    with psycopg.connect(
        host=owner.host,
        port=owner.port or 5432,
        dbname=owner.database,
        user=owner.username,
        password=owner.password,
        autocommit=True,
    ) as conn:
        conn.execute(
            sql.SQL("DROP ROLE IF EXISTS {}").format(sql.Identifier(SCRATCH_ROLE))
        )
        conn.execute(
            sql.SQL("CREATE ROLE {} LOGIN SUPERUSER PASSWORD {}").format(
                sql.Identifier(SCRATCH_ROLE), sql.Literal(SCRATCH_PASSWORD)
            )
        )
    admin = User(
        email=ADMIN_EMAIL,
        hashed_password="x",
        role=UserRole.admin,
        is_superuser=True,
        is_active=True,
        must_change_password=True,
    )
    db.add(admin)
    db.commit()
    yield
    db.rollback()
    leftover = db.exec(select(User).where(col(User.email) == ADMIN_EMAIL)).first()
    if leftover:
        db.delete(leftover)
        db.commit()
    with psycopg.connect(
        host=owner.host,
        port=owner.port or 5432,
        dbname=owner.database,
        user=owner.username,
        password=owner.password,
        autocommit=True,
    ) as conn:
        conn.execute(
            sql.SQL("DROP ROLE IF EXISTS {}").format(sql.Identifier(SCRATCH_ROLE))
        )


@pytest.fixture
def folder(tmp_path: Path) -> Path:
    backups = tmp_path / "backups"
    backups.mkdir()
    (backups / "mayondon-db-20261113-010101-001.dump").write_bytes(b"x")
    return tmp_path


def run_apply(folder: Path, parts: tuple[str, ...], **kwargs: object) -> r.Result:
    env_file = folder / ".env"
    if not env_file.exists():
        env_file.write_text(env_text(SCRATCH_PASSWORD), encoding="utf-8", newline="")
    return r.apply_rotation(
        env_file,
        parts,
        url=scratch_url(),
        current_db_password=SCRATCH_PASSWORD,
        backups=folder / "backups",
        max_backup_age_minutes=120,
        need_encrypted=False,
        ask_admin_password=lambda: NEW_ADMIN_PASSWORD,
        **kwargs,  # type: ignore[arg-type]
    )


# ---- .env text ------------------------------------------------------------


def test_env_get_and_set_keep_comments_and_line_endings() -> None:
    text = "# note\r\nA=1\r\nB='two'\r\n#C=3\r\n"
    assert r.env_get(text, "A") == "1"
    assert r.env_get(text, "B") == "two"
    assert r.env_get(text, "C") is None  # a commented-out line is not a value
    changed = r.env_set(text, "A", "9")
    assert changed == "# note\r\nA=9\r\nB='two'\r\n#C=3\r\n"
    appended = r.env_set("A=1", "Z", "5")
    assert appended == "A=1\nZ=5\n"
    assert r.env_set("A=1\r\n", "Z", "5") == "A=1\r\nZ=5\r\n"


def test_new_secrets_are_long_and_url_safe() -> None:
    assert len(r.new_secret_key().encode()) >= 32
    password = r.new_database_password()
    assert len(password) >= 32
    assert all(c.isalnum() or c in "-_" for c in password)
    assert r.new_database_password() != r.new_database_password()


# ---- plan -----------------------------------------------------------------


def test_plan_names_changes_but_never_values(folder: Path) -> None:
    text = env_text("some-db-password")
    plan = r.build_plan(
        text,
        r.PARTS,
        backups=folder / "backups",
        max_backup_age_minutes=120,
        current_db_password="some-db-password",
        need_encrypted=False,
    )
    assert plan.ok
    shown = "\n".join(plan.lines)
    for value in (OLD_SECRET_KEY, "some-db-password", "the-old-admin-password"):
        assert value not in shown
    assert "SECRET_KEY" in shown
    assert "not undone by rollback" in shown


def test_plan_refuses_without_a_recent_backup(folder: Path) -> None:
    text = env_text("pw")

    def plan(directory: Path, encrypted: bool = False) -> r.Plan:
        return r.build_plan(
            text,
            r.PARTS,
            backups=directory,
            max_backup_age_minutes=120,
            current_db_password="pw",
            need_encrypted=encrypted,
        )

    empty = folder / "none"
    empty.mkdir()
    assert "no backup" in plan(empty).problems[0].lower()

    assert "not encrypted" in plan(folder / "backups", True).problems[0]

    old = folder / "backups" / "mayondon-db-20200101-000000-000.dump"
    stale = folder / "stale"
    stale.mkdir()
    (stale / old.name).write_bytes(b"x")
    long_ago = time.time() - 5 * 3600
    os.utime(stale / old.name, (long_ago, long_ago))
    assert "minutes old" in plan(stale).problems[0]

    encrypted = folder / "enc"
    encrypted.mkdir()
    (encrypted / "mayondon-db-20261113-010101-001.dump.enc").write_bytes(b"x")
    assert plan(encrypted, True).ok


def test_plan_refuses_when_env_and_running_password_differ(folder: Path) -> None:
    plan = r.build_plan(
        env_text("in-env"),
        ("db-password",),
        backups=folder / "backups",
        max_backup_age_minutes=120,
        current_db_password="what-the-backend-uses",
        need_encrypted=False,
    )
    assert any("not the password the running backend uses" in p for p in plan.problems)


def test_plan_reports_missing_values(folder: Path) -> None:
    plan = r.build_plan(
        "PROJECT_NAME=x\n",
        r.PARTS,
        backups=folder / "backups",
        max_backup_age_minutes=120,
        current_db_password=None,
        need_encrypted=False,
    )
    keys = " ".join(plan.problems)
    for key in ("SECRET_KEY", "POSTGRES_PASSWORD", "FIRST_SUPERUSER"):
        assert key in keys


def test_admin_password_rules() -> None:
    assert r.valid_admin_password("short", None)
    assert r.valid_admin_password("ChangeThisPassword", None)
    assert r.valid_admin_password("replace-with-a-strong-password", None)
    assert r.valid_admin_password("same-as-old-password", "same-as-old-password")
    assert r.valid_admin_password("a-long-enough-password", "other") is None


# ---- apply and rollback against a scratch role -----------------------------


@pytest.mark.usefixtures("scratch")
def test_apply_changes_everything_and_keeps_a_way_back(
    folder: Path, db: Session
) -> None:
    result = run_apply(folder, r.PARTS, now=datetime(2026, 11, 13, 1, 2, 3, tzinfo=UTC))

    new_text = r.read_text_exact(folder / ".env")
    new_db_password = r.env_get(new_text, "POSTGRES_PASSWORD")
    assert new_db_password and new_db_password != SCRATCH_PASSWORD
    assert r.env_get(new_text, "SECRET_KEY") != OLD_SECRET_KEY
    assert r.env_get(new_text, "FIRST_SUPERUSER_PASSWORD") != "the-old-admin-password"
    assert new_db_password in (r.env_get(new_text, "DATABASE_URL") or "")
    assert SCRATCH_PASSWORD not in new_text
    assert "# comment kept\r\n" in new_text  # layout and line endings kept
    assert "\n" not in new_text.replace("\r\n", "")

    # The old file is kept untouched beside it.
    assert result.old_env_copy.name == ".env.before-rotation-20261113-010203"
    assert r.read_text_exact(result.old_env_copy) == env_text(SCRATCH_PASSWORD)
    assert oct(result.old_env_copy.stat().st_mode & 0o777) == "0o600"

    # The database moved with the file: new works, old does not.
    assert r.can_connect(scratch_url(), new_db_password)
    assert not r.can_connect(scratch_url(), SCRATCH_PASSWORD)

    # Administrator password set; the new one is typed, not stored in .env.
    db.expire_all()
    admin = db.exec(select(User).where(col(User.email) == ADMIN_EMAIL)).one()
    ok, _ = verify_password(NEW_ADMIN_PASSWORD, admin.hashed_password)
    assert ok
    assert admin.must_change_password is False
    assert NEW_ADMIN_PASSWORD not in new_text

    # Two audit rows, names only.
    rows = db.exec(
        select(AuditLog).where(
            col(AuditLog.action).in_([r.AUDIT_ACTION, "user.password_change"]),
            col(AuditLog.reason).like("%rotation tool%")
            | col(AuditLog.reason).like("Changed: %"),
        )
    ).all()
    reasons = [row.reason or "" for row in rows]
    assert any("Changed: SECRET_KEY, POSTGRES_PASSWORD" in x for x in reasons)
    joined = " ".join(str(row.details) + (row.reason or "") for row in rows)
    assert new_db_password not in joined

    # Rollback puts file and database password back.
    steps = r.rollback_rotation(
        folder / ".env",
        result.old_env_copy,
        url=scratch_url(),
        current_db_password=new_db_password,
    )
    assert steps == ["database password set back", ".env restored"]
    assert r.read_text_exact(folder / ".env") == env_text(SCRATCH_PASSWORD)
    assert r.can_connect(scratch_url(), SCRATCH_PASSWORD)
    assert not r.can_connect(scratch_url(), new_db_password)


@pytest.mark.usefixtures("scratch")
def test_failure_after_the_database_change_puts_the_old_password_back(
    folder: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    original = env_text(SCRATCH_PASSWORD)
    (folder / ".env").write_text(original, encoding="utf-8", newline="")

    def broken(_path: Path, _text: str) -> None:
        raise OSError("disk full")

    monkeypatch.setattr(r, "_replace_env", broken)
    with pytest.raises(r.RotationError, match="old password is back in place"):
        run_apply(folder, ("db-password",))

    assert r.read_text_exact(folder / ".env") == original
    assert r.can_connect(scratch_url(), SCRATCH_PASSWORD)


@pytest.mark.usefixtures("scratch")
def test_nothing_changes_when_a_check_fails(folder: Path) -> None:
    original = env_text(SCRATCH_PASSWORD)
    (folder / ".env").write_text(original, encoding="utf-8", newline="")
    for old in (folder / "backups").iterdir():
        old.unlink()
    with pytest.raises(r.RotationError, match="no backup"):
        run_apply(folder, r.PARTS)
    assert r.read_text_exact(folder / ".env") == original
    assert r.can_connect(scratch_url(), SCRATCH_PASSWORD)
    assert [p.name for p in folder.iterdir() if "before-rotation" in p.name] == []


@pytest.mark.usefixtures("scratch")
def test_weak_admin_password_stops_before_any_change(folder: Path) -> None:
    original = env_text(SCRATCH_PASSWORD)
    (folder / ".env").write_text(original, encoding="utf-8", newline="")
    with pytest.raises(r.RotationError, match="at least 12"):
        r.apply_rotation(
            folder / ".env",
            r.PARTS,
            url=scratch_url(),
            current_db_password=SCRATCH_PASSWORD,
            backups=folder / "backups",
            max_backup_age_minutes=120,
            need_encrypted=False,
            ask_admin_password=lambda: "short",
        )
    assert r.read_text_exact(folder / ".env") == original
    assert r.can_connect(scratch_url(), SCRATCH_PASSWORD)


@pytest.mark.usefixtures("scratch")
def test_secret_key_alone_does_not_touch_the_database(folder: Path) -> None:
    result = run_apply(folder, ("secret-key",))
    assert result.changed == ["SECRET_KEY"]
    text = r.read_text_exact(folder / ".env")
    assert r.env_get(text, "SECRET_KEY") != OLD_SECRET_KEY
    assert r.env_get(text, "POSTGRES_PASSWORD") == SCRATCH_PASSWORD
    assert r.can_connect(scratch_url(), SCRATCH_PASSWORD)


# ---- command line ----------------------------------------------------------


@pytest.mark.usefixtures("scratch")
def test_cli_plan_is_a_dry_run_and_prints_no_secret(
    folder: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    original = env_text(SCRATCH_PASSWORD)
    (folder / ".env").write_text(original, encoding="utf-8", newline="")
    url = (
        scratch_url()
        .set(password=SCRATCH_PASSWORD)
        .render_as_string(hide_password=False)
    )
    monkeypatch.setenv("DATABASE_URL", url)
    code = r.main(
        [
            "plan",
            "--env-file",
            str(folder / ".env"),
            "--backup-dir",
            str(folder / "backups"),
        ]
    )
    out = capsys.readouterr()
    assert code == 0
    assert "DRY RUN" in out.out
    for value in (OLD_SECRET_KEY, SCRATCH_PASSWORD, "the-old-admin-password"):
        assert value not in out.out + out.err
    assert r.read_text_exact(folder / ".env") == original


def test_cli_apply_and_rollback_need_the_typed_word(
    folder: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    (folder / ".env").write_text(env_text("pw"), encoding="utf-8", newline="")
    args = ["--env-file", str(folder / ".env"), "--backup-dir", str(folder / "backups")]
    assert r.main(["apply", *args]) == 2
    assert r.main(["apply", "--confirm", "yes", *args]) == 2
    assert r.main(["rollback", "--confirm", "ROLLBACK", *args]) == 2  # no --old-env
    assert "--confirm ROTATE" in capsys.readouterr().err
    assert r.read_text_exact(folder / ".env") == env_text("pw")


def test_cli_rejects_unknown_parts() -> None:
    with pytest.raises(SystemExit):
        r.main(["plan", "--parts", "everything"])
