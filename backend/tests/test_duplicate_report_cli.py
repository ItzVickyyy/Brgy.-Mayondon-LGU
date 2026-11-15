"""Duplicate report (``python -m app.duplicate_report_cli``): read-only counts.

All data is fictional. The test database may already hold residents, so the
tests compare the report before and after adding their own people.
"""

import uuid
from datetime import date

import pytest
from sqlmodel import Session, func, select

from app import duplicate_report_cli as cli
from app.core.db import engine
from app.models_foundation import AuditLog
from app.models_residents import Resident


def _tag() -> str:
    return uuid.uuid4().hex[:8].capitalize()


def _add(
    db: Session,
    first_name: str,
    last_name: str,
    middle_name: str | None = None,
    birthdate: date | None = None,
) -> None:
    db.add(
        Resident(
            first_name=first_name,
            middle_name=middle_name,
            last_name=last_name,
            birthdate=birthdate,
        )
    )
    db.commit()


def _report() -> dict[str, int]:
    with Session(engine) as session:
        return cli.build_report(session)


def test_counts_spelling_variants_and_never_prints_names(
    db: Session, capsys: pytest.CaptureFixture[str]
) -> None:
    last = f"Zz{_tag()}"
    before = _report()
    _add(
        db,
        first_name="María",
        middle_name="De la Cruz",
        last_name=last,
        birthdate=date(1980, 4, 5),
    )
    # Same person, typed with another spelling, no birthdate.
    _add(db, first_name="Maria", middle_name="Dela Cruz", last_name=last.upper())
    # Same first and last name but another middle name.
    _add(db, first_name="Maria", middle_name="Santos", last_name=last)
    # Someone else entirely.
    _add(db, first_name="Pedro", last_name=f"Other{_tag()}")
    after = _report()

    def grew(name: str) -> int:
        return after[name] - before[name]

    assert grew("residents_total") == 4
    assert grew("residents_without_birthdate") == 3
    assert grew("stubs_same_full_name_as_one_dated_resident") == 1
    assert grew("stubs_same_first_and_last_only_middle_differs") == 1
    assert grew("stubs_same_full_name_as_several_dated_residents") == 0

    assert cli.main([]) == 0
    out = capsys.readouterr().out
    assert "Possible duplicate residents" in out
    assert last not in out and last.upper() not in out
    assert "María" not in out and "Pedro" not in out


def test_two_name_only_records_with_one_name_are_counted(db: Session) -> None:
    last = f"Yy{_tag()}"
    before = _report()
    _add(db, first_name="Lito", last_name=last)
    _add(db, first_name="LITO", last_name=last)
    after = _report()
    assert (
        after["stubs_sharing_a_full_name_with_another_stub"]
        - before["stubs_sharing_a_full_name_with_another_stub"]
        == 2
    )


def test_it_writes_nothing() -> None:
    with Session(engine) as session:
        residents = session.exec(select(func.count()).select_from(Resident)).one()
        audit = session.exec(select(func.count()).select_from(AuditLog)).one()
    assert cli.main([]) == 0
    with Session(engine) as session:
        assert (
            session.exec(select(func.count()).select_from(Resident)).one() == residents
        )
        assert session.exec(select(func.count()).select_from(AuditLog)).one() == audit


def test_show_lists_same_birthday_groups_only_when_asked(
    db: Session, capsys: pytest.CaptureFixture[str]
) -> None:
    last = f"Xx{_tag()}"
    _add(db, "Nena", last, "Reyes", date(1971, 9, 9))
    _add(db, "NENA", last, "R.", date(1971, 9, 9))
    _add(db, "Nena", last, "Reyes", date(1972, 1, 1))
    assert cli.main([]) == 0
    assert last not in capsys.readouterr().out
    assert cli.main(["--show"]) == 0
    out = capsys.readouterr().out
    assert "PERSONAL DATA BELOW" in out
    assert out.count(last) == 2
    assert "born 1971-09-09" in out
    assert "1972-01-01" not in out
