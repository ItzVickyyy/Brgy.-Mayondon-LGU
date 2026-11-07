# ruff: noqa: F811  (fixtures imported from test_issuances are used as parameters)
"""Activity Log: scoping, filters, and what the log must never contain."""

from datetime import timedelta
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.core.dates import today_manila
from app.models import UserRole
from tests.api.routes.test_issuances import (  # noqa: F401  (fixtures are reused)
    _resident,
    _tidy_up,
    street_id,
)
from tests.api.routes.test_issuances_certificates import (
    SECRET,
    _sector_ids,
)
from tests.api.routes.test_issuances_certificates import (
    _draft as _certificate_draft,
)
from tests.utils.user import create_user_with_role, user_authentication_headers
from tests.utils.utils import random_email, random_lower_string

API = settings.API_V1_STR
ACT = f"{API}/activity"
Headers = dict[str, str]


def _me(client: TestClient, headers: Headers) -> dict:
    return client.get(f"{API}/users/me", headers=headers).json()


def _list(client: TestClient, headers: Headers, **params: object) -> dict:
    # Sign-ins are logged too (module "auth"); these tests are about record activity.
    params.setdefault("exclude_module", "auth")
    r = client.get(f"{ACT}/", headers=headers, params={"limit": 200, **params})
    assert r.status_code == 200, r.text
    return r.json()


def _staff_resident(client: TestClient, headers: Headers, street_id: int) -> dict:
    """Creating a resident writes a ``resident.create`` audit row."""
    return _resident(client, headers, street_id)


# --- Access and scope ---------------------------------------------------------


def test_requires_login(client: TestClient) -> None:
    assert client.get(f"{ACT}/").status_code == 401
    assert client.get(f"{ACT}/options").status_code == 401


def test_staff_see_only_their_own_activity(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    me = _me(client, staff_token_headers)
    mine = _staff_resident(client, staff_token_headers, street_id)
    # Someone else acts too; staff must not see it.
    theirs = _staff_resident(client, superuser_token_headers, street_id)

    body = _list(client, staff_token_headers)
    assert body["count"] >= 1
    assert all(row["actor_user_id"] == me["id"] for row in body["data"])
    assert all(row["is_own"] is True for row in body["data"])
    seen = {row["record_id"] for row in body["data"]}
    assert mine["id"] in seen and theirs["id"] not in seen
    row = next(r for r in body["data"] if r["record_id"] == mine["id"])
    assert row["action"] == "resident.create"
    assert row["module"] == "records" and row["outcome"] == "success"
    assert row["actor_email"] == me["email"]


def test_staff_cannot_ask_for_another_persons_activity(
    client: TestClient, staff_token_headers: Headers, superuser_token_headers: Headers
) -> None:
    admin_id = _me(client, superuser_token_headers)["id"]
    r = client.get(
        f"{ACT}/", headers=staff_token_headers, params={"actor_user_id": admin_id}
    )
    assert r.status_code == 403
    own_id = _me(client, staff_token_headers)["id"]
    r = client.get(
        f"{ACT}/", headers=staff_token_headers, params={"actor_user_id": own_id}
    )
    assert r.status_code == 200


def test_admin_sees_everyone_and_can_filter_by_person(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    staff_id = _me(client, staff_token_headers)["id"]
    admin_id = _me(client, superuser_token_headers)["id"]
    a = _staff_resident(client, staff_token_headers, street_id)
    b = _staff_resident(client, superuser_token_headers, street_id)

    everyone = {r["record_id"] for r in _list(client, superuser_token_headers)["data"]}
    assert {a["id"], b["id"]} <= everyone
    only_staff = _list(client, superuser_token_headers, actor_user_id=staff_id)
    assert {r["record_id"] for r in only_staff["data"]} == {a["id"]}
    assert all(r["is_own"] is False for r in only_staff["data"])
    only_admin = _list(client, superuser_token_headers, actor_user_id=admin_id)
    assert b["id"] in {r["record_id"] for r in only_admin["data"]}
    assert all(r["is_own"] is True for r in only_admin["data"])


# --- Filters, paging, order ---------------------------------------------------------


def test_filters_paging_and_order(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    first = _staff_resident(client, staff_token_headers, street_id)
    second = _staff_resident(client, staff_token_headers, street_id)
    client.patch(
        f"{API}/residents/{first['id']}",
        headers=staff_token_headers,
        json={"purok": 4},
    )
    allrows = _list(client, staff_token_headers)
    assert allrows["count"] == 3
    # Newest first: the update comes before both creates, second before first.
    assert [r["action"] for r in allrows["data"]] == [
        "resident.update",
        "resident.create",
        "resident.create",
    ]
    assert allrows["data"][1]["record_id"] == second["id"]
    # Exact filters.
    assert _list(client, staff_token_headers, action="resident.update")["count"] == 1
    assert _list(client, staff_token_headers, module="records")["count"] == 3
    assert _list(client, staff_token_headers, module="lookups")["count"] == 0
    assert _list(client, staff_token_headers, outcome="denied")["count"] == 0
    assert _list(client, staff_token_headers, record_id=first["id"])["count"] == 2
    assert (
        _list(
            client, staff_token_headers, record_type="resident", record_id=second["id"]
        )["count"]
        == 1
    )
    # Words match action or record id.
    assert _list(client, staff_token_headers, q="update")["count"] == 1
    assert _list(client, staff_token_headers, q=second["id"][:8])["count"] == 1
    assert _list(client, staff_token_headers, q="update nomatchword")["count"] == 0
    # Paging keeps the total.
    page = _list(client, staff_token_headers, limit=2, skip=2)
    assert page["count"] == 3 and len(page["data"]) == 1
    # An update row names the fields, never the values.
    update_row = allrows["data"][0]
    assert update_row["details"] is None or "4" not in str(update_row["details"])


def test_date_range_uses_manila_days_and_is_validated(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    _staff_resident(client, staff_token_headers, street_id)
    today = today_manila()
    yesterday = today - timedelta(days=1)
    tomorrow = today + timedelta(days=1)
    assert (
        _list(client, staff_token_headers, date_from=today, date_to=today)["count"] == 1
    )
    assert _list(client, staff_token_headers, date_to=yesterday)["count"] == 0
    assert _list(client, staff_token_headers, date_from=tomorrow)["count"] == 0
    assert _list(client, staff_token_headers, date_from=yesterday)["count"] == 1
    r = client.get(
        f"{ACT}/",
        headers=staff_token_headers,
        params={"date_from": tomorrow.isoformat(), "date_to": yesterday.isoformat()},
    )
    assert r.status_code == 422
    bad = client.get(f"{ACT}/", headers=staff_token_headers, params={"limit": 500})
    assert bad.status_code == 422
    bad = client.get(f"{ACT}/", headers=staff_token_headers, params={"outcome": "x"})
    assert bad.status_code == 422


# --- Options ----------------------------------------------------------------------


def test_options_are_limited_to_what_the_user_may_see(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    me = _me(client, staff_token_headers)
    _staff_resident(client, staff_token_headers, street_id)
    mine = client.get(f"{ACT}/options", headers=staff_token_headers).json()
    assert mine["modules"] == ["auth", "records"]
    assert mine["actions"] == ["auth.login", "resident.create"]
    assert mine["outcomes"] == ["success", "failed", "denied"]
    assert mine["actors"] == []  # staff get no list of colleagues

    everyone = client.get(f"{ACT}/options", headers=superuser_token_headers).json()
    assert "records" in everyone["modules"]
    assert "resident.create" in everyone["actions"]
    assert {"id": me["id"], "email": me["email"]} in everyone["actors"]


# --- What the log must never contain ------------------------------------------------


def test_sensitive_read_is_logged_without_the_value(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    draft = _certificate_draft(
        client,
        staff_token_headers,
        "MARGINALIZED_SECTOR",
        res["id"],
        marginalized={"health_condition": SECRET},
        sectors=[{"sector_id": _sector_ids(client, staff_token_headers)[0]}],
    )
    got = client.get(f"{API}/issuances/{draft['id']}", headers=staff_token_headers)
    assert SECRET in got.text  # the single read does carry it
    for headers in (staff_token_headers, superuser_token_headers):
        r = client.get(
            f"{ACT}/",
            headers=headers,
            params={"record_id": draft["id"], "action": "issuance.view_sensitive"},
        )
        assert r.status_code == 200
        assert SECRET not in r.text
        rows = r.json()["data"]
        assert len(rows) == 1
        assert rows[0]["details"] == {"field": "health_condition"}
    everything = client.get(
        f"{ACT}/", headers=superuser_token_headers, params={"limit": 200}
    )
    assert SECRET not in everything.text


# --- Account changes now reach the log ------------------------------------------------


def test_account_changes_are_logged_without_passwords(
    client: TestClient, superuser_token_headers: Headers
) -> None:
    email = random_email()
    password = random_lower_string()
    new_password = random_lower_string()
    with patch("app.api.routes.users.send_email", return_value=None):
        r = client.post(
            f"{API}/users/",
            headers=superuser_token_headers,
            json={"email": email, "password": password},
        )
    assert r.status_code == 200, r.text
    uid = r.json()["id"]
    r = client.patch(
        f"{API}/users/{uid}",
        headers=superuser_token_headers,
        json={"role": UserRole.admin.value, "password": new_password},
    )
    assert r.status_code == 200, r.text
    r = client.delete(f"{API}/users/{uid}", headers=superuser_token_headers)
    assert r.status_code == 200, r.text

    r = client.get(
        f"{ACT}/",
        headers=superuser_token_headers,
        params={"record_id": uid, "module": "users"},
    )
    assert password not in r.text and new_password not in r.text
    rows = r.json()["data"]
    by_action = {row["action"]: row for row in rows}
    assert set(by_action) == {
        "user.create",
        "user.temp_password_set",
        "user.update",
        "user.role_change",
        "user.delete",
    }
    # One temporary password at creation and one at the administrator's reset.
    reasons = sorted(
        row["details"]["reason"]
        for row in rows
        if row["action"] == "user.temp_password_set"
    )
    assert reasons == ["account_created", "password_reset"]
    assert by_action["user.create"]["details"] == {"role": "staff"}
    # Field names only; the model also marks is_superuser when the role is set.
    assert set(by_action["user.update"]["details"]["fields"]) >= {"password", "role"}
    assert by_action["user.role_change"]["details"] == {"from": "staff", "to": "admin"}
    assert (
        by_action["user.delete"]["actor_email"]
        == _me(client, superuser_token_headers)["email"]
    )


def test_own_account_actions_are_logged_and_survive_deletion(
    client: TestClient, superuser_token_headers: Headers, db: Session
) -> None:
    user, password = create_user_with_role(db, UserRole.staff)
    headers = user_authentication_headers(
        client=client, email=user.email, password=password
    )
    new_password = random_lower_string()
    r = client.patch(f"{API}/users/me", headers=headers, json={"full_name": "Someone"})
    assert r.status_code == 200, r.text
    r = client.patch(
        f"{API}/users/me/password",
        headers=headers,
        json={"current_password": password, "new_password": new_password},
    )
    assert r.status_code == 200, r.text
    # A password change ends the old session; sign in again.
    headers = user_authentication_headers(
        client=client, email=user.email, password=new_password
    )
    mine = _list(client, headers, module="users")
    assert {row["action"] for row in mine["data"]} == {
        "user.password_change",
        "user.update_self",
    }
    assert password not in str(mine) and new_password not in str(mine)
    update_row = next(r for r in mine["data"] if r["action"] == "user.update_self")
    assert update_row["details"] == {"fields": ["full_name"]}
    assert "Someone" not in str(mine)

    assert client.delete(f"{API}/users/me", headers=headers).status_code == 200
    rows = _list(
        client, superuser_token_headers, record_id=str(user.id), module="users"
    )["data"]
    gone = next(r for r in rows if r["action"] == "user.delete_self")
    assert gone["actor_user_id"] is None  # account is gone
    assert gone["actor_email"] == user.email  # but the history still names it
