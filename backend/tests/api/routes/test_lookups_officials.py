"""Lookup lists and officials: who may read, who may write, and the rules."""

import uuid
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, col, delete, select

from app.core.config import settings
from app.models_foundation import AuditLog, Official, Street, TricycleAssociation
from app.models_residents import Resident
from tests.utils.utils import random_lower_string

LK = f"{settings.API_V1_STR}/lookups"
OFF = f"{settings.API_V1_STR}/officials"


@pytest.fixture(scope="module", autouse=True)
def _tidy_up(db: Session) -> Generator[None]:
    """Streets, associations and officials start empty; leave them that way."""
    yield
    db.rollback()
    db.execute(delete(Resident).where(col(Resident.street_id).is_not(None)))
    db.execute(delete(Street))
    db.execute(delete(TricycleAssociation))
    db.execute(delete(Official))
    db.commit()


def _name(prefix: str) -> str:
    return f"{prefix} {random_lower_string()[:10]}"


def _audit_actions(db: Session, record_id: str) -> list[str]:
    rows = db.exec(
        select(AuditLog.action).where(col(AuditLog.record_id) == record_id)
    ).all()
    return list(rows)


# --- Reading lookups --------------------------------------------------------


def test_lookups_require_login(client: TestClient) -> None:
    for path in (
        "document-types",
        "sectors",
        "id-types",
        "issuance-purposes",
        "streets",
        "tricycle-associations",
    ):
        assert client.get(f"{LK}/{path}").status_code == 401
    assert client.get(f"{OFF}/").status_code == 401


def test_staff_and_admin_read_seeded_lookups(
    client: TestClient,
    staff_token_headers: dict[str, str],
    superuser_token_headers: dict[str, str],
) -> None:
    expected = {"sectors": 11, "id-types": 16, "issuance-purposes": 38}
    for headers in (staff_token_headers, superuser_token_headers):
        for path, count in expected.items():
            r = client.get(f"{LK}/{path}", headers=headers)
            assert r.status_code == 200
            items = r.json()
            assert len(items) == count
            assert set(items[0]) == {"id", "name"}
            names = [i["name"] for i in items]
            assert names == sorted(names, key=str.casefold)
        r = client.get(f"{LK}/document-types", headers=headers)
        assert r.status_code == 200
        kinds = {d["code"]: d for d in r.json()}
        assert len(kinds) == 9
        assert kinds["BARANGAY_CLEARANCE"]["validity_months"] == 2
        assert kinds["FIRST_TIME_JOBSEEKER"]["one_per_resident"] is True
        for path in ("streets", "tricycle-associations"):
            assert client.get(f"{LK}/{path}", headers=headers).status_code == 200


def test_seeded_lookups_are_read_only(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    for path in ("sectors", "id-types", "issuance-purposes", "document-types"):
        r = client.post(
            f"{LK}/{path}", json={"name": "Nope"}, headers=superuser_token_headers
        )
        assert r.status_code == 405


# --- Streets and tricycle associations --------------------------------------


def test_staff_cannot_change_streets_or_associations(
    client: TestClient,
    db: Session,
    staff_token_headers: dict[str, str],
    superuser_token_headers: dict[str, str],
) -> None:
    created = client.post(
        f"{LK}/streets", json={"name": _name("Staff")}, headers=superuser_token_headers
    ).json()
    sid = created["id"]
    for path in ("streets", "tricycle-associations"):
        r = client.post(f"{LK}/{path}", json={"name": "X"}, headers=staff_token_headers)
        assert r.status_code == 403
        r = client.patch(
            f"{LK}/{path}/{sid}", json={"name": "Y"}, headers=staff_token_headers
        )
        assert r.status_code == 403
        r = client.delete(f"{LK}/{path}/{sid}", headers=staff_token_headers)
        assert r.status_code == 403
    assert db.get(Street, sid) is not None  # untouched
    client.delete(f"{LK}/streets/{sid}", headers=superuser_token_headers)


def test_admin_street_lifecycle_is_audited(
    client: TestClient, db: Session, superuser_token_headers: dict[str, str]
) -> None:
    name = _name("Rizal")
    r = client.post(
        f"{LK}/streets", json={"name": f"  {name}  "}, headers=superuser_token_headers
    )
    assert r.status_code == 201
    item = r.json()
    assert item["name"] == name  # trimmed
    sid = item["id"]

    listed = client.get(f"{LK}/streets", headers=superuser_token_headers).json()
    assert {"id": sid, "name": name} in listed

    new_name = _name("Mabini")
    r = client.patch(
        f"{LK}/streets/{sid}", json={"name": new_name}, headers=superuser_token_headers
    )
    assert r.status_code == 200
    assert r.json()["name"] == new_name

    r = client.delete(f"{LK}/streets/{sid}", headers=superuser_token_headers)
    assert r.status_code == 204
    assert db.get(Street, sid) is None
    r = client.delete(f"{LK}/streets/{sid}", headers=superuser_token_headers)
    assert r.status_code == 404
    r = client.patch(
        f"{LK}/streets/{sid}", json={"name": "Z"}, headers=superuser_token_headers
    )
    assert r.status_code == 404

    db.expire_all()
    actions = _audit_actions(db, str(sid))
    assert {"street.create", "street.rename", "street.delete"} <= set(actions)


def test_duplicate_names_rejected_ignoring_case_and_spacing(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    name = _name("Bonifacio")
    first = client.post(
        f"{LK}/streets", json={"name": name}, headers=superuser_token_headers
    ).json()
    messy = f" {name.upper().replace(' ', '   ')} "
    r = client.post(
        f"{LK}/streets", json={"name": messy}, headers=superuser_token_headers
    )
    assert r.status_code == 409

    other = client.post(
        f"{LK}/streets", json={"name": _name("Luna")}, headers=superuser_token_headers
    ).json()
    r = client.patch(
        f"{LK}/streets/{other['id']}",
        json={"name": name.lower()},
        headers=superuser_token_headers,
    )
    assert r.status_code == 409
    # Renaming to its own name (different case) is fine.
    r = client.patch(
        f"{LK}/streets/{first['id']}",
        json={"name": name.upper()},
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    for item in (first, other):
        client.delete(f"{LK}/streets/{item['id']}", headers=superuser_token_headers)


def test_blank_or_too_long_name_rejected(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    for bad in ("", "   ", "x" * 151):
        r = client.post(
            f"{LK}/streets", json={"name": bad}, headers=superuser_token_headers
        )
        assert r.status_code == 422


def test_street_in_use_cannot_be_deleted(
    client: TestClient,
    db: Session,
    staff_token_headers: dict[str, str],
    superuser_token_headers: dict[str, str],
) -> None:
    street = client.post(
        f"{LK}/streets", json={"name": _name("Used")}, headers=superuser_token_headers
    ).json()
    r = client.post(
        f"{settings.API_V1_STR}/residents/",
        json={
            "first_name": "Lookup",
            "last_name": f"Tester{random_lower_string()[:8]}",
            "birthdate": "1990-01-01",
            "sex": "Female",
            "civil_status": "Single",
            "street_id": street["id"],
        },
        headers=staff_token_headers,
    )
    assert r.status_code == 201, r.text
    r = client.delete(f"{LK}/streets/{street['id']}", headers=superuser_token_headers)
    assert r.status_code == 409
    assert db.get(Street, street["id"]) is not None
    # Renaming is still allowed.
    r = client.patch(
        f"{LK}/streets/{street['id']}",
        json={"name": _name("Renamed")},
        headers=superuser_token_headers,
    )
    assert r.status_code == 200


def test_admin_tricycle_association_lifecycle(
    client: TestClient, db: Session, superuser_token_headers: dict[str, str]
) -> None:
    name = _name("Mayondon TODA")
    r = client.post(
        f"{LK}/tricycle-associations",
        json={"name": name},
        headers=superuser_token_headers,
    )
    assert r.status_code == 201
    aid = r.json()["id"]
    assert (
        client.post(
            f"{LK}/tricycle-associations",
            json={"name": name.upper()},
            headers=superuser_token_headers,
        ).status_code
        == 409
    )
    listed = client.get(f"{LK}/tricycle-associations", headers=superuser_token_headers)
    assert any(i["id"] == aid for i in listed.json())
    new_name = _name("Renamed TODA")
    r = client.patch(
        f"{LK}/tricycle-associations/{aid}",
        json={"name": new_name},
        headers=superuser_token_headers,
    )
    assert r.status_code == 200 and r.json()["name"] == new_name
    r = client.delete(
        f"{LK}/tricycle-associations/{aid}", headers=superuser_token_headers
    )
    assert r.status_code == 204
    assert db.get(TricycleAssociation, aid) is None


# --- Officials --------------------------------------------------------------


def _official_body(**over: object) -> dict[str, object]:
    body: dict[str, object] = {
        "full_name": f"Official {random_lower_string()[:8]}",
        "position": "Barangay Captain",
        "term_start": "2023-11-01",
        "is_elected": True,
    }
    body.update(over)
    return body


def test_staff_cannot_create_or_edit_officials(
    client: TestClient,
    staff_token_headers: dict[str, str],
    superuser_token_headers: dict[str, str],
) -> None:
    created = client.post(
        f"{OFF}/", json=_official_body(), headers=superuser_token_headers
    ).json()
    r = client.post(f"{OFF}/", json=_official_body(), headers=staff_token_headers)
    assert r.status_code == 403
    r = client.patch(
        f"{OFF}/{created['id']}",
        json={"position": "Hacked"},
        headers=staff_token_headers,
    )
    assert r.status_code == 403
    assert (
        client.get(f"{OFF}/{created['id']}", headers=staff_token_headers).json()[
            "position"
        ]
        == "Barangay Captain"
    )


def test_admin_creates_updates_and_retires_official(
    client: TestClient,
    db: Session,
    staff_token_headers: dict[str, str],
    superuser_token_headers: dict[str, str],
) -> None:
    body = _official_body(full_name="  Juan   Dela Cruz ")
    r = client.post(f"{OFF}/", json=body, headers=superuser_token_headers)
    assert r.status_code == 201
    official = r.json()
    oid = official["id"]
    assert official["full_name"] == "Juan Dela Cruz"
    assert official["is_current"] is True
    assert official["term_end"] is None

    # Staff can read it, in the default (current) list and singly.
    listed = client.get(f"{OFF}/", headers=staff_token_headers).json()
    assert any(o["id"] == oid for o in listed)
    assert client.get(f"{OFF}/{oid}", headers=staff_token_headers).status_code == 200

    r = client.patch(
        f"{OFF}/{oid}",
        json={"is_current": False, "term_end": "2026-10-31"},
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    assert r.json()["is_current"] is False
    assert r.json()["term_end"] == "2026-10-31"

    current = client.get(f"{OFF}/", headers=staff_token_headers).json()
    assert all(o["id"] != oid for o in current)
    former = client.get(f"{OFF}/?status=former", headers=staff_token_headers).json()
    assert any(o["id"] == oid for o in former)
    everyone = client.get(f"{OFF}/?status=all", headers=staff_token_headers).json()
    assert any(o["id"] == oid for o in everyone)
    assert (
        client.get(f"{OFF}/?status=bogus", headers=staff_token_headers).status_code
        == 422
    )

    # Clearing the end date works with an explicit null.
    r = client.patch(
        f"{OFF}/{oid}",
        json={"term_end": None, "is_current": True},
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    assert r.json()["term_end"] is None

    db.expire_all()
    actions = _audit_actions(db, oid)
    assert "official.create" in actions
    assert actions.count("official.update") == 2


def test_official_term_order_and_nulls_validated(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.post(
        f"{OFF}/",
        json=_official_body(term_start="2025-01-01", term_end="2024-12-31"),
        headers=superuser_token_headers,
    )
    assert r.status_code == 422

    oid = client.post(
        f"{OFF}/",
        json=_official_body(term_start="2025-01-01"),
        headers=superuser_token_headers,
    ).json()["id"]
    # Moving the start past an existing end, or ending before the start.
    r = client.patch(
        f"{OFF}/{oid}", json={"term_end": "2024-01-01"}, headers=superuser_token_headers
    )
    assert r.status_code == 422
    client.patch(
        f"{OFF}/{oid}", json={"term_end": "2025-06-30"}, headers=superuser_token_headers
    )
    r = client.patch(
        f"{OFF}/{oid}",
        json={"term_start": "2025-07-01"},
        headers=superuser_token_headers,
    )
    assert r.status_code == 422
    # Required fields cannot be nulled.
    for field in ("full_name", "position", "term_start", "is_current", "is_elected"):
        r = client.patch(
            f"{OFF}/{oid}", json={field: None}, headers=superuser_token_headers
        )
        assert r.status_code == 422, field
    r = client.post(
        f"{OFF}/", json=_official_body(full_name="   "), headers=superuser_token_headers
    )
    assert r.status_code == 422


def test_unknown_official_is_404_and_no_delete_route(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    missing = uuid.uuid4()
    assert (
        client.get(f"{OFF}/{missing}", headers=superuser_token_headers).status_code
        == 404
    )
    assert (
        client.patch(
            f"{OFF}/{missing}", json={"position": "X"}, headers=superuser_token_headers
        ).status_code
        == 404
    )
    assert (
        client.delete(f"{OFF}/{missing}", headers=superuser_token_headers).status_code
        == 405
    )


def test_noop_official_update_writes_no_audit_row(
    client: TestClient, db: Session, superuser_token_headers: dict[str, str]
) -> None:
    oid = client.post(
        f"{OFF}/", json=_official_body(), headers=superuser_token_headers
    ).json()["id"]
    r = client.patch(
        f"{OFF}/{oid}",
        json={"position": "Barangay Captain"},
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    db.expire_all()
    assert _audit_actions(db, oid) == ["official.create"]


def test_audit_details_hold_field_names_only(
    client: TestClient, db: Session, superuser_token_headers: dict[str, str]
) -> None:
    name = f"Secret {random_lower_string()[:10]}"
    oid = client.post(
        f"{OFF}/", json=_official_body(full_name=name), headers=superuser_token_headers
    ).json()["id"]
    db.expire_all()
    row = db.exec(
        select(AuditLog).where(
            col(AuditLog.record_id) == oid, col(AuditLog.action) == "official.create"
        )
    ).one()
    assert name not in str(row.details)
    assert "full_name" in row.details["fields"]  # type: ignore[index]
