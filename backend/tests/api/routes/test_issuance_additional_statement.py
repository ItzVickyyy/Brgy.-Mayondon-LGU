# ruff: noqa: F811  (fixtures imported from test_issuances are used as parameters)
"""The Residency "Additional statement" is saved, changed, cleared and kept."""

from fastapi.testclient import TestClient

from app.core.config import settings
from tests.api.routes.test_issuances import (  # noqa: F401  (fixtures are reused)
    _clearance,
    _doc,
    _resident,
    street_id,
)

API = settings.API_V1_STR
ISS = f"{API}/issuances"
Headers = dict[str, str]


def _residency(client: TestClient, headers: Headers, resident_id: str, **extra: object):
    return client.post(
        f"{ISS}/",
        headers=headers,
        json={
            "document_type_id": _doc(client, headers, "RESIDENCY"),
            "resident_id": resident_id,
            **extra,
        },
    )


def test_statement_is_saved_changed_and_cleared(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    r = _residency(
        client,
        staff_token_headers,
        res["id"],
        additional_statement="  Living here with her family.  ",
    )
    assert r.status_code == 201, r.text
    draft = r.json()
    assert draft["additional_statement"] == "Living here with her family."

    url = f"{ISS}/{draft['id']}"
    got = client.get(url, headers=staff_token_headers).json()
    assert got["additional_statement"] == "Living here with her family."

    # Not sent: unchanged. Sent blank: cleared.
    r = client.patch(url, headers=staff_token_headers, json={"remarks": "x"})
    assert r.json()["additional_statement"] == "Living here with her family."
    r = client.patch(
        url, headers=staff_token_headers, json={"additional_statement": "   "}
    )
    assert r.status_code == 200, r.text
    assert r.json()["additional_statement"] is None


def test_statement_is_refused_on_other_documents_and_when_too_long(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    r = client.post(
        f"{ISS}/",
        headers=staff_token_headers,
        json={
            "document_type_id": _doc(client, staff_token_headers, "BARANGAY_CLEARANCE"),
            "resident_id": res["id"],
            "additional_statement": "Not for a clearance",
        },
    )
    assert r.status_code == 422
    clearance = _clearance(client, staff_token_headers, res["id"])
    r = client.patch(
        f"{ISS}/{clearance['id']}",
        headers=staff_token_headers,
        json={"additional_statement": "Not for a clearance"},
    )
    assert r.status_code == 422
    r = _residency(
        client, staff_token_headers, res["id"], additional_statement="a" * 501
    )
    assert r.status_code == 422


def test_correction_keeps_the_statement(
    client: TestClient,
    staff_token_headers: Headers,
    street_id: int,
) -> None:
    res = _resident(client, staff_token_headers, street_id, resident_since_year=2010)
    draft = _residency(
        client,
        staff_token_headers,
        res["id"],
        additional_statement="Kept in the correction.",
    ).json()
    issued = client.post(
        f"{ISS}/{draft['id']}/issue",
        headers=staff_token_headers,
        json={"purpose_name": "Employment Requirement"},
    )
    assert issued.status_code == 200, issued.text
    r = client.post(
        f"{ISS}/{draft['id']}/correct",
        headers=staff_token_headers,
        json={"reason": "Typing error in the name"},
    )
    assert r.status_code in (200, 201), r.text
    assert r.json()["additional_statement"] == "Kept in the correction."
