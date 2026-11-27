import random
from datetime import date

import pytest
from sqlmodel import Session, col, select

from app.models_residents import Resident, ResidentDeath
from app.sample_data_cli import main, seed


def test_refuses_a_database_not_named_dev(capsys: pytest.CaptureFixture[str]) -> None:
    # The test database ends in _test (or is the CI database), never in _dev.
    assert main(["--residents", "5"]) == 2
    assert "REFUSED" in capsys.readouterr().err


def test_refuses_a_silly_number() -> None:
    assert main(["--residents", "0"]) == 2
    assert main(["--residents", "999999"]) == 2


def test_seed_is_repeatable_and_fits_the_rules(db: Session) -> None:
    first = seed(db, 30, random.Random(7))
    db.rollback()
    second = seed(db, 30, random.Random(7))
    db.rollback()
    assert first == second
    assert first["residents"] == 30
    assert first["streets"] >= 0


def _new_deaths(
    db: Session, known: set[object]
) -> list[tuple[ResidentDeath, Resident]]:
    rows = db.exec(
        select(ResidentDeath, Resident).join(
            Resident, col(Resident.id) == col(ResidentDeath.resident_id)
        )
    ).all()
    return [(d, r) for d, r in rows if d.id not in known]


def test_seed_records_a_few_deaths_that_fit_the_rules(db: Session) -> None:
    known = {d.id for d in db.exec(select(ResidentDeath)).all()}
    counts = seed(db, 120, random.Random(7))
    try:
        fresh = _new_deaths(db, known)
        # About 1 resident in 40 (of those not archived), and at least one.
        assert counts["deceased"] == len(fresh)
        assert 2 <= len(fresh) <= 4
        for death, resident in fresh:
            assert resident.status == "deceased" and resident.archived_at is None
            if death.date_precision == "unknown":
                assert death.date_of_death is None
                continue
            assert death.date_of_death is not None and resident.birthdate is not None
            assert death.date_of_death <= date.today()
            born = resident.birthdate
            if death.date_precision == "month":
                born = born.replace(day=1)
            elif death.date_precision == "year":
                born = born.replace(month=1, day=1)
            assert death.date_of_death >= born
    finally:
        db.rollback()


def test_the_sample_deaths_cover_every_way_a_date_can_be_known(db: Session) -> None:
    known = {d.id for d in db.exec(select(ResidentDeath)).all()}
    seed(db, 400, random.Random(7))
    try:
        fresh = _new_deaths(db, known)
        assert {d.date_precision for d, _ in fresh} == {
            "day",
            "month",
            "year",
            "unknown",
        }
        assert {d.evidence for d, _ in fresh} == {"reported", "verified"}
    finally:
        db.rollback()
