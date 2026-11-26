# ruff: noqa: F811  (fixtures imported from test_issuances are used as parameters)
"""Certificate of Utilization: the figures it fills in and the audit row on print.

The database is shared, so counts are compared before and after the test's own
issuances instead of expecting an absolute number."""

from datetime import timedelta

import pytest
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
    official_id,
    street_id,
)

API = settings.API_V1_STR
UTIL = f"{API}/utilization"
Headers = dict[str, str]


def _figures(client: TestClient, headers: Headers, **params: object) -> dict:
    r = client.get(f"{UTIL}/", headers=headers, params=params)
    assert r.status_code == 200, r.text
    return r.json()


def test_requires_login(client: TestClient) -> None:
    assert client.get(f"{UTIL}/").status_code == 401
    assert client.post(f"{UTIL}/printed", json={"month": "2026-11"}).status_code == 401


def test_staff_and_admin_can_read_it(
    client: TestClient, staff_token_headers: Headers, superuser_token_headers: Headers
) -> None:
    for headers in (staff_token_headers, superuser_token_headers):
        body = _figures(client, headers)
        today = today_manila()
        assert body["month"] == f"{today.year:04d}-{today.month:02d}"
        assert body["month_start"] == today.replace(day=1).isoformat()
        assert body["month_end"] == today.isoformat()  # this month: up to today
        assert body["clients_served"] <= body["documents_issued"]


@pytest.mark.usefixtures("official_id")
def test_counts_each_resident_once_and_ignores_voided(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    before = _figures(client, staff_token_headers)
    first = _resident(client, staff_token_headers, street_id)
    second = _resident(client, staff_token_headers, street_id)
    one = _issue(
        client,
        staff_token_headers,
        _clearance(client, staff_token_headers, first["id"])["id"],
    )
    _issue(
        client,
        staff_token_headers,
        _clearance(client, staff_token_headers, second["id"])["id"],
    )
    after = _figures(client, staff_token_headers)
    assert after["clients_served"] == before["clients_served"] + 2
    assert after["documents_issued"] == before["documents_issued"] + 2

    # A voided document is not a client served.
    voided = client.post(
        f"{API}/issuances/{one['id']}/void",
        headers=superuser_token_headers,
        json={"reason": "Test void"},
    )
    assert voided.status_code == 200, voided.text
    final = _figures(client, staff_token_headers)
    assert final["clients_served"] == before["clients_served"] + 1
    assert final["documents_issued"] == before["documents_issued"] + 1


def test_a_past_month_is_whole_and_a_future_month_is_refused(
    client: TestClient, staff_token_headers: Headers
) -> None:
    today = today_manila()
    last_month_end = today.replace(day=1) - timedelta(days=1)
    key = f"{last_month_end.year:04d}-{last_month_end.month:02d}"
    body = _figures(client, staff_token_headers, month=key)
    assert body["month_start"] == last_month_end.replace(day=1).isoformat()
    assert body["month_end"] == last_month_end.isoformat()
    future = f"{today.year + 1:04d}-01"
    r = client.get(f"{UTIL}/", headers=staff_token_headers, params={"month": future})
    assert r.status_code == 422
    for bad in ("2026-13", "2026-1", "november", "2026-11-01"):
        r = client.get(f"{UTIL}/", headers=staff_token_headers, params={"month": bad})
        assert r.status_code == 422, bad


@pytest.mark.usefixtures("official_id")
def test_names_the_current_punong_barangay(
    client: TestClient, staff_token_headers: Headers
) -> None:
    body = _figures(client, staff_token_headers)
    assert isinstance(body["punong_barangay"], str)
    assert body["punong_barangay"]


def test_printing_is_logged_with_the_month_only(
    client: TestClient, db: Session, staff_token_headers: Headers
) -> None:
    db.rollback()
    before = len(
        db.exec(
            select(AuditLog).where(col(AuditLog.action) == "utilization.print")
        ).all()
    )
    r = client.post(
        f"{UTIL}/printed", headers=staff_token_headers, json={"month": "2026-11"}
    )
    assert r.status_code == 204
    db.rollback()
    rows = db.exec(
        select(AuditLog)
        .where(col(AuditLog.action) == "utilization.print")
        .order_by(col(AuditLog.id))
    ).all()
    assert len(rows) == before + 1
    assert rows[-1].module == "reports"
    assert rows[-1].details == {"period": "2026-11"}
    bad = client.post(
        f"{UTIL}/printed", headers=staff_token_headers, json={"month": "soon"}
    )
    assert bad.status_code == 422


REPORT = f"{API}/reports/utilization"


def test_report_is_for_administrators_only(
    client: TestClient, staff_token_headers: Headers
) -> None:
    assert client.get(REPORT).status_code == 401
    assert client.get(REPORT, headers=staff_token_headers).status_code == 403


def test_report_rows_match_the_monthly_certificate(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
) -> None:
    today = today_manila()
    r = client.get(REPORT, headers=superuser_token_headers, params={"period": "year"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert [row["month"] for row in body["data"]] == [
        f"{today.year:04d}-{month:02d}" for month in range(1, today.month + 1)
    ]
    assert body["data"][-1]["month_end"] == today.isoformat()
    for row in body["data"]:
        # The same figures the monthly certificate prints.
        month = _figures(client, staff_token_headers, month=row["month"])
        assert row["clients_served"] == month["clients_served"]
        assert row["documents_issued"] == month["documents_issued"]
    assert body["total_documents"] == sum(
        row["documents_issued"] for row in body["data"]
    )
    # A resident who came in two months is one client for the whole period.
    assert body["total_clients"] <= sum(row["clients_served"] for row in body["data"])


def test_report_this_month_is_one_row(
    client: TestClient, superuser_token_headers: Headers
) -> None:
    body = client.get(
        REPORT, headers=superuser_token_headers, params={"period": "month"}
    ).json()
    assert len(body["data"]) == 1
    assert body["data"][0]["clients_served"] == body["total_clients"]
    assert body["data"][0]["documents_issued"] == body["total_documents"]
