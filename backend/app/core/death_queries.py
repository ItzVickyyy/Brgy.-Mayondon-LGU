"""Deaths per period for Management Reports (counts only, patch 329).

No name, date of death, source note or birthdate leaves this module: only
totals, by evidence, sex, age group and purok. A voided death record is never
counted. Dates are Manila business dates, like every other report.

**Which period a death falls in** follows how exactly the date is known:

* A date known to the **day** counts in every period that contains that day.
* A date known to the **month** counts in a period of a month or longer
  (``month``, ``quarter``, ``3months``, ``6months``, ``year``, ``overall``) that
  contains the first day of that month; never in ``today`` or ``week``.
* A date known to the **year** counts only in ``year`` and ``overall``.
* A death with **no date** is in no period. It is shown on its own line.

A death whose date is too general for the chosen period but could have fallen
inside it is shown on a second line (``date_too_general``), so the totals never
claim more than the records say.
"""

from datetime import date, timedelta

from sqlmodel import Session, col, select

from app.core.dates import add_months
from app.core.periods import DateRange, Period
from app.core.population_queries import AGE_BRACKETS, age_on
from app.models_reports import (
    AgeBracketCount,
    DeathsReportPublic,
    PeriodInfo,
    PurokCount,
    SexCounts,
)
from app.models_residents import Resident, ResidentDeath

# The coarsest date precision a period can place a death with.
_PRECISION_RANK = {"day": 0, "month": 1, "year": 2}
_PERIOD_RANK: dict[Period, int] = {
    "today": 0,
    "week": 0,
    "month": 1,
    "quarter": 1,
    "3months": 1,
    "6months": 1,
    "year": 2,
    "overall": 2,
}
AGE_UNKNOWN = "unknown"


def _span(day: date, precision: str) -> tuple[date, date]:
    """First and last day the death could have happened on."""
    if precision == "month":
        return day, add_months(day, 1) - timedelta(days=1)
    if precision == "year":
        return day, date(day.year, 12, 31)
    return day, day


def _overlaps(span: tuple[date, date], range_: DateRange) -> bool:
    first, last = span
    return first <= range_.end and (range_.start is None or last >= range_.start)


def _age_bracket(age: int) -> int:
    for index, (_, low, high) in enumerate(AGE_BRACKETS):
        if age >= low and (high is None or age <= high):
            return index
    return len(AGE_BRACKETS) - 1


def deaths_report(
    session: Session, period: Period, range_: DateRange, info: PeriodInfo
) -> DeathsReportPublic:
    """The figures behind the Deaths report."""
    rows = session.exec(
        select(
            ResidentDeath,
            col(Resident.sex),
            col(Resident.purok),
            col(Resident.birthdate),
        )
        .join(Resident, col(Resident.id) == col(ResidentDeath.resident_id))
        .where(col(ResidentDeath.voided_at).is_(None))
    ).all()

    total = verified = male = female = sex_missing = purok_missing = 0
    date_unknown = date_too_general = 0
    brackets = [0] * len(AGE_BRACKETS)
    age_missing = 0
    puroks: dict[int, int] = {}
    for death, sex, purok, birthdate in rows:
        if death.date_precision == "unknown" or death.date_of_death is None:
            date_unknown += 1
            continue
        span = _span(death.date_of_death, death.date_precision)
        if _PRECISION_RANK[death.date_precision] > _PERIOD_RANK[period]:
            if _overlaps(span, range_):
                date_too_general += 1
            continue
        first = span[0]
        if first > range_.end or (range_.start is not None and first < range_.start):
            continue
        total += 1
        verified += int(death.evidence == "verified")
        if sex == "Male":
            male += 1
        elif sex == "Female":
            female += 1
        else:
            sex_missing += 1
        if purok is None:
            purok_missing += 1
        else:
            puroks[purok] = puroks.get(purok, 0) + 1
        # Same rule as the profile: an age only for a day-exact death.
        if death.date_precision == "day" and birthdate is not None:
            brackets[_age_bracket(age_on(birthdate, death.date_of_death))] += 1
        else:
            age_missing += 1

    return DeathsReportPublic(
        period=info,
        total=total,
        verified=verified,
        reported=total - verified,
        by_sex=SexCounts(male=male, female=female, not_recorded=sex_missing),
        by_age=[
            *(
                AgeBracketCount(bracket=name, count=brackets[i])
                for i, (name, _, _) in enumerate(AGE_BRACKETS)
            ),
            AgeBracketCount(bracket=AGE_UNKNOWN, count=age_missing),
        ],
        by_purok=[PurokCount(purok=p, count=n) for p, n in sorted(puroks.items())],
        purok_not_recorded=purok_missing,
        date_unknown=date_unknown,
        date_too_general=date_too_general,
    )
