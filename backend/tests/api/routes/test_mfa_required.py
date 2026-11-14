"""An administrator asks a staff person to use two-factor (patch 77)."""

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, col, select

from app.core.config import settings
from app.models import User, UserRole
from app.models_foundation import AuditLog
from tests.api.routes.test_mfa import TEST_KEY, _code, _enrol, _password_step
from tests.utils.user import create_user_with_role, user_authentication_headers

API = settings.API_V1_STR


@pytest.fixture(autouse=True)
def _mfa_key(monkeypatch: pytest.MonkeyPatch) -> Generator[None]:
    monkeypatch.setattr(settings, "MFA_ENCRYPTION_KEY", TEST_KEY)
    yield


def _ask(client: TestClient, admin: dict[str, str], user: User, required: bool):
    return client.put(
        f"{API}/users/{user.id}/mfa-required",
        headers=admin,
        json={"required": required},
    )


def _rows(db: Session, user: User, action: str) -> list[AuditLog]:
    db.expire_all()
    return list(
        db.exec(
            select(AuditLog).where(
                col(AuditLog.action) == action,
                col(AuditLog.record_id) == str(user.id),
            )
        ).all()
    )


def test_ask_and_stop_asking_write_one_audit_row_each(
    client: TestClient, db: Session, superuser_token_headers: dict[str, str]
) -> None:
    user, password = create_user_with_role(db, UserRole.staff)
    headers = user_authentication_headers(
        client=client, email=user.email, password=password
    )
    assert (
        client.get(f"{API}/users/me/mfa", headers=headers).json()["required"] is False
    )

    r = _ask(client, superuser_token_headers, user, True)
    assert r.status_code == 200 and r.json() == {"enabled": False, "required": True}
    assert _ask(client, superuser_token_headers, user, True).status_code == 200
    assert len(_rows(db, user, "auth.mfa_required_set")) == 1
    assert client.get(f"{API}/users/me/mfa", headers=headers).json()["required"] is True
    got = client.get(f"{API}/users/{user.id}/mfa", headers=superuser_token_headers)
    assert got.json() == {"enabled": False, "required": True}

    assert _ask(client, superuser_token_headers, user, False).status_code == 200
    assert _ask(client, superuser_token_headers, user, False).status_code == 200
    assert len(_rows(db, user, "auth.mfa_required_cleared")) == 1


def test_being_asked_never_blocks_a_sign_in(
    client: TestClient, db: Session, superuser_token_headers: dict[str, str]
) -> None:
    user, password = create_user_with_role(db, UserRole.staff)
    assert _ask(client, superuser_token_headers, user, True).status_code == 200
    r = _password_step(client, user, password)
    assert r.status_code == 200 and r.json().get("access_token")


def test_a_person_who_is_asked_cannot_turn_it_off_and_a_reset_keeps_the_ask(
    client: TestClient, db: Session, superuser_token_headers: dict[str, str]
) -> None:
    user, password, headers, secret, _codes = _enrol(client, db)
    assert _ask(client, superuser_token_headers, user, True).status_code == 200
    r = client.post(
        f"{API}/users/me/mfa/disable",
        headers=headers,
        json={"current_password": password, "code": _code(secret, 1)},
    )
    assert r.status_code == 409 and "administrator" in r.json()["detail"]

    r = client.delete(f"{API}/users/{user.id}/mfa", headers=superuser_token_headers)
    assert r.status_code == 200
    got = client.get(f"{API}/users/{user.id}/mfa", headers=superuser_token_headers)
    assert got.json() == {"enabled": False, "required": True}

    # Stopping the ask lets the person turn it off again later.
    assert _ask(client, superuser_token_headers, user, False).status_code == 200


def test_rules_for_who_can_be_asked(
    client: TestClient, db: Session, superuser_token_headers: dict[str, str]
) -> None:
    staff, staff_pw = create_user_with_role(db, UserRole.staff)
    other, _ = create_user_with_role(db, UserRole.staff)
    admin2, _ = create_user_with_role(db, UserRole.admin)
    staff_headers = user_authentication_headers(
        client=client, email=staff.email, password=staff_pw
    )
    assert _ask(client, staff_headers, other, True).status_code == 403
    assert _ask(client, superuser_token_headers, admin2, True).status_code == 400
    me = db.exec(select(User).where(User.email == settings.FIRST_SUPERUSER)).one()
    assert _ask(client, superuser_token_headers, me, True).status_code == 400
    missing = client.put(
        f"{API}/users/00000000-0000-0000-0000-000000000000/mfa-required",
        headers=superuser_token_headers,
        json={"required": True},
    )
    assert missing.status_code == 404


def test_cannot_ask_while_the_server_has_no_key(
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user, _ = create_user_with_role(db, UserRole.staff)
    monkeypatch.setattr(settings, "MFA_ENCRYPTION_KEY", "")
    assert _ask(client, superuser_token_headers, user, True).status_code == 409


def test_the_ask_shows_in_the_bell_for_the_person_and_the_admin_only(
    client: TestClient, db: Session, superuser_token_headers: dict[str, str]
) -> None:
    user, password = create_user_with_role(db, UserRole.staff)
    other, other_password = create_user_with_role(db, UserRole.staff)
    headers = user_authentication_headers(
        client=client, email=user.email, password=password
    )
    other_headers = user_authentication_headers(
        client=client, email=other.email, password=other_password
    )
    url = f"{API}/notifications/"
    assert _ask(client, superuser_token_headers, user, True).status_code == 200

    def found(hdrs: dict[str, str], action: str) -> list[dict]:
        data = client.get(url, headers=hdrs).json()["data"]
        return [i for i in data if i["action"] == action]

    mine = found(headers, "auth.mfa_required_set")
    assert len(mine) == 1
    assert mine[0]["target_is_me"] is True and mine[0]["actor_is_me"] is False
    assert mine[0]["category"] == "security"
    assert found(other_headers, "auth.mfa_required_set") == []
    seen = found(superuser_token_headers, "auth.mfa_required_set")
    assert any(i["target_is_me"] is False and i["actor_is_me"] for i in seen)

    assert _ask(client, superuser_token_headers, user, False).status_code == 200
    assert len(found(headers, "auth.mfa_required_cleared")) == 1
    assert found(other_headers, "auth.mfa_required_cleared") == []
