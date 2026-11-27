"""Character and format checks for resident details (patch 240).

The rules are the same ones the form enforces while typing (``frontend/src/lib/inputRules.ts``);
keep both lists equal. On an edit only the values that changed are checked, so an old
record that predates these rules can still be saved without touching the bad value.
"""

import re
import unicodedata
from collections.abc import Mapping
from datetime import date
from typing import Any

from app.core.dates import today_manila

MIN_BIRTHDATE = date(1900, 1, 1)
NAME_EXTRA = " .'’,-"
FREE_TEXT_BAD = re.compile(r"[<>\x00-\x1f\x7f]")

NAME_FIELDS = ("first_name", "middle_name", "last_name")
TEXT_FIELDS = (
    "birth_place",
    "occupation",
    "house_number",
    "resident_type",
    "emergency_contact_name",
    "emergency_contact_address",
)


def _is_name(value: str) -> bool:
    text = unicodedata.normalize("NFC", value)
    if not text or not text[0].isalpha():
        return False
    return all(
        ch.isalpha() or unicodedata.category(ch).startswith("M") or ch in NAME_EXTRA
        for ch in text
    )


def tidy_name(value: str) -> str:
    """A name as stored: Unicode NFC (so Ñ is one character, never N plus a tilde)
    with single spaces, so the same person always matches the same spelling."""
    return " ".join(unicodedata.normalize("NFC", value).split())


def tidy_text(value: str) -> str:
    """Free text as stored: Unicode NFC, nothing else changed."""
    return unicodedata.normalize("NFC", value)


def check_birthdate(value: date | None) -> date | None:
    """A birthdate from 1 January 1900 to today (Manila); empty is allowed."""
    if value is not None and value > today_manila():
        raise ValueError("birthdate cannot be in the future")
    if value is not None and value < MIN_BIRTHDATE:
        raise ValueError("birthdate cannot be before 1900")
    return value


def phone_ok(value: str) -> bool:
    """Digits, spaces and + - ( ) only, with 7 to 13 digits (as the form's isValidPhone).

    A mobile number is checked more strictly: one that starts 09 has exactly 11
    digits and one that starts 639 (+63 9...) exactly 12, so a missing or extra
    digit is caught. Anything else is taken as a landline and keeps the 7 to 13 rule.
    """
    if not re.fullmatch(r"\+?[\d\s\-()]+", value.strip()):
        return False
    digits = re.sub(r"\D", "", value)
    if digits.startswith("09"):
        return len(digits) == 11
    if digits.startswith("639"):
        return len(digits) == 12
    return 7 <= len(digits) <= 13


def check_values(
    values: Mapping[str, Any], *, current: Mapping[str, Any] | None = None
) -> str | None:
    """The first problem in ``values`` as a sentence, or None.

    ``current`` holds the stored record on an edit: a field equal to its stored value
    is not checked again.
    """

    def changed(key: str) -> bool:
        return key in values and (current is None or values[key] != current.get(key))

    for key in NAME_FIELDS:
        value = values.get(key)
        if changed(key) and isinstance(value, str) and value.strip():
            if not _is_name(value.strip()):
                label = key.replace("_", " ")
                return (
                    f"The {label} may contain only letters (including Ñ), spaces "
                    "and . ' - characters."
                )
    for key in TEXT_FIELDS:
        value = values.get(key)
        if changed(key) and isinstance(value, str) and FREE_TEXT_BAD.search(value):
            return f"The {key.replace('_', ' ')} may not contain < or > characters."
    phone = values.get("emergency_contact_phone")
    if changed("emergency_contact_phone") and isinstance(phone, str) and phone.strip():
        if not phone_ok(phone.strip()):
            return (
                "Enter the emergency contact number like 09171234567 or +639171234567."
            )
    year = values.get("resident_since_year")
    if changed("resident_since_year") and isinstance(year, int):
        if year > today_manila().year or year < 1900:
            return "The year of residence must be from 1900 to this year."
        birth = values.get("birthdate")
        if birth is not None and year < birth.year:
            return "The year of residence cannot be before the year of birth."
    return None
