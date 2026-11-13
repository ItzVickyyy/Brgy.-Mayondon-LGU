"""Security questions for offline password recovery (step 13).

The question list is fixed in code (ids ``q01`` to ``q10``); the wording in
English and Filipino lives in the frontend language files. Answers are
normalised, then stored only as Argon2 hashes, like passwords.
"""

import hashlib
import hmac
import unicodedata

from app.core import security
from app.core.config import settings

QUESTION_IDS: tuple[str, ...] = tuple(f"q{n:02d}" for n in range(1, 11))
QUESTIONS_REQUIRED = 3
MIN_ANSWER_LENGTH = 2

# Checked for unknown accounts so the time taken does not reveal them.
_DUMMY_HASH = security.get_password_hash("security-questions-dummy")


def normalize_answer(answer: str) -> str:
    """Lower case, accents and punctuation removed, spaces collapsed."""
    decomposed = unicodedata.normalize("NFKD", answer)
    kept = []
    for char in decomposed:
        category = unicodedata.category(char)
        if category.startswith("M"):  # combining accent
            continue
        if category[0] in ("L", "N"):
            kept.append(char.casefold())
        elif category[0] in ("Z", "P", "S", "C"):
            kept.append(" ")
    return " ".join("".join(kept).split())


def _material(question_id: str, answer: str) -> str:
    # Bound to the question, so a hash cannot be moved to another question.
    return f"{question_id}:{normalize_answer(answer)}"


def hash_answer(question_id: str, answer: str) -> str:
    return security.get_password_hash(_material(question_id, answer))


def verify_answer(question_id: str, answer: str, answer_hash: str) -> bool:
    verified, _ = security.verify_password(_material(question_id, answer), answer_hash)
    return verified


def spend_dummy_verification(answers: list[str]) -> None:
    """Do the same work as a real check when there is no account to check."""
    for answer in answers:
        security.verify_password(_material("q00", answer), _DUMMY_HASH)


def decoy_question_ids(email: str) -> list[str]:
    """Three questions chosen from the e-mail itself with a server-side key.

    The same e-mail always gets the same three, so an unknown account looks
    exactly like a real one.
    """
    digest = hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        f"recovery-decoy:{email.strip().casefold()}".encode(),
        hashlib.sha256,
    ).digest()
    pool = list(QUESTION_IDS)
    chosen: list[str] = []
    for byte in digest:
        if len(chosen) == QUESTIONS_REQUIRED:
            break
        chosen.append(pool.pop(byte % len(pool)))
    return sorted(chosen)
