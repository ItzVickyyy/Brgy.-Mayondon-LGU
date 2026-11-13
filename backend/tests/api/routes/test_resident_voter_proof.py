# ruff: noqa: F811  (fixtures imported from test_issuances are used as parameters)
"""Residency type and voter-registration proof (patch 61).

The proof only changes the DEFAULT validity of the next Barangay ID. An ID that
is already issued is never changed.
"""

import uuid
from datetime import timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session, col, select

from app.core.config import settings
from app.core.dates import today_manila
from app.models_foundation import AuditLog
from app.models_issuance import IssuanceBarangayId
from tests.api.routes.test_barangay_ids import _id_resident, _issue_card, _number
from tests.api.routes.test_issuances import (  # noqa: F401  (fixtures are reused)
    _audit,
    _resident,
    _tidy_up,
    street_id,
)

API = settings.API_V1_STR
RES = f"{API}/residents"
Headers = dict[str, str]


def _get(client: TestClient, headers: Headers, resident_id: str) -> dict:
    r = client.get(f"{RES}/{resident_id}", headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def _verify(client: TestClient, headers: Headers, resident_id: str, **body: object):
    return client.post(f"{RES}/{resident_id}/voter-proof", headers=headers, json=body)


def test_validity_months_follow_type_and_proof(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    plain = _resident(client, staff_token_headers, street_id)
    assert plain["residency_type"] is None
    assert plain["id_validity_months"] == 12
    regular = _resident(
        client, staff_token_headers, street_id, residency_type="regular"
    )
    assert regular["id_validity_months"] == 12
    for kind in ("new", "renting"):
        res = _resident(client, staff_token_headers, street_id, residency_type=kind)
        assert res["id_validity_months"] == 6
        assert res["voter_proof_verified_at"] is None
        done = _verify(client, staff_token_headers, res["id"])
        assert done.status_code == 200, done.text
        assert done.json()["id_validity_months"] == 12


def test_residency_type_is_limited_and_updatable(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    bad = client.post(
        f"{RES}/",
        headers=staff_token_headers,
        json={"first_name": "A", "last_name": "B", "residency_type": "visitor"},
    )
    assert bad.status_code == 422
    res = _resident(client, staff_token_headers, street_id)
    r = client.patch(
        f"{RES}/{res['id']}",
        headers=staff_token_headers,
        json={"residency_type": "new"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["residency_type"] == "new"
    assert r.json()["id_validity_months"] == 6


def test_verify_records_who_and_when_and_audits(
    client: TestClient,
    db: Session,
    staff_token_headers: Headers,
    street_id: int,
) -> None:
    res = _resident(client, staff_token_headers, street_id, residency_type="new")
    day = (today_manila() - timedelta(days=2)).isoformat()
    r = _verify(client, staff_token_headers, res["id"], verified_on=day)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["voter_proof_verified_at"] == day
    assert body["voter_proof_verified_by_name"]
    assert "resident.voter_proof_verify" in _audit(db, res["id"])
    row = db.exec(
        select(AuditLog).where(
            col(AuditLog.record_id) == res["id"],
            col(AuditLog.action) == "resident.voter_proof_verify",
        )
    ).one()
    assert row.details == {"verified_on": day}
    # The same name shows on the profile and in the list.
    assert _get(client, staff_token_headers, res["id"])["voter_proof_verified_by_name"]


def test_verify_defaults_to_today(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    res = _resident(client, staff_token_headers, street_id, residency_type="renting")
    r = _verify(client, staff_token_headers, res["id"])
    assert r.json()["voter_proof_verified_at"] == today_manila().isoformat()


def test_verify_refusals(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    regular = _resident(
        client, staff_token_headers, street_id, residency_type="regular"
    )
    r = _verify(client, staff_token_headers, regular["id"])
    assert r.status_code == 409
    assert r.json()["detail"]["code"] == "not_new_or_renting"
    empty = _resident(client, staff_token_headers, street_id)
    assert _verify(client, staff_token_headers, empty["id"]).status_code == 409

    res = _resident(client, staff_token_headers, street_id, residency_type="new")
    future = (today_manila() + timedelta(days=1)).isoformat()
    r = _verify(client, staff_token_headers, res["id"], verified_on=future)
    assert r.status_code == 422
    assert r.json()["detail"]["code"] == "verified_on_future"
    assert _verify(client, staff_token_headers, res["id"]).status_code == 200
    again = _verify(client, staff_token_headers, res["id"])
    assert again.status_code == 409
    assert again.json()["detail"]["code"] == "already_verified"
    missing = client.post(
        f"{RES}/00000000-0000-0000-0000-000000000000/voter-proof",
        headers=staff_token_headers,
        json={},
    )
    assert missing.status_code == 404


def test_clear_undoes_it_and_audits(
    client: TestClient,
    db: Session,
    staff_token_headers: Headers,
    street_id: int,
) -> None:
    res = _resident(client, staff_token_headers, street_id, residency_type="new")
    nothing = client.post(
        f"{RES}/{res['id']}/voter-proof/clear", headers=staff_token_headers
    )
    assert nothing.status_code == 409
    assert nothing.json()["detail"]["code"] == "not_verified"
    _verify(client, staff_token_headers, res["id"])
    r = client.post(f"{RES}/{res['id']}/voter-proof/clear", headers=staff_token_headers)
    assert r.status_code == 200, r.text
    assert r.json()["voter_proof_verified_at"] is None
    assert r.json()["voter_proof_verified_by_name"] is None
    assert r.json()["id_validity_months"] == 6
    assert "resident.voter_proof_clear" in _audit(db, res["id"])


def test_archived_resident_cannot_be_verified(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    res = _resident(client, staff_token_headers, street_id, residency_type="new")
    a = client.post(
        f"{RES}/{res['id']}/archive",
        headers=superuser_token_headers,
        json={"reason": "Moved away"},
    )
    assert a.status_code == 200, a.text
    assert _verify(client, staff_token_headers, res["id"]).status_code == 409


def test_verifying_never_changes_an_issued_id(
    client: TestClient,
    db: Session,
    staff_token_headers: Headers,
    street_id: int,
) -> None:
    res = _id_resident(client, staff_token_headers, street_id, residency_type="new")
    until = (today_manila() + timedelta(days=182)).isoformat()
    card = _issue_card(
        client, staff_token_headers, res["id"], id_number=_number(), valid_until=until
    )
    before = _get(client, staff_token_headers, res["id"])
    assert before["id_valid_until"] == until
    assert _verify(client, staff_token_headers, res["id"]).status_code == 200
    db.rollback()
    stored = db.get(IssuanceBarangayId, uuid.UUID(card["id"]))
    assert stored is not None
    assert stored.valid_until.isoformat() == until
    after = _get(client, staff_token_headers, res["id"])
    assert after["id_valid_until"] == until
    assert after["id_validity_months"] == 12


def test_voter_proof_is_open_to_staff_and_needs_login(
    client: TestClient, street_id: int, staff_token_headers: Headers
) -> None:
    res = _resident(client, staff_token_headers, street_id, residency_type="new")
    assert client.post(f"{RES}/{res['id']}/voter-proof", json={}).status_code == 401
    assert client.post(f"{RES}/{res['id']}/voter-proof/clear").status_code == 401
