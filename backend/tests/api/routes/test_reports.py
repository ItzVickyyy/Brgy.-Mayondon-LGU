# ruff: noqa: F811  (fixtures imported from test_issuances are used as parameters)
"""Dashboard and management reports: access, numbers, and what they never show.

The database is shared, so most checks compare a figure before and after the
test's own changes instead of expecting an absolute number.
"""

import json
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.core.dates import add_months, today_manila
from app.core.periods import DateRange, months_in, previous_range, resolve_period
from tests.api.routes.test_barangay_ids import (
    _id_resident,
    _issue_card,
    _number,
    _until,
)
from tests.api.routes.test_issuances import (  # noqa: F401  (fixtures are reused)
    _clearance,
    _doc,
    _issue,
    _resident,
    _tidy_up,
    street_id,
)
from tests.api.routes.test_issuances_certificates import SECRET, _marginalized
from tests.utils.user import create_user_with_role, user_authentication_headers
from tests.utils.utils import random_lower_string

API = settings.API_V1_STR
DASH = f"{API}/dashboard"
REP = f"{API}/reports"
Headers = dict[str, str]

REPORT_PATHS = (
    "summary",
    "issuances-by-type",
    "issuances-by-purpose",
    "expiring",
    "account-activity",
    "records-overview",
)


def _get(client: TestClient, headers: Headers, url: str, **params: object) -> dict:
    r = client.get(url, headers=headers, params=params)
    assert r.status_code == 200, r.text
    return r.json()


def _issue_clearance(
    client: TestClient,
    headers: Headers,
    street_id: int,
    *,
    issue_date: date | None = None,
    resident_id: str | None = None,
    **body: object,
) -> dict:
    """Issue a clearance (2 months validity) for a new or given resident."""
    rid = resident_id or _resident(client, headers, street_id)["id"]
    extra = dict(body)
    if issue_date is not None:
        extra["issue_date"] = issue_date.isoformat()
    draft = _clearance(client, headers, rid, **extra)
    return _issue(client, headers, draft["id"])


def _type_row(body: dict, code: str) -> dict:
    return next(row for row in body["data"] if row["code"] == code)


def _expiring_ids(client: TestClient, headers: Headers, **params: object) -> set[str]:
    body = _get(client, headers, f"{REP}/expiring", limit=200, **params)
    return {row["issuance_id"] for row in body["data"]}


# --- Access ---------------------------------------------------------------------


def test_requires_login(client: TestClient) -> None:
    assert client.get(f"{DASH}/").status_code == 401
    for path in REPORT_PATHS:
        assert client.get(f"{REP}/{path}").status_code == 401


def test_reports_are_admin_only_and_the_dashboard_is_for_both(
    client: TestClient, staff_token_headers: Headers, superuser_token_headers: Headers
) -> None:
    for path in REPORT_PATHS:
        assert (
            client.get(f"{REP}/{path}", headers=staff_token_headers).status_code == 403
        )
        assert (
            client.get(f"{REP}/{path}", headers=superuser_token_headers).status_code
            == 200
        )
    assert client.get(f"{DASH}/", headers=staff_token_headers).status_code == 200
    assert client.get(f"{DASH}/", headers=superuser_token_headers).status_code == 200


def test_unknown_period_is_rejected(
    client: TestClient, superuser_token_headers: Headers
) -> None:
    for url in (f"{DASH}/", f"{REP}/summary", f"{REP}/issuances-by-type"):
        r = client.get(
            url, headers=superuser_token_headers, params={"period": "decade"}
        )
        assert r.status_code == 422


# --- Periods (pure) ---------------------------------------------------------------


@pytest.mark.parametrize(
    ("period", "start"),
    [
        ("today", date(2026, 11, 6)),
        ("week", date(2026, 11, 2)),  # Monday
        ("month", date(2026, 11, 1)),
        ("quarter", date(2026, 10, 1)),
        ("3months", date(2026, 9, 1)),
        ("6months", date(2026, 6, 1)),
        ("year", date(2026, 1, 1)),
        ("overall", None),
    ],
)
def test_period_start(period: str, start: date | None) -> None:
    got = resolve_period(period, date(2026, 11, 6))  # type: ignore[arg-type]
    assert got == DateRange(start, date(2026, 11, 6))


def test_previous_period_is_the_same_span_one_unit_earlier() -> None:
    today = date(2026, 3, 31)
    month = resolve_period("month", today)
    assert previous_range("month", month) == DateRange(
        date(2026, 2, 1),
        date(2026, 2, 28),  # day clamped to month end
    )
    week = resolve_period("week", date(2026, 11, 6))
    assert previous_range("week", week) == DateRange(
        date(2026, 10, 26), date(2026, 10, 30)
    )
    year = resolve_period("year", date(2026, 11, 6))
    assert previous_range("year", year) == DateRange(
        date(2025, 1, 1), date(2025, 11, 6)
    )
    assert previous_range("overall", resolve_period("overall", today)) is None


def test_months_in_spans_year_ends() -> None:
    assert months_in(date(2025, 11, 20), date(2026, 2, 3)) == [
        date(2025, 11, 1),
        date(2025, 12, 1),
        date(2026, 1, 1),
        date(2026, 2, 1),
    ]


# --- Dashboard --------------------------------------------------------------------


def test_dashboard_counts_follow_issuing(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    before = _get(client, staff_token_headers, f"{DASH}/")
    draft = _clearance(
        client,
        staff_token_headers,
        _resident(client, staff_token_headers, street_id)["id"],
    )
    mid = _get(client, staff_token_headers, f"{DASH}/")
    assert mid["summary"]["open_drafts"] == before["summary"]["open_drafts"] + 1
    assert (
        mid["summary"]["documents_issued_this_month"]
        == before["summary"]["documents_issued_this_month"]
    )  # a draft is not an issued document
    _issue(client, staff_token_headers, draft["id"])
    after = _get(client, staff_token_headers, f"{DASH}/")

    assert after["summary"]["open_drafts"] == before["summary"]["open_drafts"]
    assert (
        after["summary"]["documents_issued_this_month"]
        == before["summary"]["documents_issued_this_month"] + 1
    )
    assert after["total_issued"] == before["total_issued"] + 1
    assert after["total_issued"] == sum(t["count"] for t in after["by_document_type"])
    assert len(after["by_document_type"]) == 9  # every type, zeros included
    clearance = _type_row({"data": after["by_document_type"]}, "BARANGAY_CLEARANCE")[
        "count"
    ]
    clearance_before = _type_row(
        {"data": before["by_document_type"]}, "BARANGAY_CLEARANCE"
    )["count"]
    assert clearance == clearance_before + 1
    # The bar for the current month is the last one and matches the card.
    last = after["issuances_over_time"][-1]
    assert last["month"] == f"{today_manila():%Y-%m}"
    assert last["count"] == after["summary"]["documents_issued_this_month"]
    assert after["period"]["end"] == today_manila().isoformat()


def test_dashboard_period_limits_the_charts_not_the_month_card(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    last_month = add_months(today_manila(), -1)
    base = _get(client, staff_token_headers, f"{DASH}/", period="month")
    _issue_clearance(client, staff_token_headers, street_id, issue_date=last_month)
    month = _get(client, staff_token_headers, f"{DASH}/", period="month")
    three = _get(client, staff_token_headers, f"{DASH}/", period="3months")
    assert month["total_issued"] == base["total_issued"]  # last month is outside
    assert three["total_issued"] >= month["total_issued"] + 1
    assert len(month["issuances_over_time"]) == 1
    assert len(three["issuances_over_time"]) == 3
    # The cards ignore the period: last month's document is not "this month".
    assert (
        month["summary"]["documents_issued_this_month"]
        == base["summary"]["documents_issued_this_month"]
    )


def test_dashboard_expiring_cards_and_list(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    today = today_manila()
    before = _get(client, staff_token_headers, f"{DASH}/")["summary"]
    soon = _issue_clearance(
        client,
        staff_token_headers,
        street_id,
        issue_date=add_months(today, -2) + timedelta(days=10),  # expires in 10 days
    )
    _issue_clearance(  # already expired: not "expiring soon"
        client, staff_token_headers, street_id, issue_date=add_months(today, -6)
    )
    _issue_clearance(client, staff_token_headers, street_id)  # valid for 2 months
    after = _get(client, staff_token_headers, f"{DASH}/")
    assert after["summary"]["clearances_expiring"] == before["clearances_expiring"] + 1
    assert after["summary"]["clearance_window_days"] == 30
    assert after["summary"]["id_window_days"] == 30
    assert soon["id"] in {row["issuance_id"] for row in after["expiring"]} or (
        len(after["expiring"]) == 10  # a busy database may push it past the limit
    )
    assert all(row["status"] == "expiring_soon" for row in after["expiring"])
    days = [row["days_left"] for row in after["expiring"]]
    assert days == sorted(days) and all(0 <= d <= 30 for d in days)


def test_a_renewed_clearance_is_no_longer_expiring_or_expired(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    today = today_manila()
    res = _resident(client, staff_token_headers, street_id)
    old = _issue_clearance(
        client,
        staff_token_headers,
        street_id,
        resident_id=res["id"],
        issue_date=add_months(today, -6),
    )
    assert old["id"] in _expiring_ids(
        client, superuser_token_headers, status="expired", kind="clearance"
    )
    renewed = _issue_clearance(
        client, staff_token_headers, street_id, resident_id=res["id"]
    )
    for status in ("expired", "expiring_soon", "all"):
        ids = _expiring_ids(client, superuser_token_headers, status=status)
        assert old["id"] not in ids and renewed["id"] not in ids


def test_expiring_report_lists_both_kinds_with_status_and_days(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    today = today_manila()
    clearance = _issue_clearance(
        client,
        staff_token_headers,
        street_id,
        issue_date=add_months(today, -2) + timedelta(days=5),
    )
    res = _id_resident(client, staff_token_headers, street_id)
    card = _issue_card(
        client,
        staff_token_headers,
        res["id"],
        valid_until=_until(10),
        id_number=_number(),
    )
    rows = _get(client, superuser_token_headers, f"{REP}/expiring", limit=200)["data"]
    by_id = {row["issuance_id"]: row for row in rows}
    assert by_id[clearance["id"]]["kind"] == "clearance"
    assert by_id[clearance["id"]]["days_left"] == 5
    assert by_id[clearance["id"]]["status"] == "expiring_soon"
    assert by_id[card["id"]]["kind"] == "barangay_id"
    assert by_id[card["id"]]["days_left"] == 10
    assert by_id[card["id"]]["resident_name"].startswith(res["first_name"])
    # Filters by kind and paging
    only_ids = _get(
        client,
        superuser_token_headers,
        f"{REP}/expiring",
        kind="barangay_id",
        limit=200,
    )
    assert {r["kind"] for r in only_ids["data"]} == {"barangay_id"}
    assert card["id"] in {r["issuance_id"] for r in only_ids["data"]}
    page = _get(client, superuser_token_headers, f"{REP}/expiring", limit=1)
    assert len(page["data"]) == 1 and page["count"] >= 2
    sooner = [r["days_left"] for r in rows]
    assert sooner == sorted(sooner)


# --- Reports: issuances ------------------------------------------------------------


def test_issuances_by_type_counts_issued_voided_and_corrections(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    url = f"{REP}/issuances-by-type"
    before = _get(client, superuser_token_headers, url, period="today")
    first = _issue_clearance(client, staff_token_headers, street_id)
    second = _issue_clearance(client, staff_token_headers, street_id)
    # Void one; correct and re-issue the other.
    assert (
        client.post(
            f"{API}/issuances/{first['id']}/void",
            headers=superuser_token_headers,
            json={"reason": "Issued by mistake"},
        ).status_code
        == 200
    )
    fix = client.post(
        f"{API}/issuances/{second['id']}/correct",
        headers=staff_token_headers,
        json={"reason": "Wrong spelling"},
    )
    assert fix.status_code == 201, fix.text
    _issue(client, staff_token_headers, fix.json()["id"])

    after = _get(client, superuser_token_headers, url, period="today")
    was, now = (
        _type_row(before, "BARANGAY_CLEARANCE"),
        _type_row(after, "BARANGAY_CLEARANCE"),
    )
    assert now["issued"] == was["issued"] + 2  # second + its correction; first is void
    assert now["voided"] == was["voided"] + 1
    assert now["corrections"] == was["corrections"] + 1
    assert after["total_issued"] == sum(r["issued"] for r in after["data"])
    assert after["total_voided"] == sum(r["voided"] for r in after["data"])
    assert after["total_corrections"] == sum(r["corrections"] for r in after["data"])
    assert len(after["data"]) == 9
    shares = [r["share_percent"] for r in after["data"] if r["share_percent"]]
    assert abs(sum(shares) - 100) < 1  # rounding only


def test_issuances_by_type_compares_with_the_previous_period(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    url = f"{REP}/issuances-by-type"
    before = _type_row(
        _get(client, superuser_token_headers, url, period="month"),
        "BARANGAY_CLEARANCE",
    )
    _issue_clearance(
        client,
        staff_token_headers,
        street_id,
        issue_date=add_months(today_manila(), -1),
    )
    body = _get(client, superuser_token_headers, url, period="month")
    row = _type_row(body, "BARANGAY_CLEARANCE")
    assert row["issued"] == before["issued"]
    assert row["previous_issued"] == before["previous_issued"] + 1
    if row["previous_issued"]:
        expected = round(
            (row["issued"] - row["previous_issued"]) * 100 / row["previous_issued"], 1
        )
        assert row["change_percent"] == expected
    previous = body["period"]
    assert previous["previous_start"] is not None
    overall = _get(client, superuser_token_headers, url, period="overall")
    assert overall["period"]["previous_start"] is None
    assert all(r["previous_issued"] is None for r in overall["data"])
    assert all(r["change_percent"] is None for r in overall["data"])


def test_issuances_by_purpose(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    url = f"{REP}/issuances-by-purpose"
    before = _get(client, superuser_token_headers, url, period="today")
    name = f"ZZ test {random_lower_string()[:8]}"
    for _ in range(2):
        rid = _resident(client, staff_token_headers, street_id)["id"]
        draft = _clearance(client, staff_token_headers, rid)
        _issue(client, staff_token_headers, draft["id"], purpose_name=name)
    rid = _resident(client, staff_token_headers, street_id)["id"]
    draft = _clearance(client, staff_token_headers, rid)
    client.patch(
        f"{API}/issuances/{draft['id']}",
        headers=staff_token_headers,
        json={"purpose_id": None},
    )
    _issue(client, staff_token_headers, draft["id"])

    after = _get(client, superuser_token_headers, url, period="today")
    ours = next(r for r in after["data"] if r["purpose"] == name)
    assert ours["issued"] == 2 and ours["purpose_id"] is not None
    assert after["total_issued"] == before["total_issued"] + 3
    assert after["total_issued"] == sum(r["issued"] for r in after["data"])
    counts = [r["issued"] for r in after["data"]]
    assert counts == sorted(counts, reverse=True)
    none = [r for r in after["data"] if r["purpose_id"] is None]
    assert len(none) <= 1


def test_summary_cards(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    before = _get(client, superuser_token_headers, f"{REP}/summary", period="today")
    _issue_clearance(client, staff_token_headers, street_id)
    _issue_clearance(
        client,
        staff_token_headers,
        street_id,
        issue_date=add_months(today_manila(), -6),  # expired
    )
    after = _get(client, superuser_token_headers, f"{REP}/summary", period="today")
    assert (
        after["documents_issued"] == before["documents_issued"] + 1
    )  # the other is back-dated
    assert after["records_expiring"] == before["records_expiring"] + 1


# --- Reports: accounts and records ------------------------------------------------------


def test_account_activity_counts_documents_and_record_changes(
    client: TestClient,
    superuser_token_headers: Headers,
    db: Session,
    street_id: int,
) -> None:
    from app.models import UserRole

    user, password = create_user_with_role(db, UserRole.staff)
    quiet, _ = create_user_with_role(db, UserRole.staff)
    headers = user_authentication_headers(
        client=client, email=user.email, password=password
    )
    res = _resident(client, headers, street_id)  # resident.create
    client.patch(
        f"{API}/residents/{res['id']}", headers=headers, json={"house_number": "99"}
    )  # resident.update
    _issue_clearance(client, headers, street_id, resident_id=res["id"])

    body = _get(
        client, superuser_token_headers, f"{REP}/account-activity", period="today"
    )
    rows = {row["user_id"]: row for row in body["data"]}
    mine = rows[str(user.id)]
    assert mine["documents_issued"] == 1
    assert mine["records_changed"] == 2
    assert mine["email"] == user.email and mine["role"] == "staff"
    assert mine["last_activity"] is not None
    idle = rows[str(quiet.id)]
    assert idle["documents_issued"] == 0 and idle["records_changed"] == 0
    assert idle["last_activity"] is None
    # Sign-ins are not recorded, so the report does not invent them.
    assert "sign_ins" not in mine


def test_records_overview_matches_the_id_list_and_the_dashboard(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    url = f"{REP}/records-overview"
    before = _get(client, superuser_token_headers, url)
    today = today_manila()

    def card(valid_until: str, issue_date: date | None = None) -> None:
        res = _id_resident(client, staff_token_headers, street_id)
        extra = {"issue_date": issue_date.isoformat()} if issue_date else {}
        draft = client.post(
            f"{API}/issuances/",
            headers=staff_token_headers,
            json={
                "document_type_id": _doc(client, staff_token_headers, "BARANGAY_ID"),
                "resident_id": res["id"],
                "barangay_id": {
                    "transaction_type": "new",
                    "valid_until": valid_until,
                    "id_number": _number(),
                },
                **extra,
            },
        )
        assert draft.status_code == 201, draft.text
        _issue(client, staff_token_headers, draft.json()["id"])

    card(_until(200))  # valid
    card(_until(10))  # expiring soon
    card(  # expired
        (today - timedelta(days=30)).isoformat(), issue_date=today - timedelta(days=400)
    )
    after = _get(client, superuser_token_headers, url)
    was, now = before["ids_by_status"], after["ids_by_status"]
    assert now["valid"] == was["valid"] + 1
    assert now["expiring_soon"] == was["expiring_soon"] + 1
    assert now["expired"] == was["expired"] + 1
    assert now["total"] == was["total"] + 3
    assert now["total"] == now["valid"] + now["expiring_soon"] + now["expired"]

    # The same rule as the Records Management ID list and the dashboard card.
    for status in ("valid", "expiring_soon", "expired"):
        listed = client.get(
            f"{API}/barangay-ids/",
            headers=superuser_token_headers,
            params={"status": status, "limit": 1},
        ).json()["count"]
        assert listed == now[status]
    dash = _get(client, superuser_token_headers, f"{DASH}/")["summary"]
    assert dash["barangay_ids_expiring"] == now["expiring_soon"]


def test_records_overview_counts_active_residents_by_sector(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    url = f"{REP}/records-overview"
    before = _get(client, superuser_token_headers, url)
    sectors = client.get(f"{API}/lookups/sectors", headers=staff_token_headers).json()
    target = sectors[0]["id"]
    first = _resident(client, staff_token_headers, street_id, sector_ids=[target])
    second = _resident(client, staff_token_headers, street_id, sector_ids=[target])
    mid = _get(client, superuser_token_headers, url)

    def count(body: dict) -> int:
        return next(
            s["residents"]
            for s in body["residents_by_sector"]
            if s["sector_id"] == target
        )

    assert count(mid) == count(before) + 2
    assert mid["residents_active"] == before["residents_active"] + 2
    assert len(mid["residents_by_sector"]) == len(sectors)  # empty sectors listed too
    # An archived resident leaves the sector count and joins the archived total.
    assert (
        client.post(
            f"{API}/residents/{second['id']}/archive",
            headers=superuser_token_headers,
            json={"reason": "Moved away"},
        ).status_code
        == 200
    )
    after = _get(client, superuser_token_headers, url)
    assert count(after) == count(before) + 1
    assert after["residents_active"] == before["residents_active"] + 1
    assert after["residents_archived"] == before["residents_archived"] + 1
    assert first["id"] != second["id"]


# --- Privacy ---------------------------------------------------------------------------


def test_no_report_or_dashboard_response_holds_the_health_condition_or_totals_with_names(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    res = _resident(client, staff_token_headers, street_id)
    draft = _marginalized(client, staff_token_headers, res["id"])
    _issue(client, staff_token_headers, draft["id"])
    responses = [client.get(f"{DASH}/", headers=staff_token_headers)]
    for path in REPORT_PATHS:
        responses.append(client.get(f"{REP}/{path}", headers=superuser_token_headers))
    assert all(r.status_code == 200 for r in responses)
    for r in responses:
        assert SECRET not in json.dumps(r.json())
    # Totals carry no resident names; only the expiring work list does.
    for path in (
        "summary",
        "issuances-by-type",
        "issuances-by-purpose",
        "records-overview",
    ):
        text = client.get(f"{REP}/{path}", headers=superuser_token_headers).text
        assert res["first_name"] not in text and res["last_name"] not in text


def test_summary_counts_committed_imports(
    client: TestClient, superuser_token_headers: Headers
) -> None:
    def committed() -> int:
        r = client.get(
            f"{REP}/summary",
            headers=superuser_token_headers,
            params={"period": "overall"},
        )
        assert r.status_code == 200, r.text
        return int(r.json()["imports_committed"])

    before = committed()
    last = random_lower_string()[:10].capitalize()
    content = f"First Name,Last Name\nIma,{last}\n".encode()
    batch = client.post(
        f"{API}/imports/",
        headers=superuser_token_headers,
        files={"file": ("list.csv", content)},
    ).json()
    client.put(
        f"{API}/imports/{batch['id']}/mapping",
        headers=superuser_token_headers,
        json={"mapping": batch["suggested_mapping"]},
    )
    # Checked but not finished: not counted yet.
    assert committed() == before
    r = client.post(
        f"{API}/imports/{batch['id']}/commit", headers=superuser_token_headers
    )
    assert r.status_code == 200, r.text
    assert committed() == before + 1
    today = client.get(
        f"{REP}/summary",
        headers=superuser_token_headers,
        params={"period": "today"},
    ).json()
    assert today["imports_committed"] >= 1
