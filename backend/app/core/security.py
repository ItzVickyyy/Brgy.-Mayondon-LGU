import hashlib
import hmac
import uuid
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
CONFIRM_TOKEN_PURPOSE = "confirm"
# The actions that ask for the password again, and nothing else.
CONFIRM_SCOPES = ("backup.restore", "backup.download")

# The starting password of every account an administrator creates (or resets).
# The account is flagged must_change_password, so it only works until the
# person's first sign-in. Keep equal to DEFAULT_PASSWORD in
# frontend/src/config/site.ts.
DEFAULT_PASSWORD = "ChangeThisPassword"


def password_expires_at(changed_at: datetime | None) -> datetime | None:
    """When a password set at ``changed_at`` stops being valid (None = never).

    The limit is ``PASSWORD_MAX_AGE_DAYS`` (90 days, about 3 months); 0 turns the rule off.
    An account with no recorded date has no limit until its next password change.
    """
    if changed_at is None or settings.PASSWORD_MAX_AGE_DAYS <= 0:
        return None
    start = changed_at if changed_at.tzinfo else changed_at.replace(tzinfo=UTC)
    return start + timedelta(days=settings.PASSWORD_MAX_AGE_DAYS)


def password_is_expired(changed_at: datetime | None) -> bool:
    expires = password_expires_at(changed_at)
    return expires is not None and expires <= datetime.now(UTC)


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
    subject: str | Any,
    expires_delta: timedelta,
    hashed_password: str,
    jti: str | None = None,
) -> str:
    expire = datetime.now(UTC) + expires_delta
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "pwdv": password_fingerprint(hashed_password),
        "jti": jti or uuid.uuid4().hex,
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


def create_confirm_token(subject: str | Any, hashed_password: str, scope: str) -> str:
    """Proof that the signed-in person just typed their password again.

    It carries ``purpose=confirm`` and one ``scope``, lives two minutes, and is
    refused by the normal request check (like the two-factor token), so it can
    never be used as a sign-in. Changing the password makes it stale (``pwdv``).
    """
    expire = datetime.now(UTC) + timedelta(
        seconds=settings.CONFIRM_TOKEN_EXPIRE_SECONDS
    )
    return jwt.encode(
        {
            "exp": expire,
            "sub": str(subject),
            "pwdv": password_fingerprint(hashed_password),
            "purpose": CONFIRM_TOKEN_PURPOSE,
            "scope": scope,
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
