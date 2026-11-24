"""Rules for resident names, free text, phone numbers and the year of residence."""

from datetime import date

import pytest

from app.core.resident_validation import check_values, phone_ok


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


@pytest.mark.parametrize("number", ["abc", "12", "0917-123-456-7890", "09a71234567"])
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
