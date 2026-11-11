"""Forgiving name search shared by the resident, issuance and Barangay ID lists.

Counter staff type ``Last, First`` or ``Dela Cruz`` without accents, so a word
must match whatever is stored whether or not either side has accents, commas,
capitals or spaces. Everything here is plain PostgreSQL (``translate``,
``replace``, ``lower``); no extension or migration is needed.
"""

import re
from typing import Any

from sqlalchemy import func as sa_func
from sqlalchemy import or_

_ACCENTED = "áàâäãåāéèêëēíìîïīóòôöõōúùûüūñçýÿ"
_PLAIN = "aaaaaaaeeeeeiiiiiooooooouuuuncyy"
assert len(_ACCENTED) == len(_PLAIN)

_ESCAPE = "\\"


def fold_text(value: str) -> str:
    """Python twin of :func:`fold`: lower case, accents removed."""
    return value.lower().translate(str.maketrans(_ACCENTED, _PLAIN))


def fold(column: Any) -> Any:
    """SQL expression: ``column`` in lower case with accents removed."""
    return sa_func.translate(sa_func.lower(column), _ACCENTED, _PLAIN)


def search_words(q: str | None) -> list[str]:
    """Split what was typed into words; commas, dots and semicolons only separate."""
    return fold_text(re.sub(r"[,.;]", " ", q or "")).split()


def _like_pattern(word: str) -> str:
    escaped = word.replace(_ESCAPE, _ESCAPE * 2).replace("%", r"\%").replace("_", r"\_")
    return f"%{escaped}%"


def word_matches(word: str, name_columns: list[Any], other_columns: list[Any]) -> Any:
    """True when ``word`` is found in a column, ignoring case and accents.

    Name columns are also compared with their spaces removed, so ``Delacruz``
    finds ``Dela Cruz``. ``other_columns`` (reference numbers, ID numbers) are
    compared as they are.
    """
    pattern = _like_pattern(word)
    tests = []
    for column in name_columns:
        folded = fold(column)
        tests.append(folded.like(pattern, escape=_ESCAPE))
        tests.append(sa_func.replace(folded, " ", "").like(pattern, escape=_ESCAPE))
    for column in other_columns:
        tests.append(fold(column).like(pattern, escape=_ESCAPE))
    return or_(*tests)
