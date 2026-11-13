# ruff: noqa: F811  (fixtures imported from test_issuances are used as parameters)
"""Same-day duplicate warning: the clerk must confirm, both copies stay."""

from datetime import timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session, col, select

from app.core.config import settings
from app.core.dates import today_manila
from app.models_foundation import AuditLog
from tests.api.routes.test_issuances import (  # noqa: F401  (fixtures are reused)
    _clearance,
    _issue,
    _resident,
    _tidy_up,
    street_id,
)

API = settings.API_V1_STR
ISS = f"{API}/issuances"


def _try_issue(
    client: TestClient, headers: dict[str, str], issuance_id: str, **body: object
) -> tuple[int, dict]:
    r = client.post(f"{ISS}/{issuance_id}/issue", headers=headers, json=body or None)
    return r.status_code, r.json()


def test_second_same_day_copy_needs_confirmation(
    client: TestClient,
    staff_token_headers: dict[str, str],
    street_id: int,
    db: Session,
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    first = _issue(
        client,
        staff_token_headers,
        _clearance(client, staff_token_headers, res["id"])["id"],
    )
    second = _clearance(client, staff_token_headers, res["id"])

    code, body = _try_issue(client, staff_token_headers, second["id"])
    assert code == 409
    assert body["detail"]["code"] == "duplicate_same_day"
    assert body["detail"]["reference_no"] == first["reference_no"]
    assert body["detail"]["issue_date"] == first["issue_date"]
    # Nothing was issued: the second one is still a draft.
    still = client.get(f"{ISS}/{second['id']}", headers=staff_token_headers).json()
    assert still["status"] == "draft"
    assert still["reference_no"] is None

    # An explicit "false" is the same as no answer.
    code, _ = _try_issue(
        client, staff_token_headers, second["id"], confirm_duplicate=False
    )
    assert code == 409

    # After confirming, both copies are issued and valid.
    confirmed = _issue(
        client, staff_token_headers, second["id"], confirm_duplicate=True
    )
    assert confirmed["status"] == "issued"
    assert confirmed["reference_no"] != first["reference_no"]
    kept = client.get(f"{ISS}/{first['id']}", headers=staff_token_headers).json()
    assert kept["status"] == "issued"

    # The record names the earlier copy.
    db.rollback()
    row = db.exec(
        select(AuditLog).where(
            col(AuditLog.record_id) == second["id"],
            col(AuditLog.action) == "issuance.issue",
        )
    ).one()
    assert row.details is not None
    assert row.details["duplicate_of"] == first["reference_no"]
    plain = db.exec(
        select(AuditLog).where(
            col(AuditLog.record_id) == first["id"],
            col(AuditLog.action) == "issuance.issue",
        )
    ).one()
    assert plain.details is not None
    assert "duplicate_of" not in plain.details

    # A third copy that day is warned about again.
    third = _clearance(client, staff_token_headers, res["id"])
    code, body = _try_issue(client, staff_token_headers, third["id"])
    assert code == 409
    assert body["detail"]["reference_no"] == first["reference_no"]


def test_other_day_resident_or_type_is_not_a_duplicate(
    client: TestClient, staff_token_headers: dict[str, str], street_id: int
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    other = _resident(client, staff_token_headers, street_id)
    _issue(
        client,
        staff_token_headers,
        _clearance(client, staff_token_headers, res["id"])["id"],
    )
    yesterday = (today_manila() - timedelta(days=1)).isoformat()
    _issue(
        client,
        staff_token_headers,
        _clearance(client, staff_token_headers, res["id"], issue_date=yesterday)["id"],
    )
    _issue(
        client,
        staff_token_headers,
        _clearance(client, staff_token_headers, other["id"])["id"],
    )


def test_a_voided_copy_is_not_a_duplicate(
    client: TestClient,
    staff_token_headers: dict[str, str],
    superuser_token_headers: dict[str, str],
    street_id: int,
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    first = _issue(
        client,
        staff_token_headers,
        _clearance(client, staff_token_headers, res["id"])["id"],
    )
    r = client.post(
        f"{ISS}/{first['id']}/void",
        headers=superuser_token_headers,
        json={"reason": "Printed on the wrong paper"},
    )
    assert r.status_code == 200, r.text
    _issue(
        client,
        staff_token_headers,
        _clearance(client, staff_token_headers, res["id"])["id"],
    )


def test_a_correction_is_not_a_duplicate_of_its_original(
    client: TestClient, staff_token_headers: dict[str, str], street_id: int
) -> None:
    res = _resident(client, staff_token_headers, street_id)
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
    code, body = _try_issue(client, staff_token_headers, draft["id"])
    assert code == 200, body
    assert body["status"] == "issued"
