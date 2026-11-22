"""Keeps a spreadsheet program from running text as a formula.

A cell that starts with ``=``, ``+``, ``-``, ``@``, a tab or a carriage return is read by Excel and
LibreOffice as a formula, so a resident name or an imported value typed that way could run when
someone opens the file. A leading apostrophe makes it plain text. Numbers are left alone.
"""

from typing import Any

_FORMULA_STARTS = ("=", "+", "-", "@", "\t", "\r")


def csv_safe(value: Any) -> Any:
    if isinstance(value, str) and value.startswith(_FORMULA_STARTS):
        return f"'{value}"
    return value
