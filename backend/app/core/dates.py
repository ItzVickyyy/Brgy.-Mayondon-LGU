"""Business dates are computed in Philippine time, not the server's UTC.

The Philippines has no daylight saving, so a fixed UTC+8 offset is exact and
needs no time-zone database (which Windows lacks by default).
"""

import calendar
from datetime import UTC, date, datetime, timedelta, timezone

MANILA_TZ = timezone(timedelta(hours=8), name="Asia/Manila")


def today_manila() -> date:
    return datetime.now(UTC).astimezone(MANILA_TZ).date()


def age_on(birthdate: date | None, on: date | None = None) -> int | None:
    """Whole years between ``birthdate`` and ``on`` (default: today in Manila)."""
    if birthdate is None:
        return None
    on = on or today_manila()
    years = on.year - birthdate.year
    if (on.month, on.day) < (birthdate.month, birthdate.day):
        years -= 1
    return max(years, 0)


def add_months(start: date, months: int) -> date:
    """``start`` moved forward by whole months; the day is clamped to month end."""
    index = start.month - 1 + months
    year, month = start.year + index // 12, index % 12 + 1
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(start.day, last_day))
