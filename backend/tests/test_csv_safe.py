import pytest

from app.core.csv_safe import csv_safe


@pytest.mark.parametrize("start", ["=", "+", "-", "@", "\t", "\r"])
def test_formula_starts_become_plain_text(start: str) -> None:
    assert csv_safe(f"{start}1+1") == f"'{start}1+1"


def test_normal_values_are_left_alone() -> None:
    assert csv_safe("Juan dela Cruz") == "Juan dela Cruz"
    assert csv_safe("") == ""
    assert csv_safe(12) == 12
    assert csv_safe(-3) == -3
