"""Encryption of the one sensitive free-text field kept in the database (patch 213).

Only the assistance ``health_condition`` is encrypted. Names, addresses and birthdates stay plain
text because the program searches and sorts on them (decision 94).

* Key: ``DATA_ENCRYPTION_KEY`` in ``.env``. It is its own key (not ``MFA_ENCRYPTION_KEY`` and not
  touched by the secret-rotation tool), so changing one can never make the other data unreadable.
  Without the key a value is stored as plain text, exactly as before, and a warning is logged at
  start-up. **Losing or changing the key makes the stored health conditions unreadable** (they show
  as ``[cannot be read]``); keep a copy of ``.env`` on the USB drive.
* Format: ``enc1:`` + base64url(nonce + AES-GCM ciphertext), key derived with HKDF-SHA256.
  A stored value without the prefix is plain text (rows written before the key existed) and is
  returned as it is.
* ``EncryptedText`` does this transparently in the ORM, so routes and tests keep reading and
  writing plain strings; the database only ever holds the encrypted form once a key is set.
"""

import base64
import logging
import secrets
from typing import NamedTuple

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from sqlalchemy import Text, TypeDecorator, text
from sqlmodel import Session

from app.core.config import settings

logger = logging.getLogger(__name__)

PREFIX = "enc1:"
# Shown instead of a value that cannot be decrypted (wrong or missing key, damaged value).
UNREADABLE = "[cannot be read]"


class DataKeyMissing(Exception):
    """No ``DATA_ENCRYPTION_KEY`` is set, so nothing can be encrypted or decrypted."""


def _aead(key_text: str) -> AESGCM:
    if not key_text:
        raise DataKeyMissing
    derived = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=None,
        info=b"mayondon-field-v1",
    ).derive(key_text.encode("utf-8"))
    return AESGCM(derived)


def is_available() -> bool:
    return bool(settings.DATA_ENCRYPTION_KEY)


def encrypt_text(plain: str, *, key: str | None = None) -> str:
    nonce = secrets.token_bytes(12)
    blob = _aead(settings.DATA_ENCRYPTION_KEY if key is None else key).encrypt(
        nonce, plain.encode("utf-8"), None
    )
    return PREFIX + base64.urlsafe_b64encode(nonce + blob).decode("ascii")


def decrypt_text(stored: str, *, key: str | None = None) -> str | None:
    """The plain text, or None when it cannot be read (no key, wrong key, damaged)."""
    if not stored.startswith(PREFIX):
        return None
    try:
        raw = base64.urlsafe_b64decode(stored[len(PREFIX) :])
        plain = _aead(settings.DATA_ENCRYPTION_KEY if key is None else key).decrypt(
            raw[:12], raw[12:], None
        )
        return plain.decode("utf-8")
    except InvalidTag, ValueError, DataKeyMissing:
        return None


class EncryptedText(TypeDecorator[str]):
    """A text column that is encrypted on the way in and decrypted on the way out."""

    impl = Text
    cache_ok = True

    def process_bind_param(self, value: str | None, dialect: object) -> str | None:
        if value is None or not is_available():
            return value
        return encrypt_text(value)

    def process_result_value(self, value: str | None, dialect: object) -> str | None:
        if value is None or not value.startswith(PREFIX):
            return value
        plain = decrypt_text(value)
        return UNREADABLE if plain is None else plain


def encrypt_existing(session: Session) -> int:
    """Encrypt health conditions saved as plain text before a key was set.

    Safe to run at every start: it touches only rows that are not encrypted yet, does nothing
    without a key, and returns how many rows it changed.
    """
    connection = session.connection()
    pending = connection.execute(
        text(
            "SELECT issuance_id, health_condition FROM issuance_assistance "
            "WHERE health_condition IS NOT NULL AND health_condition NOT LIKE :p"
        ),
        {"p": PREFIX + "%"},
    ).all()
    if not pending:
        return 0
    if not is_available():
        logger.warning(
            "DATA_ENCRYPTION_KEY is not set: %d health condition(s) are stored as plain "
            "text. Add the key to .env to protect them.",
            len(pending),
        )
        return 0
    for issuance_id, plain in pending:
        encrypted = encrypt_text(plain)
        if (
            decrypt_text(encrypted) != plain
        ):  # never replace a value we cannot read back
            session.rollback()
            raise RuntimeError("A health condition did not survive a test decryption.")
        connection.execute(
            text(
                "UPDATE issuance_assistance SET health_condition = :v "
                "WHERE issuance_id = :i"
            ),
            {"v": encrypted, "i": issuance_id},
        )
    session.commit()
    logger.info("Encrypted %d health condition(s).", len(pending))
    return len(pending)


class DataProtection(NamedTuple):
    """What the administrator needs to know about the health-condition key (patch 214)."""

    key_configured: bool
    # Stored as plain text (no key was set when they were saved).
    plain_count: int
    # Stored encrypted but not readable with the key in .env (key lost, changed or damaged).
    unreadable_count: int


def protection_status(session: Session) -> DataProtection:
    """Count health conditions that are plain or unreadable. Reads, never changes, never logs a value."""
    rows = (
        session.connection()
        .execute(
            text(
                "SELECT health_condition FROM issuance_assistance "
                "WHERE health_condition IS NOT NULL"
            )
        )
        .scalars()
        .all()
    )
    plain = sum(1 for value in rows if not value.startswith(PREFIX))
    unreadable = sum(
        1 for value in rows if value.startswith(PREFIX) and decrypt_text(value) is None
    )
    return DataProtection(is_available(), plain, unreadable)
