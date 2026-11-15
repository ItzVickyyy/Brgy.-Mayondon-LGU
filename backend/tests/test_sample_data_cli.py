import random

import pytest
from sqlmodel import Session

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
