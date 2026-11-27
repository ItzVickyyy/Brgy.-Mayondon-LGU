"""Fill a DEVELOPMENT database with made-up sample data.

Use it only on the separate development database (see docs/12-Development-Database.md),
never on the real one:

    docker compose -p mayondon-dev --env-file .env.dev -f compose.yml -f compose.dev.yml \
        exec backend python -m app.sample_data_cli --residents 400

What it adds: 8 streets, 10 barangay officials, the requested number of residents
(default 400; about 6 in 100 archived, about 1 in 4 with a sector, about 1 in 40
recorded as deceased) with invented
names, birthdates and addresses. The lookups (sectors, document types, ID types) and
the two accounts already come from the migrations and ``initial_data``.

Safety, on purpose:
  * It REFUSES to run unless the database name ends with ``_dev``. The real
    database is called ``app``.
  * It REFUSES to run when the database already holds residents, so running it
    twice never doubles the data. To start over, remove the development volume
    (``scripts/dev-db.ps1 reset``).
  * Names are invented, but common Filipino names can match real people by
    chance. Never copy real resident data into the development database.
  * Same ``--seed`` gives the same data every time (default seed 2026).

Exit code 0 = done, 2 = refused.
"""

import argparse
import random
import sys
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func
from sqlmodel import Session, col, select

from app.core.config import settings
from app.core.db import engine
from app.models_foundation import Official, Sector, Street
from app.models_residents import Resident, ResidentDeath, ResidentSector

STREETS = [
    "Rizal Street",
    "Mabini Street",
    "Bonifacio Street",
    "Del Pilar Street",
    "Luna Street",
    "Sampaguita Road",
    "Narra Avenue",
    "Mahogany Lane",
]
MALE = [
    "Juan", "Jose", "Mark", "John Paul", "Ramon", "Carlo", "Eduardo", "Noel",
    "Ricardo", "Jerome", "Arnel", "Benjie", "Romeo", "Dennis", "Rey", "Allan",
]  # fmt: skip
FEMALE = [
    "Maria", "Ana", "Rosalinda", "Grace", "Liza", "Jennifer", "Cristina", "Joy",
    "Marites", "Elena", "Angelica", "Dolores", "Nenita", "Rowena", "Shiela", "Lorna",
]  # fmt: skip
LAST = [
    "Dela Cruz", "Santos", "Reyes", "Garcia", "Mendoza", "Bautista", "Villanueva",
    "Aquino", "Navarro", "Castillo", "Ramos", "Pascual", "Domingo", "Soriano",
    "Magsino", "Tolentino", "Alcantara", "Manalo", "Cabrera", "Lopez",
]  # fmt: skip
MIDDLE = ["Cruz", "Santos", "Reyes", "Garcia", "Lim", "Torres", "Flores", "Rivera"]
PLACES = ["Nagcarlan, Laguna", "San Pablo City, Laguna", "Liliw, Laguna", "Manila"]
OCCUPATIONS = [
    "Farmer",
    "Vendor",
    "Teacher",
    "Tricycle driver",
    "Housewife",
    "Carpenter",
    "Retired",
    None,
]
CIVIL = ["Single", "Married", "Widow/Widower", "Legally Separated"]
# How exactly each sample death date is known, and what backs it, cycled so
# every case (day, month, year, no date; reported, verified) appears.
DEATH_PRECISIONS = ["day", "day", "month", "day", "year", "unknown", "day", "month"]
DEATH_EVIDENCE = ["reported", "verified", "verified", "reported"]
DEATH_NOTES = [
    "Reported by a relative (sample data)",
    "Death certificate seen (sample data)",
    None,
]
OFFICIALS = [
    ("Punong Barangay", True),
    ("Barangay Kagawad", True),
    ("Barangay Kagawad", True),
    ("Barangay Kagawad", True),
    ("Barangay Kagawad", True),
    ("Barangay Kagawad", True),
    ("Barangay Kagawad", True),
    ("Barangay Kagawad", True),
    ("Barangay Secretary", False),
    ("Barangay Treasurer", False),
]


def _database_name() -> str:
    return (settings.DATABASE_URL.path or "").lstrip("/")


def _refuse(message: str) -> int:
    print(f"REFUSED: {message}", file=sys.stderr)  # noqa: T201
    return 2


def _name(rng: random.Random, sex: str) -> tuple[str, str, str]:
    first = rng.choice(MALE if sex == "Male" else FEMALE)
    return first, rng.choice(MIDDLE), rng.choice(LAST)


def _record_sample_deaths(
    session: Session, living: list[Resident], today: date, rng: random.Random
) -> int:
    """Record about 1 resident in 40 as deceased (at least one), after the loop
    that makes the residents, so the earlier sample data is not changed."""
    if not living:
        return 0
    chosen = rng.sample(living, min(len(living), max(1, len(living) // 40)))
    for index, resident in enumerate(chosen):
        precision = DEATH_PRECISIONS[index % len(DEATH_PRECISIONS)]
        born = resident.birthdate or today
        since_birth = max(1, (today - born).days)
        died = today - timedelta(days=rng.randint(1, min(700, since_birth)))
        if precision == "month":
            died = died.replace(day=1)
        elif precision == "year":
            died = died.replace(month=1, day=1)
        resident.status = "deceased"
        session.add(resident)
        session.add(
            ResidentDeath(
                resident_id=resident.id,
                date_of_death=None if precision == "unknown" else died,
                date_precision=precision,
                evidence=DEATH_EVIDENCE[index % len(DEATH_EVIDENCE)],
                source_note=DEATH_NOTES[index % len(DEATH_NOTES)],
            )
        )
    session.flush()
    return len(chosen)


def seed(session: Session, residents: int, rng: random.Random) -> dict[str, int]:
    counts = {
        "streets": 0,
        "officials": 0,
        "residents": 0,
        "archived": 0,
        "deceased": 0,
    }

    street_ids: list[int] = []
    for name in STREETS:
        street = session.exec(select(Street).where(Street.name == name)).first()
        if street is None:
            street = Street(name=name)
            session.add(street)
            session.flush()
            counts["streets"] += 1
        assert street.id is not None
        street_ids.append(street.id)

    if not session.exec(select(Official)).first():
        for position, elected in OFFICIALS:
            sex = rng.choice(["Male", "Female"])
            first, _, last = _name(rng, sex)
            session.add(
                Official(
                    full_name=f"{first} {last} (sample)",
                    position=position,
                    term_start=date(2023, 11, 1),
                    is_elected=elected,
                    is_current=True,
                )
            )
            counts["officials"] += 1

    sector_ids = [
        i for i in session.exec(select(col(Sector.id))).all() if i is not None
    ]
    today = date.today()
    living: list[Resident] = []
    for _ in range(residents):
        sex = rng.choice(["Male", "Female"])
        first, middle, last = _name(rng, sex)
        age = rng.choice([rng.randint(1, 17), rng.randint(18, 59), rng.randint(60, 90)])
        birthdate = today - timedelta(days=age * 365 + rng.randint(0, 364))
        archived = rng.random() < 0.06
        from_birth = rng.random() < 0.4
        resident = Resident(
            first_name=first,
            middle_name=middle,
            last_name=last,
            suffix=rng.choice([None] * 12 + ["Jr.", "Sr.", "III"]),
            birthdate=birthdate,
            birth_place=rng.choice(PLACES),
            sex=sex,
            civil_status="Single" if age < 18 else rng.choice(CIVIL),
            occupation=None if age < 18 else rng.choice(OCCUPATIONS),
            house_number=str(rng.randint(1, 250)),
            street_id=rng.choice(street_ids),
            purok=rng.randint(1, 7),
            resident_since_birth=from_birth,
            resident_since_year=None
            if from_birth
            else rng.randint(max(birthdate.year + 1, 1960), today.year),
            voter_registration="registered"
            if age >= 18 and rng.random() < 0.8
            else "unregistered",
            residency_type=rng.choice(["regular"] * 8 + ["new", "renting"]),
            status="archived" if archived else "active",
            archive_reason="Moved out (sample data)" if archived else None,
            archived_at=datetime.now(UTC) if archived else None,
        )
        session.add(resident)
        session.flush()
        counts["residents"] += 1
        counts["archived"] += int(archived)
        if not archived:
            living.append(resident)
        if sector_ids and rng.random() < 0.25:
            session.add(
                ResidentSector(
                    resident_id=resident.id, sector_id=rng.choice(sector_ids)
                )
            )
    counts["deceased"] = _record_sample_deaths(session, living, today, rng)
    return counts


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--residents", type=int, default=400)
    parser.add_argument("--seed", type=int, default=2026)
    args = parser.parse_args(argv)
    if not 1 <= args.residents <= 5000:
        return _refuse("--residents must be between 1 and 5000.")

    name = _database_name()
    if not name.endswith("_dev"):
        return _refuse(
            f"the database is called '{name}', not one ending in '_dev'. "
            "Sample data goes only into the development database."
        )

    with Session(engine) as session:
        existing = session.exec(select(func.count()).select_from(Resident)).one()
        if existing:
            return _refuse(
                f"the database already holds {existing} residents. "
                "Reset the development database first (scripts/dev-db.ps1 reset)."
            )
        counts = seed(session, args.residents, random.Random(args.seed))
        session.commit()

    print(f"SAVED into '{name}'")  # noqa: T201
    for key, value in counts.items():
        print(f"  {key}: {value}")  # noqa: T201
    return 0


if __name__ == "__main__":
    sys.exit(main())
