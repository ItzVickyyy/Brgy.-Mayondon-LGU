"""Issuance core: drafts, issuing, correcting, voiding, and the rules around them."""

import re
import uuid
from collections.abc import Generator
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, col, delete, select

from app.core.config import settings
from app.core.dates import add_months, today_manila
from app.models_foundation import (
    AuditLog,
    IssuancePurpose,
    Official,
    Street,
    TricycleAssociation,
)
from app.models_issuance import Issuance, Tricycle
from app.models_residents import Resident
from tests.utils.utils import random_lower_string

API = settings.API_V1_STR
ISS = f"{API}/issuances"
Headers = dict[str, str]

_CACHE: dict[str, int] = {}


@pytest.fixture(scope="module", autouse=True)
def _tidy_up(db: Session) -> Generator[None]:
    """Remove what these tests add to lists that other tests expect to be empty."""
    yield
    db.rollback()
    db.execute(delete(Issuance).where(col(Issuance.corrects_issuance_id).is_not(None)))
    db.execute(delete(Issuance))
    db.execute(delete(Tricycle))
    db.execute(delete(Resident).where(col(Resident.street_id).is_not(None)))
    db.execute(delete(Street))
    db.execute(delete(TricycleAssociation))
    db.execute(delete(Official))
    db.execute(
        delete(IssuancePurpose).where(col(IssuancePurpose.name).like("ZZ test %"))
    )
    db.commit()


@pytest.fixture(scope="module")
def street_id(db: Session) -> int:
    street = Street(name=f"Test St {random_lower_string()[:8]}")
    db.add(street)
    db.commit()
    assert street.id is not None
    return street.id


@pytest.fixture(scope="module")
def association_id(db: Session) -> int:
    assoc = TricycleAssociation(name=f"Test Assoc {random_lower_string()[:8]}")
    db.add(assoc)
    db.commit()
    assert assoc.id is not None
    return assoc.id


@pytest.fixture(scope="module")
def official_id(db: Session) -> uuid.UUID:
    official = Official(
        full_name="Test Official",
        position="Punong Barangay",
        term_start=date(2023, 1, 1),
    )
    db.add(official)
    db.commit()
    return official.id


def _lookup_id(client: TestClient, headers: Headers, path: str, **match: str) -> int:
    key = path + str(match)
    if key not in _CACHE:
        rows = client.get(f"{API}/lookups/{path}", headers=headers).json()
        row = (
            next(r for r in rows if all(r.get(k) == v for k, v in match.items()))
            if match
            else rows[0]
        )
        _CACHE[key] = row["id"]
    return _CACHE[key]


def _doc(client: TestClient, headers: Headers, code: str) -> int:
    return _lookup_id(client, headers, "document-types", code=code)


def _resident(
    client: TestClient, headers: Headers, street_id: int | None = None, **extra: object
) -> dict:
    body: dict[str, object] = {
        "first_name": f"Test{random_lower_string()[:8]}",
        "last_name": f"Last{random_lower_string()[:8]}",
        "birthdate": "1990-05-17",
        "birth_place": "Los Baños",
        "sex": "Female",
        "civil_status": "Single",
        "house_number": "12",
        "purok": 3,
    }
    if street_id is not None:
        body["street_id"] = street_id
    body.update(extra)
    r = client.post(f"{API}/residents/", headers=headers, json=body)
    assert r.status_code == 201, r.text
    return r.json()


def _ident(client: TestClient, headers: Headers) -> dict:
    return {
        "id_type_id": _lookup_id(client, headers, "id-types"),
        "id_number": "N01-23-456789",
    }


def _receipt() -> dict:
    return {"official_receipt_no": f"OR-{random_lower_string()[:10]}"}


def _clearance(
    client: TestClient, headers: Headers, resident_id: str, **extra: object
) -> dict:
    body: dict[str, object] = {
        "document_type_id": _doc(client, headers, "BARANGAY_CLEARANCE"),
        "resident_id": resident_id,
        "identification": _ident(client, headers),
        "payment": _receipt(),
    }
    body.update(extra)
    r = client.post(f"{ISS}/", headers=headers, json=body)
    assert r.status_code == 201, r.text
    return r.json()


def _issue(
    client: TestClient, headers: Headers, issuance_id: str, **body: object
) -> dict:
    r = client.post(f"{ISS}/{issuance_id}/issue", headers=headers, json=body or None)
    assert r.status_code == 200, r.text
    return r.json()


def _audit(db: Session, record_id: str) -> list[str]:
    db.rollback()
    return list(
        db.exec(
            select(AuditLog.action).where(col(AuditLog.record_id) == record_id)
        ).all()
    )


# --- Access -------------------------------------------------------------------


def test_requires_login(client: TestClient) -> None:
    assert client.get(f"{ISS}/").status_code == 401
    assert client.post(f"{ISS}/", json={}).status_code == 401


def test_unsupported_document_type_is_not_implemented(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    r = client.post(
        f"{ISS}/",
        headers=staff_token_headers,
        json={
            "document_type_id": _doc(client, staff_token_headers, "ASSISTANCE"),
            "resident_id": res["id"],
        },
    )
    assert r.status_code == 501


# --- Drafts -------------------------------------------------------------------


def test_create_clearance_draft_has_defaults(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    draft = _clearance(client, staff_token_headers, res["id"])
    assert draft["status"] == "draft"
    assert draft["reference_no"] is None
    assert draft["remarks"] == "NO DEROGATORY RECORD ON FILE"
    assert draft["issue_date"] == today_manila().isoformat()
    assert draft["resident_name"] == res["full_name"]
    assert draft["identification"]["place_of_issue"] == "Los Baños, Laguna"
    assert draft["identification"]["date_of_issue"] == today_manila().isoformat()
    assert draft["payment"]["is_free"] is False
    assert draft["snapshot"] is None


def test_update_draft_changes_only_what_is_sent(
    client: TestClient,
    staff_token_headers: Headers,
    street_id: int,
    official_id: uuid.UUID,
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    draft = _clearance(client, staff_token_headers, res["id"], remarks="First remark")
    r = client.patch(
        f"{ISS}/{draft['id']}",
        headers=staff_token_headers,
        json={"signatory_official_id": str(official_id)},
    )
    assert r.status_code == 200, r.text
    assert r.json()["remarks"] == "First remark"
    assert r.json()["signatory_official_id"] == str(official_id)
    assert (
        r.json()["payment"]["official_receipt_no"]
        == draft["payment"]["official_receipt_no"]
    )
    # Sending a section as null removes it.
    r = client.patch(
        f"{ISS}/{draft['id']}", headers=staff_token_headers, json={"payment": None}
    )
    assert r.json()["payment"] is None
    # Remarks can be cleared on purpose.
    r = client.patch(
        f"{ISS}/{draft['id']}", headers=staff_token_headers, json={"remarks": None}
    )
    assert r.json()["remarks"] is None


def test_section_for_another_document_type_is_rejected(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    draft = _clearance(client, staff_token_headers, res["id"])
    r = client.patch(
        f"{ISS}/{draft['id']}",
        headers=staff_token_headers,
        json={"indigency": {"addressed_to_office": "Some Office"}},
    )
    assert r.status_code == 422


def test_unknown_references_are_rejected(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    doc = _doc(client, staff_token_headers, "BARANGAY_CLEARANCE")
    base = {"document_type_id": doc, "resident_id": res["id"]}
    for extra in (
        {"purpose_id": 999999},
        {"signatory_official_id": str(uuid.uuid4())},
        {"identification": {"id_type_id": 999999, "id_number": "X"}},
    ):
        r = client.post(f"{ISS}/", headers=staff_token_headers, json={**base, **extra})
        assert r.status_code == 422, extra
    r = client.post(
        f"{ISS}/",
        headers=staff_token_headers,
        json={**base, "resident_id": str(uuid.uuid4())},
    )
    assert r.status_code == 422
    r = client.post(
        f"{ISS}/",
        headers=staff_token_headers,
        json={**base, "document_type_id": 999999},
    )
    assert r.status_code == 422


def test_payment_rules(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    doc = _doc(client, staff_token_headers, "BARANGAY_CLEARANCE")

    def create(payment: dict) -> int:
        return client.post(
            f"{ISS}/",
            headers=staff_token_headers,
            json={
                "document_type_id": doc,
                "resident_id": res["id"],
                "payment": payment,
            },
        ).status_code

    assert create({}) == 422  # not free, no receipt number
    assert (
        create({"official_receipt_no": "foc"}) == 422
    )  # FOC is only for free documents
    assert create({"is_free": True, "official_receipt_no": "OR-1"}) == 422
    future = (today_manila() + timedelta(days=1)).isoformat()
    assert create({"official_receipt_no": "OR-2", "date_of_payment": future}) == 422
    r = client.post(
        f"{ISS}/",
        headers=staff_token_headers,
        json={
            "document_type_id": doc,
            "resident_id": res["id"],
            "payment": {"is_free": True},
        },
    )
    assert r.status_code == 201
    assert r.json()["payment"]["official_receipt_no"] == "FOC"


def test_future_issue_date_is_rejected(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    future = (today_manila() + timedelta(days=1)).isoformat()
    r = client.post(
        f"{ISS}/",
        headers=staff_token_headers,
        json={
            "document_type_id": _doc(client, staff_token_headers, "BARANGAY_CLEARANCE"),
            "resident_id": res["id"],
            "issue_date": future,
        },
    )
    assert r.status_code == 422


def test_archived_resident_cannot_receive_documents(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    draft = _clearance(client, staff_token_headers, res["id"])
    r = client.post(
        f"{API}/residents/{res['id']}/archive",
        headers=superuser_token_headers,
        json={"reason": "Moved away"},
    )
    assert r.status_code == 200, r.text
    r = client.post(
        f"{ISS}/",
        headers=staff_token_headers,
        json={
            "document_type_id": _doc(client, staff_token_headers, "BARANGAY_CLEARANCE"),
            "resident_id": res["id"],
        },
    )
    assert r.status_code == 409
    assert (
        client.post(
            f"{ISS}/{draft['id']}/issue", headers=staff_token_headers
        ).status_code
        == 409
    )


def test_discard_draft(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    draft = _clearance(client, staff_token_headers, res["id"])
    assert (
        client.delete(f"{ISS}/{draft['id']}", headers=staff_token_headers).status_code
        == 204
    )
    assert (
        client.get(f"{ISS}/{draft['id']}", headers=staff_token_headers).status_code
        == 404
    )
    assert (
        client.delete(f"{ISS}/{draft['id']}", headers=staff_token_headers).status_code
        == 404
    )


# --- Issuing ------------------------------------------------------------------


def test_issue_clearance(
    client: TestClient, staff_token_headers: Headers, street_id: int, db: Session
) -> None:
    res = _resident(
        client, staff_token_headers, street_id, middle_name="Mid", suffix="Jr."
    )
    draft = _clearance(client, staff_token_headers, res["id"])
    issued = _issue(client, staff_token_headers, draft["id"])
    assert issued["id"] == draft["id"]
    assert issued["status"] == "issued"
    assert re.fullmatch(rf"ISS-{today_manila().year}-\d{{6}}", issued["reference_no"])
    assert issued["issued_by_user_id"] is not None
    assert issued["issued_at"] is not None
    assert (
        issued["expires_on"]
        == add_months(date.fromisoformat(issued["issue_date"]), 2).isoformat()
    )
    snap = issued["snapshot"]
    assert snap["full_name"] == res["full_name"]
    assert snap["address_line"] == "12 " + db.get(Street, street_id).name + ", Purok 3"  # type: ignore[union-attr]
    assert snap["birth_date"] == "1990-05-17"
    assert snap["civil_status"] == "Single"
    assert "issuance.issue" in _audit(db, draft["id"])


def test_snapshot_survives_later_resident_edit(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    issued = _issue(
        client,
        staff_token_headers,
        _clearance(client, staff_token_headers, res["id"])["id"],
    )
    r = client.patch(
        f"{API}/residents/{res['id']}",
        headers=staff_token_headers,
        json={"last_name": "Changed"},
    )
    assert r.status_code == 200
    again = client.get(f"{ISS}/{issued['id']}", headers=staff_token_headers).json()
    assert again["snapshot"]["full_name"] == res["full_name"]
    assert again["resident_name"].endswith(
        "Changed"
    )  # the live name; the snapshot is the printed one


def test_reference_numbers_are_unique_and_increase(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    refs = [
        _issue(
            client,
            staff_token_headers,
            _clearance(client, staff_token_headers, res["id"])["id"],
        )["reference_no"]
        for _ in range(3)
    ]
    numbers = [int(r.rsplit("-", 1)[1]) for r in refs]
    assert numbers == sorted(numbers)
    assert len(set(refs)) == 3


def test_issue_reports_missing_sections(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    r = client.post(
        f"{ISS}/",
        headers=staff_token_headers,
        json={
            "document_type_id": _doc(client, staff_token_headers, "BARANGAY_CLEARANCE"),
            "resident_id": res["id"],
        },
    )
    r = client.post(f"{ISS}/{r.json()['id']}/issue", headers=staff_token_headers)
    assert r.status_code == 422
    assert r.json()["detail"] == {
        "code": "missing_sections",
        "sections": ["identification", "payment"],
    }


def test_issue_reports_missing_resident_fields(
    client: TestClient, staff_token_headers: Headers
) -> None:
    res = _resident(client, staff_token_headers, birth_place=None, civil_status=None)
    draft = _clearance(client, staff_token_headers, res["id"])
    r = client.post(f"{ISS}/{draft['id']}/issue", headers=staff_token_headers)
    assert r.status_code == 422
    detail = r.json()["detail"]
    assert detail["code"] == "missing_resident_fields"
    assert set(detail["fields"]) == {"birth_place", "civil_status", "street_id"}
    # Fill the record and the same draft can be issued.
    street = client.post(
        f"{API}/lookups/streets",
        headers=_admin(client),
        json={"name": f"Fix St {random_lower_string()[:6]}"},
    ).json()
    client.patch(
        f"{API}/residents/{res['id']}",
        headers=staff_token_headers,
        json={
            "birth_place": "Calamba",
            "civil_status": "Single",
            "street_id": street["id"],
        },
    )
    assert (
        client.post(
            f"{ISS}/{draft['id']}/issue", headers=staff_token_headers
        ).status_code
        == 200
    )


def _admin(client: TestClient) -> Headers:
    from tests.utils.utils import get_superuser_token_headers

    return get_superuser_token_headers(client)


def test_issued_document_cannot_be_edited_issued_again_or_discarded(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    issued = _issue(
        client,
        staff_token_headers,
        _clearance(client, staff_token_headers, res["id"])["id"],
    )
    url = f"{ISS}/{issued['id']}"
    assert (
        client.patch(
            url, headers=staff_token_headers, json={"remarks": "x"}
        ).status_code
        == 409
    )
    assert client.post(f"{url}/issue", headers=staff_token_headers).status_code == 409
    assert client.delete(url, headers=staff_token_headers).status_code == 409


def test_same_receipt_number_cannot_be_issued_twice(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    receipt = _receipt()
    _issue(
        client,
        staff_token_headers,
        _clearance(client, staff_token_headers, res["id"], payment=receipt)["id"],
    )
    second = _clearance(client, staff_token_headers, res["id"], payment=receipt)
    r = client.post(f"{ISS}/{second['id']}/issue", headers=staff_token_headers)
    assert r.status_code == 409


def test_free_documents_share_the_foc_receipt(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    for _ in range(2):
        draft = _clearance(
            client, staff_token_headers, res["id"], payment={"is_free": True}
        )
        assert (
            _issue(client, staff_token_headers, draft["id"])["payment"][
                "official_receipt_no"
            ]
            == "FOC"
        )


def test_new_purpose_is_remembered_only_when_issued(
    client: TestClient, staff_token_headers: Headers, street_id: int, db: Session
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    name = f"ZZ test {random_lower_string()[:8]}"
    draft = _clearance(client, staff_token_headers, res["id"])
    db.rollback()
    assert (
        db.exec(select(IssuancePurpose).where(IssuancePurpose.name == name)).first()
        is None
    )
    issued = _issue(
        client, staff_token_headers, draft["id"], purpose_name=f"  {name.upper()}  "
    )
    db.rollback()
    row = db.exec(
        select(IssuancePurpose).where(IssuancePurpose.name == name.upper())
    ).first()
    assert row is not None and issued["purpose_id"] == row.id
    # The same words in another case reuse the row instead of adding one.
    again = _issue(
        client,
        staff_token_headers,
        _clearance(client, staff_token_headers, res["id"])["id"],
        purpose_name=name.upper().lower(),
    )
    assert again["purpose_id"] == row.id
    db.execute(delete(Issuance).where(col(Issuance.purpose_id) == row.id))
    db.execute(delete(IssuancePurpose).where(col(IssuancePurpose.id) == row.id))
    db.commit()


# --- Corrections and voiding --------------------------------------------------


def test_correction_flow(
    client: TestClient, staff_token_headers: Headers, street_id: int, db: Session
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    original = _issue(
        client,
        staff_token_headers,
        _clearance(client, staff_token_headers, res["id"])["id"],
    )
    url = f"{ISS}/{original['id']}/correct"
    assert (
        client.post(url, headers=staff_token_headers, json={}).status_code == 422
    )  # reason needed
    r = client.post(
        url, headers=staff_token_headers, json={"reason": "Typo in the ID number"}
    )
    assert r.status_code == 201, r.text
    draft = r.json()
    assert draft["status"] == "draft"
    assert draft["corrects_issuance_id"] == original["id"]
    assert draft["correction_reason"] == "Typo in the ID number"
    assert (
        draft["identification"]["id_number"] == original["identification"]["id_number"]
    )
    # One correction at a time.
    again = client.post(url, headers=staff_token_headers, json={"reason": "Another"})
    assert again.status_code == 409
    assert again.json()["detail"]["draft_id"] == draft["id"]
    # The corrected draft keeps the same receipt and can be issued.
    client.patch(
        f"{ISS}/{draft['id']}",
        headers=staff_token_headers,
        json={
            "identification": {
                **_ident(client, staff_token_headers),
                "id_number": "FIXED-1",
            }
        },
    )
    fixed = _issue(client, staff_token_headers, draft["id"])
    assert fixed["identification"]["id_number"] == "FIXED-1"
    assert fixed["reference_no"] != original["reference_no"]
    # The original is untouched.
    untouched = client.get(
        f"{ISS}/{original['id']}", headers=staff_token_headers
    ).json()
    assert untouched["status"] == "issued"
    assert (
        untouched["identification"]["id_number"]
        == original["identification"]["id_number"]
    )
    assert "issuance.correct" in _audit(db, original["id"])


def test_only_an_issued_document_can_be_corrected(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    draft = _clearance(client, staff_token_headers, res["id"])
    r = client.post(
        f"{ISS}/{draft['id']}/correct",
        headers=staff_token_headers,
        json={"reason": "Not valid"},
    )
    assert r.status_code == 409


def test_void_needs_admin_and_a_reason(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
    db: Session,
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    receipt = _receipt()
    issued = _issue(
        client,
        staff_token_headers,
        _clearance(client, staff_token_headers, res["id"], payment=receipt)["id"],
    )
    url = f"{ISS}/{issued['id']}/void"
    assert (
        client.post(
            url, headers=staff_token_headers, json={"reason": "Mistake"}
        ).status_code
        == 403
    )
    assert client.post(url, headers=superuser_token_headers, json={}).status_code == 422
    r = client.post(
        url, headers=superuser_token_headers, json={"reason": "Issued by mistake"}
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "voided"
    assert r.json()["void_reason"] == "Issued by mistake"
    assert (
        client.post(
            url, headers=superuser_token_headers, json={"reason": "Again"}
        ).status_code
        == 409
    )
    assert "issuance.void" in _audit(db, issued["id"])
    # A voided document cannot be edited, corrected or discarded, and frees its receipt number.
    assert (
        client.patch(
            f"{ISS}/{issued['id']}", headers=staff_token_headers, json={"remarks": "x"}
        ).status_code
        == 409
    )
    assert (
        client.delete(f"{ISS}/{issued['id']}", headers=staff_token_headers).status_code
        == 409
    )
    assert (
        client.post(
            f"{ISS}/{issued['id']}/correct",
            headers=staff_token_headers,
            json={"reason": "Not valid"},
        ).status_code
        == 409
    )
    reuse = _clearance(client, staff_token_headers, res["id"], payment=receipt)
    assert (
        client.post(
            f"{ISS}/{reuse['id']}/issue", headers=staff_token_headers
        ).status_code
        == 200
    )


def test_void_a_draft_is_refused(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    draft = _clearance(client, staff_token_headers, res["id"])
    r = client.post(
        f"{ISS}/{draft['id']}/void",
        headers=superuser_token_headers,
        json={"reason": "Nope"},
    )
    assert r.status_code == 409


# --- Other document types -----------------------------------------------------


def _franchise(association_id: int, **extra: object) -> dict:
    suffix = random_lower_string()[:6].upper()
    body: dict[str, object] = {
        "association_id": association_id,
        "make": "Honda",
        "body_type": "Sidecar",
        "motor_number": f"MTR{suffix}",
        "color": "Blue",
        "plate_number": f"PLT{suffix}",
    }
    body.update(extra)
    return body


def _franchise_draft(
    client: TestClient, headers: Headers, resident_id: str, franchise: dict
) -> dict:
    r = client.post(
        f"{ISS}/",
        headers=headers,
        json={
            "document_type_id": _doc(client, headers, "FRANCHISE_CLEARANCE"),
            "resident_id": resident_id,
            "identification": _ident(client, headers),
            "payment": _receipt(),
            "franchise": franchise,
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


def test_franchise_stores_and_reuses_the_tricycle(
    client: TestClient,
    staff_token_headers: Headers,
    street_id: int,
    association_id: int,
    db: Session,
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    data = _franchise(association_id)
    first = _issue(
        client,
        staff_token_headers,
        _franchise_draft(client, staff_token_headers, res["id"], data)["id"],
    )
    assert first["franchise"]["plate_number"] == data["plate_number"]
    # Same tricycle (even typed in lower case) is reused, not stored twice.
    again = _franchise_draft(
        client,
        staff_token_headers,
        res["id"],
        {**data, "plate_number": str(data["plate_number"]).lower(), "color": "BLUE"},
    )
    assert again["franchise"]["tricycle_id"] == first["franchise"]["tricycle_id"]
    db.rollback()
    assert (
        db.exec(select(Tricycle).where(Tricycle.plate_number == data["plate_number"]))
        .all()
        .__len__()
        == 1
    )


def test_franchise_with_different_details_for_a_known_tricycle_is_refused(
    client: TestClient,
    staff_token_headers: Headers,
    street_id: int,
    association_id: int,
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    data = _franchise(association_id)
    issued = _issue(
        client,
        staff_token_headers,
        _franchise_draft(client, staff_token_headers, res["id"], data)["id"],
    )
    assert issued["franchise"]["color"] == "Blue"
    r = client.post(
        f"{ISS}/",
        headers=staff_token_headers,
        json={
            "document_type_id": _doc(
                client, staff_token_headers, "FRANCHISE_CLEARANCE"
            ),
            "resident_id": res["id"],
            "franchise": {**data, "color": "Red"},
        },
    )
    assert r.status_code == 409
    assert r.json()["detail"]["code"] == "tricycle_mismatch"


def test_plate_and_motor_of_different_tricycles_conflict(
    client: TestClient,
    staff_token_headers: Headers,
    street_id: int,
    association_id: int,
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    one, two = _franchise(association_id), _franchise(association_id)
    _franchise_draft(client, staff_token_headers, res["id"], one)
    _franchise_draft(client, staff_token_headers, res["id"], two)
    r = client.post(
        f"{ISS}/",
        headers=staff_token_headers,
        json={
            "document_type_id": _doc(
                client, staff_token_headers, "FRANCHISE_CLEARANCE"
            ),
            "resident_id": res["id"],
            "franchise": {**one, "motor_number": two["motor_number"]},
        },
    )
    assert r.status_code == 409
    assert r.json()["detail"]["code"] == "tricycle_conflict"


def test_draft_franchise_typo_can_be_fixed_before_issue(
    client: TestClient,
    staff_token_headers: Headers,
    street_id: int,
    association_id: int,
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    data = _franchise(association_id)
    draft = _franchise_draft(client, staff_token_headers, res["id"], data)
    r = client.patch(
        f"{ISS}/{draft['id']}",
        headers=staff_token_headers,
        json={"franchise": {**data, "color": "Green"}},
    )
    assert r.status_code == 200, r.text
    assert r.json()["franchise"]["color"] == "Green"
    assert r.json()["franchise"]["tricycle_id"] == draft["franchise"]["tricycle_id"]


def test_franchise_needs_a_known_association(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    r = client.post(
        f"{ISS}/",
        headers=staff_token_headers,
        json={
            "document_type_id": _doc(
                client, staff_token_headers, "FRANCHISE_CLEARANCE"
            ),
            "resident_id": res["id"],
            "franchise": _franchise(999999),
        },
    )
    assert r.status_code == 422


def test_utility_clearance(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    doc = _doc(client, staff_token_headers, "UTILITY_CLEARANCE")
    base = {
        "document_type_id": doc,
        "resident_id": res["id"],
        "identification": _ident(client, staff_token_headers),
        "payment": _receipt(),
    }
    utility = {
        "has_electric": True,
        "connection_type": "new",
        "classification": "residential",
        "location": "Purok 3",
    }
    for bad in (
        {**utility, "has_electric": False},  # no service chosen
        {**utility, "connection_type": "transfer"},
        {**utility, "classification": "industrial"},
        {**utility, "location": "  "},
    ):
        r = client.post(
            f"{ISS}/", headers=staff_token_headers, json={**base, "utility": bad}
        )
        assert r.status_code == 422, bad
    draft = client.post(
        f"{ISS}/", headers=staff_token_headers, json={**base, "utility": utility}
    ).json()
    issued = _issue(client, staff_token_headers, draft["id"])
    assert issued["utility"]["has_electric"] is True
    assert issued["utility"]["has_water"] is False
    assert issued["expires_on"] is None  # only Barangay Clearance has a validity rule


def test_indigency(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    doc = _doc(client, staff_token_headers, "INDIGENCY")
    sector_rows = client.get(
        f"{API}/lookups/sectors", headers=staff_token_headers
    ).json()
    s1, s2, s3 = (s["id"] for s in sector_rows[:3])
    base = {"document_type_id": doc, "resident_id": res["id"]}
    office = {
        "addressed_to_office": "Municipal Social Welfare Office",
        "requested_by": "  ",
    }

    for bad in ([{"sector_id": s1}, {"sector_id": s1}], [{"sector_id": 999999}]):
        r = client.post(
            f"{ISS}/", headers=staff_token_headers, json={**base, "sectors": bad}
        )
        assert r.status_code == 422
    too_many = [{"sector_id": s} for s in (s1, s2, s3)]
    assert (
        client.post(
            f"{ISS}/", headers=staff_token_headers, json={**base, "sectors": too_many}
        ).status_code
        == 422
    )

    draft = client.post(
        f"{ISS}/", headers=staff_token_headers, json={**base, "indigency": office}
    ).json()
    assert draft["indigency"]["requested_by"] is None
    assert draft["remarks"] is None  # the default remark is for clearances only
    r = client.post(f"{ISS}/{draft['id']}/issue", headers=staff_token_headers)
    assert r.status_code == 422
    assert r.json()["detail"]["sections"] == ["sectors"]
    client.patch(
        f"{ISS}/{draft['id']}",
        headers=staff_token_headers,
        json={
            "sectors": [{"sector_id": s1}, {"sector_id": s2, "sector_id_number": "S-1"}]
        },
    )
    issued = _issue(client, staff_token_headers, draft["id"])
    assert [s["sector_id"] for s in issued["sectors"]] == sorted([s1, s2])
    assert issued["expires_on"] is None  # no approved validity rule for indigency


# --- Listing ------------------------------------------------------------------


def test_list_filters(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    draft = _clearance(client, staff_token_headers, res["id"])
    issued = _issue(
        client,
        staff_token_headers,
        _clearance(client, staff_token_headers, res["id"])["id"],
    )

    def ids(**params: object) -> set[str]:
        r = client.get(f"{ISS}/", headers=staff_token_headers, params=params)
        assert r.status_code == 200, r.text
        assert r.json()["count"] >= len(r.json()["data"])
        return {row["id"] for row in r.json()["data"]}

    assert ids(resident_id=res["id"]) == {draft["id"], issued["id"]}
    assert ids(resident_id=res["id"], status="draft") == {draft["id"]}
    assert ids(resident_id=res["id"], status="issued") == {issued["id"]}
    assert ids(q=issued["reference_no"]) == {issued["id"]}
    assert ids(q=res["first_name"], status="issued") == {issued["id"]}
    assert (
        ids(
            resident_id=res["id"],
            document_type_id=_doc(client, staff_token_headers, "INDIGENCY"),
        )
        == set()
    )
    row = client.get(
        f"{ISS}/", headers=staff_token_headers, params={"q": issued["reference_no"]}
    ).json()["data"][0]
    assert row["document_type_code"] == "BARANGAY_CLEARANCE"
    assert "identification" not in row  # lists carry no detail sections


def test_get_unknown_issuance_is_404(
    client: TestClient, staff_token_headers: Headers
) -> None:
    assert (
        client.get(f"{ISS}/{uuid.uuid4()}", headers=staff_token_headers).status_code
        == 404
    )


# --- Accounts that issued documents -------------------------------------------


def test_account_that_issued_documents_cannot_be_deleted(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    _issue(
        client,
        staff_token_headers,
        _clearance(client, staff_token_headers, res["id"])["id"],
    )
    me = client.get(f"{API}/users/me", headers=staff_token_headers).json()
    r = client.delete(f"{API}/users/{me['id']}", headers=superuser_token_headers)
    assert r.status_code == 409
    assert "Deactivate" in r.json()["detail"]
    assert (
        client.delete(f"{API}/users/me", headers=staff_token_headers).status_code == 409
    )
    # Deactivating is the supported way out.
    r = client.patch(
        f"{API}/users/{me['id']}",
        headers=superuser_token_headers,
        json={"is_active": False},
    )
    assert r.status_code == 200, r.text
    assert client.get(f"{ISS}/", headers=staff_token_headers).status_code in (
        400,
        401,
        403,
    )


def test_account_with_only_drafts_can_still_be_deleted(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    _clearance(client, staff_token_headers, res["id"])
    me = client.get(f"{API}/users/me", headers=staff_token_headers).json()
    r = client.delete(f"{API}/users/{me['id']}", headers=superuser_token_headers)
    assert r.status_code == 200, r.text


# --- Units --------------------------------------------------------------------


@pytest.mark.parametrize(
    ("start", "months", "expected"),
    [
        (date(2026, 11, 6), 2, date(2027, 1, 6)),
        (date(2026, 12, 31), 2, date(2027, 2, 28)),
        (date(2027, 12, 31), 2, date(2028, 2, 29)),
        (date(2026, 1, 31), 1, date(2026, 2, 28)),
        (date(2026, 3, 15), 12, date(2027, 3, 15)),
    ],
)
def test_add_months(start: date, months: int, expected: date) -> None:
    assert add_months(start, months) == expected
