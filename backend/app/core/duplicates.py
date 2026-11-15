"""Finding people who may already be in the records.

A namesake check that compares exact lower-case text misses the usual ways the
same person is typed twice: ``Dela Cruz`` and ``Delacruz``, ``Peña`` and
``Pena``, a stray space or full stop. Names are therefore compared by a *key*:
accents removed, lower case, and every character that is not a letter or digit
dropped. ``name_key`` (Python) and ``name_key_sql`` (PostgreSQL) build the same
key, so a value checked in either place gives the same answer.

Two rules decide "possible duplicate" (a warning the clerk can confirm, never a
hard block, because real namesakes exist):

* **Same person, same birthday**: first name, last name and birthdate match.
* **Same name, a record without a birthdate**: the masterlist and the Barangay
  ID history leave records that hold only a name. A new or edited record whose
  first, middle and last name (and suffix) match one of those, or that has no
  birthdate itself, is flagged so the two are not left as separate people.

Two people adding the same person at the same moment would both pass a plain
"look first" check, so ``lock_person`` takes a transaction-scoped advisory lock
on the person's key; the second request waits until the first has committed and
then sees it.
"""

import re
from datetime import date
from typing import Any

from sqlalchemy import and_, bindparam, or_, text
from sqlalchemy import func as sa_func
from sqlmodel import Session, col, select

from app.core.search import fold, fold_text
from app.models_residents import Resident

_NOT_ALNUM = re.compile(r"[^a-z0-9]")


def name_key(value: str | None) -> str:
    """Accent-free, lower-case text with only letters and digits left."""
    return _NOT_ALNUM.sub("", fold_text(value or ""))


def name_key_sql(column: Any) -> Any:
    """SQL twin of :func:`name_key` for a text column."""
    return sa_func.regexp_replace(
        fold(sa_func.coalesce(column, "")), "[^a-z0-9]", "", "g"
    )


def lock_person(
    session: Session, first_name: str, last_name: str, birthdate: date | None
) -> None:
    """Serialise two requests about the same person until the first commits."""
    key = f"resident:{name_key(first_name)}:{name_key(last_name)}:{birthdate or ''}"
    session.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:key))").bindparams(
            bindparam("key", key)
        )
    )


def find_possible_duplicates(
    session: Session,
    *,
    first_name: str,
    middle_name: str | None,
    last_name: str,
    suffix: str | None,
    birthdate: date | None,
    except_id: Any = None,
    limit: int = 5,
) -> list[Resident]:
    """Residents (active or archived) who may be the same person."""
    first = name_key(first_name)
    last = name_key(last_name)
    if not first or not last:
        return []
    same_first_last = and_(
        name_key_sql(col(Resident.first_name)) == first,
        name_key_sql(col(Resident.last_name)) == last,
    )
    rules = []
    if birthdate is not None:
        rules.append(and_(same_first_last, col(Resident.birthdate) == birthdate))
    # A record that holds only a name (or a new record with no birthdate) is
    # compared on the full name, so common first and last names alone stay quiet.
    same_full_name = and_(
        same_first_last,
        name_key_sql(col(Resident.middle_name)) == name_key(middle_name),
        name_key_sql(col(Resident.suffix)) == name_key(suffix),
    )
    if birthdate is None:
        rules.append(same_full_name)
    else:
        rules.append(and_(same_full_name, col(Resident.birthdate).is_(None)))
    stmt = select(Resident).where(or_(*rules))
    if except_id is not None:
        stmt = stmt.where(col(Resident.id) != except_id)
    stmt = stmt.order_by(
        col(Resident.status), col(Resident.last_name), col(Resident.first_name)
    ).limit(limit)
    return list(session.exec(stmt).all())
