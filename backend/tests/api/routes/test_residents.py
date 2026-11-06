"""Resident records API, tested through the real API for both roles."""

import uuid
from datetime import timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.core.dates import age_on, today_manila
from app.models_foundation import AuditLog, Sector, Street
from app.models_residents import Resident
from tests.utils.utils import random_lower_string

API = settings.API_V1_STR
Headers = dict[str, str]

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 100
WEBP = b"RIFF\x00\x00\x00\x00WEBP" + b"0" * 100


def _payload(**extra: object) -> dict[str, object]:
    base: dict[str, object] = {
        "first_name": f"Test{random_lower_string()[:8]}",
        "last_name": f"Last{random_lower_string()[:8]}",
        "birthdate": "1990-05-17",
        "sex": "Female",
        "civil_status": "Single",
    }
    base.update(extra)
    return base


def _create(client: TestClient, headers: Headers, **extra: object) -> dict:
    r = client.post(f"{API}/residents/", headers=headers, json=_payload(**extra))
    assert r.status_code == 201, r.text
    return r.json()


def _sector_ids(db: Session, n: int = 2) -> list[int]:
    return list(db.exec(select(Sector.id).order_by(Sector.id).limit(n)).all())


def _audit(db: Session, action: str, record_id: str) -> list[AuditLog]:
    db.expire_all()
    return list(
        db.exec(
            select(AuditLog).where(
                AuditLog.action == action, AuditLog.record_id == record_id
            )
        ).all()
    )


# --- Access control ---------------------------------------------------------


def test_requests_without_token_are_rejected(client: TestClient) -> None:
    rid = uuid.uuid4()
    assert client.get(f"{API}/residents/").status_code == 401
    assert client.post(f"{API}/residents/", json=_payload()).status_code == 401
    assert client.get(f"{API}/residents/{rid}/photo").status_code == 401
    assert (
        client.post(f"{API}/residents/{rid}/archive", json={"reason": "x"}).status_code
        == 401
    )


def test_staff_can_search_create_view_edit(
    client: TestClient, staff_token_headers: Headers
) -> None:
    created = _create(client, staff_token_headers)
    rid = created["id"]
    assert (
        client.get(f"{API}/residents/{rid}", headers=staff_token_headers).status_code
        == 200
    )
    r = client.patch(
        f"{API}/residents/{rid}", headers=staff_token_headers, json={"purok": 3}
    )
    assert r.status_code == 200 and r.json()["purok"] == 3
    listed = client.get(
        f"{API}/residents/",
        headers=staff_token_headers,
        params={"q": created["last_name"]},
    ).json()
    assert [x["id"] for x in listed["data"]] == [rid]


def test_staff_cannot_archive_or_restore(
    client: TestClient, staff_token_headers: Headers, superuser_token_headers: Headers
) -> None:
    rid = _create(client, staff_token_headers)["id"]
    r = client.post(
        f"{API}/residents/{rid}/archive",
        headers=staff_token_headers,
        json={"reason": "moved"},
    )
    assert r.status_code == 403
    client.post(
        f"{API}/residents/{rid}/archive",
        headers=superuser_token_headers,
        json={"reason": "moved"},
    )
    assert (
        client.post(
            f"{API}/residents/{rid}/restore", headers=staff_token_headers
        ).status_code
        == 403
    )


def test_admin_can_do_everything_staff_can(
    client: TestClient, superuser_token_headers: Headers
) -> None:
    created = _create(client, superuser_token_headers)
    assert (
        client.get(
            f"{API}/residents/{created['id']}", headers=superuser_token_headers
        ).status_code
        == 200
    )


# --- Create, read, validate --------------------------------------------------


def test_create_returns_computed_name_and_age_and_audits(
    client: TestClient, staff_token_headers: Headers, db: Session
) -> None:
    created = _create(
        client,
        staff_token_headers,
        first_name="Ana",
        middle_name="Cruz",
        last_name=f"Reyes{random_lower_string()[:6]}",
        suffix="Jr.",
    )
    assert created["full_name"] == f"Ana Cruz {created['last_name']} Jr."
    assert created["age"] == age_on(today_manila().replace(year=1990, month=5, day=17))
    assert created["status"] == "active" and created["has_photo"] is False
    assert len(_audit(db, "resident.create", created["id"])) == 1


def test_validation_rejects_bad_input(
    client: TestClient, staff_token_headers: Headers
) -> None:
    future = (today_manila() + timedelta(days=1)).isoformat()
    for bad in (
        {"birthdate": future},
        {"sex": "Other"},
        {"civil_status": "Complicated"},
        {"suffix": "Esq."},
        {"purok": 0},
        {"first_name": "   "},
        {"resident_since_year": 2000, "resident_since_birth": True},
        {"voter_registration": "maybe"},
    ):
        r = client.post(
            f"{API}/residents/", headers=staff_token_headers, json=_payload(**bad)
        )
        assert r.status_code == 422, bad


def test_unknown_street_or_sector_is_rejected(
    client: TestClient, staff_token_headers: Headers
) -> None:
    for extra in ({"street_id": 999999}, {"sector_ids": [999999]}):
        r = client.post(
            f"{API}/residents/", headers=staff_token_headers, json=_payload(**extra)
        )
        assert r.status_code == 422


def test_duplicate_is_warned_then_allowed_when_confirmed(
    client: TestClient, staff_token_headers: Headers
) -> None:
    first = _create(client, staff_token_headers)
    again = _payload(
        first_name=first["first_name"].upper(), last_name=first["last_name"].lower()
    )
    r = client.post(f"{API}/residents/", headers=staff_token_headers, json=again)
    assert r.status_code == 409
    detail = r.json()["detail"]
    assert (
        detail["code"] == "possible_duplicate" and first["id"] in detail["resident_ids"]
    )
    r = client.post(
        f"{API}/residents/",
        headers=staff_token_headers,
        json=again,
        params={"confirm_duplicate": True},
    )
    assert r.status_code == 201


def test_id_number_must_be_unique(
    client: TestClient, staff_token_headers: Headers
) -> None:
    number = f"ID-{random_lower_string()[:10]}"
    _create(client, staff_token_headers, id_number=number)
    r = client.post(
        f"{API}/residents/",
        headers=staff_token_headers,
        json=_payload(id_number=number),
    )
    assert r.status_code == 409


def test_unknown_resident_is_404(
    client: TestClient, staff_token_headers: Headers
) -> None:
    assert (
        client.get(
            f"{API}/residents/{uuid.uuid4()}", headers=staff_token_headers
        ).status_code
        == 404
    )


# --- Update, sectors, search -------------------------------------------------


def test_update_changes_only_sent_fields_and_sectors(
    client: TestClient, staff_token_headers: Headers, db: Session
) -> None:
    s1, s2 = _sector_ids(db)
    created = _create(client, staff_token_headers, sector_ids=[s1, s1])
    assert created["sector_ids"] == [s1]
    r = client.patch(
        f"{API}/residents/{created['id']}",
        headers=staff_token_headers,
        json={"sector_ids": [s2], "birth_place": "  Los Baños  "},
    )
    body = r.json()
    assert body["sector_ids"] == [s2] and body["birth_place"] == "Los Baños"
    assert body["first_name"] == created["first_name"]
    audit = _audit(db, "resident.update", created["id"])
    assert audit and audit[0].details == {"fields": ["birth_place", "sector_ids"]}


def test_update_cannot_blank_required_names(
    client: TestClient, staff_token_headers: Headers
) -> None:
    rid = _create(client, staff_token_headers)["id"]
    r = client.patch(
        f"{API}/residents/{rid}", headers=staff_token_headers, json={"last_name": None}
    )
    assert r.status_code == 422


def test_update_ignores_protected_fields(
    client: TestClient, staff_token_headers: Headers
) -> None:
    created = _create(client, staff_token_headers)
    r = client.patch(
        f"{API}/residents/{created['id']}",
        headers=staff_token_headers,
        json={
            "status": "archived",
            "archive_reason": "hack",
            "created_at": "2000-01-01T00:00:00Z",
        },
    )
    assert r.status_code == 200
    assert r.json()["status"] == "active" and r.json()["archive_reason"] is None
    assert r.json()["created_at"] == created["created_at"]


def test_search_matches_each_word_and_filters_by_sector(
    client: TestClient, staff_token_headers: Headers, db: Session
) -> None:
    sector = _sector_ids(db, 1)[0]
    tag = random_lower_string()[:8]
    a = _create(
        client,
        staff_token_headers,
        first_name=f"Maria{tag}",
        last_name="Santos",
        sector_ids=[sector],
    )
    _create(client, staff_token_headers, first_name=f"Pedro{tag}", last_name="Santos")
    r = client.get(
        f"{API}/residents/",
        headers=staff_token_headers,
        params={"q": f"santos maria{tag}"},
    ).json()
    assert [x["id"] for x in r["data"]] == [a["id"]] and r["count"] == 1
    r = client.get(
        f"{API}/residents/",
        headers=staff_token_headers,
        params={"q": tag, "sector_id": sector},
    ).json()
    assert [x["id"] for x in r["data"]] == [a["id"]]


def test_search_matches_address_and_id_number(
    client: TestClient, staff_token_headers: Headers, db: Session
) -> None:
    tag = random_lower_string()[:8]
    street = Street(name=f"Search Road {tag}")
    db.add(street)
    db.commit()
    db.refresh(street)
    resident = _create(
        client,
        staff_token_headers,
        house_number=f"{tag}-17",
        street_id=street.id,
        id_number=f"MAY-{tag.upper()}-01",
    )

    for term in (tag, street.name, f"MAY-{tag.upper()}-01"):
        response = client.get(
            f"{API}/residents/",
            headers=staff_token_headers,
            params={"q": term},
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["count"] == 1
        assert [row["id"] for row in body["data"]] == [resident["id"]]

def test_list_pagination_limits(
    client: TestClient, staff_token_headers: Headers
) -> None:
    assert (
        client.get(
            f"{API}/residents/", headers=staff_token_headers, params={"limit": 201}
        ).status_code
        == 422
    )
    assert (
        client.get(
            f"{API}/residents/", headers=staff_token_headers, params={"limit": 1}
        ).status_code
        == 200
    )


# --- Archive and restore -----------------------------------------------------


def test_archive_hides_resident_blocks_edits_and_restores(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    db: Session,
) -> None:
    created = _create(client, staff_token_headers)
    rid = created["id"]
    r = client.post(
        f"{API}/residents/{rid}/archive",
        headers=superuser_token_headers,
        json={"reason": "Moved away"},
    )
    assert r.status_code == 200 and r.json()["status"] == "archived"
    assert r.json()["archive_reason"] == "Moved away"
    assert audit_reason(db, rid) == "Moved away"
    default = client.get(
        f"{API}/residents/",
        headers=staff_token_headers,
        params={"q": created["last_name"]},
    ).json()
    assert default["count"] == 0
    archived = client.get(
        f"{API}/residents/",
        headers=staff_token_headers,
        params={"q": created["last_name"], "status": "archived"},
    ).json()
    assert archived["count"] == 1
    assert (
        client.patch(
            f"{API}/residents/{rid}", headers=staff_token_headers, json={"purok": 1}
        ).status_code
        == 409
    )
    assert (
        client.post(
            f"{API}/residents/{rid}/archive",
            headers=superuser_token_headers,
            json={"reason": "again"},
        ).status_code
        == 409
    )
    r = client.post(f"{API}/residents/{rid}/restore", headers=superuser_token_headers)
    assert r.status_code == 200 and r.json()["status"] == "active"
    assert r.json()["archive_reason"] is None
    assert (
        client.patch(
            f"{API}/residents/{rid}", headers=staff_token_headers, json={"purok": 1}
        ).status_code
        == 200
    )


def audit_reason(db: Session, rid: str) -> str | None:
    rows = _audit(db, "resident.archive", rid)
    return rows[0].reason if rows else None


def test_archive_requires_a_reason(
    client: TestClient, staff_token_headers: Headers, superuser_token_headers: Headers
) -> None:
    rid = _create(client, staff_token_headers)["id"]
    for body in ({}, {"reason": ""}, {"reason": "  "}):
        r = client.post(
            f"{API}/residents/{rid}/archive", headers=superuser_token_headers, json=body
        )
        assert r.status_code == 422


def test_database_rejects_inconsistent_archive_fields(db: Session) -> None:
    from sqlalchemy.exc import IntegrityError

    bad = Resident(first_name="Bad", last_name="Row", status="archived")
    db.add(bad)
    try:
        db.commit()
        raise AssertionError("archived without reason must be rejected")
    except IntegrityError:
        db.rollback()


# --- Photo -------------------------------------------------------------------


def test_photo_upload_download_replace_delete(
    client: TestClient, staff_token_headers: Headers, db: Session
) -> None:
    rid = _create(client, staff_token_headers)["id"]
    url = f"{API}/residents/{rid}/photo"
    assert client.get(url, headers=staff_token_headers).status_code == 404
    r = client.put(url, headers=staff_token_headers, content=PNG)
    assert r.status_code == 200 and r.json()["has_photo"] is True
    got = client.get(url, headers=staff_token_headers)
    assert got.status_code == 200 and got.content == PNG
    assert got.headers["content-type"] == "image/png"
    assert "no-store" in got.headers["cache-control"]
    assert client.put(url, headers=staff_token_headers, content=WEBP).status_code == 200
    assert (
        client.get(url, headers=staff_token_headers).headers["content-type"]
        == "image/webp"
    )
    assert client.delete(url, headers=staff_token_headers).json()["has_photo"] is False
    assert client.get(url, headers=staff_token_headers).status_code == 404
    assert _audit(db, "resident.photo_set", rid) and _audit(
        db, "resident.photo_remove", rid
    )


def test_photo_rejects_wrong_type_and_oversize(
    client: TestClient, staff_token_headers: Headers
) -> None:
    rid = _create(client, staff_token_headers)["id"]
    url = f"{API}/residents/{rid}/photo"
    # A name or header saying "png" does not matter; the first bytes decide.
    r = client.put(
        url,
        headers={**staff_token_headers, "Content-Type": "image/png"},
        content=b"<html>not an image</html>",
    )
    assert r.status_code == 415
    assert (
        client.put(
            url, headers=staff_token_headers, content=b"\xff\xd8\xff" + b"0" * 50
        ).status_code
        == 415
    )
    too_big = PNG + b"0" * 307200
    assert (
        client.put(url, headers=staff_token_headers, content=too_big).status_code == 413
    )
    assert client.get(url, headers=staff_token_headers).status_code == 404


def test_photo_not_in_list_payload_but_flag_is(
    client: TestClient, staff_token_headers: Headers
) -> None:
    created = _create(client, staff_token_headers)
    client.put(
        f"{API}/residents/{created['id']}/photo",
        headers=staff_token_headers,
        content=PNG,
    )
    listed = client.get(
        f"{API}/residents/",
        headers=staff_token_headers,
        params={"q": created["last_name"]},
    ).json()
    row = listed["data"][0]
    assert row["has_photo"] is True and "content" not in row and "photo_url" not in row


# --- Helpers ----------------------------------------------------------------


def test_age_is_computed_on_the_birthday_boundary() -> None:
    from datetime import date

    assert age_on(date(2000, 6, 15), date(2026, 6, 14)) == 25
    assert age_on(date(2000, 6, 15), date(2026, 6, 15)) == 26
    assert age_on(None) is None


def test_today_is_manila_not_utc() -> None:
    from datetime import UTC, datetime

    utc_now = datetime.now(UTC)
    assert today_manila() - utc_now.date() in (timedelta(0), timedelta(days=1))
