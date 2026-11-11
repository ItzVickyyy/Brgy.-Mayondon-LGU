"""Reading and exporting resident data is audited (step 15, patch 53)."""

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.models_foundation import AuditLog
from tests.utils.utils import random_lower_string

API = settings.API_V1_STR
Headers = dict[str, str]


def _resident(client: TestClient, headers: Headers) -> dict:
    r = client.post(
        f"{API}/residents/",
        headers=headers,
        json={
            "first_name": f"Read{random_lower_string()[:8]}",
            "last_name": f"Audit{random_lower_string()[:8]}",
            "birthdate": "1990-05-17",
            "sex": "Female",
            "civil_status": "Single",
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


def _rows(db: Session, action: str, record_id: str | None = None) -> list[AuditLog]:
    db.expire_all()
    stmt = select(AuditLog).where(AuditLog.action == action)
    if record_id is not None:
        stmt = stmt.where(AuditLog.record_id == record_id)
    return list(db.exec(stmt).all())


def test_opening_a_profile_is_logged_once_per_window(
    client: TestClient, db: Session, staff_token_headers: Headers
) -> None:
    rid = _resident(client, staff_token_headers)["id"]
    for _ in range(3):
        r = client.get(f"{API}/residents/{rid}", headers=staff_token_headers)
        assert r.status_code == 200
    rows = _rows(db, "resident.view", rid)
    assert len(rows) == 1
    assert rows[0].module == "records" and rows[0].record_type == "resident"
    assert rows[0].actor_email is not None and rows[0].details is None


def test_a_profile_opened_again_after_the_window_is_logged_again(
    client: TestClient, db: Session, staff_token_headers: Headers
) -> None:
    rid = _resident(client, staff_token_headers)["id"]
    client.get(f"{API}/residents/{rid}", headers=staff_token_headers)
    # The table is append-only, so the window is tested through the helper itself.
    from app.core.audit import record_read_event
    from app.models import User

    actor = db.exec(select(User).where(User.email == settings.FIRST_SUPERUSER)).one()
    assert record_read_event(
        db, action="x.view", actor=actor, module="records", record_id=rid
    )
    assert not record_read_event(
        db, action="x.view", actor=actor, module="records", record_id=rid
    )
    assert record_read_event(
        db,
        action="x.view",
        actor=actor,
        module="records",
        record_id=rid,
        window_minutes=0,
    )


def test_each_person_and_each_resident_is_logged_separately(
    client: TestClient,
    db: Session,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
) -> None:
    first = _resident(client, staff_token_headers)["id"]
    second = _resident(client, staff_token_headers)["id"]
    client.get(f"{API}/residents/{first}", headers=staff_token_headers)
    client.get(f"{API}/residents/{second}", headers=staff_token_headers)
    client.get(f"{API}/residents/{first}", headers=superuser_token_headers)
    assert len(_rows(db, "resident.view", first)) == 2
    assert len(_rows(db, "resident.view", second)) == 1


def test_unknown_resident_is_not_logged(
    client: TestClient, db: Session, staff_token_headers: Headers
) -> None:
    before = len(_rows(db, "resident.view"))
    missing = "00000000-0000-0000-0000-000000000000"
    r = client.get(f"{API}/residents/{missing}", headers=staff_token_headers)
    assert r.status_code == 404
    assert len(_rows(db, "resident.view")) == before


def test_browsing_the_whole_list_is_logged_but_a_name_search_is_not(
    client: TestClient, db: Session, staff_token_headers: Headers
) -> None:
    created = _resident(client, staff_token_headers)
    before = len(_rows(db, "resident.list"))
    client.get(
        f"{API}/residents/",
        headers=staff_token_headers,
        params={"q": created["last_name"]},
    )
    assert len(_rows(db, "resident.list")) == before
    for _ in range(2):
        r = client.get(f"{API}/residents/", headers=staff_token_headers)
        assert r.status_code == 200
    rows = _rows(db, "resident.list")
    assert len(rows) == before + 1
    newest = max(rows, key=lambda x: x.id or 0)
    assert newest.details is not None
    assert newest.details["status"] == "active" and newest.details["count"] >= 1
    assert newest.record_id is None


def test_barangay_id_list_is_logged_when_browsed(
    client: TestClient, db: Session, staff_token_headers: Headers
) -> None:
    before = len(_rows(db, "barangay_id.list"))
    r = client.get(f"{API}/barangay-ids/", headers=staff_token_headers)
    assert r.status_code == 200
    added = len(_rows(db, "barangay_id.list")) - before
    if r.json()["count"] == 0:
        # An empty list reads no personal data, so nothing is logged for it.
        assert added == 0
    else:
        # One row, or none when the same person already browsed it just now.
        assert added in (0, 1)
    searched = client.get(
        f"{API}/barangay-ids/", headers=staff_token_headers, params={"q": "zzzz"}
    )
    assert searched.status_code == 200
    assert len(_rows(db, "barangay_id.list")) - before == added


def test_report_export_is_logged_and_validated(
    client: TestClient,
    db: Session,
    superuser_token_headers: Headers,
    staff_token_headers: Headers,
) -> None:
    body = {"report": "expiry", "period": "month", "mode": "csv"}
    r = client.post(
        f"{API}/reports/exported", headers=superuser_token_headers, json=body
    )
    assert r.status_code == 204
    printed = client.post(
        f"{API}/reports/exported",
        headers=superuser_token_headers,
        json={**body, "mode": "print"},
    )
    assert printed.status_code == 204
    rows = sorted(_rows(db, "report.export"), key=lambda x: x.id or 0)[-2:]
    assert [x.details["mode"] for x in rows if x.details] == ["CSV file", "printed"]
    assert rows[0].module == "reports"
    assert rows[0].details == {
        "report": "expiry",
        "period": "month",
        "mode": "CSV file",
    }
    bad = client.post(
        f"{API}/reports/exported",
        headers=superuser_token_headers,
        json={**body, "report": "everything"},
    )
    assert bad.status_code == 422
    assert (
        client.post(
            f"{API}/reports/exported", headers=staff_token_headers, json=body
        ).status_code
        == 403
    )
    assert client.post(f"{API}/reports/exported", json=body).status_code == 401


def test_dashboard_can_hide_read_rows(
    client: TestClient, superuser_token_headers: Headers
) -> None:
    rid = _resident(client, superuser_token_headers)["id"]
    client.get(f"{API}/residents/{rid}", headers=superuser_token_headers)
    shown = client.get(
        f"{API}/activity/", headers=superuser_token_headers, params={"limit": 200}
    ).json()
    assert "resident.view" in {row["action"] for row in shown["data"]}
    hidden = client.get(
        f"{API}/activity/",
        headers=superuser_token_headers,
        params={"limit": 200, "hide_reads": True},
    ).json()
    actions = {row["action"] for row in hidden["data"]}
    assert actions and not actions & {
        "resident.view",
        "resident.list",
        "barangay_id.list",
    }
