"""Character and format checks for resident details (patch 240).

The rules are the same ones the form enforces while typing (``frontend/src/lib/inputRules.ts``);
keep both lists equal. On an edit only the values that changed are checked, so an old
record that predates these rules can still be saved without touching the bad value.
"""

import re
import unicodedata
from collections.abc import Mapping
from typing import Any

from app.core.dates import today_manila

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


def phone_ok(value: str) -> bool:
    """Digits, spaces and + - ( ) only, with 7 to 13 digits (as the form's isValidPhone)."""
    if not re.fullmatch(r"\+?[\d\s\-()]+", value.strip()):
        return False
    return 7 <= len(re.sub(r"\D", "", value)) <= 13


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
