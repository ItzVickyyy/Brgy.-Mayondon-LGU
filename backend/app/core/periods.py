"""Reporting periods for the dashboard and reports (Manila business dates).

Every period runs from its start up to **today, inclusive** ("to date"), so the
current month is the month so far. The previous period is the same span moved
back by one unit, so a comparison is like for like (month so far against the
same days of last month). Nothing here is stored.

Which periods the client wants is still open (D-21). ``week`` starts on Monday.
``3months`` and ``6months`` are calendar months: the current month plus the two
or five before it, matching the dashboard's monthly bars.
"""

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Literal

from app.core.dates import add_months

Period = Literal[
    "today", "week", "month", "quarter", "3months", "6months", "year", "overall"
]


@dataclass(frozen=True)
class DateRange:
    start: date | None  # None means "from the beginning" (overall)
    end: date  # inclusive


def _first_of_month(day: date, months_back: int = 0) -> date:
    return add_months(day.replace(day=1), -months_back)


def resolve_period(period: Period, today: date) -> DateRange:
    if period == "today":
        return DateRange(today, today)
    if period == "week":
        return DateRange(today - timedelta(days=today.weekday()), today)
    if period == "month":
        return DateRange(_first_of_month(today), today)
    if period == "quarter":
        return DateRange(_first_of_month(today, (today.month - 1) % 3), today)
    if period == "3months":
        return DateRange(_first_of_month(today, 2), today)
    if period == "6months":
        return DateRange(_first_of_month(today, 5), today)
    if period == "year":
        return DateRange(date(today.year, 1, 1), today)
    return DateRange(None, today)


def previous_range(period: Period, current: DateRange) -> DateRange | None:
    """The same span one unit earlier; None for ``overall`` (nothing before)."""
    if current.start is None:
        return None
    if period in ("today", "week"):
        days = 1 if period == "today" else 7
        delta = timedelta(days=days)
        return DateRange(current.start - delta, current.end - delta)
    months = {"month": 1, "quarter": 3, "3months": 3, "6months": 6, "year": 12}[period]
    return DateRange(
        add_months(current.start, -months), add_months(current.end, -months)
    )


def months_in(start: date, end: date) -> list[date]:
    """First day of every month from ``start``'s month to ``end``'s month."""
    first, out = start.replace(day=1), []
    while first <= end:
        out.append(first)
        first = add_months(first, 1)
    return out
