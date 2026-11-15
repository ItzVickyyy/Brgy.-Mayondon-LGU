"""Duplicate protection for residents and lookup lists (patch 99)."""

from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.core.duplicates import name_key
from app.models_residents import Resident
from tests.utils.utils import random_lower_string

API = settings.API_V1_STR
Headers = dict[str, str]


def _body(**extra: object) -> dict[str, object]:
    base: dict[str, object] = {
        "first_name": f"Dup{random_lower_string()[:8]}",
        "last_name": f"Same{random_lower_string()[:8]}",
        "birthdate": "1988-03-04",
        "sex": "Female",
        "civil_status": "Single",
    }
    base.update(extra)
    return base


def _post(client: TestClient, headers: Headers, body: dict, confirm: bool = False):
    return client.post(
        f"{API}/residents/",
        headers=headers,
        json=body,
        params={"confirm_duplicate": True} if confirm else None,
    )


def test_name_key_ignores_accents_spaces_and_punctuation() -> None:
    assert name_key("Dela Cruz") == name_key("DELACRUZ") == name_key("dela-cruz")
    assert name_key("Peña") == name_key("pena")
    assert name_key("  O'Brien ") == name_key("obrien")
    assert name_key(None) == "" and name_key("...") == ""


def test_spacing_accent_and_case_variants_are_still_a_duplicate(
    client: TestClient, staff_token_headers: Headers
) -> None:
    token = random_lower_string()[:6]
    first = _post(
        client,
        staff_token_headers,
        _body(first_name=f"Ana {token}", last_name=f"De la Peña{token}"),
    )
    assert first.status_code == 201
    again = _post(
        client,
        staff_token_headers,
        _body(first_name=f"ANA{token}", last_name=f"Dela  Pena {token}"),
    )
    assert again.status_code == 409
    detail = again.json()["detail"]
    assert detail["code"] == "possible_duplicate"
    assert first.json()["id"] in detail["resident_ids"]
    assert detail["matches"][0]["id"] == first.json()["id"]
    assert detail["matches"][0]["status"] == "active"
    assert detail["matches"][0]["birthdate"] == "1988-03-04"


def test_a_different_birthdate_is_not_a_duplicate(
    client: TestClient, staff_token_headers: Headers
) -> None:
    first = _body()
    assert _post(client, staff_token_headers, first).status_code == 201
    other = {**first, "birthdate": "1990-01-01"}
    assert _post(client, staff_token_headers, other).status_code == 201


def test_an_archived_resident_is_still_found(
    client: TestClient, staff_token_headers: Headers, superuser_token_headers: Headers
) -> None:
    body = _body()
    made = _post(client, staff_token_headers, body).json()
    r = client.post(
        f"{API}/residents/{made['id']}/archive",
        headers=superuser_token_headers,
        json={"reason": "Moved away"},
    )
    assert r.status_code == 200, r.text
    again = _post(client, staff_token_headers, body)
    assert again.status_code == 409
    assert again.json()["detail"]["matches"][0]["status"] == "archived"


def test_a_name_only_record_is_found_when_the_birthdate_is_filled_in(
    client: TestClient, staff_token_headers: Headers
) -> None:
    # The ID-history import leaves residents with a name and no birthdate.
    token = random_lower_string()[:8]
    stub = _post(
        client,
        staff_token_headers,
        _body(
            first_name=f"Stub{token}",
            middle_name="Reyes",
            last_name=f"Cruz{token}",
            birthdate=None,
        ),
    )
    assert stub.status_code == 201, stub.text
    full = _body(
        first_name=f"Stub{token}", middle_name="reyes", last_name=f"Cruz{token}"
    )
    r = _post(client, staff_token_headers, full)
    assert r.status_code == 409
    assert stub.json()["id"] in r.json()["detail"]["resident_ids"]
    # A different middle name is a different person.
    other = {**full, "middle_name": "Santos"}
    assert _post(client, staff_token_headers, other).status_code == 201


def test_no_birthdate_is_compared_on_the_full_name(
    client: TestClient, staff_token_headers: Headers
) -> None:
    token = random_lower_string()[:8]
    first = _body(first_name=f"Nob{token}", last_name=f"Day{token}", birthdate=None)
    assert _post(client, staff_token_headers, first).status_code == 201
    assert _post(client, staff_token_headers, first).status_code == 409
    # Jr. and Sr. with no birthdate are not the same person.
    assert (
        _post(client, staff_token_headers, {**first, "suffix": "Jr."}).status_code
        == 201
    )


def test_editing_into_an_existing_person_is_warned_then_allowed(
    client: TestClient, staff_token_headers: Headers
) -> None:
    existing = _post(client, staff_token_headers, _body()).json()
    other = _post(client, staff_token_headers, _body()).json()
    change = {
        "first_name": existing["first_name"],
        "last_name": existing["last_name"],
        "birthdate": existing["birthdate"],
    }
    r = client.patch(
        f"{API}/residents/{other['id']}", headers=staff_token_headers, json=change
    )
    assert r.status_code == 409
    assert r.json()["detail"]["code"] == "possible_duplicate"
    assert existing["id"] in r.json()["detail"]["resident_ids"]
    ok = client.patch(
        f"{API}/residents/{other['id']}",
        headers=staff_token_headers,
        json=change,
        params={"confirm_duplicate": True},
    )
    assert ok.status_code == 200


def test_editing_something_else_never_asks_about_duplicates(
    client: TestClient, staff_token_headers: Headers
) -> None:
    body = _body()
    first = _post(client, staff_token_headers, body).json()
    assert _post(client, staff_token_headers, body, confirm=True).status_code == 201
    # The namesake pair exists on purpose; saving a phone number must still work.
    r = client.patch(
        f"{API}/residents/{first['id']}",
        headers=staff_token_headers,
        json={
            "first_name": first["first_name"],
            "birthdate": first["birthdate"],
            "emergency_contact_phone": "09171234567",
        },
    )
    assert r.status_code == 200, r.text


def test_two_clerks_adding_the_same_person_at_once_get_one_record(
    client: TestClient, staff_token_headers: Headers, db: Session
) -> None:
    body = _body()

    def add() -> int:
        return _post(client, staff_token_headers, body).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        codes = sorted(pool.map(lambda _i: add(), range(2)))
    assert codes == [201, 409]
    db.expire_all()
    rows = db.exec(
        select(Resident).where(Resident.first_name == body["first_name"])
    ).all()
    assert len(rows) == 1


def test_street_names_that_only_differ_in_spelling_are_the_same(
    client: TestClient, superuser_token_headers: Headers
) -> None:
    token = random_lower_string()[:6]
    first = client.post(
        f"{API}/lookups/streets",
        headers=superuser_token_headers,
        json={"name": f"Rizal{token} Street"},
    )
    assert first.status_code == 201, first.text
    for variant in (f"RIZAL{token} St.", f"rizal{token}  street", f"Rízal{token} St"):
        r = client.post(
            f"{API}/lookups/streets",
            headers=superuser_token_headers,
            json={"name": variant},
        )
        assert r.status_code == 409, variant
    other = client.post(
        f"{API}/lookups/streets",
        headers=superuser_token_headers,
        json={"name": f"Mabini{token} Street"},
    )
    assert other.status_code == 201
    # Renaming into another street's spelling is refused; keeping its own is fine.
    clash = client.patch(
        f"{API}/lookups/streets/{other.json()['id']}",
        headers=superuser_token_headers,
        json={"name": f"rizal{token} st"},
    )
    assert clash.status_code == 409
    same = client.patch(
        f"{API}/lookups/streets/{other.json()['id']}",
        headers=superuser_token_headers,
        json={"name": f"MABINI{token} STREET"},
    )
    assert same.status_code == 200
