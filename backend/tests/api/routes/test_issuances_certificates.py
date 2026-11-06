# ruff: noqa: F811  (fixtures imported from test_issuances are used as parameters)
"""Residency, Assistance, Marginalized Sector and First-Time Jobseeker issuance."""

import json
from datetime import date

from fastapi.testclient import TestClient
from sqlmodel import Session, col, select

from app.core.config import settings
from app.core.dates import add_months
from app.models_foundation import AuditLog
from tests.api.routes.test_issuances import (  # noqa: F401  (fixtures are reused)
    _doc,
    _ident,
    _issue,
    _receipt,
    _resident,
    _tidy_up,
    official_id,
    street_id,
)

API = settings.API_V1_STR
ISS = f"{API}/issuances"
Headers = dict[str, str]

SECRET = "Test condition xyzzy-4471"


def _sector_ids(client: TestClient, headers: Headers) -> list[int]:
    rows = client.get(f"{API}/lookups/sectors", headers=headers).json()
    return [r["id"] for r in rows]


def _draft(
    client: TestClient,
    headers: Headers,
    code: str,
    resident_id: str,
    expect: int = 201,
    **extra: object,
) -> dict:
    r = client.post(
        f"{ISS}/",
        headers=headers,
        json={
            "document_type_id": _doc(client, headers, code),
            "resident_id": resident_id,
            **extra,
        },
    )
    assert r.status_code == expect, r.text
    return r.json()


def _issue_status(
    client: TestClient, headers: Headers, issuance_id: str
) -> tuple[int, dict]:
    r = client.post(f"{ISS}/{issuance_id}/issue", headers=headers)
    return r.status_code, r.json()


def _view_audit_rows(db: Session, issuance_id: str) -> list[AuditLog]:
    db.rollback()
    return list(
        db.exec(
            select(AuditLog).where(
                col(AuditLog.record_id) == issuance_id,
                col(AuditLog.action) == "issuance.view_sensitive",
            )
        ).all()
    )


# --- Residency ----------------------------------------------------------------


def test_residency_needs_no_sections_but_needs_residing_since(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    without = _resident(client, staff_token_headers, street_id)
    draft = _draft(client, staff_token_headers, "RESIDENCY", without["id"])
    code, body = _issue_status(client, staff_token_headers, draft["id"])
    assert code == 422
    assert body["detail"] == {
        "code": "missing_resident_fields",
        "fields": ["resident_since"],
    }
    # Either the year or "since birth" satisfies the rule.
    for extra in ({"resident_since_year": 2001}, {"resident_since_birth": True}):
        res = _resident(client, staff_token_headers, street_id, **extra)
        draft = _draft(client, staff_token_headers, "RESIDENCY", res["id"])
        issued = _issue(client, staff_token_headers, draft["id"])
        assert issued["status"] == "issued"
        assert issued["expires_on"] is None
        assert issued["snapshot"]["resident_since_year"] == extra.get(
            "resident_since_year"
        )


def test_residency_accepts_optional_identification_and_payment_only(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    res = _resident(client, staff_token_headers, street_id, resident_since_year=1999)
    draft = _draft(
        client,
        staff_token_headers,
        "RESIDENCY",
        res["id"],
        identification=_ident(client, staff_token_headers),
        payment=_receipt(),
    )
    assert draft["identification"] is not None and draft["payment"] is not None
    assert _issue(client, staff_token_headers, draft["id"])["status"] == "issued"
    for bad in (
        {"indigency": {"addressed_to_office": "Some Office"}},
        {"sectors": [{"sector_id": _sector_ids(client, staff_token_headers)[0]}]},
        {"jobseeker": {"educational_attainment": "College"}},
    ):
        _draft(client, staff_token_headers, "RESIDENCY", res["id"], expect=422, **bad)


# --- Assistance ---------------------------------------------------------------


def test_assistance_beneficiary_rules(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    res = _resident(client, staff_token_headers, street_id, resident_since_year=2005)
    sector = _sector_ids(client, staff_token_headers)[0]
    base = {"sectors": [{"sector_id": sector}]}

    def create(assistance: dict, expect: int = 201) -> dict:
        return _draft(
            client,
            staff_token_headers,
            "ASSISTANCE",
            res["id"],
            expect,
            assistance=assistance,
            **base,
        )

    create({"assistance_type": "cash"}, 422)
    create({"assistance_type": "medical", "for_self": False}, 422)
    create(
        {"assistance_type": "medical", "for_self": False, "beneficiary_name": "A B"},
        422,
    )
    other = create(
        {
            "assistance_type": "burial",
            "for_self": False,
            "beneficiary_name": "Test Beneficiary",
            "beneficiary_relationship": "Mother",
        }
    )
    assert other["assistance"]["beneficiary_name"] == "Test Beneficiary"
    # "For myself" clears any beneficiary left in the form.
    mine = create(
        {
            "assistance_type": "financial",
            "for_self": True,
            "beneficiary_name": "Leftover",
            "beneficiary_relationship": "Leftover",
        }
    )
    assert mine["assistance"]["beneficiary_name"] is None
    assert mine["assistance"]["beneficiary_relationship"] is None
    assert (
        _issue(client, staff_token_headers, mine["id"])["assistance"]["for_self"]
        is True
    )


def test_assistance_needs_exactly_one_sector_and_residing_since(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    s1, s2 = _sector_ids(client, staff_token_headers)[:2]
    assistance = {"assistance_type": "medical"}
    _draft(
        client,
        staff_token_headers,
        "ASSISTANCE",
        res["id"],
        expect=422,
        assistance=assistance,
        sectors=[{"sector_id": s1}, {"sector_id": s2}],
    )
    draft = _draft(
        client, staff_token_headers, "ASSISTANCE", res["id"], assistance=assistance
    )
    code, body = _issue_status(client, staff_token_headers, draft["id"])
    assert code == 422 and body["detail"]["sections"] == ["sectors"]
    client.patch(
        f"{ISS}/{draft['id']}",
        headers=staff_token_headers,
        json={"sectors": [{"sector_id": s1}]},
    )
    code, body = _issue_status(client, staff_token_headers, draft["id"])
    assert code == 422 and body["detail"]["fields"] == ["resident_since"]
    client.patch(
        f"{API}/residents/{res['id']}",
        headers=staff_token_headers,
        json={"resident_since_year": 2010},
    )
    assert _issue(client, staff_token_headers, draft["id"])["status"] == "issued"


# --- Marginalized sector and the health condition ------------------------------


def _marginalized(
    client: TestClient, headers: Headers, resident_id: str, **extra: object
) -> dict:
    sector = _sector_ids(client, headers)[0]
    return _draft(
        client,
        headers,
        "MARGINALIZED_SECTOR",
        resident_id,
        marginalized={"health_condition": SECRET},
        sectors=[{"sector_id": sector, "sector_id_number": "PWD-0001"}],
        **extra,
    )


def test_health_condition_is_masked_in_every_response_but_the_single_read(
    client: TestClient, staff_token_headers: Headers, street_id: int, db: Session
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    created = _marginalized(client, staff_token_headers, res["id"])
    assert created["marginalized"] == {"health_condition": "[restricted]"}
    assert created["sectors"][0]["sector_id_number"] == "PWD-0001"
    assert SECRET not in json.dumps(created)

    patched = client.patch(
        f"{ISS}/{created['id']}", headers=staff_token_headers, json={"remarks": "x"}
    )
    assert SECRET not in patched.text

    listing = client.get(
        f"{ISS}/", headers=staff_token_headers, params={"resident_id": res["id"]}
    )
    assert SECRET not in listing.text
    assert "marginalized" not in listing.json()["data"][0]

    issued = _issue(client, staff_token_headers, created["id"])
    assert SECRET not in json.dumps(issued)
    assert issued["marginalized"]["health_condition"] == "[restricted]"

    # Only the single read returns the value, and each read is audited.
    assert _view_audit_rows(db, created["id"]) == []
    for expected_rows in (1, 2):
        single = client.get(f"{ISS}/{created['id']}", headers=staff_token_headers)
        assert single.status_code == 200
        assert single.json()["marginalized"]["health_condition"] == SECRET
        assert len(_view_audit_rows(db, created["id"])) == expected_rows


def test_audit_log_never_holds_the_health_condition(
    client: TestClient, staff_token_headers: Headers, street_id: int, db: Session
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    draft = _marginalized(client, staff_token_headers, res["id"])
    _issue(client, staff_token_headers, draft["id"])
    client.get(f"{ISS}/{draft['id']}", headers=staff_token_headers)
    client.post(
        f"{ISS}/{draft['id']}/correct",
        headers=staff_token_headers,
        json={"reason": "Fix wording"},
    )
    db.rollback()
    rows = db.exec(select(AuditLog).where(col(AuditLog.record_id) == draft["id"])).all()
    assert {r.action for r in rows} >= {
        "issuance.issue",
        "issuance.view_sensitive",
        "issuance.correct",
    }
    for row in rows:
        assert SECRET not in json.dumps(row.details) + (row.reason or "")
    view = next(r for r in rows if r.action == "issuance.view_sensitive")
    assert view.details == {"field": "health_condition"}


def test_reading_a_document_without_the_condition_writes_no_sensitive_audit(
    client: TestClient, staff_token_headers: Headers, street_id: int, db: Session
) -> None:
    res = _resident(client, staff_token_headers, street_id, resident_since_year=2000)
    draft = _draft(client, staff_token_headers, "RESIDENCY", res["id"])
    assert (
        client.get(f"{ISS}/{draft['id']}", headers=staff_token_headers).status_code
        == 200
    )
    assert _view_audit_rows(db, draft["id"]) == []


def test_admin_can_read_the_condition_and_it_is_audited(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
    db: Session,
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    draft = _marginalized(client, staff_token_headers, res["id"])
    r = client.get(f"{ISS}/{draft['id']}", headers=superuser_token_headers)
    assert r.json()["marginalized"]["health_condition"] == SECRET
    rows = _view_audit_rows(db, draft["id"])
    assert len(rows) == 1 and rows[0].actor_email == settings.FIRST_SUPERUSER


def test_marginalized_rules(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    s1, s2 = _sector_ids(client, staff_token_headers)[:2]
    # An empty condition and two sectors are both rejected.
    _draft(
        client,
        staff_token_headers,
        "MARGINALIZED_SECTOR",
        res["id"],
        expect=422,
        marginalized={"health_condition": "   "},
        sectors=[{"sector_id": s1}],
    )
    _draft(
        client,
        staff_token_headers,
        "MARGINALIZED_SECTOR",
        res["id"],
        expect=422,
        marginalized={"health_condition": SECRET},
        sectors=[{"sector_id": s1}, {"sector_id": s2}],
    )
    draft = _draft(client, staff_token_headers, "MARGINALIZED_SECTOR", res["id"])
    code, body = _issue_status(client, staff_token_headers, draft["id"])
    assert code == 422 and body["detail"]["sections"] == ["marginalized", "sectors"]


def test_correction_copies_the_condition_without_exposing_it(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    original = _issue(
        client,
        staff_token_headers,
        _marginalized(client, staff_token_headers, res["id"])["id"],
    )
    r = client.post(
        f"{ISS}/{original['id']}/correct",
        headers=staff_token_headers,
        json={"reason": "Typo fix"},
    )
    assert r.status_code == 201
    assert SECRET not in r.text
    draft = r.json()
    assert draft["marginalized"]["health_condition"] == "[restricted]"
    assert draft["sectors"][0]["sector_id_number"] == "PWD-0001"
    single = client.get(f"{ISS}/{draft['id']}", headers=staff_token_headers).json()
    assert single["marginalized"]["health_condition"] == SECRET


def test_unauthenticated_cannot_read_a_document(client: TestClient) -> None:
    assert client.get(f"{ISS}/00000000-0000-0000-0000-000000000000").status_code == 401


# --- First-Time Jobseeker ------------------------------------------------------


def _jobseeker_resident(client: TestClient, headers: Headers, street_id: int) -> dict:
    return _resident(client, headers, street_id, resident_since_birth=True)


def test_jobseeker_defaults_witness_and_expiry(
    client: TestClient,
    staff_token_headers: Headers,
    street_id: int,
    official_id,  # noqa: ANN001
) -> None:
    res = _jobseeker_resident(client, staff_token_headers, street_id)
    _draft(
        client,
        staff_token_headers,
        "FIRST_TIME_JOBSEEKER",
        res["id"],
        expect=422,
        jobseeker={
            "educational_attainment": "College",
            "witness_official_id": "00000000-0000-0000-0000-000000000000",
        },
    )
    draft = _draft(
        client,
        staff_token_headers,
        "FIRST_TIME_JOBSEEKER",
        res["id"],
        jobseeker={"educational_attainment": "  College Graduate "},
    )
    assert draft["jobseeker"]["educational_attainment"] == "College Graduate"
    assert draft["jobseeker"]["course"] == "N/A"
    assert draft["jobseeker"]["is_jobstart_beneficiary"] is False
    r = client.patch(
        f"{ISS}/{draft['id']}",
        headers=staff_token_headers,
        json={
            "jobseeker": {
                "educational_attainment": "College Graduate",
                "course": "BS Biology",
                "is_jobstart_beneficiary": True,
                "witness_official_id": str(official_id),
            }
        },
    )
    assert r.status_code == 200, r.text
    issued = _issue(client, staff_token_headers, draft["id"])
    assert issued["jobseeker"]["witness_official_id"] == str(official_id)
    assert (
        issued["expires_on"]
        == add_months(date.fromisoformat(issued["issue_date"]), 12).isoformat()
    )


def test_jobseeker_needs_birth_sex_civil_status_and_residing_since(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    res = _resident(
        client,
        staff_token_headers,
        street_id,
        sex=None,
        civil_status=None,
        birthdate=None,
    )
    draft = _draft(
        client,
        staff_token_headers,
        "FIRST_TIME_JOBSEEKER",
        res["id"],
        jobseeker={"educational_attainment": "Senior High"},
    )
    code, body = _issue_status(client, staff_token_headers, draft["id"])
    assert code == 422
    assert set(body["detail"]["fields"]) == {
        "birthdate",
        "civil_status",
        "sex",
        "resident_since",
    }


def test_only_one_issued_jobseeker_certificate_per_resident(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    res = _jobseeker_resident(client, staff_token_headers, street_id)
    job = {"educational_attainment": "College"}
    first = _draft(
        client, staff_token_headers, "FIRST_TIME_JOBSEEKER", res["id"], jobseeker=job
    )
    second = _draft(
        client, staff_token_headers, "FIRST_TIME_JOBSEEKER", res["id"], jobseeker=job
    )
    _issue(client, staff_token_headers, first["id"])
    code, _ = _issue_status(client, staff_token_headers, second["id"])
    assert code == 409
    # Another resident is unaffected.
    other = _jobseeker_resident(client, staff_token_headers, street_id)
    mine = _draft(
        client, staff_token_headers, "FIRST_TIME_JOBSEEKER", other["id"], jobseeker=job
    )
    assert _issue_status(client, staff_token_headers, mine["id"])[0] == 200
    # Voiding the first frees the slot.
    r = client.post(
        f"{ISS}/{first['id']}/void",
        headers=superuser_token_headers,
        json={"reason": "Wrong person"},
    )
    assert r.status_code == 200
    assert _issue_status(client, staff_token_headers, second["id"])[0] == 200


def test_correcting_a_jobseeker_certificate_is_not_blocked_by_the_original(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    res = _jobseeker_resident(client, staff_token_headers, street_id)
    original = _issue(
        client,
        staff_token_headers,
        _draft(
            client,
            staff_token_headers,
            "FIRST_TIME_JOBSEEKER",
            res["id"],
            jobseeker={"educational_attainment": "College"},
        )["id"],
    )
    r = client.post(
        f"{ISS}/{original['id']}/correct",
        headers=staff_token_headers,
        json={"reason": "Course typo"},
    )
    assert r.status_code == 201
    assert r.json()["jobseeker"]["educational_attainment"] == "College"
    assert _issue_status(client, staff_token_headers, r.json()["id"])[0] == 200
