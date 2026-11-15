"""Count residents who may be the same person (read-only, counts only).

The Barangay ID history import leaves "name-only" residents (no birthdate).
Some of them may be the same person as a resident of the masterlist who has a
birthdate, typed with a different spelling. This report counts them so the
clerk knows whether a check by hand is worth the time. Run inside the container:

    docker compose -f compose.yml exec backend python -m app.duplicate_report_cli

What it does and does not do:
  * It only reads. The database session is read-only; nothing is changed or
    audited, and no file is written.
  * It prints counts only, never a name, birthdate, address or ID number.
  * Names are compared by ``name_key`` (accents, case, spaces and punctuation
    ignored), the same rule the duplicate warning uses when a record is saved.
  * Archived residents are included in every count.
  * There is no merge tool. A count above zero is a reason to search a few of
    those people in Records, not an instruction to delete anything.

Exit code 0 = done.
"""

import argparse
import sys
from collections import Counter

from sqlalchemy import text
from sqlmodel import Session, select

from app.core.db import engine
from app.core.duplicates import name_key
from app.models_residents import Resident

FullKey = tuple[str, str, str, str]
PairKey = tuple[str, str]


def say(message: str) -> None:
    print(message, file=sys.stdout)  # noqa: T201


def _full_key(person: Resident) -> FullKey:
    return (
        name_key(person.first_name),
        name_key(person.middle_name),
        name_key(person.last_name),
        name_key(person.suffix),
    )


def build_report(session: Session) -> dict[str, int]:
    """Counts only. ``stub`` = a resident with no birthdate on record."""
    rows = session.exec(select(Resident)).all()
    dated_full: Counter[FullKey] = Counter()
    dated_pair: Counter[PairKey] = Counter()
    stub_full: Counter[FullKey] = Counter()
    dated_same_day: Counter[tuple[str, str, str]] = Counter()
    stubs: list[FullKey] = []
    for person in rows:
        key = _full_key(person)
        birthdate = person.birthdate
        if birthdate is None:
            stubs.append(key)
            stub_full[key] += 1
        else:
            dated_full[key] += 1
            dated_pair[(key[0], key[2])] += 1
            dated_same_day[(key[0], key[2], birthdate.isoformat())] += 1

    same_full_one = same_full_many = same_pair_only = 0
    for key in stubs:
        if dated_full[key]:
            if dated_full[key] == 1:
                same_full_one += 1
            else:
                same_full_many += 1
        elif dated_pair[(key[0], key[2])]:
            same_pair_only += 1
    return {
        "residents_total": len(rows),
        "residents_without_birthdate": len(stubs),
        "stubs_same_full_name_as_one_dated_resident": same_full_one,
        "stubs_same_full_name_as_several_dated_residents": same_full_many,
        "stubs_same_first_and_last_only_middle_differs": same_pair_only,
        "stubs_sharing_a_full_name_with_another_stub": sum(
            n for n in stub_full.values() if n > 1
        ),
        "dated_residents_same_first_last_and_birthdate": sum(
            n for n in dated_same_day.values() if n > 1
        ),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Count possible duplicate residents (read-only, counts only)."
    )
    parser.parse_args(argv)
    with Session(engine) as session:
        session.execute(text("SET TRANSACTION READ ONLY"))
        report = build_report(session)
        session.rollback()
    say("Possible duplicate residents (counts only, nothing was changed):")
    for name, value in report.items():
        say(f"  {name}: {value}")
    say(
        "A count above zero means: search a few of those people in Records and "
        "decide by eye. There is no merge tool."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
