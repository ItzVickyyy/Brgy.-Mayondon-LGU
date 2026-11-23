"""Encryption of the sensitive values kept in the database (patches 213 and 216).

The assistance ``health_condition`` (patch 213) and the resident photos (patch 216) are encrypted.
Names, addresses and birthdates stay plain text because the program searches and sorts on them
(decision 94).

* Key: ``DATA_ENCRYPTION_KEY`` in ``.env``. It is its own key (not ``MFA_ENCRYPTION_KEY`` and not
  touched by the secret-rotation tool), so changing one can never make the other data unreadable.
  Without the key a value is stored as plain text, exactly as before, and a warning is logged at
  start-up. **Losing or changing the key makes the stored health conditions unreadable** (they show
  as ``[cannot be read]``, a photo cannot be shown); keep a copy of ``.env`` on the USB drive.
* Format: ``enc1:`` + base64url(nonce + AES-GCM ciphertext), key derived with HKDF-SHA256.
  A stored value without the prefix is plain text (rows written before the key existed) and is
  returned as it is. A photo uses the same key and layout as raw bytes: ``enc1:`` + nonce +
  AES-GCM ciphertext (a PNG or WebP file never starts with those bytes).
* ``EncryptedText`` does this transparently in the ORM, so routes and tests keep reading and
  writing plain strings; the database only ever holds the encrypted form once a key is set.
"""

import base64
import logging
import secrets
import threading
import time
from functools import lru_cache
from typing import NamedTuple

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from sqlalchemy import LargeBinary, Text, TypeDecorator, text
from sqlmodel import Session

from app.core.config import settings

logger = logging.getLogger(__name__)

PREFIX = "enc1:"
BYTES_PREFIX = PREFIX.encode("ascii")
_PHOTO_CONTEXT = b"resident-photo-v1"
# Shown instead of a value that cannot be decrypted (wrong or missing key, damaged value).
UNREADABLE = "[cannot be read]"


class DataKeyMissing(Exception):
    """No ``DATA_ENCRYPTION_KEY`` is set, so nothing can be encrypted or decrypted."""


@lru_cache(maxsize=4)
def _aead(key_text: str) -> AESGCM:
    """The cipher for a key. Derived once per key, not once per value (an AESGCM object holds no
    per-message state, so one can be shared by every request)."""
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


def encrypt_bytes(plain: bytes, *, key: str | None = None) -> bytes:
    nonce = secrets.token_bytes(12)
    blob = _aead(settings.DATA_ENCRYPTION_KEY if key is None else key).encrypt(
        nonce, plain, _PHOTO_CONTEXT
    )
    return BYTES_PREFIX + nonce + blob


def decrypt_bytes(stored: bytes, *, key: str | None = None) -> bytes | None:
    """The plain bytes, or None when they cannot be read (no key, wrong key, damaged)."""
    if not stored.startswith(BYTES_PREFIX):
        return None
    raw = stored[len(BYTES_PREFIX) :]
    try:
        return _aead(settings.DATA_ENCRYPTION_KEY if key is None else key).decrypt(
            raw[:12], raw[12:], _PHOTO_CONTEXT
        )
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


class EncryptedBytes(TypeDecorator[bytes]):
    """A binary column (the resident photo) encrypted on the way in and decrypted on the way out.

    A value that cannot be decrypted reads as empty bytes; the photo route answers that the photo
    cannot be read, and uploading a new photo replaces it.
    """

    impl = LargeBinary
    cache_ok = True

    def process_bind_param(self, value: bytes | None, dialect: object) -> bytes | None:
        if value is None or not is_available():
            return value
        return encrypt_bytes(bytes(value))

    def process_result_value(
        self, value: bytes | None, dialect: object
    ) -> bytes | None:
        if value is None:
            return value
        raw = bytes(value)
        if not raw.startswith(BYTES_PREFIX):
            return raw
        return decrypt_bytes(raw) or b""


def _photos_not_encrypted(session: Session) -> list[object]:
    return list(
        session.connection()
        .execute(
            text(
                "SELECT resident_id FROM resident_photos "
                "WHERE substring(content from 1 for 5) <> :p ORDER BY resident_id"
            ),
            {"p": BYTES_PREFIX},
        )
        .scalars()
        .all()
    )


def _unreadable_photos(session: Session) -> int:
    """Encrypted photos the key in .env cannot open. One photo in memory at a time.

    One streamed query (a small batch of photos at a time) instead of one query per photo: with
    1,500 photos the per-photo version spent about a second just waiting for the database.
    """
    result = session.connection().execute(
        text(
            "SELECT content FROM resident_photos WHERE substring(content from 1 for 5) = :p"
        ).execution_options(stream_results=True, yield_per=20),
        {"p": BYTES_PREFIX},
    )
    bad = 0
    for (stored,) in result:
        if stored is not None and decrypt_bytes(bytes(stored)) is None:
            bad += 1
    return bad


def encrypt_existing(session: Session) -> int:
    """Encrypt health conditions and photos saved as plain text before a key was set.

    Safe to run at every start: it touches only rows that are not encrypted yet, does nothing
    without a key, saves everything in one transaction, and returns how many values it changed.
    """
    connection = session.connection()
    pending = connection.execute(
        text(
            "SELECT issuance_id, health_condition FROM issuance_assistance "
            "WHERE health_condition IS NOT NULL AND health_condition NOT LIKE :p"
        ),
        {"p": PREFIX + "%"},
    ).all()
    pending_photos = _photos_not_encrypted(session)
    if not pending and not pending_photos:
        return 0
    if not is_available():
        logger.warning(
            "DATA_ENCRYPTION_KEY is not set: %d health condition(s) and %d photo(s) are "
            "stored unprotected. Add the key to .env to protect them.",
            len(pending),
            len(pending_photos),
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
    for resident_id in pending_photos:
        row = connection.execute(
            text("SELECT content FROM resident_photos WHERE resident_id = :i"),
            {"i": resident_id},
        ).first()
        if row is None:
            continue
        plain_photo = bytes(row[0])
        encrypted_photo = encrypt_bytes(plain_photo)
        if decrypt_bytes(encrypted_photo) != plain_photo:
            session.rollback()
            raise RuntimeError("A photo did not survive a test decryption.")
        connection.execute(
            text("UPDATE resident_photos SET content = :v WHERE resident_id = :i"),
            {"v": encrypted_photo, "i": resident_id},
        )
    session.commit()
    logger.info(
        "Encrypted %d health condition(s) and %d photo(s).",
        len(pending),
        len(pending_photos),
    )
    return len(pending) + len(pending_photos)


class DataProtection(NamedTuple):
    """What the administrator needs to know about the data key (patches 214 and 217).

    The counts cover health conditions and resident photos together.
    """

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
    plain += len(_photos_not_encrypted(session))
    unreadable += _unreadable_photos(session)
    return DataProtection(is_available(), plain, unreadable)


# The bell asks for this every 5 minutes from every administrator's browser, and the answer only
# changes when a photo or health condition is saved or the key in .env changes (which needs a
# restart, and so empties this cache). Checking every stored photo costs time that grows with the
# number of photos, so the last answer is kept for a few minutes. The tests set this to 0.
PROTECTION_CACHE_SECONDS = 300.0
_protection_lock = threading.Lock()
_protection_cache: tuple[float, str, DataProtection] | None = None


def protection_status_cached(session: Session) -> DataProtection:
    """``protection_status``, reused for ``PROTECTION_CACHE_SECONDS`` (per worker process).

    Only one request does the work at a time; the others wait and then use its answer.
    """
    global _protection_cache  # noqa: PLW0603 (a one-entry cache for the whole process)
    key_id = settings.DATA_ENCRYPTION_KEY or ""
    with _protection_lock:
        cached = _protection_cache
        now = time.monotonic()
        if (
            cached is not None
            and cached[1] == key_id
            and now - cached[0] < PROTECTION_CACHE_SECONDS
        ):
            return cached[2]
        status = protection_status(session)
        _protection_cache = (time.monotonic(), key_id, status)
        return status
