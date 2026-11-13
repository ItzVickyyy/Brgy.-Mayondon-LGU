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
MFA_TOKEN_PURPOSE = "mfa"

# The starting password of every account an administrator creates (or resets).
# The account is flagged must_change_password, so it only works until the
# person's first sign-in. Keep equal to DEFAULT_PASSWORD in
# frontend/src/config/site.ts.
DEFAULT_PASSWORD = "ChangeThisPassword"


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


def create_mfa_token(subject: str | Any, hashed_password: str) -> str:
    """The token handed out after a correct password when two-factor is on.

    It carries ``purpose=mfa`` and lives a few minutes. The normal request
    check refuses any token with a purpose, so it can only be used at
    ``POST /login/mfa``. Changing the password makes it stale (``pwdv``).
    """
    expire = datetime.now(UTC) + timedelta(minutes=settings.MFA_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {
            "exp": expire,
            "sub": str(subject),
            "pwdv": password_fingerprint(hashed_password),
            "purpose": MFA_TOKEN_PURPOSE,
        },
        settings.SECRET_KEY,
        algorithm=ALGORITHM,
    )


def verify_password(
    plain_password: str, hashed_password: str
) -> tuple[bool, str | None]:
    return password_hash.verify_and_update(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return password_hash.hash(password)
