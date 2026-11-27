"""Rules for resident names, free text, phone numbers and the year of residence."""

from datetime import date

import pytest

from app.core.resident_validation import (
    check_birthdate,
    check_values,
    phone_ok,
    tidy_name,
    tidy_text,
)
from app.core.search import search_words


@pytest.mark.parametrize(
    "name",
    [
        "Peña",
        "Ma. Cristina",
        "O'Brien",
        "De la Cruz-Santos",
        "Niño",
        "Dela Cruz",
        "Cruz, Jr.",
    ],
)
def test_real_names_pass(name: str) -> None:
    assert check_values({"first_name": name}) is None


@pytest.mark.parametrize("name", ["Juan2", "J@n", "<b>x</b>", "-Juan", "Juan_"])
def test_bad_names_are_refused(name: str) -> None:
    assert "letters" in (check_values({"last_name": name}) or "")


@pytest.mark.parametrize(
    "number",
    ["09171234567", "+639171234567", "0917 123 4567", "(049) 502-2443", "5022443"],
)
def test_phone_numbers_pass(number: str) -> None:
    assert phone_ok(number)


@pytest.mark.parametrize(
    "number",
    ["abc", "12", "0917-123-456-7890", "09a71234567", "0917123456", "091712345678"],
)
def test_phone_numbers_fail(number: str) -> None:
    assert not phone_ok(number)
    assert check_values({"emergency_contact_phone": number}) is not None


def test_text_fields_refuse_angle_brackets() -> None:
    assert check_values({"occupation": "<script>"}) is not None
    assert check_values({"occupation": "Driver"}) is None


def test_year_of_residence_rules() -> None:
    assert check_values({"resident_since_year": 2999}) is not None
    assert check_values({"resident_since_year": 1850}) is not None
    assert (
        check_values({"resident_since_year": 1980, "birthdate": date(1990, 1, 1)})
        is not None
    )


def test_unchanged_old_values_are_not_checked_again() -> None:
    stored = {"first_name": "Juan2", "emergency_contact_phone": "abc"}
    assert check_values(dict(stored), current=stored) is None
    assert check_values({"first_name": "Juan3"}, current=stored) is not None


@pytest.mark.parametrize(
    "number", ["+63917123456", "+6391712345678", "63917123456", "0917 123 456"]
)
def test_a_mobile_number_with_a_missing_or_extra_digit_is_refused(number: str) -> None:
    assert not phone_ok(number)


def test_other_numbers_keep_the_landline_rule() -> None:
    assert phone_ok("+63 49 536 0000")
    assert phone_ok("0495360000")
    assert not phone_ok("123456")


def test_birthdate_range() -> None:
    assert check_birthdate(None) is None
    assert check_birthdate(date(1900, 1, 1)) == date(1900, 1, 1)
    with pytest.raises(ValueError, match="before 1900"):
        check_birthdate(date(1899, 12, 31))
    with pytest.raises(ValueError, match="future"):
        check_birthdate(date(2999, 1, 1))


def test_names_are_stored_composed_with_single_spaces() -> None:
    decomposed = "Nin\u0303o"
    assert decomposed != "Niño"
    assert tidy_name(decomposed) == "Niño"
    assert tidy_name("  Dela   Cruz ") == "Dela Cruz"
    assert tidy_text("Pen\u0303a St.") == "Peña St."


def test_search_finds_a_name_typed_with_a_separate_tilde() -> None:
    assert search_words("Nin\u0303o") == search_words("Niño") == ["nino"]
