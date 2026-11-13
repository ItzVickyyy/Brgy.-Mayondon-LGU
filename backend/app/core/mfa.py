"""Two-factor sign-in with an authenticator app (step 14, TOTP).

Pure standard library for the codes (RFC 6238 over RFC 4226, HMAC-SHA1, six
digits, 30-second steps), so it works with no network. The authenticator
secret is stored encrypted with its own key (``MFA_ENCRYPTION_KEY``, AES-GCM),
bound to the person it belongs to. Recovery codes are random, shown once, and
stored only as Argon2 hashes.
"""

import base64
import hashlib
import hmac
import secrets
import struct
import time
import uuid
from urllib.parse import quote

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from app.core import security
from app.core.config import settings

PERIOD_SECONDS = 30
DIGITS = 6
WINDOW_STEPS = 1  # one step either side: tolerates a clock a little off
SECRET_BYTES = 20  # 160 bits, what authenticator apps expect
RECOVERY_CODE_COUNT = 10
# No 0/O/1/I/L: easy to misread when copied from paper.
_RECOVERY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
_RECOVERY_GROUP = 5
_ENCRYPTION_PREFIX = "v1:"
ISSUER = "Barangay Mayondon"


class MfaNotAvailable(Exception):
    """The server has no MFA_ENCRYPTION_KEY, so nothing can be encrypted."""


# ----- codes -----------------------------------------------------------------


def new_secret() -> str:
    """A new random authenticator secret, as the base32 text apps ask for."""
    return base64.b32encode(secrets.token_bytes(SECRET_BYTES)).decode("ascii")


def _secret_bytes(secret: str) -> bytes:
    cleaned = secret.replace(" ", "").upper()
    return base64.b32decode(cleaned + "=" * (-len(cleaned) % 8))


def hotp(key: bytes, counter: int, digits: int = DIGITS) -> str:
    """RFC 4226."""
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    number = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(number % 10**digits).zfill(digits)


def current_step(now: float | None = None) -> int:
    return int((time.time() if now is None else now) // PERIOD_SECONDS)


def totp(secret: str, *, step: int | None = None, digits: int = DIGITS) -> str:
    """RFC 6238 code for a 30-second step (the current one by default)."""
    return hotp(_secret_bytes(secret), current_step() if step is None else step, digits)


def match_step(secret: str, code: str, *, now: float | None = None) -> int | None:
    """The 30-second step this code belongs to, or None when it is wrong.

    Looks one step back and one forward. All candidates are compared, with no
    early exit, in constant time per comparison.
    """
    typed = "".join(code.split())
    if len(typed) != DIGITS or not typed.isascii() or not typed.isdigit():
        return None
    key = _secret_bytes(secret)
    centre = current_step(now)
    found: int | None = None
    for step in range(centre - WINDOW_STEPS, centre + WINDOW_STEPS + 1):
        if hmac.compare_digest(hotp(key, step), typed):
            found = step
    return found


def looks_like_totp(code: str) -> bool:
    typed = "".join(code.split())
    return len(typed) == DIGITS and typed.isascii() and typed.isdigit()


def otpauth_uri(secret: str, account: str) -> str:
    label = quote(f"{ISSUER}:{account}", safe="")
    return (
        f"otpauth://totp/{label}?secret={secret}&issuer={quote(ISSUER, safe='')}"
        f"&algorithm=SHA1&digits={DIGITS}&period={PERIOD_SECONDS}"
    )


# ----- encrypting the secret -------------------------------------------------


def _aead(key_text: str) -> AESGCM:
    if not key_text:
        raise MfaNotAvailable
    derived = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=None,
        info=b"mayondon-mfa-secret-v1",
    ).derive(key_text.encode("utf-8"))
    return AESGCM(derived)


def is_available() -> bool:
    return bool(settings.MFA_ENCRYPTION_KEY)


def encrypt_secret(secret: str, user_id: uuid.UUID, *, key: str | None = None) -> str:
    nonce = secrets.token_bytes(12)
    blob = _aead(settings.MFA_ENCRYPTION_KEY if key is None else key).encrypt(
        nonce, secret.encode("ascii"), user_id.bytes
    )
    return _ENCRYPTION_PREFIX + base64.urlsafe_b64encode(nonce + blob).decode("ascii")


def decrypt_secret(
    stored: str, user_id: uuid.UUID, *, key: str | None = None
) -> str | None:
    """The plain secret, or None when it cannot be read (no key, wrong key, damaged)."""
    if not stored.startswith(_ENCRYPTION_PREFIX):
        return None
    try:
        raw = base64.urlsafe_b64decode(stored[len(_ENCRYPTION_PREFIX) :])
        plain = _aead(settings.MFA_ENCRYPTION_KEY if key is None else key).decrypt(
            raw[:12], raw[12:], user_id.bytes
        )
    except InvalidTag, ValueError, MfaNotAvailable:
        return None
    return plain.decode("ascii")


# ----- recovery codes --------------------------------------------------------


def new_recovery_code() -> str:
    letters = "".join(
        secrets.choice(_RECOVERY_ALPHABET) for _ in range(2 * _RECOVERY_GROUP)
    )
    return f"{letters[:_RECOVERY_GROUP]}-{letters[_RECOVERY_GROUP:]}"


def normalize_recovery_code(code: str) -> str:
    return "".join(ch for ch in code.upper() if ch.isalnum())


def hash_recovery_code(code: str) -> str:
    return security.get_password_hash(normalize_recovery_code(code))


def verify_recovery_code(code: str, code_hash: str) -> bool:
    verified, _ = security.verify_password(normalize_recovery_code(code), code_hash)
    return verified
