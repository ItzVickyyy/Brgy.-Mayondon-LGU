import hashlib
import hmac
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher
from pwdlib.hashers.bcrypt import BcryptHasher

from app.core.config import settings

password_hash = PasswordHash(
    (
        Argon2Hasher(),
        BcryptHasher(),
    )
)


ALGORITHM = "HS256"


def password_fingerprint(hashed_password: str) -> str:
    """Return a keyed fingerprint that changes when the password hash changes."""
    return hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        hashed_password.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def verify_password_fingerprint(
    token_fingerprint: str | None, hashed_password: str
) -> bool:
    """Reject missing or stale token fingerprints."""
    return isinstance(token_fingerprint, str) and hmac.compare_digest(
        token_fingerprint, password_fingerprint(hashed_password)
    )


def create_access_token(
    subject: str | Any, expires_delta: timedelta, hashed_password: str
) -> str:
    expire = datetime.now(UTC) + expires_delta
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "pwdv": password_fingerprint(hashed_password),
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_password(
    plain_password: str, hashed_password: str
) -> tuple[bool, str | None]:
    return password_hash.verify_and_update(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return password_hash.hash(password)
