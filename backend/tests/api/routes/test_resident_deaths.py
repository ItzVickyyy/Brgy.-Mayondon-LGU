# ruff: noqa: F811  (fixtures imported from test_issuances are used as parameters)
"""Recording, correcting and voiding a death (patch 327)."""

import uuid
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, col, select

from app.core.config import settings
from app.core.dates import age_on, today_manila
from app.models_foundation import AuditLog
from app.models_residents import ResidentDeath
from tests.api.routes.test_barangay_ids import (
    _id_resident,
    _issue_card,
    _number,
    _until,
)
from tests.api.routes.test_issuances import (  # noqa: F401  (fixtures are reused)
    _clearance,
    _doc,
    _issue,
    _resident,
    _tidy_up,
    street_id,
)

API = settings.API_V1_STR
ISS = f"{API}/issuances"
Headers = dict[str, str]
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 100


def _death(**extra: object) -> dict[str, object]:
    return {
        "date_of_death": "2026-03-15",
        "evidence": "reported",
        **extra,
    }


def _record(
    client: TestClient, headers: Headers, resident_id: str, **extra: object
) -> dict:
    r = client.post(
        f"{API}/residents/{resident_id}/deceased",
        headers=headers,
        json=_death(**extra),
    )
    assert r.status_code == 200, r.text
    return r.json()


def _rows(db: Session, resident_id: str) -> list[ResidentDeath]:
    db.rollback()
    return list(
        db.exec(
            select(ResidentDeath)
            .where(ResidentDeath.resident_id == uuid.UUID(resident_id))
            .order_by(col(ResidentDeath.recorded_at))
        ).all()
    )


def _log(db: Session, resident_id: str, action: str) -> list[AuditLog]:
    db.rollback()
    return list(
        db.exec(
            select(AuditLog).where(
                AuditLog.record_id == resident_id, AuditLog.action == action
            )
        ).all()
    )


def _listed(client: TestClient, headers: Headers, status: str, name: str) -> list[str]:
    r = client.get(
        f"{API}/residents/", headers=headers, params={"status": status, "q": name}
    )
    assert r.status_code == 200, r.text
    return [row["id"] for row in r.json()["data"]]


def test_only_an_administrator_may_record_correct_or_void(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
) -> None:
    res = _resident(client, staff_token_headers)
    url = f"{API}/residents/{res['id']}/deceased"
    assert client.post(url, json=_death()).status_code == 401
    assert (
        client.post(url, headers=staff_token_headers, json=_death()).status_code == 403
    )
    _record(client, superuser_token_headers, res["id"])
    assert (
        client.put(
            url, headers=staff_token_headers, json=_death(reason="Wrong date")
        ).status_code
        == 403
    )
    assert (
        client.post(
            f"{url}/void", headers=staff_token_headers, json={"reason": "Mistake"}
        ).status_code
        == 403
    )


def test_recording_a_death(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    db: Session,
) -> None:
    res = _resident(client, staff_token_headers)
    body = _record(
        client,
        superuser_token_headers,
        res["id"],
        source_note="  Told by a neighbor ",
    )
    assert body["status"] == "deceased"
    death = body["death"]
    assert death["date_of_death"] == "2026-03-15"
    assert death["date_precision"] == "day"
    assert death["evidence"] == "reported"
    assert death["source_note"] == "Told by a neighbor"
    assert death["recorded_by_name"]
    expected = age_on(date(1990, 5, 17), date(2026, 3, 15))
    assert death["age_at_death"] == expected and body["age"] == expected
    # Staff can read it, and it moved from the active list to the deceased one.
    name = res["last_name"]
    assert _listed(client, staff_token_headers, "deceased", name) == [res["id"]]
    assert _listed(client, staff_token_headers, "all", name) == [res["id"]]
    assert _listed(client, staff_token_headers, "active", name) == []
    assert _listed(client, staff_token_headers, "archived", name) == []
    [entry] = _log(db, res["id"], "resident.death_record")
    # Codes only: the note and the date stay out of the Activity Log.
    assert entry.details == {"evidence": "reported", "date_precision": "day"}


@pytest.mark.parametrize(
    ("precision", "sent", "kept"),
    [
        ("month", "2026-03-15", "2026-03-01"),
        ("year", "2025-08-09", "2025-01-01"),
        ("unknown", None, None),
    ],
)
def test_a_partly_known_date_is_kept_as_far_as_it_is_known(
    client: TestClient,
    superuser_token_headers: Headers,
    precision: str,
    sent: str | None,
    kept: str | None,
) -> None:
    res = _resident(client, superuser_token_headers)
    body = _record(
        client,
        superuser_token_headers,
        res["id"],
        date_precision=precision,
        date_of_death=sent,
    )
    assert body["death"]["date_of_death"] == kept
    assert body["death"]["date_precision"] == precision
    assert body["death"]["age_at_death"] is None and body["age"] is None


@pytest.mark.parametrize(
    "bad",
    [
        {"date_of_death": None},
        {"date_precision": "unknown"},  # unknown, yet a date is sent
        {"date_of_death": (today_manila() + timedelta(days=1)).isoformat()},
        {"date_of_death": "1899-12-31"},
        {"date_of_death": "1990-05-16"},  # the day before the birthdate
        {"date_precision": "month", "date_of_death": "1990-04-30"},
        {"date_precision": "year", "date_of_death": "1989-12-31"},
        {"evidence": "rumour"},
        {"source_note": "<script>"},
        {"source_note": "x" * 501},
    ],
)
def test_bad_death_details_are_refused(
    client: TestClient, superuser_token_headers: Headers, db: Session, bad: dict
) -> None:
    res = _resident(client, superuser_token_headers)
    r = client.post(
        f"{API}/residents/{res['id']}/deceased",
        headers=superuser_token_headers,
        json=_death(**bad),
    )
    assert r.status_code == 422, r.text
    assert _rows(db, res["id"]) == []


@pytest.mark.parametrize(
    ("precision", "value"),
    [("day", "1990-05-17"), ("month", "1990-05-02"), ("year", "1990-02-02")],
)
def test_a_death_in_the_birth_period_is_allowed(
    client: TestClient, superuser_token_headers: Headers, precision: str, value: str
) -> None:
    res = _resident(client, superuser_token_headers)
    _record(
        client,
        superuser_token_headers,
        res["id"],
        date_precision=precision,
        date_of_death=value,
    )


def test_wrong_status_is_refused(
    client: TestClient, superuser_token_headers: Headers
) -> None:
    admin = superuser_token_headers
    unknown = f"{API}/residents/{uuid.uuid4()}/deceased"
    assert client.post(unknown, headers=admin, json=_death()).status_code == 404

    alive = _resident(client, admin)
    url = f"{API}/residents/{alive['id']}/deceased"
    r = client.put(url, headers=admin, json=_death(reason="Not recorded"))
    assert r.status_code == 409
    r = client.post(f"{url}/void", headers=admin, json={"reason": "Not recorded"})
    assert r.status_code == 409

    _record(client, admin, alive["id"])
    assert client.post(url, headers=admin, json=_death()).status_code == 409

    gone = _resident(client, admin)
    r = client.post(
        f"{API}/residents/{gone['id']}/archive",
        headers=admin,
        json={"reason": "Moved away"},
    )
    assert r.status_code == 200
    r = client.post(
        f"{API}/residents/{gone['id']}/deceased", headers=admin, json=_death()
    )
    assert r.status_code == 409 and "Restore" in r.json()["detail"]


def test_a_deceased_record_is_read_only(
    client: TestClient, superuser_token_headers: Headers
) -> None:
    admin = superuser_token_headers
    res = _resident(client, admin, residency_type="new")
    base = f"{API}/residents/{res['id']}"
    assert client.put(f"{base}/photo", headers=admin, content=PNG).status_code == 200
    _record(client, admin, res["id"])
    refused = [
        client.patch(base, headers=admin, json={"purok": 4}),
        client.put(f"{base}/photo", headers=admin, content=PNG),
        client.delete(f"{base}/photo", headers=admin),
        client.post(f"{base}/voter-proof", headers=admin, json={}),
        client.post(f"{base}/voter-proof/clear", headers=admin),
        client.post(f"{base}/archive", headers=admin, json={"reason": "Moved away"}),
        client.post(f"{base}/restore", headers=admin),
    ]
    assert [r.status_code for r in refused] == [409] * len(refused)
    # The profile and the photo can still be read.
    assert client.get(base, headers=admin).json()["purok"] == 3
    assert client.get(f"{base}/photo", headers=admin).status_code == 200


def test_a_deceased_resident_gets_no_document(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    staff = staff_token_headers
    res = _resident(client, staff, street_id)
    issued = _issue(client, staff, _clearance(client, staff, res["id"])["id"])
    draft = _clearance(client, staff, res["id"])
    _record(client, superuser_token_headers, res["id"])

    new = client.post(
        f"{ISS}/",
        headers=staff,
        json={
            "document_type_id": _doc(client, staff, "BARANGAY_CLEARANCE"),
            "resident_id": res["id"],
        },
    )
    edit = client.patch(f"{ISS}/{draft['id']}", headers=staff, json={"remarks": "x"})
    issue = client.post(
        f"{ISS}/{draft['id']}/issue",
        headers=staff,
        json={"confirm_duplicate": True},
    )
    correct = client.post(
        f"{ISS}/{issued['id']}/correct", headers=staff, json={"reason": "Typo"}
    )
    for r in (new, edit, issue, correct):
        assert r.status_code == 409, r.text
        assert r.json()["detail"] == "A deceased resident cannot receive documents"
    # What was already issued is not changed, and a draft can still be discarded.
    kept = client.get(f"{ISS}/{issued['id']}", headers=staff).json()
    assert kept["status"] == "issued"
    assert client.delete(f"{ISS}/{draft['id']}", headers=staff).status_code < 300


def test_a_death_leaves_the_counts_and_expiry_lists(
    client: TestClient,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    admin = superuser_token_headers
    res = _id_resident(client, admin, street_id)
    _issue_card(client, admin, res["id"], valid_until=_until(10), id_number=_number())

    def seen() -> dict[str, object]:
        cards = client.get(
            f"{API}/barangay-ids/", headers=admin, params={"q": res["last_name"]}
        ).json()
        expiring = client.get(
            f"{API}/reports/expiring", headers=admin, params={"limit": 200}
        ).json()
        overview = client.get(f"{API}/reports/records-overview", headers=admin).json()
        dashboard = client.get(f"{API}/dashboard/", headers=admin).json()
        profile = client.get(f"{API}/residents/{res['id']}", headers=admin).json()
        return {
            "cards": cards["count"],
            "listed": res["id"] in [x["resident_id"] for x in expiring["data"]],
            "active": overview["residents_active"],
            "ids": overview["ids_by_status"]["total"],
            "dashboard_ids": dashboard["summary"]["barangay_ids_expiring"],
            "id_status": profile["id_status"],
        }

    before = seen()
    assert before["cards"] == 1 and before["listed"]
    assert before["id_status"] == "expiring_soon"
    _record(client, admin, res["id"])
    after = seen()
    assert after == {
        "cards": 0,
        "listed": False,
        "active": before["active"] - 1,  # type: ignore[operator]
        "ids": before["ids"] - 1,  # type: ignore[operator]
        "dashboard_ids": before["dashboard_ids"] - 1,  # type: ignore[operator]
        "id_status": "none",
    }
    r = client.post(
        f"{API}/residents/{res['id']}/deceased/void",
        headers=admin,
        json={"reason": "A namesake had died"},
    )
    assert r.status_code == 200, r.text
    assert seen() == before


def test_correcting_keeps_the_old_row(
    client: TestClient, superuser_token_headers: Headers, db: Session
) -> None:
    admin = superuser_token_headers
    res = _resident(client, admin)
    _record(client, admin, res["id"])
    url = f"{API}/residents/{res['id']}/deceased"
    assert client.put(url, headers=admin, json=_death()).status_code == 422  # reason
    # Nothing changed: nothing written.
    r = client.put(url, headers=admin, json=_death(reason="No change"))
    assert r.status_code == 200 and len(_rows(db, res["id"])) == 1
    assert _log(db, res["id"], "resident.death_correct") == []

    r = client.put(
        url,
        headers=admin,
        json=_death(
            evidence="verified",
            date_of_death="2026-03-14",
            reason="Death certificate seen",
        ),
    )
    assert r.status_code == 200, r.text
    assert r.json()["death"]["evidence"] == "verified"
    assert r.json()["death"]["date_of_death"] == "2026-03-14"
    old, new = _rows(db, res["id"])
    assert old.voided_at is not None and old.void_reason == "Death certificate seen"
    assert old.evidence == "reported"
    assert new.voided_at is None and new.evidence == "verified"
    [entry] = _log(db, res["id"], "resident.death_correct")
    assert entry.reason == "Death certificate seen"
    assert entry.details == {
        "fields": ["date_of_death", "evidence"],
        "evidence": "verified",
        "date_precision": "day",
    }
    # The birthdate rule holds on a correction too.
    r = client.put(
        url,
        headers=admin,
        json=_death(date_of_death="1980-01-01", reason="Wrong"),
    )
    assert r.status_code == 422 and len(_rows(db, res["id"])) == 2


def test_voiding_makes_the_resident_active_and_a_death_can_be_recorded_again(
    client: TestClient, superuser_token_headers: Headers, db: Session
) -> None:
    admin = superuser_token_headers
    res = _resident(client, admin)
    _record(client, admin, res["id"])
    void = f"{API}/residents/{res['id']}/deceased/void"
    assert client.post(void, headers=admin, json={"reason": "  "}).status_code == 422
    r = client.post(void, headers=admin, json={"reason": "Wrong person"})
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "active" and r.json()["death"] is None
    assert r.json()["age"] == age_on(date(1990, 5, 17))
    [row] = _rows(db, res["id"])
    assert row.void_reason == "Wrong person" and row.voided_by_user_id is not None
    [entry] = _log(db, res["id"], "resident.death_void")
    assert entry.reason == "Wrong person"
    _record(client, admin, res["id"], evidence="verified")
    assert len(_rows(db, res["id"])) == 2


def test_a_new_record_is_warned_about_a_deceased_namesake(
    client: TestClient, superuser_token_headers: Headers
) -> None:
    admin = superuser_token_headers
    res = _resident(client, admin)
    _record(client, admin, res["id"])
    r = client.post(
        f"{API}/residents/",
        headers=admin,
        json={
            "first_name": res["first_name"],
            "last_name": res["last_name"],
            "birthdate": res["birthdate"],
        },
    )
    assert r.status_code == 409
    assert r.json()["detail"]["matches"][0]["status"] == "deceased"
