"""Load the cleaned Barangay ID log (past cards) into Records and Issuance.

Copy the cleaned workbook into the backend container, then run (dry run first,
it only counts and writes nothing):

    docker compose -f compose.yml cp "Mayondon Residents IDs (Cleaned).xlsx" backend:/tmp/ids.xlsx
    docker compose -f compose.yml exec backend python -m app.import_barangay_ids_cli /tmp/ids.xlsx --user admin@example.com
    docker compose -f compose.yml exec backend python -m app.import_barangay_ids_cli /tmp/ids.xlsx --user admin@example.com --commit

Each row becomes one issued Barangay ID (``issuances`` + ``issuance_barangay_id``
+ the printed-name snapshot), dated as in the log, so the ID lists, the "expiring
soon" counts and renewals see the old cards.

Rules (decided with the owner's cleaned file in mind, none of them destructive):
  * Import the residents first (Records > Import Masterlist).
  * A row is matched to a resident by ``Resident ID Number`` when the file has
    one. Otherwise the person is found by first, middle, last name and extension
    (exact, any case). When nobody matches, a resident with only the name and
    voter status is created (one per person, however many cards they had).
    A name that matches more than one resident is left out and counted.
  * A row that matches a resident recorded as deceased is left out and counted.
  * A resident who already has an ID number keeps it. A new resident gets the
    number of their latest card.
  * A card whose ID number is already in the history is skipped, so the command
    can be run again after a stop. Nothing is changed or removed.
  * Everything is saved in one transaction; if anything fails nothing is saved.
  * The audit log gets one row (``import.barangay_ids``) with counts only.

Personal data is never printed. Exit code 0 = done, 2 = bad option or file.
"""

import argparse
import sys
from collections import Counter
from datetime import UTC, date, datetime, time
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import text
from sqlmodel import Session, col, select

from app.api.routes.issuances import _address_line
from app.core.audit import record_audit_event
from app.core.db import engine
from app.core.masterlist_import import parse_rows
from app.models import User
from app.models_foundation import DocumentType
from app.models_issuance import (
    ID_TRANSACTION_TYPES,
    Issuance,
    IssuanceBarangayId,
    IssuanceResidentSnapshot,
)
from app.models_residents import SUFFIXES, Resident, build_full_name

PersonKey = tuple[str, str, str, str]
MANILA = ZoneInfo("Asia/Manila")
REMARK = "Imported from the Barangay ID log"
REQUIRED = (
    "ID Number",
    "Date Issued",
    "Valid Until",
    "Transaction Type",
    "First Name",
    "Last Name",
)


def say(message: str, *, error: bool = False) -> None:
    print(message, file=sys.stderr if error else sys.stdout)  # noqa: T201


def _person_key(
    first: str, middle: str | None, last: str, suffix: str | None
) -> PersonKey:
    return (
        first.casefold(),
        (middle or "").casefold(),
        last.casefold(),
        (suffix or "").casefold(),
    )


def _day(value: str) -> date:
    return date.fromisoformat(value[:10])


def read_cards(path: str) -> list[dict[str, Any]]:
    """The log rows as plain dicts. Raises ``ValueError`` (safe to show)."""
    try:
        with open(path, "rb") as handle:
            content = handle.read()
        _kind, headers, rows = parse_rows(
            path if path.endswith(".xlsx") else "x.xlsx", content
        )
    except OSError:
        raise ValueError("The file could not be opened") from None
    except ValueError as exc:
        raise ValueError(str(exc)) from None
    missing = [name for name in REQUIRED if name not in headers]
    if missing:
        raise ValueError("These columns are missing: " + ", ".join(missing))
    cards: list[dict[str, Any]] = []
    for number, raw in rows:
        try:
            suffix = raw.get("Extension")
            card: dict[str, Any] = {
                "row": number,
                "id_number": raw["ID Number"],
                "issued": _day(raw["Date Issued"] or ""),
                "valid_until": _day(raw["Valid Until"] or ""),
                "type": (raw["Transaction Type"] or "").casefold(),
                "first": raw["First Name"],
                "middle": raw.get("Middle Name"),
                "last": raw["Last Name"],
                "suffix": suffix,
                "resident_id_number": raw.get("Resident ID Number"),
                "voter": (raw.get("Voter Status") or "").casefold() or None,
            }
        except ValueError, TypeError, KeyError:
            raise ValueError(
                f"Row {number}: a date, name or ID number is missing"
            ) from None
        if not card["id_number"] or not card["first"] or not card["last"]:
            raise ValueError(f"Row {number}: a date, name or ID number is missing")
        if card["type"] not in ID_TRANSACTION_TYPES:
            raise ValueError(f"Row {number}: unknown transaction type")
        if card["valid_until"] < card["issued"]:
            raise ValueError(f"Row {number}: valid until is before the issue date")
        if card["suffix"] and card["suffix"] not in SUFFIXES:
            card["suffix"] = None
        if card["voter"] not in ("registered", "unregistered"):
            card["voter"] = None
        cards.append(card)
    numbers = Counter(c["id_number"] for c in cards)
    if any(n > 1 for n in numbers.values()):
        raise ValueError("An ID number appears twice in the file; fix the file first")
    return cards


def run(
    session: Session, cards: list[dict[str, Any]], user: User, *, commit: bool
) -> dict[str, int]:
    doc = session.exec(
        select(DocumentType).where(DocumentType.code == "BARANGAY_ID")
    ).first()
    if doc is None or doc.id is None:
        raise ValueError("The Barangay ID document type is missing")

    by_number = {
        r.id_number: r
        for r in session.exec(
            select(Resident).where(col(Resident.id_number).is_not(None))
        ).all()
    }
    by_name: dict[PersonKey, list[Resident]] = {}
    for person in session.exec(select(Resident)).all():
        by_name.setdefault(
            _person_key(
                person.first_name,
                person.middle_name,
                person.last_name,
                person.suffix,
            ),
            [],
        ).append(person)
    already = set(
        session.exec(
            select(IssuanceBarangayId.id_number).where(
                col(IssuanceBarangayId.id_number).is_not(None)
            )
        ).all()
    )

    counts: Counter[str] = Counter()
    created: dict[PersonKey, Resident] = {}
    latest_card: dict[Any, dict[str, Any]] = {}
    plan: list[tuple[dict[str, Any], Resident]] = []
    for card in sorted(cards, key=lambda c: (c["issued"], c["row"])):
        if card["id_number"] in already:
            counts["skipped_already_imported"] += 1
            continue
        resident: Resident | None
        if card["resident_id_number"]:
            resident = by_number.get(card["resident_id_number"])
            if resident is None:
                counts["left_out_resident_not_found"] += 1
                continue
        else:
            key = _person_key(
                card["first"], card["middle"], card["last"], card["suffix"]
            )
            found = by_name.get(key, [])
            if len(found) > 1:
                counts["left_out_name_matches_several"] += 1
                continue
            resident = found[0] if found else created.get(key)
            if resident is None:
                resident = Resident(
                    first_name=card["first"],
                    middle_name=card["middle"],
                    last_name=card["last"],
                    suffix=card["suffix"],
                    voter_registration=card["voter"],
                    created_by_user_id=user.id,
                    updated_by_user_id=user.id,
                )
                created[key] = resident
                counts["residents_created"] += 1
        if resident.status == "deceased":
            # A deceased resident gets no new document and is not edited.
            counts["left_out_resident_deceased"] += 1
            continue
        plan.append((card, resident))
        latest_card[id(resident)] = card
        counts["cards"] += 1

    counts["residents_matched"] = len(
        {id(r) for _c, r in plan} - {id(r) for r in created.values()}
    )
    if not commit or not plan:
        return dict(counts)

    now = datetime.now(UTC)
    for resident in created.values():
        session.add(resident)
    session.flush()
    for card, resident in plan:
        issued_at = datetime.combine(
            card["issued"], time(12, 0), tzinfo=MANILA
        ).astimezone(UTC)
        sequence_value = (
            session.connection()
            .execute(text("SELECT nextval('issuance_reference_seq')"))
            .scalar_one()
        )
        issuance = Issuance(
            reference_no=f"ISS-{card['issued'].year}-{sequence_value:06d}",
            document_type_id=doc.id,
            resident_id=resident.id,
            issue_date=card["issued"],
            remarks=REMARK,
            status="issued",
            issued_by_user_id=user.id,
            issued_at=issued_at,
            expires_on=card["valid_until"],
            created_by_user_id=user.id,
            created_at=issued_at,
            updated_at=issued_at,
        )
        session.add(issuance)
        session.flush()
        session.add(
            IssuanceBarangayId(
                issuance_id=issuance.id,
                transaction_type=card["type"],
                valid_until=card["valid_until"],
                id_number=card["id_number"],
            )
        )
        session.add(
            IssuanceResidentSnapshot(
                issuance_id=issuance.id,
                full_name=build_full_name(resident),
                address_line=_address_line(session, resident),
                birth_date=resident.birthdate,
                birth_place=resident.birth_place,
                sex=resident.sex,
                civil_status=resident.civil_status,
                resident_since_year=resident.resident_since_year,
                resident_since_birth=resident.resident_since_birth,
            )
        )
    # A resident without an ID number gets the number of their latest card.
    for resident in {id(r): r for _c, r in plan}.values():
        if resident.id_number is None:
            resident.id_number = latest_card[id(resident)]["id_number"]
            resident.updated_at = now
            resident.updated_by_user_id = user.id
            session.add(resident)
            counts["residents_given_id_number"] += 1
    record_audit_event(
        session,
        action="import.barangay_ids",
        actor=user,
        module="records",
        record_type="import",
        details=dict(counts),
    )
    session.commit()
    return dict(counts)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Load the cleaned Barangay ID log.")
    parser.add_argument("file", help="the cleaned .xlsx file inside the container")
    parser.add_argument(
        "--user", required=True, help="e-mail of the administrator doing the import"
    )
    parser.add_argument(
        "--commit", action="store_true", help="save (default: count only)"
    )
    args = parser.parse_args(argv)
    try:
        cards = read_cards(args.file)
    except ValueError as exc:
        say(str(exc), error=True)
        return 2
    with Session(engine) as session:
        user = session.exec(select(User).where(User.email == args.user)).first()
        if user is None or not user.is_superuser:
            say("--user must be an existing administrator account", error=True)
            return 2
        try:
            counts = run(session, cards, user, commit=args.commit)
        except ValueError as exc:
            session.rollback()
            say(str(exc), error=True)
            return 2
        except Exception:
            session.rollback()
            say("The import failed and nothing was saved", error=True)
            return 1
    say(
        ("SAVED" if args.commit else "DRY RUN (nothing saved)")
        + f", {len(cards)} rows read"
    )
    for name, value in sorted(counts.items()):
        say(f"  {name}: {value}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
