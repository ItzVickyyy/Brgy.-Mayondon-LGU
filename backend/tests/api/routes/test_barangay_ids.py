# ruff: noqa: F811  (fixtures imported from test_issuances are used as parameters)
"""Barangay ID issuance (new, renewal, replacement) and the ID list."""

from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.core.dates import today_manila
from app.core.permissions import has_permission as real_has_permission
from tests.api.routes.test_issuances import (  # noqa: F401  (fixtures are reused)
    _audit,
    _doc,
    _issue,
    _resident,
    _tidy_up,
    street_id,
)
from tests.utils.utils import random_lower_string

API = settings.API_V1_STR
ISS = f"{API}/issuances"
IDS = f"{API}/barangay-ids"
Headers = dict[str, str]

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 100
EMERGENCY = {
    "emergency_contact_name": "Test Contact",
    "emergency_contact_address": "Test Address, Los Baños",
    "emergency_contact_phone": "09170000000",
}


def _number() -> str:
    return f"T{random_lower_string()[:10]}"


def _until(days: int = 365) -> str:
    return (today_manila() + timedelta(days=days)).isoformat()


def _id_resident(
    client: TestClient, headers: Headers, street_id: int, **extra: object
) -> dict:
    """A resident with everything an ID card needs, including a photo."""
    res = _resident(client, headers, street_id, **{**EMERGENCY, **extra})
    r = client.put(f"{API}/residents/{res['id']}/photo", headers=headers, content=PNG)
    assert r.status_code == 200, r.text
    return res


def _card(
    transaction_type: str = "new", valid_until: str | None = None, **extra: object
) -> dict:
    return {
        "transaction_type": transaction_type,
        "valid_until": valid_until or _until(),
        **extra,
    }


def _draft(
    client: TestClient,
    headers: Headers,
    resident_id: str,
    barangay_id: dict | None,
    expect: int = 201,
    **extra: object,
) -> dict:
    body: dict[str, object] = {
        "document_type_id": _doc(client, headers, "BARANGAY_ID"),
        "resident_id": resident_id,
        **extra,
    }
    if barangay_id is not None:
        body["barangay_id"] = barangay_id
    r = client.post(f"{ISS}/", headers=headers, json=body)
    assert r.status_code == expect, r.text
    return r.json()


def _try_issue(client: TestClient, headers: Headers, issuance_id: str) -> tuple:
    r = client.post(f"{ISS}/{issuance_id}/issue", headers=headers)
    return r.status_code, r.json()


def _issue_card(
    client: TestClient, headers: Headers, resident_id: str, **card: object
) -> dict:
    transaction = str(card.pop("transaction_type", "new"))
    draft = _draft(client, headers, resident_id, _card(transaction, **card))  # type: ignore[arg-type]
    return _issue(client, headers, draft["id"])


def _resident_number(client: TestClient, headers: Headers, resident_id: str) -> str:
    return client.get(f"{API}/residents/{resident_id}", headers=headers).json()[
        "id_number"
    ]


# --- Drafts -------------------------------------------------------------------


def test_draft_keeps_card_details_and_rejects_other_sections(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    res = _id_resident(client, staff_token_headers, street_id)
    draft = _draft(client, staff_token_headers, res["id"], _card(id_number=" 77-0001 "))
    assert draft["status"] == "draft"
    assert draft["barangay_id"]["transaction_type"] == "new"
    assert draft["barangay_id"]["id_number"] == "77-0001"
    # A card draft takes no payment, identification or other detail section.
    for bad in (
        {"payment": {"is_free": True}},
        {"indigency": {"addressed_to_office": "Some Office"}},
    ):
        _draft(client, staff_token_headers, res["id"], _card(), expect=422, **bad)
    # Sections are saved only when complete.
    _draft(
        client,
        staff_token_headers,
        res["id"],
        {"transaction_type": "new"},
        expect=422,
    )
    _draft(
        client,
        staff_token_headers,
        res["id"],
        {"transaction_type": "lost", "valid_until": _until()},
        expect=422,
    )
    # The card can be changed on the draft and removed again.
    r = client.patch(
        f"{ISS}/{draft['id']}",
        headers=staff_token_headers,
        json={"barangay_id": _card("renewal")},
    )
    assert r.status_code == 200 and r.json()["barangay_id"]["id_number"] is None
    r = client.patch(
        f"{ISS}/{draft['id']}", headers=staff_token_headers, json={"barangay_id": None}
    )
    assert r.json()["barangay_id"] is None


def test_issue_needs_the_card_section(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    res = _id_resident(client, staff_token_headers, street_id)
    draft = _draft(client, staff_token_headers, res["id"], None)
    code, body = _try_issue(client, staff_token_headers, draft["id"])
    assert code == 422
    assert body["detail"] == {"code": "missing_sections", "sections": ["barangay_id"]}


# --- Issuing a new card ---------------------------------------------------------


def test_issue_lists_missing_resident_fields_including_photo(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    res = _resident(client, staff_token_headers, street_id)  # no contact, no photo
    draft = _draft(client, staff_token_headers, res["id"], _card(id_number=_number()))
    code, body = _try_issue(client, staff_token_headers, draft["id"])
    assert code == 422
    assert body["detail"] == {
        "code": "missing_resident_fields",
        "fields": [*EMERGENCY, "photo"],
    }
    # Adding the photo alone leaves the contact fields.
    client.put(
        f"{API}/residents/{res['id']}/photo",
        headers=staff_token_headers,
        content=PNG,
    )
    code, body = _try_issue(client, staff_token_headers, draft["id"])
    assert body["detail"]["fields"] == list(EMERGENCY)


def test_new_card_is_issued_and_number_becomes_current(
    client: TestClient, staff_token_headers: Headers, street_id: int, db: Session
) -> None:
    res = _id_resident(client, staff_token_headers, street_id)
    number = _number()
    until = _until(180)
    issued = _issue_card(
        client, staff_token_headers, res["id"], valid_until=until, id_number=number
    )
    assert issued["status"] == "issued"
    assert issued["reference_no"].startswith("ISS-")
    assert issued["barangay_id"] == {
        "transaction_type": "new",
        "valid_until": until,
        "id_number": number,
    }
    assert issued["expires_on"] == until
    snap = issued["snapshot"]
    assert snap["emergency_contact_name"] == EMERGENCY["emergency_contact_name"]
    assert snap["emergency_contact_phone"] == EMERGENCY["emergency_contact_phone"]
    assert _resident_number(client, staff_token_headers, res["id"]) == number
    assert "issuance.issue" in _audit(db, issued["id"])
    # No photo bytes ever travel with the issuance.
    assert "content" not in str(issued) and "photo" not in issued


def test_new_card_without_a_number_is_refused(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    res = _id_resident(client, staff_token_headers, street_id)
    draft = _draft(client, staff_token_headers, res["id"], _card())
    code, body = _try_issue(client, staff_token_headers, draft["id"])
    assert code == 422 and body["detail"] == {"code": "id_number_required"}


def test_valid_until_must_be_after_the_issue_date(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    res = _id_resident(client, staff_token_headers, street_id)
    today = today_manila()
    for when in (today, today - timedelta(days=1)):
        draft = _draft(
            client,
            staff_token_headers,
            res["id"],
            _card(valid_until=when.isoformat(), id_number=_number()),
        )
        code, body = _try_issue(client, staff_token_headers, draft["id"])
        assert code == 422 and body["detail"]["code"] == "invalid_valid_until"


# --- Renewal, replacement and history ---------------------------------------------


def test_renewal_and_replacement_keep_history(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    res = _id_resident(client, staff_token_headers, street_id)
    number = _number()
    first = _issue_card(client, staff_token_headers, res["id"], id_number=number)
    # A second "new" card is refused; the clerk must renew or replace.
    again = _draft(client, staff_token_headers, res["id"], _card(id_number=_number()))
    code, body = _try_issue(client, staff_token_headers, again["id"])
    assert code == 409 and body["detail"]["code"] == "id_already_exists"
    # A renewal keeps the number when none is typed.
    renewal = _issue(
        client,
        staff_token_headers,
        _draft(client, staff_token_headers, res["id"], _card("renewal"))["id"],
    )
    assert renewal["barangay_id"]["id_number"] == number
    # A replacement may carry a new number, which becomes the current one.
    new_number = _number()
    replacement = _issue_card(
        client,
        staff_token_headers,
        res["id"],
        transaction_type="replacement",
        id_number=new_number,
    )
    assert _resident_number(client, staff_token_headers, res["id"]) == new_number
    # All three cards stay in the history, each with its own number.
    rows = client.get(
        f"{ISS}/?resident_id={res['id']}&status=issued",
        headers=staff_token_headers,
    ).json()
    ids = {
        row["id"] for row in rows["data"] if row["document_type_code"] == "BARANGAY_ID"
    }
    assert {first["id"], renewal["id"], replacement["id"]} <= ids
    assert first["barangay_id"]["id_number"] == number  # not overwritten


def test_renewal_without_an_earlier_card_is_refused(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    res = _id_resident(client, staff_token_headers, street_id)
    for kind in ("renewal", "replacement"):
        draft = _draft(client, staff_token_headers, res["id"], _card(kind))
        code, body = _try_issue(client, staff_token_headers, draft["id"])
        assert code == 409 and body["detail"]["code"] == "no_earlier_id"


def test_resident_with_a_paper_id_number_can_renew(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    """A card from before the system has a number on the record but no row."""
    number = _number()
    res = _id_resident(client, staff_token_headers, street_id, id_number=number)
    issued = _issue_card(
        client, staff_token_headers, res["id"], transaction_type="renewal"
    )
    assert issued["barangay_id"]["id_number"] == number
    # ...but cannot be issued a "new" card with a different number.
    other = _id_resident(client, staff_token_headers, street_id, id_number=_number())
    draft = _draft(client, staff_token_headers, other["id"], _card(id_number=_number()))
    code, body = _try_issue(client, staff_token_headers, draft["id"])
    assert code == 409 and body["detail"]["code"] == "id_already_exists"


def test_id_number_of_another_resident_is_refused(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    owner = _id_resident(client, staff_token_headers, street_id)
    number = _number()
    _issue_card(client, staff_token_headers, owner["id"], id_number=number)
    other = _id_resident(client, staff_token_headers, street_id)
    # Same number, different case: still taken.
    draft = _draft(
        client, staff_token_headers, other["id"], _card(id_number=number.lower())
    )
    code, body = _try_issue(client, staff_token_headers, draft["id"])
    assert code == 409 and body["detail"]["code"] == "id_number_in_use"
    # A number set by hand on another record is taken too.
    manual = _number()
    _id_resident(client, staff_token_headers, street_id, id_number=manual)
    draft = _draft(client, staff_token_headers, other["id"], _card(id_number=manual))
    code, body = _try_issue(client, staff_token_headers, draft["id"])
    assert code == 409 and body["detail"]["code"] == "id_number_in_use"
    assert _resident_number(client, staff_token_headers, other["id"]) is None


# --- Correct and void -------------------------------------------------------------


def test_correcting_a_card_copies_it_and_can_be_issued(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    res = _id_resident(client, staff_token_headers, street_id)
    number = _number()
    original = _issue_card(client, staff_token_headers, res["id"], id_number=number)
    r = client.post(
        f"{ISS}/{original['id']}/correct",
        headers=staff_token_headers,
        json={"reason": "Wrong valid until date"},
    )
    assert r.status_code == 201, r.text
    draft = r.json()
    assert draft["barangay_id"]["id_number"] == number
    new_until = _until(200)
    r = client.patch(
        f"{ISS}/{draft['id']}",
        headers=staff_token_headers,
        json={"barangay_id": _card(valid_until=new_until, id_number=number)},
    )
    assert r.status_code == 200
    corrected = _issue(client, staff_token_headers, draft["id"])
    assert corrected["expires_on"] == new_until
    assert corrected["corrects_issuance_id"] == original["id"]
    assert _resident_number(client, staff_token_headers, res["id"]) == number


def test_void_is_admin_only_and_keeps_the_number(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    res = _id_resident(client, staff_token_headers, street_id)
    number = _number()
    card = _issue_card(client, staff_token_headers, res["id"], id_number=number)
    url = f"{ISS}/{card['id']}/void"
    assert (
        client.post(url, headers=staff_token_headers, json={"reason": "Wrong person"})
    ).status_code == 403
    r = client.post(
        url, headers=superuser_token_headers, json={"reason": "Wrong person"}
    )
    assert r.status_code == 200 and r.json()["status"] == "voided"
    # The record keeps the number until a replacement is issued.
    assert _resident_number(client, staff_token_headers, res["id"]) == number
    replacement = _issue_card(
        client, staff_token_headers, res["id"], transaction_type="replacement"
    )
    assert replacement["barangay_id"]["id_number"] == number


# --- Permission -------------------------------------------------------------------


def test_id_write_permission_guards_card_work(
    client: TestClient,
    staff_token_headers: Headers,
    street_id: int,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    res = _id_resident(client, staff_token_headers, street_id)
    draft = _draft(client, staff_token_headers, res["id"], _card(id_number=_number()))
    # Take ID_WRITE away from everyone; other documents are not affected.
    monkeypatch.setattr(
        "app.api.routes.issuances.has_permission",
        lambda user, permission: (
            permission != "id.write" and real_has_permission(user, permission)
        ),
    )
    _draft(client, staff_token_headers, res["id"], _card(), expect=403)
    assert (
        client.patch(
            f"{ISS}/{draft['id']}", headers=staff_token_headers, json={"remarks": "x"}
        ).status_code
        == 403
    )
    assert (
        client.post(f"{ISS}/{draft['id']}/issue", headers=staff_token_headers)
    ).status_code == 403
    assert (
        client.delete(f"{ISS}/{draft['id']}", headers=staff_token_headers).status_code
        == 403
    )
    r = client.post(
        f"{ISS}/",
        headers=staff_token_headers,
        json={
            "document_type_id": _doc(client, staff_token_headers, "RESIDENCY"),
            "resident_id": res["id"],
        },
    )
    assert r.status_code == 201


# --- ID list ----------------------------------------------------------------------


def test_id_list_requires_records_access(
    client: TestClient, staff_token_headers: Headers
) -> None:
    assert client.get(f"{IDS}/").status_code == 401
    assert client.get(f"{IDS}/", headers=staff_token_headers).status_code == 200


def _listed(client: TestClient, headers: Headers, **params: object) -> list[dict]:
    r = client.get(f"{IDS}/", headers=headers, params={"limit": 200, **params})
    assert r.status_code == 200, r.text
    return r.json()["data"]


def test_id_list_computes_status_and_shows_latest_card_only(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    today = today_manila()
    cases = {
        "valid": today + timedelta(days=200),
        "expiring_soon": today + timedelta(days=10),
        "expired": today - timedelta(days=1),
    }
    # An expired date is before the issue date, so issue with an older issue_date.
    made: dict[str, dict] = {}
    for state, until in cases.items():
        res = _id_resident(client, staff_token_headers, street_id)
        draft = _draft(
            client,
            staff_token_headers,
            res["id"],
            _card(valid_until=until.isoformat(), id_number=_number()),
            issue_date=(today - timedelta(days=400)).isoformat(),
        )
        issued = _issue(client, staff_token_headers, draft["id"])
        made[state] = {"res": res, "card": issued}

    for state, info in made.items():
        rows = _listed(client, staff_token_headers, q=info["res"]["last_name"])
        assert len(rows) == 1
        row = rows[0]
        assert row["status"] == state
        assert row["resident_id"] == info["res"]["id"]
        assert row["id_number"] == info["card"]["barangay_id"]["id_number"]
        assert row["resident_name"] == info["res"]["full_name"]
        listed_ids = {
            r["issuance_id"] for r in _listed(client, staff_token_headers, status=state)
        }
        assert info["card"]["id"] in listed_ids
        for other in cases:
            if other != state:
                others = {
                    r["issuance_id"]
                    for r in _listed(client, staff_token_headers, status=other)
                }
                assert info["card"]["id"] not in others
    # Searching by ID number works.
    number = made["valid"]["card"]["barangay_id"]["id_number"]
    assert len(_listed(client, staff_token_headers, q=number)) == 1

    # Renewing replaces the expired card in the list; voiding the renewal shows
    # the earlier one again.
    res = made["expired"]["res"]
    renewal = _issue_card(
        client, staff_token_headers, res["id"], transaction_type="renewal"
    )
    rows = _listed(client, staff_token_headers, q=res["last_name"])
    assert len(rows) == 1 and rows[0]["issuance_id"] == renewal["id"]
    assert rows[0]["status"] == "valid" and rows[0]["transaction_type"] == "renewal"
    client.post(
        f"{ISS}/{renewal['id']}/void",
        headers=superuser_token_headers,
        json={"reason": "Entered by mistake"},
    )
    rows = _listed(client, staff_token_headers, q=res["last_name"])
    assert rows[0]["issuance_id"] == made["expired"]["card"]["id"]
    assert rows[0]["status"] == "expired"


def test_id_list_ignores_other_documents_and_drafts(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    res = _id_resident(client, staff_token_headers, street_id, resident_since_year=2000)
    _draft(client, staff_token_headers, res["id"], _card(id_number=_number()))
    r = client.post(
        f"{ISS}/",
        headers=staff_token_headers,
        json={
            "document_type_id": _doc(client, staff_token_headers, "RESIDENCY"),
            "resident_id": res["id"],
        },
    )
    _issue(client, staff_token_headers, r.json()["id"])
    assert _listed(client, staff_token_headers, q=res["last_name"]) == []

