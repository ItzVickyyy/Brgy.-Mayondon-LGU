"""Masterlist import: read a file, map columns, check rows, find duplicates.

Mapping-agnostic on purpose (D-19): the client's real column names, required
fields and duplicate rule are settings of a batch (``mapping``, ``date_order``,
``duplicate_action``), not code. Rows are checked with the same ``ResidentFields``
model the resident API uses, so an imported resident is held to the same rules
as one typed in by hand.

Error messages never contain cell values, so they are safe to keep and export.
"""

import csv
import io
import re
import zipfile
from collections.abc import Iterable
from datetime import date, datetime
from typing import Any

from pydantic import ValidationError
from sqlalchemy import func as sa_func
from sqlmodel import Session, col, select

from app.core.text_repair import fix_mojibake
from app.models_foundation import Street
from app.models_import import ImportBatch, ImportRow
from app.models_residents import (
    CIVIL_STATUSES,
    SEXES,
    SUFFIXES,
    Resident,
    ResidentFields,
)

MAX_FILE_BYTES = 5 * 1024 * 1024
MAX_ROWS = 5000
MAX_UNZIPPED_BYTES = 50 * 1024 * 1024
MAX_COLUMNS = 60
MAX_CELL_CHARS = 1000

# Resident fields an admin may map a column to. ``street`` is matched by name
# against the streets lookup and stored as ``street_id``.
IMPORT_FIELDS: tuple[str, ...] = (
    "first_name",
    "middle_name",
    "last_name",
    "suffix",
    "birthdate",
    "birth_place",
    "sex",
    "civil_status",
    "house_number",
    "street",
    "purok",
    "resident_since_year",
    "resident_type",
    "id_number",
    "voter_registration",
    "emergency_contact_name",
    "emergency_contact_address",
    "emergency_contact_phone",
)
REQUIRED_FIELDS: tuple[str, ...] = ("first_name", "last_name")

# Header spellings recognised when suggesting a mapping (compared after
# lower-casing and dropping everything but letters and digits).
HEADER_ALIASES: dict[str, tuple[str, ...]] = {
    "first_name": ("firstname", "first", "givenname", "fname"),
    "middle_name": ("middlename", "middle", "mname", "middleinitial"),
    "last_name": ("lastname", "last", "surname", "familyname", "lname"),
    "suffix": ("suffix", "extension", "nameextension"),
    "birthdate": ("birthdate", "dateofbirth", "birthday", "dob", "bdate"),
    "birth_place": ("birthplace", "placeofbirth", "pob"),
    "sex": ("sex", "gender"),
    "civil_status": ("civilstatus", "maritalstatus", "status"),
    "house_number": ("housenumber", "houseno", "houseblklot", "blocklot"),
    "street": ("street", "streetname"),
    "purok": ("purok", "zone"),
    "resident_since_year": ("residentsinceyear", "residingsince", "residentsince"),
    "resident_type": ("residenttype", "typeofresident"),
    "id_number": ("idnumber", "idno", "barangayidnumber"),
    "voter_registration": (
        "voterregistration",
        "voterstatus",
        "voter",
        "registeredvoter",
    ),
    "emergency_contact_name": ("emergencycontactname", "emergencycontact"),
    "emergency_contact_address": ("emergencycontactaddress",),
    "emergency_contact_phone": (
        "emergencycontactphone",
        "emergencycontactnumber",
    ),
}

_CIVIL_ALIASES = {
    "widow": "Widow/Widower",
    "widower": "Widow/Widower",
    "widowed": "Widow/Widower",
    "separated": "Legally Separated",
}
_SUFFIX_ALIASES = {"jr": "Jr.", "sr": "Sr."}
_SEX_ALIASES = {"m": "Male", "f": "Female"}


class ImportFileError(ValueError):
    """The uploaded file cannot be used; the message is safe to show."""


# --- reading files ----------------------------------------------------------


def _clean_cell(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        value = value.date()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    text = fix_mojibake(str(value)).strip()
    if not text:
        return None
    if len(text) > MAX_CELL_CHARS:
        raise ImportFileError("A cell in the file is too long")
    return text


def _decode_csv(content: bytes) -> str:
    if b"\x00" in content:
        raise ImportFileError("This does not look like a CSV file")
    try:
        return content.decode("utf-8-sig")
    except UnicodeDecodeError:
        return content.decode("cp1252", errors="replace")


def _read_csv(content: bytes) -> list[list[Any]]:
    text = _decode_csv(content)
    sample = text[:4096]
    try:
        dialect: Any = csv.Sniffer().sniff(sample, delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel
    return [list(row) for row in csv.reader(io.StringIO(text), dialect)]


def _read_xlsx(content: bytes) -> list[list[Any]]:
    from openpyxl import load_workbook

    try:
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            names = archive.namelist()
            if any(n.lower().endswith("vbaproject.bin") for n in names):
                raise ImportFileError("Files with macros are not accepted")
            if sum(i.file_size for i in archive.infolist()) > MAX_UNZIPPED_BYTES:
                raise ImportFileError("The spreadsheet is too large")
    except zipfile.BadZipFile:
        raise ImportFileError("This is not a valid .xlsx file") from None
    try:
        workbook = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        sheet = workbook.worksheets[0]
        rows = [
            list(r) for r in sheet.iter_rows(values_only=True, max_row=MAX_ROWS + 2)
        ]
        workbook.close()
    except ImportFileError:
        raise
    except Exception:
        raise ImportFileError("This is not a valid .xlsx file") from None
    return rows


def parse_rows(
    file_name: str, content: bytes
) -> tuple[str, list[str], list[tuple[int, dict[str, str | None]]]]:
    """Return ``(file_type, headers, [(file row number, row by header)])``.

    The header is row 1. Empty rows are dropped but numbering stays true.
    """
    if len(content) > MAX_FILE_BYTES:
        raise ImportFileError("The file is larger than 5 MB")
    if not content:
        raise ImportFileError("The file is empty")
    lower = file_name.lower()
    if lower.endswith(".xlsm") or lower.endswith(".xlsb") or lower.endswith(".xls"):
        raise ImportFileError("Only .csv and .xlsx files are accepted")
    if lower.endswith(".xlsx"):
        file_type = "xlsx"
        raw_rows = _read_xlsx(content)
    elif lower.endswith(".csv"):
        file_type = "csv"
        raw_rows = _read_csv(content)
    else:
        raise ImportFileError("Only .csv and .xlsx files are accepted")

    if not raw_rows:
        raise ImportFileError("The file has no header row")
    header_cells = raw_rows[0]
    headers: list[str] = []
    for cell in header_cells:
        cleaned = _clean_cell(cell)
        headers.append(cleaned or "")
    while headers and not headers[-1]:
        headers.pop()
    if not any(headers):
        raise ImportFileError("The first row must hold the column titles")
    if len(headers) > MAX_COLUMNS:
        raise ImportFileError("The file has too many columns")
    named = [h for h in headers if h]
    if len({h.casefold() for h in named}) != len(named):
        raise ImportFileError("Two columns have the same title")

    rows: list[tuple[int, dict[str, str | None]]] = []
    for index, cells in enumerate(raw_rows[1:], start=2):
        values = {
            header: _clean_cell(cells[i]) if i < len(cells) else None
            for i, header in enumerate(headers)
            if header
        }
        if not any(values.values()):
            continue
        rows.append((index, values))
        if len(rows) > MAX_ROWS:
            raise ImportFileError(f"The file has more than {MAX_ROWS} rows")
    if not rows:
        raise ImportFileError("The file has no data rows")
    return file_type, [h for h in headers if h], rows


# --- mapping ----------------------------------------------------------------


def _norm_header(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.casefold())


def suggest_mapping(
    headers: Iterable[str], previous: dict[str, str] | None = None
) -> dict[str, str]:
    """Header -> field. A mapping used before wins; then known header spellings."""
    headers = list(headers)
    suggestion: dict[str, str] = {}
    used: set[str] = set()
    if previous:
        for header in headers:
            field = previous.get(header)
            if field in IMPORT_FIELDS and field not in used:
                suggestion[header] = field
                used.add(field)
    for header in headers:
        if header in suggestion:
            continue
        key = _norm_header(header)
        for field, aliases in HEADER_ALIASES.items():
            if field not in used and key in (_norm_header(field), *aliases):
                suggestion[header] = field
                used.add(field)
                break
    return suggestion


def check_mapping(headers: list[str], mapping: dict[str, str]) -> None:
    """Raise ``ValueError`` (safe to show) when the mapping cannot be used."""
    for header, field in mapping.items():
        if header not in headers:
            raise ValueError("A mapped column is not in the file")
        if field not in IMPORT_FIELDS:
            raise ValueError(f"Unknown resident field: {field}")
    fields = list(mapping.values())
    if len(set(fields)) != len(fields):
        raise ValueError("Each resident field can be mapped to one column only")
    for required in REQUIRED_FIELDS:
        if required not in fields:
            raise ValueError(f"The {required} field must be mapped")


# --- checking rows ----------------------------------------------------------

_DATE_PATTERNS = {
    "ymd": re.compile(r"^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$"),
    "mdy": re.compile(r"^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$"),
    "dmy": re.compile(r"^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$"),
}


def parse_date(value: str, order: str) -> date | None:
    """ISO ``YYYY-MM-DD`` always works (Excel dates arrive that way); the batch's
    ``date_order`` decides how ``05/03/1990`` is read."""
    for pattern_order in ("ymd", order):
        match = _DATE_PATTERNS[pattern_order].match(value)
        if not match:
            continue
        a, b, c = (int(g) for g in match.groups())
        if pattern_order == "ymd":
            year, month, day = a, b, c
        elif pattern_order == "mdy":
            month, day, year = a, b, c
        else:
            day, month, year = a, b, c
        try:
            return date(year, month, day)
        except ValueError:
            return None
    return None


def _match(value: str, allowed: tuple[str, ...], aliases: dict[str, str]) -> str:
    folded = value.casefold()
    for option in allowed:
        if option.casefold() == folded:
            return option
    return aliases.get(folded.rstrip("."), value)


def _field_message(error: Any) -> tuple[str, str]:
    loc = error.get("loc") or ()
    field = str(loc[0]) if loc else "row"
    message = str(error.get("msg", "Invalid value"))
    message = message.removeprefix("Value error, ")
    return field, message


def check_row(
    raw: dict[str, str | None],
    mapping: dict[str, str],
    date_order: str,
    street_ids: dict[str, int],
) -> tuple[dict[str, Any], list[dict[str, str]]]:
    """Validate one row. Returns ``(mapped values, errors)``.

    ``mapped`` holds only fields that had a value, JSON-ready, with ``street``
    replaced by ``street_id``.
    """
    errors: list[dict[str, str]] = []
    candidate: dict[str, Any] = {}
    street_id: int | None = None
    for header, field in mapping.items():
        value = raw.get(header)
        if value is None:
            continue
        if field == "street":
            street_id = street_ids.get(value.casefold())
            if street_id is None:
                errors.append(
                    {"field": "street", "message": "Street is not in the streets list"}
                )
            continue
        if field == "birthdate":
            parsed = parse_date(value, date_order)
            if parsed is None:
                errors.append({"field": "birthdate", "message": "Date not recognised"})
            else:
                candidate["birthdate"] = parsed
            continue
        if field == "sex":
            value = _match(value, SEXES, _SEX_ALIASES)
        elif field == "civil_status":
            value = _match(value, CIVIL_STATUSES, _CIVIL_ALIASES)
        elif field == "suffix":
            value = _match(value, SUFFIXES, _SUFFIX_ALIASES)
        elif field == "voter_registration":
            value = value.casefold()
        candidate[field] = value
    if street_id is not None:
        candidate["street_id"] = street_id
    try:
        model = ResidentFields.model_validate(candidate)
    except ValidationError as exc:
        seen: set[tuple[str, str]] = set()
        for item in exc.errors():
            field, message = _field_message(item)
            if (field, message) not in seen:
                seen.add((field, message))
                errors.append({"field": field, "message": message})
        return {}, errors
    dumped = model.model_dump(mode="json", exclude_none=True)
    dumped.pop("resident_since_birth", None)
    return dumped, errors


def _street_lookup(session: Session) -> dict[str, int]:
    return {
        name.casefold(): street_id
        for street_id, name in session.exec(select(Street.id, Street.name)).all()
        if street_id is not None
    }


def classify_batch(session: Session, batch: ImportBatch) -> dict[str, int]:
    """Check every staged row against the mapping and the database.

    Sets ``classification``, ``errors``, ``mapped`` and the duplicate fields on
    the rows (not committed) and returns the counts. Safe to run again: commit
    runs it once more so a stale preview is never imported.
    """
    mapping = batch.mapping or {}
    streets = _street_lookup(session)
    rows = list(
        session.exec(
            select(ImportRow)
            .where(ImportRow.batch_id == batch.id)
            .order_by(col(ImportRow.row_number))
        ).all()
    )

    checked: list[tuple[ImportRow, dict[str, Any], list[dict[str, str]]]] = []
    birthdates: set[date] = set()
    id_numbers: set[str] = set()
    for row in rows:
        mapped, errors = check_row(row.raw or {}, mapping, batch.date_order, streets)
        checked.append((row, mapped, errors))
        if not errors:
            if mapped.get("birthdate"):
                birthdates.add(date.fromisoformat(mapped["birthdate"]))
            if mapped.get("id_number"):
                id_numbers.add(mapped["id_number"])

    existing: dict[tuple[str, str, date], tuple[Any, str]] = {}
    if birthdates:
        for person in session.exec(
            select(Resident).where(col(Resident.birthdate).in_(birthdates))
        ).all():
            if person.birthdate is not None:
                person_key = (
                    person.first_name.casefold(),
                    person.last_name.casefold(),
                    person.birthdate,
                )
                # Prefer an active record when namesakes exist.
                if person_key not in existing or person.status == "active":
                    existing[person_key] = (person.id, person.status)
    owners: dict[str, Any] = {}
    if id_numbers:
        owners = {
            number: rid
            for rid, number in session.exec(
                select(Resident.id, Resident.id_number).where(
                    col(Resident.id_number).in_(id_numbers)
                )
            ).all()
            if number is not None
        }

    counts = {"new": 0, "duplicate": 0, "error": 0}
    seen_people: set[tuple[str, str, date]] = set()
    seen_numbers: set[str] = set()
    for row, mapped, errors in checked:
        row.duplicate_resident_id = None
        row.duplicate_scope = None
        row.outcome = None
        classification = "new"
        dup_id = None
        if not errors:
            born = (
                date.fromisoformat(mapped["birthdate"])
                if mapped.get("birthdate")
                else None
            )
            key: tuple[str, str, date] | None = (
                (mapped["first_name"].casefold(), mapped["last_name"].casefold(), born)
                if born
                else None
            )
            if key is not None and key in seen_people:
                classification = "duplicate"
                row.duplicate_scope = "file"
            elif key is not None and key in existing:
                classification = "duplicate"
                dup_id = existing[key][0]
                row.duplicate_resident_id = dup_id
                row.duplicate_scope = "existing"
            number = mapped.get("id_number")
            if number:
                if number in seen_numbers:
                    errors.append(
                        {
                            "field": "id_number",
                            "message": "ID number appears twice in the file",
                        }
                    )
                elif number in owners and owners[number] != dup_id:
                    errors.append(
                        {
                            "field": "id_number",
                            "message": "ID number is already assigned to a resident",
                        }
                    )
        if errors:
            classification = "error"
            row.duplicate_scope = None
            row.duplicate_resident_id = None
        else:
            if key is not None:
                seen_people.add(key)
            if mapped.get("id_number"):
                seen_numbers.add(mapped["id_number"])
        row.mapped = mapped if not errors else None
        row.errors = errors or None
        row.classification = classification
        counts[classification] += 1
        session.add(row)
    return counts


def wipe_staged_data(session: Session, batch_id: Any) -> None:
    """Remove the personal data of a finished batch; keep numbers and reasons."""
    from sqlalchemy import update

    session.exec(
        update(ImportRow)
        .where(col(ImportRow.batch_id) == batch_id)
        .values(raw=None, mapped=None)
    )


def count_rows(session: Session, batch_id: Any) -> int:
    return session.exec(
        select(sa_func.count())
        .select_from(ImportRow)
        .where(ImportRow.batch_id == batch_id)
    ).one()
