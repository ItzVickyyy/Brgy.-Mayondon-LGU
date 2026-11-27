# ruff: noqa: F811  (fixtures imported from test_issuances are used as parameters)
"""The Deaths report in Management Reports (patch 329)."""

import json
from datetime import timedelta

from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.dates import today_manila
from tests.api.routes.test_issuances import (  # noqa: F401  (fixtures are reused)
    _resident,
    _tidy_up,
    street_id,
)

API = settings.API_V1_STR
REP = f"{API}/reports"
Headers = dict[str, str]
PERIODS = ("today", "week", "month", "quarter", "3months", "6months", "year", "overall")


def _report(client: TestClient, headers: Headers, period: str) -> dict:
    r = client.get(f"{REP}/deaths", headers=headers, params={"period": period})
    assert r.status_code == 200, r.text
    return r.json()


def _all(client: TestClient, headers: Headers) -> dict[str, dict]:
    return {p: _report(client, headers, p) for p in PERIODS}


def _die(
    client: TestClient,
    admin: Headers,
    staff: Headers,
    street_id: int,
    *,
    when: str | None,
    precision: str,
    evidence: str = "reported",
    **resident: object,
) -> dict:
    res = _resident(client, staff, street_id, **resident)
    body: dict[str, object] = {"date_precision": precision, "evidence": evidence}
    if when is not None:
        body["date_of_death"] = when
    r = client.post(f"{API}/residents/{res['id']}/deceased", headers=admin, json=body)
    assert r.status_code == 200, r.text
    return res


def test_a_day_death_counts_in_every_period_that_holds_the_day(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    before = _all(client, superuser_token_headers)
    _die(
        client,
        superuser_token_headers,
        staff_token_headers,
        street_id,
        when=today_manila().isoformat(),
        precision="day",
        evidence="verified",
    )
    after = _all(client, superuser_token_headers)
    for p in PERIODS:
        assert after[p]["total"] == before[p]["total"] + 1, p
        assert after[p]["verified"] == before[p]["verified"] + 1, p
        assert after[p]["reported"] == before[p]["reported"], p
        assert after[p]["by_sex"]["female"] == before[p]["by_sex"]["female"] + 1, p
        assert after[p]["period"]["period"] == p


def test_a_day_death_before_the_period_is_left_out(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    before = _all(client, superuser_token_headers)
    _die(
        client,
        superuser_token_headers,
        staff_token_headers,
        street_id,
        when=(today_manila() - timedelta(days=800)).isoformat(),
        precision="day",
    )
    after = _all(client, superuser_token_headers)
    assert after["overall"]["total"] == before["overall"]["total"] + 1
    for p in ("today", "week", "month", "quarter", "3months", "6months", "year"):
        assert after[p]["total"] == before[p]["total"], p


def test_a_month_only_death_counts_from_a_month_up_never_in_a_day_or_week(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    before = _all(client, superuser_token_headers)
    # Any day of this month: the server keeps the first.
    _die(
        client,
        superuser_token_headers,
        staff_token_headers,
        street_id,
        when=today_manila().isoformat(),
        precision="month",
    )
    after = _all(client, superuser_token_headers)
    for p in ("month", "quarter", "3months", "6months", "year", "overall"):
        assert after[p]["total"] == before[p]["total"] + 1, p
        assert after[p]["date_too_general"] == before[p]["date_too_general"], p
    for p in ("today", "week"):
        assert after[p]["total"] == before[p]["total"], p
        # It may have happened inside the day or week, so it is not hidden.
        assert after[p]["date_too_general"] == before[p]["date_too_general"] + 1, p


def test_a_year_only_death_counts_only_in_a_year_or_overall(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    before = _all(client, superuser_token_headers)
    _die(
        client,
        superuser_token_headers,
        staff_token_headers,
        street_id,
        when=today_manila().replace(month=1, day=1).isoformat(),
        precision="year",
    )
    after = _all(client, superuser_token_headers)
    for p in ("year", "overall"):
        assert after[p]["total"] == before[p]["total"] + 1, p
    for p in ("today", "week", "month", "quarter", "3months", "6months"):
        assert after[p]["total"] == before[p]["total"], p
        assert after[p]["date_too_general"] == before[p]["date_too_general"] + 1, p


def test_a_death_with_no_date_is_in_no_period_but_is_shown(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    before = _all(client, superuser_token_headers)
    _die(
        client,
        superuser_token_headers,
        staff_token_headers,
        street_id,
        when=None,
        precision="unknown",
    )
    after = _all(client, superuser_token_headers)
    for p in PERIODS:
        assert after[p]["total"] == before[p]["total"], p
        assert after[p]["date_unknown"] == before[p]["date_unknown"] + 1, p


def test_age_group_follows_the_profile_rule(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    today = today_manila()
    before = _report(client, superuser_token_headers, "overall")
    # Born 70 years ago, died today: 65+ (day-exact, birthdate known).
    _die(
        client,
        superuser_token_headers,
        staff_token_headers,
        street_id,
        when=today.isoformat(),
        precision="day",
        birthdate=(
            today.replace(year=today.year - 70) - timedelta(days=30)
        ).isoformat(),
    )
    # Month-only: no age is worked out, so it goes to "unknown".
    _die(
        client,
        superuser_token_headers,
        staff_token_headers,
        street_id,
        when=today.isoformat(),
        precision="month",
    )
    after = _report(client, superuser_token_headers, "overall")

    def by_age(report: dict) -> dict[str, int]:
        return {row["bracket"]: row["count"] for row in report["by_age"]}

    assert [row["bracket"] for row in after["by_age"]] == [
        "0-17",
        "18-29",
        "30-49",
        "50-64",
        "65+",
        "unknown",
    ]
    assert by_age(after)["65+"] == by_age(before)["65+"] + 1
    assert by_age(after)["unknown"] == by_age(before)["unknown"] + 1
    assert sum(by_age(after).values()) == after["total"]


def test_sex_and_purok_are_counted_and_missing_ones_shown(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    today = today_manila().isoformat()
    before = _report(client, superuser_token_headers, "overall")
    _die(
        client,
        superuser_token_headers,
        staff_token_headers,
        street_id,
        when=today,
        precision="day",
        sex="Male",
        purok=7,
    )
    _die(
        client,
        superuser_token_headers,
        staff_token_headers,
        street_id,
        when=today,
        precision="day",
        sex=None,
        purok=None,
    )
    after = _report(client, superuser_token_headers, "overall")
    assert after["by_sex"]["male"] == before["by_sex"]["male"] + 1
    assert after["by_sex"]["not_recorded"] == before["by_sex"]["not_recorded"] + 1
    assert after["purok_not_recorded"] == before["purok_not_recorded"] + 1

    def purok(report: dict, number: int) -> int:
        return next((r["count"] for r in report["by_purok"] if r["purok"] == number), 0)

    assert purok(after, 7) == purok(before, 7) + 1
    sexes = after["by_sex"]
    assert sexes["male"] + sexes["female"] + sexes["not_recorded"] == after["total"]
    assert (
        sum(r["count"] for r in after["by_purok"]) + after["purok_not_recorded"]
        == after["total"]
    )
    assert after["verified"] + after["reported"] == after["total"]


def test_a_voided_death_is_no_longer_counted(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    before = _report(client, superuser_token_headers, "overall")
    res = _die(
        client,
        superuser_token_headers,
        staff_token_headers,
        street_id,
        when=today_manila().isoformat(),
        precision="day",
    )
    assert (
        _report(client, superuser_token_headers, "overall")["total"]
        == before["total"] + 1
    )
    r = client.post(
        f"{API}/residents/{res['id']}/deceased/void",
        headers=superuser_token_headers,
        json={"reason": "Wrong person"},
    )
    assert r.status_code == 200, r.text
    back = _report(client, superuser_token_headers, "overall")
    assert back["total"] == before["total"]
    assert back["by_sex"] == before["by_sex"]
    assert back["by_age"] == before["by_age"]


def test_the_report_holds_no_name_and_no_date_of_death(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    res = _die(
        client,
        superuser_token_headers,
        staff_token_headers,
        street_id,
        when="2026-03-15",
        precision="day",
    )
    text = json.dumps(_report(client, superuser_token_headers, "overall"))
    assert res["first_name"] not in text and res["last_name"] not in text
    assert "2026-03-15" not in text and "source_note" not in text


def test_records_overview_counts_the_deceased(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    url = f"{REP}/records-overview"
    before = client.get(url, headers=superuser_token_headers).json()
    res = _die(
        client,
        superuser_token_headers,
        staff_token_headers,
        street_id,
        when=today_manila().isoformat(),
        precision="day",
    )
    after = client.get(url, headers=superuser_token_headers).json()
    assert after["residents_deceased"] == before["residents_deceased"] + 1
    client.post(
        f"{API}/residents/{res['id']}/deceased/void",
        headers=superuser_token_headers,
        json={"reason": "Wrong person"},
    )
    back = client.get(url, headers=superuser_token_headers).json()
    assert back["residents_deceased"] == before["residents_deceased"]
