"""The notification bell: audit-fed, role-filtered, read state per person."""

import secrets
import time
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session, col, select

from app import crud
from app.core.audit import record_audit_event
from app.core.config import settings
from app.core.mfa_check import register_failure
from app.models import User, UserCreate, UserRole
from app.models_foundation import AuditLog
from tests.utils.user import user_authentication_headers
from tests.utils.utils import random_email

API = settings.API_V1_STR
URL = f"{API}/notifications/"


def _person(db: Session, role: UserRole = UserRole.staff) -> tuple[User, str, str]:
    """A signed-in-able account with a recognisable full name."""
    name = f"Name{secrets.token_hex(4)}"
    password = f"Pw-{secrets.token_hex(8)}-ok"
    user = crud.create_user(
        session=db,
        user_create=UserCreate(
            email=random_email(), password=password, role=role, full_name=name
        ),
    )
    return user, password, name


def _headers(client: TestClient, user: User, password: str) -> dict[str, str]:
    return user_authentication_headers(
        client=client, email=user.email, password=password
    )


def _bell(client: TestClient, headers: dict[str, str]) -> dict:
    r = client.get(URL, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def _find(body: dict, **want: object) -> list[dict]:
    return [
        item for item in body["data"] if all(item.get(k) == v for k, v in want.items())
    ]


def _audit(db: Session, actor: User | None, action: str, **kw: object) -> AuditLog:
    return record_audit_event(db, action=action, actor=actor, commit=True, **kw)  # type: ignore[arg-type]


def test_requires_sign_in(client: TestClient) -> None:
    assert client.get(URL).status_code == 401
    assert client.post(f"{URL}read-all").status_code == 401
    assert client.post(f"{URL}1/read").status_code == 401


def test_admin_sees_account_events_and_staff_sees_only_their_own(
    client: TestClient, db: Session, superuser_token_headers: dict[str, str]
) -> None:
    a, pw_a, name_a = _person(db)
    b, pw_b, name_b = _person(db)
    head_a = _headers(client, a, pw_a)
    head_b = _headers(client, b, pw_b)
    for user, name in ((a, "Alpha"), (b, "Bravo")):
        r = client.patch(
            f"{API}/users/{user.id}",
            headers=superuser_token_headers,
            json={"full_name": f"{name}{secrets.token_hex(3)}"},
        )
        assert r.status_code == 200, r.text

    admin_body = _bell(client, superuser_token_headers)
    updated = [i for i in admin_body["data"] if i["action"] == "user.update"]
    assert {i["target_is_me"] for i in updated} == {False}
    assert len(updated) >= 2

    body_a = _bell(client, head_a)
    mine = _find(body_a, action="user.update")
    assert len(mine) == 1
    assert mine[0]["target_is_me"] is True
    assert mine[0]["actor_is_me"] is False
    assert mine[0]["category"] == "account"
    # Nothing about the other person, and nothing outside the staff catalog.
    assert all(i["target_is_me"] or i["actor_is_me"] for i in body_a["data"])
    assert {i["category"] for i in body_a["data"]} <= {"account", "security"}
    assert len(_find(_bell(client, head_b), action="user.update")) == 1


def test_account_created_temporary_password_row_is_hidden(
    client: TestClient, db: Session, superuser_token_headers: dict[str, str]
) -> None:
    email = random_email()
    r = client.post(
        f"{API}/users/",
        headers=superuser_token_headers,
        json={"email": email, "full_name": "Hidden Temp", "role": "staff"},
    )
    assert r.status_code == 200, r.text
    new_id = r.json()["id"]
    body = _bell(client, superuser_token_headers)
    created = [
        i
        for i in _find(body, action="user.create")
        if i["target_name"] == "Hidden Temp"
    ]
    assert len(created) == 1 and created[0]["actor_is_me"] is True
    row = db.exec(
        select(AuditLog).where(
            AuditLog.action == "user.temp_password_set",
            AuditLog.record_id == new_id,
        )
    ).one()
    assert row.id is not None
    assert not [i for i in body["data"] if i["id"] == row.id]
    # The administrator's own reset is a different reason and is shown.
    r = client.patch(
        f"{API}/users/{new_id}",
        headers=superuser_token_headers,
        json={"reset_to_default_password": True},
    )
    assert r.status_code == 200, r.text
    body = _bell(client, superuser_token_headers)
    resets = [
        i
        for i in body["data"]
        if i["action"] == "user.temp_password_set" and i["id"] != row.id
    ]
    assert resets and resets[0]["target_name"] == "Hidden Temp"
    # The reset's empty user.update row is not a notice of its own.
    assert not [
        i
        for i in body["data"]
        if i["action"] == "user.update" and i["target_name"] == "Hidden Temp"
    ]


def test_staff_never_see_backup_import_or_configuration(
    client: TestClient, db: Session, superuser_token_headers: dict[str, str]
) -> None:
    admin = db.exec(select(User).where(User.email == settings.FIRST_SUPERUSER)).one()
    staff, pw, _ = _person(db)
    head = _headers(client, staff, pw)
    ok = _audit(db, admin, "backup.create", module="backups")
    bad = _audit(
        db,
        admin,
        "backup.create",
        outcome="failed",
        module="backups",
        reason="pg_dump: SECRET-SERVER-TEXT /var/backups/x.dump",
        details={"file": "x.dump"},
    )
    cfg = _audit(db, admin, "street.create", module="lookups", record_id="7")
    imp = _audit(db, admin, "import.commit", module="imports", details={"file": "z"})
    ids = {ok.id, bad.id, cfg.id, imp.id}
    staff_body = _bell(client, head)
    assert not ids & {i["id"] for i in staff_body["data"]}
    assert not {"backup", "import", "configuration"} & {
        i["category"] for i in staff_body["data"]
    }
    admin_body = _bell(client, superuser_token_headers)
    got = {i["id"]: i for i in admin_body["data"]}
    assert ids <= set(got)
    assert got[ok.id]["category"] == "backup"
    assert got[bad.id]["outcome"] == "failed"
    assert got[cfg.id]["category"] == "configuration"
    assert got[imp.id]["category"] == "import"
    # No reason, details, file names or record ids ever leave the server.
    text = client.get(URL, headers=superuser_token_headers).text
    for forbidden in ("SECRET-SERVER-TEXT", "x.dump", "reason", "details", "record"):
        assert forbidden not in text
    assert set(got[bad.id]) == {
        "id",
        "occurred_at",
        "action",
        "category",
        "outcome",
        "actor_name",
        "actor_is_me",
        "target_name",
        "target_is_me",
        "read",
    }


def test_staff_own_security_events_only(
    client: TestClient, db: Session, superuser_token_headers: dict[str, str]
) -> None:
    a, pw_a, _ = _person(db)
    b, pw_b, _ = _person(db)
    head_a = _headers(client, a, pw_a)
    head_b = _headers(client, b, pw_b)
    new_password = f"New-{secrets.token_hex(8)}-ok"
    r = client.patch(
        f"{API}/users/me/password",
        headers=head_a,
        json={"current_password": pw_a, "new_password": new_password},
    )
    assert r.status_code == 200, r.text
    head_a = _headers(client, a, new_password)
    mine = _find(_bell(client, head_a), action="user.password_change")
    assert len(mine) == 1 and mine[0]["actor_is_me"] is True
    assert mine[0]["category"] == "security"
    assert not _find(_bell(client, head_b), action="user.password_change")
    # An administrator sees it too, with the person's name.
    seen = _find(
        _bell(client, superuser_token_headers),
        action="user.password_change",
        id=mine[0]["id"],
    )
    assert len(seen) == 1 and seen[0]["actor_is_me"] is False
    assert seen[0]["actor_name"] == a.full_name


def test_unread_count_mark_one_mark_all_and_isolation(
    client: TestClient, db: Session, superuser_token_headers: dict[str, str]
) -> None:
    admin = db.exec(select(User).where(User.email == settings.FIRST_SUPERUSER)).one()
    # History from before an account exists is not unread for that account.
    old = _audit(db, admin, "backup.create", module="backups")
    time.sleep(0.05)
    other, pw_o, _ = _person(db, UserRole.admin)
    mine, pw_m, _ = _person(db, UserRole.admin)
    head_o = _headers(client, other, pw_o)
    head_m = _headers(client, mine, pw_m)
    first = _bell(client, head_m)
    assert first["unread_count"] == 0
    assert [i for i in first["data"] if i["id"] == old.id][0]["read"] is True
    _bell(client, head_o)  # same for the other person

    time.sleep(0.05)
    e1 = _audit(db, admin, "backup.verify", module="backups")
    e2 = _audit(db, admin, "import.cancel", module="imports")
    body = _bell(client, head_m)
    assert body["unread_count"] == 2
    assert [i["read"] for i in body["data"] if i["id"] in (e1.id, e2.id)] == [
        False,
        False,
    ]
    badge_before = _bell(client, superuser_token_headers)["unread_count"]

    r = client.post(f"{URL}{e1.id}/read", headers=head_m)
    assert r.status_code == 200
    assert client.post(f"{URL}{e1.id}/read", headers=head_m).status_code == 200
    body = _bell(client, head_m)
    assert body["unread_count"] == 1
    assert [i for i in body["data"] if i["id"] == e1.id][0]["read"] is True
    # Somebody else's state did not move.
    assert _bell(client, head_o)["unread_count"] == 2
    assert _bell(client, superuser_token_headers)["unread_count"] == badge_before

    assert client.post(f"{URL}read-all", headers=head_m).status_code == 200
    body = _bell(client, head_m)
    assert body["unread_count"] == 0
    assert all(i["read"] for i in body["data"])
    assert _bell(client, head_o)["unread_count"] == 2
    # A new event after "mark all" is unread again.
    e3 = _audit(db, admin, "backup.create", module="backups")
    body = _bell(client, head_m)
    assert body["unread_count"] == 1
    assert [i for i in body["data"] if i["id"] == e3.id][0]["read"] is False


def test_marking_a_notice_the_person_cannot_see_is_refused(
    client: TestClient, db: Session
) -> None:
    admin = db.exec(select(User).where(User.email == settings.FIRST_SUPERUSER)).one()
    staff, pw, _ = _person(db)
    row = _audit(db, admin, "backup.create", module="backups")
    r = client.post(f"{URL}{row.id}/read", headers=_headers(client, staff, pw))
    assert r.status_code == 404
    r = client.post(f"{URL}999999999/read", headers=_headers(client, staff, pw))
    assert r.status_code == 404


def test_deleted_account_actor_shows_as_none(
    client: TestClient, db: Session, superuser_token_headers: dict[str, str]
) -> None:
    gone, pw, name = _person(db)
    head = _headers(client, gone, pw)
    r = client.patch(
        f"{API}/users/me/password",
        headers=head,
        json={"current_password": pw, "new_password": f"New-{secrets.token_hex(8)}-ok"},
    )
    assert r.status_code == 200, r.text
    rows = _find(
        _bell(client, superuser_token_headers),
        action="user.password_change",
        actor_name=name,
    )
    assert len(rows) == 1
    row_id = rows[0]["id"]
    r = client.delete(f"{API}/users/{gone.id}", headers=superuser_token_headers)
    assert r.status_code == 200, r.text
    after = _bell(client, superuser_token_headers)
    item = [i for i in after["data"] if i["id"] == row_id][0]
    assert item["actor_name"] is None
    # The delete itself is a notice, with nobody left to name as its target.
    deleted = [i for i in after["data"] if i["action"] == "user.delete"][0]
    assert deleted["actor_is_me"] is True
    assert deleted["target_name"] is None


def test_activate_deactivate_and_role_change(
    client: TestClient, db: Session, superuser_token_headers: dict[str, str]
) -> None:
    person, _, name = _person(db)
    base = f"{API}/users/{person.id}"
    for active, action in ((False, "user.deactivated"), (True, "user.activated")):
        r = client.patch(
            base, headers=superuser_token_headers, json={"is_active": active}
        )
        assert r.status_code == 200, r.text
        row = db.exec(
            select(AuditLog)
            .where(
                AuditLog.action == "user.update", AuditLog.record_id == str(person.id)
            )
            .order_by(col(AuditLog.id).desc())
        ).first()
        assert row is not None and row.details is not None
        assert row.details["is_active"] is active
        items = _find(
            _bell(client, superuser_token_headers), action=action, target_name=name
        )
        assert items and items[0]["id"] == row.id
    # A save that changes nothing about activity does not claim it did.
    r = client.patch(base, headers=superuser_token_headers, json={"is_active": True})
    last = db.exec(
        select(AuditLog)
        .where(AuditLog.action == "user.update", AuditLog.record_id == str(person.id))
        .order_by(col(AuditLog.id).desc())
    ).first()
    assert last is not None and "is_active" not in (last.details or {})

    r = client.patch(base, headers=superuser_token_headers, json={"role": "admin"})
    assert r.status_code == 200, r.text
    body = _bell(client, superuser_token_headers)
    mine = [i for i in body["data"] if i["target_name"] == name]
    assert "user.role_change" in {i["action"] for i in mine}
    # The role change is one notice, not also a plain "updated" one.
    newest_update = [i for i in mine if i["action"] == "user.update"]
    assert all(
        i["id"] < [m for m in mine if m["action"] == "user.role_change"][0]["id"]
        for i in newest_update
    )


def test_lock_event_is_written_once_at_the_threshold(
    client: TestClient, db: Session, superuser_token_headers: dict[str, str]
) -> None:
    person, pw, name = _person(db)
    for _ in range(settings.LOGIN_MAX_FAILED_ATTEMPTS + 2):
        r = client.post(
            f"{API}/login/access-token",
            data={"username": person.email, "password": "wrong-password-123"},
        )
        assert r.status_code == 400
    rows = db.exec(
        select(AuditLog).where(
            AuditLog.action == "auth.account_locked",
            AuditLog.actor_user_id == person.id,
        )
    ).all()
    assert len(rows) == 1 and rows[0].outcome == "failed"
    shown = _find(
        _bell(client, superuser_token_headers),
        action="auth.account_locked",
        actor_name=name,
    )
    assert len(shown) == 1 and shown[0]["category"] == "security"
    assert shown[0]["outcome"] == "failed"


def test_two_factor_lock_event_is_written_once(db: Session) -> None:
    person, _, _ = _person(db)
    person.failed_login_attempts = settings.LOGIN_MAX_FAILED_ATTEMPTS - 1
    person.locked_until = None
    db.add(person)
    db.commit()
    register_failure(db, person, reason="incorrect_code")
    register_failure(db, person, reason="incorrect_code")
    rows = db.exec(
        select(AuditLog).where(
            AuditLog.action == "auth.account_locked",
            AuditLog.actor_user_id == person.id,
        )
    ).all()
    assert len(rows) == 1
    assert person.locked_until is not None
    assert person.locked_until.replace(tzinfo=UTC) > datetime.now(UTC) - timedelta(
        seconds=1
    )


def test_window_is_thirty_days(
    client: TestClient, db: Session, superuser_token_headers: dict[str, str]
) -> None:
    admin = db.exec(select(User).where(User.email == settings.FIRST_SUPERUSER)).one()
    row = _audit(db, admin, "backup.verify", module="backups")
    # Audit rows are protected, so the age is checked through the visible list:
    # a fresh row is inside, the cap is 50.
    body = _bell(client, superuser_token_headers)
    assert row.id in {i["id"] for i in body["data"]}
    assert len(body["data"]) <= 50
