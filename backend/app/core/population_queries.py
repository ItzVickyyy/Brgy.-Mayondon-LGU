"""Population figures for the dashboard, computed from active residents.

Counts only (decision 3): no name, no health condition. Archived residents are
never counted. The barangay has no household record, so a household is a
distinct house number on a street (see ``household_key``); residents with
neither a street nor a house number cannot be grouped and add no household.
"""

import uuid
from collections import Counter
from datetime import date, timedelta

from sqlmodel import Session, col, select

from app.models_foundation import Sector
from app.models_reports import (
    AgeBracketCount,
    CivilStatusCount,
    DashboardPopulation,
    PurokCount,
    SectoralIndicators,
)
from app.models_residents import Resident, ResidentSector

# Order matters: the dashboard draws the bars left to right.
AGE_BRACKETS: list[tuple[str, int, int | None]] = [
    ("0-17", 0, 17),
    ("18-29", 18, 29),
    ("30-49", 30, 49),
    ("50-64", 50, 64),
    ("65+", 65, None),
]
SENIOR_AGE = 60  # RA 9994: a senior citizen is 60 or older
GROWTH_WINDOW_DAYS = 30

# Stored civil statuses, in the order the dashboard lists them.
CIVIL_STATUS_ORDER = ["Single", "Married", "Widow/Widower", "Legally Separated"]

# Sector names are an editable list, so they are matched by a word they contain.
PWD_WORDS = ("disabilit", "pwd")
SOLO_PARENT_WORDS = ("solo parent",)
SENIOR_WORDS = ("senior",)
URBAN_POOR_WORDS = ("urban poor",)
INDIGENOUS_WORDS = ("indigenous",)

# Age groups of the dashboard's sectoral card (seniors use SENIOR_AGE).
CHILD_MAX_AGE = 12
TEEN_MAX_AGE = 17


def age_on(birthdate: date, today: date) -> int:
    years = today.year - birthdate.year
    if (today.month, today.day) < (birthdate.month, birthdate.day):
        years -= 1
    return years


HouseholdKey = tuple[int | None, str]


def household_key(
    street_id: int | None, house_number: str | None
) -> HouseholdKey | None:
    number = (house_number or "").strip().lower()
    if street_id is None and not number:
        return None
    return (street_id, number)


def _growth(total: int, added: int) -> float | None:
    """Percent change over the window: records added / records before it."""
    before = total - added
    if before <= 0 or added <= 0:
        return None
    return round(added / before * 100, 1)


def _matches(name: str, words: tuple[str, ...]) -> bool:
    lowered = name.lower()
    return any(word in lowered for word in words)


def population_summary(session: Session, today: date) -> DashboardPopulation:
    since = today - timedelta(days=GROWTH_WINDOW_DAYS)
    residents = session.exec(select(Resident).where(Resident.status == "active")).all()

    sectors: dict[int, str] = {}
    for sector_id, name in session.exec(select(col(Sector.id), col(Sector.name))).all():
        if sector_id is not None:
            sectors[sector_id] = name
    pwd_ids = {i for i, n in sectors.items() if _matches(n, PWD_WORDS)}
    solo_ids = {i for i, n in sectors.items() if _matches(n, SOLO_PARENT_WORDS)}
    senior_ids = {i for i, n in sectors.items() if _matches(n, SENIOR_WORDS)}
    urban_ids = {i for i, n in sectors.items() if _matches(n, URBAN_POOR_WORDS)}
    indigenous_ids = {i for i, n in sectors.items() if _matches(n, INDIGENOUS_WORDS)}
    links = session.exec(
        select(col(ResidentSector.resident_id), col(ResidentSector.sector_id))
    ).all()
    sector_of: dict[uuid.UUID, set[int]] = {}
    for resident_id, sector_id in links:
        sector_of.setdefault(resident_id, set()).add(sector_id)

    sexes: Counter[str] = Counter()
    civil: Counter[str] = Counter()
    puroks: Counter[int] = Counter()
    brackets = [0] * len(AGE_BRACKETS)
    voters = voters_added = added = 0
    household_first: dict[HouseholdKey, date] = {}
    pwd = seniors = children = teens = adults = solo = urban = indigenous = 0

    for resident in residents:
        rid = resident.id
        birthdate = resident.birthdate
        created_at = resident.created_at
        created_on = created_at.date()
        is_new = created_on >= since
        added += is_new
        if resident.voter_registration == "registered":
            voters += 1
            voters_added += is_new
        if resident.sex:
            sexes[resident.sex] += 1
        if resident.civil_status:
            civil[resident.civil_status] += 1
        if resident.purok is not None:
            puroks[resident.purok] += 1
        key = household_key(resident.street_id, resident.house_number)
        if key is not None and (
            key not in household_first or created_on < household_first[key]
        ):
            household_first[key] = created_on

        age = age_on(birthdate, today) if birthdate else None
        if age is not None and age >= 0:
            for index, (_, low, high) in enumerate(AGE_BRACKETS):
                if age >= low and (high is None or age <= high):
                    brackets[index] += 1
                    break
            children += age <= CHILD_MAX_AGE
            teens += CHILD_MAX_AGE < age <= TEEN_MAX_AGE
            adults += TEEN_MAX_AGE < age < SENIOR_AGE
        mine = sector_of.get(rid, set())
        pwd += bool(mine & pwd_ids)
        solo += bool(mine & solo_ids)
        urban += bool(mine & urban_ids)
        indigenous += bool(mine & indigenous_ids)
        seniors += bool((age is not None and age >= SENIOR_AGE) or mine & senior_ids)

    total = len(residents)
    households = len(household_first)
    households_added = sum(1 for d in household_first.values() if d >= since)
    civil_rows = [
        CivilStatusCount(status=s, count=civil[s]) for s in CIVIL_STATUS_ORDER
    ]
    civil_rows += [
        CivilStatusCount(status=s, count=n)
        for s, n in civil.items()
        if s not in CIVIL_STATUS_ORDER
    ]
    return DashboardPopulation(
        total_population=total,
        total_households=households,
        total_voters=voters,
        population_growth_percent=_growth(total, added),
        household_growth_percent=_growth(households, households_added),
        voter_growth_percent=_growth(voters, voters_added),
        male=sexes["Male"],
        female=sexes["Female"],
        age_brackets=[
            AgeBracketCount(bracket=name, count=brackets[i])
            for i, (name, _, _) in enumerate(AGE_BRACKETS)
        ],
        by_purok=[PurokCount(purok=p, count=n) for p, n in sorted(puroks.items())],
        civil_status=civil_rows,
        sectoral=SectoralIndicators(
            children=children,
            teens=teens,
            adults=adults,
            senior_citizens=seniors,
            pwd=pwd,
            solo_parents=solo,
            urban_poor=urban,
            indigenous_people=indigenous,
        ),
    )
