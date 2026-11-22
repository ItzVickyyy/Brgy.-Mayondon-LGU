# ruff: noqa: F811  (fixtures imported from other test modules are used as parameters)
"""Changing DATA_ENCRYPTION_KEY with the rotation tool (patch 215).

Every stored health condition is re-encrypted in one transaction that is saved only after
``.env`` is replaced; a wrong or missing key stops the tool before anything changes.
"""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, text

from app import rotate_secrets_cli as r
from app.core import field_crypto as fc
from app.core.config import settings
from tests.api.routes.test_issuances import (  # noqa: F401  (fixtures are reused)
    _resident,
    _tidy_up,
    official_id,
    street_id,
)
from tests.api.routes.test_issuances_certificates import SECRET, _marginalized
from tests.test_rotate_secrets import (  # noqa: F401  (fixtures are reused)
    OLD_SECRET_KEY,
    SCRATCH_PASSWORD,
    env_text,
    folder,
    run_apply,
    scratch,
    scratch_url,
)

OLD_KEY = "old-data-encryption-key-0123456789-0123456789-abc"
WRONG_KEY = "some-other-data-key-that-is-not-the-one-used-0123456789"


def _env_with_data_key(folder: Path, key: str | None) -> None:
    body = env_text(SCRATCH_PASSWORD)
    if key:
        body += f"DATA_ENCRYPTION_KEY={key}\r\n"
    (folder / ".env").write_text(body, encoding="utf-8", newline="")


def _forget_other_conditions(db: Session) -> None:
    """Earlier tests leave health conditions saved under other keys; the tool (rightly)
    looks at every stored one, so start from none."""
    db.connection().execute(
        text("UPDATE issuance_assistance SET health_condition = NULL")
    )
    db.commit()


def _stored(db: Session, issuance_id: str) -> str:
    db.rollback()
    value = (
        db.connection()
        .execute(
            text(
                "SELECT health_condition FROM issuance_assistance WHERE issuance_id = :i"
            ),
            {"i": issuance_id},
        )
        .scalar()
    )
    assert value
    return value


@pytest.fixture
def condition(
    client: TestClient,
    staff_token_headers: dict[str, str],
    street_id: int,
    db: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    """Makes one saved health condition; the test chooses the key it was saved under."""
    _forget_other_conditions(db)

    def make(key: str) -> str:
        monkeypatch.setattr(settings, "DATA_ENCRYPTION_KEY", key)
        res = _resident(client, staff_token_headers, street_id)
        return _marginalized(client, staff_token_headers, res["id"])["id"]

    return make


def test_data_key_is_chosen_by_name_only() -> None:
    assert "data-key" not in r.PARTS
    assert r.parse_parts("data-key") == ("data-key",)


@pytest.mark.usefixtures("scratch")
def test_plan_for_the_data_key_names_it_without_a_value(folder: Path) -> None:
    plan = r.build_plan(
        env_text("pw"),
        ("data-key",),
        backups=folder / "backups",
        max_backup_age_minutes=120,
        current_db_password="pw",
        need_encrypted=False,
    )
    assert plan.ok
    assert any("DATA_ENCRYPTION_KEY" in line and "USB" in line for line in plan.lines)


@pytest.mark.usefixtures("scratch")
def test_rotation_re_encrypts_every_condition_and_rollback_puts_it_back(
    folder: Path, db: Session, condition
) -> None:
    issuance_id = condition(OLD_KEY)
    before = _stored(db, issuance_id)
    assert fc.decrypt_text(before, key=OLD_KEY) == SECRET
    _env_with_data_key(folder, OLD_KEY)

    result = run_apply(folder, ("data-key",))

    new_text = r.read_text_exact(folder / ".env")
    new_key = r.env_get(new_text, "DATA_ENCRYPTION_KEY")
    assert new_key and new_key != OLD_KEY and len(new_key.encode()) >= 32
    assert r.env_get(new_text, "SECRET_KEY") == OLD_SECRET_KEY  # only the one part
    assert result.changed == ["DATA_ENCRYPTION_KEY"]
    stored = _stored(db, issuance_id)
    assert fc.decrypt_text(stored, key=new_key) == SECRET
    assert fc.decrypt_text(stored, key=OLD_KEY) is None
    assert SECRET not in stored

    steps = r.rollback_rotation(
        folder / ".env",
        result.old_env_copy,
        url=scratch_url(),
        current_db_password=SCRATCH_PASSWORD,
    )
    assert "health conditions put back under the old key" in steps
    assert (
        r.env_get(r.read_text_exact(folder / ".env"), "DATA_ENCRYPTION_KEY") == OLD_KEY
    )
    assert fc.decrypt_text(_stored(db, issuance_id), key=OLD_KEY) == SECRET


@pytest.mark.usefixtures("scratch")
def test_plain_text_conditions_are_encrypted_and_rollback_makes_them_plain_again(
    folder: Path, db: Session, condition
) -> None:
    issuance_id = condition("")  # saved while no key existed: plain text
    assert _stored(db, issuance_id) == SECRET
    _env_with_data_key(folder, None)

    result = run_apply(folder, ("data-key",))

    new_key = r.env_get(r.read_text_exact(folder / ".env"), "DATA_ENCRYPTION_KEY")
    assert new_key
    assert fc.decrypt_text(_stored(db, issuance_id), key=new_key) == SECRET

    r.rollback_rotation(
        folder / ".env",
        result.old_env_copy,
        url=scratch_url(),
        current_db_password=SCRATCH_PASSWORD,
    )
    assert _stored(db, issuance_id) == SECRET  # as before: no key, plain text


@pytest.mark.usefixtures("scratch")
def test_a_key_is_made_when_nothing_is_stored(folder: Path, db: Session) -> None:
    _forget_other_conditions(db)
    _env_with_data_key(folder, None)
    run_apply(folder, ("data-key",))
    key = r.env_get(r.read_text_exact(folder / ".env"), "DATA_ENCRYPTION_KEY")
    assert key and len(key.encode()) >= 32


@pytest.mark.usefixtures("scratch")
def test_refuses_when_a_condition_cannot_be_read_and_changes_nothing(
    folder: Path, db: Session, condition
) -> None:
    issuance_id = condition(OLD_KEY)
    before = _stored(db, issuance_id)
    _env_with_data_key(folder, WRONG_KEY)
    with pytest.raises(r.RotationError, match="cannot be read"):
        run_apply(folder, ("data-key",))
    assert _stored(db, issuance_id) == before
    assert not list(folder.glob(".env.before-rotation-*"))

    _env_with_data_key(folder, None)  # encrypted rows but no key in .env
    with pytest.raises(r.RotationError, match="there is none"):
        run_apply(folder, ("data-key",))
    assert _stored(db, issuance_id) == before


@pytest.mark.usefixtures("scratch")
def test_failure_while_replacing_env_leaves_the_conditions_untouched(
    folder: Path, db: Session, condition, monkeypatch: pytest.MonkeyPatch
) -> None:
    issuance_id = condition(OLD_KEY)
    before = _stored(db, issuance_id)
    _env_with_data_key(folder, OLD_KEY)
    original = r.read_text_exact(folder / ".env")

    def broken(*_args: object) -> None:
        raise OSError("disk full")

    monkeypatch.setattr(r, "_replace_env", broken)
    with pytest.raises(r.RotationError, match="Not done"):
        run_apply(folder, ("data-key",))
    assert _stored(db, issuance_id) == before  # the transaction was never saved
    assert r.read_text_exact(folder / ".env") == original


@pytest.mark.usefixtures("scratch")
def test_the_command_line_reminds_to_copy_the_new_env(
    folder: Path,
    db: Session,
    capsys: pytest.CaptureFixture[str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _forget_other_conditions(db)
    _env_with_data_key(folder, None)
    monkeypatch.setenv(
        "DATABASE_URL",
        scratch_url()
        .set(password=SCRATCH_PASSWORD)
        .render_as_string(hide_password=False),
    )
    code = r.main(
        [
            "apply",
            "--confirm",
            "ROTATE",
            "--parts",
            "data-key",
            "--env-file",
            str(folder / ".env"),
            "--backup-dir",
            str(folder / "backups"),
        ]
    )
    out = capsys.readouterr()
    assert code == 0, out.err
    assert "copy the NEW .env to the USB drive" in out.out
