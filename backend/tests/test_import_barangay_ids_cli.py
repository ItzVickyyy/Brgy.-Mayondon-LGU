"""Barangay ID log import (``python -m app.import_barangay_ids_cli``).

All data is fictional and built in memory.
"""

import uuid
from datetime import date
from pathlib import Path

import pytest
from openpyxl import Workbook
from sqlmodel import Session, col, select

from app import import_barangay_ids_cli as cli
from app.core.config import settings
from app.core.db import engine
from app.models_foundation import AuditLog
from app.models_issuance import Issuance, IssuanceBarangayId, IssuanceResidentSnapshot
from app.models_residents import Resident

HEADERS = [
    "ID Number",
    "Date Issued",
    "Valid Until",
    "Transaction Type",
    "First Name",
    "Middle Name",
    "Last Name",
    "Extension",
    "Resident ID Number",
    "Voter Status",
]


def _tag() -> str:
    return uuid.uuid4().hex[:8].capitalize()


def _book(
    tmp_path: Path, rows: list[list[object]], headers: list[str] | None = None
) -> str:
    book = Workbook()
    sheet = book.active
    assert sheet is not None
    sheet.append(headers or HEADERS)
    for row in rows:
        sheet.append(row)
    path = tmp_path / f"ids-{_tag()}.xlsx"
    book.save(path)
    return str(path)


def _run(path: str, *extra: str) -> int:
    return cli.main([path, "--user", settings.FIRST_SUPERUSER, *extra])


def _resident(db: Session, **fields: object) -> Resident:
    person = Resident(**fields)
    db.add(person)
    db.commit()
    db.refresh(person)
    return person


def test_dry_run_counts_and_saves_nothing(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    last, number = _tag(), f"D{_tag()}"
    path = _book(
        tmp_path,
        [
            [
                number,
                date(2024, 1, 5),
                date(2025, 1, 5),
                "new",
                "Ana",
                None,
                last,
                None,
                None,
                "Registered",
            ]
        ],
    )
    assert _run(path) == 0
    out = capsys.readouterr().out
    assert "DRY RUN" in out
    assert "residents_created: 1" in out
    with Session(engine) as session:
        assert (
            session.exec(select(Resident).where(Resident.last_name == last)).first()
            is None
        )
        assert (
            session.exec(
                select(IssuanceBarangayId).where(IssuanceBarangayId.id_number == number)
            ).first()
            is None
        )


def test_commit_creates_people_cards_and_keeps_existing_numbers(
    db: Session, tmp_path: Path
) -> None:
    tag = _tag()
    kept_number = f"K{tag}"
    existing = _resident(
        db, first_name="Berta", last_name=f"Old{tag}", id_number=kept_number
    )
    twin_last = f"Twin{tag}"
    _resident(db, first_name="Cora", last_name=twin_last)
    _resident(db, first_name="Cora", last_name=twin_last)
    new_last = f"New{tag}"
    first_card, second_card, old_card, twin_card = (
        f"A{tag}"[:12],
        f"B{tag}"[:12],
        f"C{tag}"[:12],
        f"E{tag}"[:12],
    )
    path = _book(
        tmp_path,
        [
            # one new person with two cards: created once, latest card wins
            [
                second_card,
                date(2025, 3, 1),
                date(2026, 3, 1),
                "renewal",
                "Dino",
                "M",
                new_last,
                "Jr.",
                None,
                "unregistered",
            ],
            [
                first_card,
                date(2024, 3, 1),
                date(2025, 3, 1),
                "new",
                "Dino",
                "M",
                new_last,
                "Jr.",
                None,
                "unregistered",
            ],
            # a matched resident keeps their own ID number
            [
                old_card,
                date(2024, 6, 1),
                date(2025, 6, 1),
                "new",
                "Berta",
                None,
                f"Old{tag}",
                None,
                kept_number,
                None,
            ],
            # two residents share the name: left out, not guessed
            [
                twin_card,
                date(2024, 7, 1),
                date(2025, 7, 1),
                "new",
                "Cora",
                None,
                twin_last,
                None,
                None,
                None,
            ],
        ],
    )
    assert _run(path, "--commit") == 0

    with Session(engine) as session:
        dino = session.exec(
            select(Resident).where(Resident.last_name == new_last)
        ).all()
        assert len(dino) == 1
        assert dino[0].id_number == second_card
        assert dino[0].voter_registration == "unregistered"
        assert dino[0].suffix == "Jr."
        cards = session.exec(
            select(IssuanceBarangayId).where(
                col(IssuanceBarangayId.id_number).in_([first_card, second_card])
            )
        ).all()
        assert {c.transaction_type for c in cards} == {"new", "renewal"}
        berta = session.get(Resident, existing.id)
        assert berta is not None
        assert berta.id_number == kept_number
        issued = session.exec(
            select(Issuance).where(Issuance.resident_id == existing.id)
        ).all()
        assert len(issued) == 1
        row = issued[0]
        assert row.status == "issued"
        assert row.issue_date == date(2024, 6, 1)
        assert row.expires_on == date(2025, 6, 1)
        assert row.reference_no is not None
        assert row.reference_no.startswith("ISS-2024-")
        snap = session.get(IssuanceResidentSnapshot, row.id)
        assert snap is not None
        assert snap.full_name == f"Berta Old{tag}"
        assert (
            session.exec(
                select(IssuanceBarangayId).where(
                    IssuanceBarangayId.id_number == twin_card
                )
            ).first()
            is None
        )
        assert (
            len(
                session.exec(
                    select(AuditLog).where(
                        col(AuditLog.action) == "import.barangay_ids"
                    )
                ).all()
            )
            >= 1
        )


def test_running_again_adds_nothing(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    last, number = _tag(), f"R{_tag()}"
    path = _book(
        tmp_path,
        [
            [
                number,
                date(2024, 1, 5),
                date(2025, 1, 5),
                "new",
                "Eli",
                None,
                last,
                None,
                None,
                None,
            ]
        ],
    )
    assert _run(path, "--commit") == 0
    capsys.readouterr()
    assert _run(path, "--commit") == 0
    assert "skipped_already_imported: 1" in capsys.readouterr().out
    with Session(engine) as session:
        assert (
            len(session.exec(select(Resident).where(Resident.last_name == last)).all())
            == 1
        )
        assert (
            len(
                session.exec(
                    select(IssuanceBarangayId).where(
                        IssuanceBarangayId.id_number == number
                    )
                ).all()
            )
            == 1
        )


@pytest.mark.parametrize(
    "rows",
    [
        # valid until before the issue date
        [
            [
                "X1",
                date(2024, 5, 1),
                date(2024, 4, 1),
                "new",
                "A",
                None,
                "B",
                None,
                None,
                None,
            ]
        ],
        # unknown transaction type
        [
            [
                "X2",
                date(2024, 5, 1),
                date(2025, 5, 1),
                "bogus",
                "A",
                None,
                "B",
                None,
                None,
                None,
            ]
        ],
        # missing date
        [["X3", None, date(2025, 5, 1), "new", "A", None, "B", None, None, None]],
        # the same card number twice
        [
            [
                "X4",
                date(2024, 5, 1),
                date(2025, 5, 1),
                "new",
                "A",
                None,
                "B",
                None,
                None,
                None,
            ],
            [
                "X4",
                date(2024, 6, 1),
                date(2025, 6, 1),
                "new",
                "C",
                None,
                "D",
                None,
                None,
                None,
            ],
        ],
    ],
)
def test_bad_rows_stop_the_whole_file(tmp_path: Path, rows: list[list[object]]) -> None:
    assert _run(_book(tmp_path, rows)) == 2


def test_missing_columns_and_unknown_user_are_refused(tmp_path: Path) -> None:
    assert (
        _run(_book(tmp_path, [["X", "Y"]], headers=["ID Number", "Date Issued"])) == 2
    )
    path = _book(
        tmp_path,
        [
            [
                "Z1",
                date(2024, 1, 1),
                date(2025, 1, 1),
                "new",
                "A",
                None,
                "B",
                None,
                None,
                None,
            ]
        ],
    )
    assert cli.main([path, "--user", "nobody@example.com"]) == 2


def test_a_deceased_resident_gets_no_imported_card(
    db: Session, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    last, number = _tag(), f"D{_tag()}"
    person = _resident(db, first_name="Ana", last_name=last, status="deceased")
    path = _book(
        tmp_path,
        [
            [
                number,
                date(2024, 1, 5),
                date(2025, 1, 5),
                "new",
                "Ana",
                None,
                last,
                None,
                None,
                None,
            ]
        ],
    )
    assert _run(path, "--commit") == 0
    assert "left_out_resident_deceased: 1" in capsys.readouterr().out
    db.expire_all()
    db.refresh(person)
    assert person.id_number is None
    assert (
        db.exec(
            select(IssuanceBarangayId).where(IssuanceBarangayId.id_number == number)
        ).first()
        is None
    )
