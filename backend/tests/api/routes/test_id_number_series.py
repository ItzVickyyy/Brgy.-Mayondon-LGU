# ruff: noqa: F811  (fixtures imported from test_issuances are used as parameters)
"""Barangay ID number series: setup, automatic numbers, overrides, restarts."""

import threading
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, col, select

from app.api.routes.issuances import _allocate_series_number
from app.core.config import settings
from app.core.dates import today_manila
from app.core.db import engine
from app.models_foundation import AuditLog
from app.models_issuance import IdNumberSeries, format_id_number
from tests.api.routes.test_barangay_ids import (  # noqa: F401  (fixtures are reused)
    _card,
    _draft,
    _id_resident,
    _issue_card,
    _resident_number,
    _try_issue,
)
from tests.api.routes.test_issuances import (  # noqa: F401  (fixtures are reused)
    _tidy_up,
    street_id,
)
from tests.utils.utils import random_lower_string

API = settings.API_V1_STR
SERIES = f"{API}/barangay-ids/series"
Headers = dict[str, str]


@pytest.fixture(autouse=True)
def _series_off(db: Session) -> Generator[None]:
    """Every test starts and ends with the series switched off and reset."""

    def reset() -> None:
        db.rollback()
        row = db.get(IdNumberSeries, 1)
        assert row is not None
        row.prefix = ""
        row.include_year = False
        row.digit_width = 0
        row.restart_yearly = False
        row.next_number = 1
        row.counter_year = None
        row.enabled = False
        db.add(row)
        db.commit()

    reset()
    yield
    reset()


def _set(
    client: TestClient, headers: Headers, expect: int = 200, **body: object
) -> dict:
    payload = {
        "prefix": "",
        "include_year": False,
        "digit_width": 0,
        "restart_yearly": False,
        "next_number": 1,
        "enabled": True,
        **body,
    }
    r = client.put(SERIES, headers=headers, json=payload)
    assert r.status_code == expect, r.text
    return r.json()


def _prefix() -> str:
    return f"S{random_lower_string()[:6].upper()}-"


# --- Formatting ---------------------------------------------------------------


def test_numbers_are_built_from_prefix_year_and_width() -> None:
    plain = IdNumberSeries(prefix="12-345-6789-", digit_width=0)
    assert format_id_number(plain, 7, 2026) == "12-345-6789-7"
    padded = IdNumberSeries(prefix="", include_year=True, digit_width=4)
    assert format_id_number(padded, 7, 2026) == "2026-0007"
    assert format_id_number(padded, 12345, 2026) == "2026-12345"
    no_year = IdNumberSeries(prefix="MAY-", include_year=False, digit_width=3)
    assert format_id_number(no_year, 7, 2026) == "MAY-007"


# --- Setup --------------------------------------------------------------------


def test_series_starts_switched_off(
    client: TestClient, superuser_token_headers: Headers, staff_token_headers: Headers
) -> None:
    row = client.get(SERIES, headers=superuser_token_headers).json()
    assert row["enabled"] is False
    assert row["preview"] == "1"
    status = client.get(f"{SERIES}/status", headers=staff_token_headers)
    assert status.status_code == 200
    assert status.json() == {"enabled": False, "preview": None}


def test_only_an_administrator_sets_the_series(
    client: TestClient, staff_token_headers: Headers
) -> None:
    assert client.get(SERIES, headers=staff_token_headers).status_code == 403
    body = {"next_number": 5, "enabled": True}
    assert client.put(SERIES, headers=staff_token_headers, json=body).status_code == 403


def test_setup_is_checked_and_audited(
    client: TestClient, superuser_token_headers: Headers, db: Session
) -> None:
    _set(client, superuser_token_headers, expect=422, restart_yearly=True)
    _set(client, superuser_token_headers, expect=422, digit_width=13)
    _set(client, superuser_token_headers, expect=422, next_number=0)
    prefix = _prefix()
    saved = _set(client, superuser_token_headers, prefix=prefix, next_number=57)
    assert saved["preview"] == f"{prefix}57"
    assert saved["enabled"] is True
    assert saved["updated_by_name"]
    status = client.get(f"{SERIES}/status", headers=superuser_token_headers).json()
    assert status == {"enabled": True, "preview": f"{prefix}57"}
    db.rollback()
    rows = db.exec(
        select(AuditLog).where(col(AuditLog.action) == "id_series.update")
    ).all()
    assert rows
    assert any(
        r.details.get("next_number") == 57
        and r.details.get("numbering") == "on"
        and "prefix" in str(r.details.get("fields"))
        for r in rows
    )
    # Saving the same values again changes nothing, so it writes no row.
    count = len(rows)
    _set(client, superuser_token_headers, prefix=prefix, next_number=57)
    db.rollback()
    assert (
        len(
            db.exec(
                select(AuditLog).where(col(AuditLog.action) == "id_series.update")
            ).all()
        )
        == count
    )


# --- Automatic numbers --------------------------------------------------------


def test_series_off_keeps_manual_numbers(
    client: TestClient, staff_token_headers: Headers, street_id: int
) -> None:
    res = _id_resident(client, staff_token_headers, street_id)
    draft = _draft(client, staff_token_headers, res["id"], _card())
    status, body = _try_issue(client, staff_token_headers, draft["id"])
    assert status == 422
    assert body["detail"]["code"] == "id_number_required"


def test_new_cards_get_consecutive_numbers(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
    db: Session,
) -> None:
    prefix = _prefix()
    _set(client, superuser_token_headers, prefix=prefix, next_number=41, digit_width=4)
    first = _id_resident(client, staff_token_headers, street_id)
    second = _id_resident(client, staff_token_headers, street_id)
    done = _issue_card(client, staff_token_headers, first["id"])
    assert done["barangay_id"]["id_number"] == f"{prefix}0041"
    _issue_card(client, staff_token_headers, second["id"])
    assert _resident_number(client, staff_token_headers, first["id"]) == f"{prefix}0041"
    assert (
        _resident_number(client, staff_token_headers, second["id"]) == f"{prefix}0042"
    )
    row = client.get(SERIES, headers=superuser_token_headers).json()
    assert row["next_number"] == 43
    db.rollback()
    issue_rows = db.exec(
        select(AuditLog).where(col(AuditLog.record_id) == done["id"])
    ).all()
    sources = [r.details.get("id_number_source") for r in issue_rows]
    assert "series" in sources


def test_numbers_already_taken_are_skipped(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    prefix = _prefix()
    holder = _id_resident(client, staff_token_headers, street_id)
    _issue_card(client, staff_token_headers, holder["id"], id_number=f"{prefix}5")
    # The series is started too low: 5 belongs to someone, so 6 is handed out.
    _set(client, superuser_token_headers, prefix=prefix, next_number=5)
    other = _id_resident(client, staff_token_headers, street_id)
    done = _issue_card(client, staff_token_headers, other["id"])
    assert done["barangay_id"]["id_number"] == f"{prefix}6"
    row = client.get(SERIES, headers=superuser_token_headers).json()
    assert row["next_number"] == 7


def test_renewal_keeps_the_number_and_uses_none_from_the_series(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    prefix = _prefix()
    _set(client, superuser_token_headers, prefix=prefix, next_number=10)
    res = _id_resident(client, staff_token_headers, street_id)
    _issue_card(client, staff_token_headers, res["id"])
    renewed = _issue_card(
        client, staff_token_headers, res["id"], transaction_type="renewal"
    )
    assert renewed["barangay_id"]["id_number"] == f"{prefix}10"
    row = client.get(SERIES, headers=superuser_token_headers).json()
    assert row["next_number"] == 11


def test_staff_cannot_type_a_number_while_the_series_is_on(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    prefix = _prefix()
    _set(client, superuser_token_headers, prefix=prefix, next_number=3)
    res = _id_resident(client, staff_token_headers, street_id)
    draft = _draft(
        client, staff_token_headers, res["id"], _card(id_number=f"{prefix}999")
    )
    status, body = _try_issue(client, staff_token_headers, draft["id"])
    assert status == 403
    assert body["detail"]["code"] == "id_number_automatic"
    # Nothing was reserved: the next card still gets 3.
    row = client.get(SERIES, headers=superuser_token_headers).json()
    assert row["next_number"] == 3
    assert _resident_number(client, staff_token_headers, res["id"]) is None


def test_administrator_may_type_a_number_and_it_is_recorded(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
    db: Session,
) -> None:
    prefix = _prefix()
    _set(client, superuser_token_headers, prefix=prefix, next_number=3)
    res = _id_resident(client, staff_token_headers, street_id)
    typed = f"{prefix}900"
    done = _issue_card(client, superuser_token_headers, res["id"], id_number=typed)
    assert done["barangay_id"]["id_number"] == typed
    row = client.get(SERIES, headers=superuser_token_headers).json()
    assert row["next_number"] == 3  # an override does not use up a number
    db.rollback()
    rows = db.exec(select(AuditLog).where(col(AuditLog.record_id) == done["id"])).all()
    assert "override" in [r.details.get("id_number_source") for r in rows]


def test_a_typed_number_of_another_resident_is_still_refused(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
) -> None:
    prefix = _prefix()
    holder = _id_resident(client, staff_token_headers, street_id)
    taken = f"{prefix}77"
    _issue_card(client, staff_token_headers, holder["id"], id_number=taken)
    _set(client, superuser_token_headers, prefix=prefix, next_number=100)
    res = _id_resident(client, staff_token_headers, street_id)
    draft = _draft(
        client, superuser_token_headers, res["id"], _card(id_number=taken.lower())
    )
    status, body = _try_issue(client, superuser_token_headers, draft["id"])
    assert status == 409
    assert body["detail"]["code"] == "id_number_in_use"


def test_year_in_the_number_and_yearly_restart(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
    db: Session,
) -> None:
    year = today_manila().year
    _set(
        client,
        superuser_token_headers,
        include_year=True,
        restart_yearly=True,
        digit_width=4,
        next_number=57,
    )
    # Pretend the counter was last used last year: the new year starts at 1.
    row = db.get(IdNumberSeries, 1)
    assert row is not None
    row.counter_year = year - 1
    db.add(row)
    db.commit()
    res = _id_resident(client, staff_token_headers, street_id)
    done = _issue_card(client, staff_token_headers, res["id"])
    assert done["barangay_id"]["id_number"] == f"{year}-0001"
    shown = client.get(SERIES, headers=superuser_token_headers).json()
    assert shown["next_number"] == 2


def test_without_restart_the_count_continues_across_years(
    client: TestClient,
    staff_token_headers: Headers,
    superuser_token_headers: Headers,
    street_id: int,
    db: Session,
) -> None:
    prefix = _prefix()
    _set(client, superuser_token_headers, prefix=prefix, next_number=57)
    row = db.get(IdNumberSeries, 1)
    assert row is not None
    row.counter_year = today_manila().year - 1
    db.add(row)
    db.commit()
    res = _id_resident(client, staff_token_headers, street_id)
    done = _issue_card(client, staff_token_headers, res["id"])
    assert done["barangay_id"]["id_number"] == f"{prefix}57"


def test_longest_possible_number_fits_the_card_field() -> None:
    longest = IdNumberSeries(prefix="P" * 30, include_year=True, digit_width=12)
    assert len(format_id_number(longest, 999_999_999, 2026)) <= 50


def test_two_clerks_issuing_at_once_never_get_the_same_number(
    client: TestClient, superuser_token_headers: Headers
) -> None:
    prefix = _prefix()
    _set(client, superuser_token_headers, prefix=prefix, next_number=20)
    results: list[str] = []

    def second_clerk() -> None:
        with Session(engine) as other:
            results.append(_allocate_series_number(other))
            other.commit()

    with Session(engine) as first:
        one = _allocate_series_number(first)  # reserved, not yet committed
        worker = threading.Thread(target=second_clerk)
        worker.start()
        worker.join(timeout=1.0)
        assert worker.is_alive()  # the second clerk waits for the first
        first.commit()
    worker.join(timeout=10)
    assert not worker.is_alive()
    assert one == f"{prefix}20"
    assert results == [f"{prefix}21"]
