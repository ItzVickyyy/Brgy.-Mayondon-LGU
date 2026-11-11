# ruff: noqa: F811  (fixtures imported from test_issuances are used as parameters)
"""Back-date limit, ID validity cap, look-alike ID numbers, one franchise per tricycle."""

from datetime import timedelta

from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.dates import today_manila
from tests.api.routes.test_barangay_ids import (  # noqa: F401
    _card,
    _draft,
    _id_resident,
    _number,
    _try_issue,
)
from tests.api.routes.test_issuances import (  # noqa: F401  (fixtures are reused)
    _clearance,
    _doc,
    _franchise,
    _franchise_draft,
    _issue,
    _resident,
    _tidy_up,
    association_id,
    street_id,
)

API = settings.API_V1_STR
ISS = f"{API}/issuances"


def test_issue_date_cannot_be_too_far_back(
    client: TestClient, staff_token_headers: dict[str, str], street_id: int, monkeypatch
) -> None:
    monkeypatch.setattr(settings, "ISSUANCE_BACKDATE_MAX_DAYS", 7)
    res = _resident(client, staff_token_headers, street_id)
    doc = _doc(client, staff_token_headers, "BARANGAY_CLEARANCE")

    def create(days_back: int) -> object:
        return client.post(
            f"{ISS}/",
            headers=staff_token_headers,
            json={
                "document_type_id": doc,
                "resident_id": res["id"],
                "issue_date": (today_manila() - timedelta(days=days_back)).isoformat(),
            },
        )

    assert create(7).status_code == 201
    late = create(8)
    assert late.status_code == 422
    assert late.json()["detail"]["code"] == "issue_date_too_old"
    draft = create(0).json()
    too_old = (today_manila() - timedelta(days=30)).isoformat()
    r = client.patch(
        f"{ISS}/{draft['id']}",
        headers=staff_token_headers,
        json={"issue_date": too_old},
    )
    assert r.status_code == 422


def test_id_validity_is_capped(
    client: TestClient, staff_token_headers: dict[str, str], street_id: int
) -> None:
    res = _id_resident(client, staff_token_headers, street_id)
    years = settings.BARANGAY_ID_MAX_VALID_YEARS
    too_long = (today_manila() + timedelta(days=366 * years + 5)).isoformat()
    draft = _draft(
        client,
        staff_token_headers,
        res["id"],
        _card(valid_until=too_long, id_number=_number()),
    )
    code, body = _try_issue(client, staff_token_headers, draft["id"])
    assert code == 422 and body["detail"]["code"] == "valid_until_too_long"


def test_look_alike_id_numbers_clash(
    client: TestClient, staff_token_headers: dict[str, str], street_id: int
) -> None:
    first = _id_resident(client, staff_token_headers, street_id)
    base = f"Z{_number()[1:6].upper().replace('O', 'A').replace('I', 'B').replace('L', 'C')}"
    draft = _draft(
        client, staff_token_headers, first["id"], _card(id_number=f"{base}0001")
    )
    _issue(client, staff_token_headers, draft["id"])
    second = _id_resident(client, staff_token_headers, street_id)
    for typed in (f"{base}000I", f" {base.lower()}OOOl ", f"{base} 0001"):
        d = _draft(client, staff_token_headers, second["id"], _card(id_number=typed))
        code, body = _try_issue(client, staff_token_headers, d["id"])
        assert code == 409, typed
        assert body["detail"]["code"] == "id_number_in_use"


def test_one_valid_franchise_per_tricycle(
    client: TestClient,
    staff_token_headers: dict[str, str],
    street_id: int,
    association_id: int,
) -> None:
    one = _resident(client, staff_token_headers, street_id)
    two = _resident(client, staff_token_headers, street_id)
    data = _franchise(association_id)
    _issue(
        client,
        staff_token_headers,
        _franchise_draft(client, staff_token_headers, one["id"], data)["id"],
    )
    rival = _franchise_draft(client, staff_token_headers, two["id"], data)
    r = client.post(f"{ISS}/{rival['id']}/issue", headers=staff_token_headers)
    assert r.status_code == 409
    assert r.json()["detail"]["code"] == "tricycle_has_valid_franchise"


def test_issuing_a_correction_voids_only_the_original(
    client: TestClient, staff_token_headers: dict[str, str], street_id: int
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    bystander = _resident(client, staff_token_headers, street_id)
    other = _clearance(client, staff_token_headers, bystander["id"])
    original = _issue(
        client,
        staff_token_headers,
        _clearance(client, staff_token_headers, res["id"])["id"],
    )
    draft = client.post(
        f"{ISS}/{original['id']}/correct",
        headers=staff_token_headers,
        json={"reason": "Wrong spelling"},
    ).json()
    # While the correction is only a draft, the original stays valid.
    still = client.get(f"{ISS}/{original['id']}", headers=staff_token_headers).json()
    assert still["status"] == "issued"
    fixed = _issue(client, staff_token_headers, draft["id"])
    after = client.get(f"{ISS}/{original['id']}", headers=staff_token_headers).json()
    assert after["status"] == "voided"
    assert after["void_reason"] == (
        f"Replaced by correction {fixed['reference_no']}. Reason: Wrong spelling"
    )
    assert fixed["status"] == "issued"
    # An unrelated draft is not touched.
    unrelated = client.get(f"{ISS}/{other['id']}", headers=staff_token_headers).json()
    assert unrelated["status"] == "draft"
