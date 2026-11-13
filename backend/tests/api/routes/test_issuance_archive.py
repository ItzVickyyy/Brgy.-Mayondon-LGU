# ruff: noqa: F811  (fixtures imported from test_issuances are used as parameters)
"""Archiving an issuance: admin only, nothing deleted, status never changed."""

from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, col, select

from app.core.config import settings
from app.core.dates import add_months, today_manila
from app.models_foundation import AuditLog
from app.models_issuance import Issuance
from tests.api.routes.test_barangay_ids import _id_resident, _issue_card, _number
from tests.api.routes.test_issuances import (  # noqa: F401  (fixtures are reused)
    _audit,
    _clearance,
    _issue,
    _resident,
    _tidy_up,
    street_id,
)
from tests.api.routes.test_reports import (
    DASH,
    _expiring_ids,
    _get,
    _issue_clearance,
)

API = settings.API_V1_STR
ISS = f"{API}/issuances"
Headers = dict[str, str]


def _archive(
    client: TestClient, headers: Headers, issuance_id: str, reason: str = "Old record"
):
    return client.post(
        f"{ISS}/{issuance_id}/archive", headers=headers, json={"reason": reason}
    )


def _listed(client: TestClient, headers: Headers, **params: object) -> set[str]:
    r = client.get(f"{ISS}/", headers=headers, params={"limit": 200, **params})
    assert r.status_code == 200, r.text
    return {row["id"] for row in r.json()["data"]}


def test_archive_is_admin_only_and_needs_a_reason(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    issued = _issue(
        client,
        staff_token_headers,
        _clearance(client, staff_token_headers, res["id"])["id"],
    )
    url = f"{ISS}/{issued['id']}"
    assert _archive(client, staff_token_headers, issued["id"]).status_code == 403
    assert client.post(f"{url}/restore", headers=staff_token_headers).status_code == 403
    assert (
        client.post(
            f"{url}/archive", headers=superuser_token_headers, json={}
        ).status_code
        == 422
    )
    assert (
        client.post(
            f"{url}/archive", headers=superuser_token_headers, json={"reason": " a "}
        ).status_code
        == 422
    )
    # Nothing happened.
    body = client.get(url, headers=staff_token_headers).json()
    assert body["archived_at"] is None and body["status"] == "issued"


def test_archive_keeps_the_record_and_its_status(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
    db: Session,
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    issued = _issue(
        client,
        staff_token_headers,
        _clearance(client, staff_token_headers, res["id"])["id"],
    )
    r = _archive(client, superuser_token_headers, issued["id"], "Filed away")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "issued"  # never altered
    assert body["original_status"] == "issued"
    assert body["archive_reason"] == "Filed away"
    assert body["archived_at"] is not None
    assert body["archived_by_name"]
    assert body["reference_no"] == issued["reference_no"]
    assert _archive(client, superuser_token_headers, issued["id"]).status_code == 409

    # Gone from the default list, found in the Archived view, still readable.
    assert issued["id"] not in _listed(client, staff_token_headers)
    assert issued["id"] in _listed(client, staff_token_headers, archived="only")
    assert issued["id"] in _listed(client, staff_token_headers, archived="include")
    assert (
        client.get(f"{ISS}/{issued['id']}", headers=staff_token_headers).status_code
        == 200
    )
    row = next(
        r
        for r in client.get(
            f"{ISS}/", headers=staff_token_headers, params={"archived": "only"}
        ).json()["data"]
        if r["id"] == issued["id"]
    )
    assert row["archive_reason"] == "Filed away" and row["archived_by_name"]

    # Audited with the reason and the original status, never deleted.
    db.rollback()
    audit = db.exec(
        select(AuditLog).where(
            col(AuditLog.record_id) == issued["id"],
            col(AuditLog.action) == "issuance.archive",
        )
    ).one()
    assert audit.reason == "Filed away"
    assert audit.details["original_status"] == "issued"
    assert db.get(Issuance, issued["id"]) is not None


def test_archived_record_cannot_be_voided_corrected_or_printed(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    issued = _issue(
        client,
        staff_token_headers,
        _clearance(client, staff_token_headers, res["id"])["id"],
    )
    assert _archive(client, superuser_token_headers, issued["id"]).status_code == 200
    url = f"{ISS}/{issued['id']}"
    for path, headers, body in (
        ("void", superuser_token_headers, {"reason": "Mistake"}),
        ("correct", staff_token_headers, {"reason": "Wrong name"}),
        ("printed", staff_token_headers, {"mode": "data"}),
    ):
        r = client.post(f"{url}/{path}", headers=headers, json=body)
        assert r.status_code == 409, (path, r.text)
        assert r.json()["detail"]["code"] == "archived"


def test_restore_returns_the_record_as_it_was_and_is_not_an_issue(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
    db: Session,
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    issued = _issue(
        client,
        staff_token_headers,
        _clearance(client, staff_token_headers, res["id"])["id"],
    )
    assert _archive(client, superuser_token_headers, issued["id"]).status_code == 200
    url = f"{ISS}/{issued['id']}/restore"
    r = client.post(url, headers=superuser_token_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "issued"
    assert body["reference_no"] == issued["reference_no"]
    assert body["issue_date"] == issued["issue_date"]
    assert body["issued_at"] == issued["issued_at"]
    assert body["issued_by_user_id"] == issued["issued_by_user_id"]
    assert body["archived_at"] is None and body["archive_reason"] is None
    assert body["original_status"] is None and body["archived_by_name"] is None
    assert client.post(url, headers=superuser_token_headers).status_code == 409
    assert issued["id"] in _listed(client, staff_token_headers)
    actions = _audit(db, issued["id"])
    assert actions.count("issuance.issue") == 1  # restoring is not issuing
    assert "issuance.archive" in actions and "issuance.restore" in actions
    # It can be voided again after the restore.
    assert (
        client.post(
            f"{ISS}/{issued['id']}/void",
            headers=superuser_token_headers,
            json={"reason": "Mistake"},
        ).status_code
        == 200
    )


def test_a_voided_record_is_archived_and_restored_as_voided(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    issued = _issue(
        client,
        staff_token_headers,
        _clearance(client, staff_token_headers, res["id"])["id"],
    )
    client.post(
        f"{ISS}/{issued['id']}/void",
        headers=superuser_token_headers,
        json={"reason": "Mistake"},
    )
    r = _archive(client, superuser_token_headers, issued["id"])
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "voided"
    assert r.json()["original_status"] == "voided"
    assert r.json()["void_reason"] == "Mistake"
    r = client.post(f"{ISS}/{issued['id']}/restore", headers=superuser_token_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "voided" and r.json()["void_reason"] == "Mistake"


def test_a_draft_cannot_be_archived(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    draft = _clearance(client, staff_token_headers, res["id"])
    assert _archive(client, superuser_token_headers, draft["id"]).status_code == 409
    assert (
        client.post(
            f"{ISS}/{draft['id']}/archive",
            headers=superuser_token_headers,
            json={"reason": "x" * 501},
        ).status_code
        == 422
    )
    assert (
        client.post(
            f"{ISS}/{'00000000-0000-0000-0000-000000000000'}/archive",
            headers=superuser_token_headers,
            json={"reason": "Nothing here"},
        ).status_code
        == 404
    )


def test_database_refuses_an_archive_that_changes_the_status(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
    db: Session,
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    issued = _issue(
        client,
        staff_token_headers,
        _clearance(client, staff_token_headers, res["id"])["id"],
    )
    assert _archive(client, superuser_token_headers, issued["id"]).status_code == 200
    db.rollback()
    row = db.get(Issuance, issued["id"])
    assert row is not None
    row.status = "voided"
    row.void_reason = "Sneaky"
    db.add(row)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_archived_copies_still_count_for_the_same_day_check(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    """Hiding a record does not cancel the document, so the warning still fires."""
    res = _resident(client, staff_token_headers, street_id)
    first = _issue(
        client,
        staff_token_headers,
        _clearance(client, staff_token_headers, res["id"])["id"],
    )
    assert _archive(client, superuser_token_headers, first["id"]).status_code == 200
    second = _clearance(client, staff_token_headers, res["id"])
    r = client.post(f"{ISS}/{second['id']}/issue", headers=staff_token_headers)
    assert r.status_code == 409
    assert r.json()["detail"]["code"] == "duplicate_same_day"
    assert r.json()["detail"]["reference_no"] == first["reference_no"]


def test_archived_rows_leave_the_dashboard_and_the_expiring_report(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    today = today_manila()
    soon = _issue_clearance(
        client,
        staff_token_headers,
        street_id,
        issue_date=add_months(today, -2) + timedelta(days=10),
    )
    before = _get(client, superuser_token_headers, f"{DASH}/")
    assert soon["id"] in _expiring_ids(client, superuser_token_headers)
    assert _archive(client, superuser_token_headers, soon["id"]).status_code == 200
    after = _get(client, superuser_token_headers, f"{DASH}/")
    assert after["total_issued"] == before["total_issued"] - 1
    assert (
        after["summary"]["clearances_expiring"]
        == before["summary"]["clearances_expiring"] - 1
    )
    assert soon["id"] not in _expiring_ids(client, superuser_token_headers)
    client.post(f"{ISS}/{soon['id']}/restore", headers=superuser_token_headers)
    back = _get(client, superuser_token_headers, f"{DASH}/")
    assert back["total_issued"] == before["total_issued"]
    assert soon["id"] in _expiring_ids(client, superuser_token_headers)


def test_an_archived_card_does_not_count_as_the_residents_current_id(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    res = _id_resident(client, staff_token_headers, street_id)
    card = _issue_card(client, staff_token_headers, res["id"], id_number=_number())
    status = client.get(f"{API}/residents/{res['id']}", headers=staff_token_headers)
    assert status.json()["id_status"] == "valid"
    assert _archive(client, superuser_token_headers, card["id"]).status_code == 200
    status = client.get(f"{API}/residents/{res['id']}", headers=staff_token_headers)
    assert status.json()["id_status"] == "none"
    client.post(f"{ISS}/{card['id']}/restore", headers=superuser_token_headers)
    status = client.get(f"{API}/residents/{res['id']}", headers=staff_token_headers)
    assert status.json()["id_status"] == "valid"
