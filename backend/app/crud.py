import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlmodel import Session, func, select

from app.core.config import settings
from app.core.security import get_password_hash, verify_password
from app.models import Item, ItemCreate, User, UserCreate, UserUpdate


def create_user(*, session: Session, user_create: UserCreate) -> User:
    db_obj = User.model_validate(
        user_create, update={"hashed_password": get_password_hash(user_create.password)}
    )
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_user(*, session: Session, db_user: User, user_in: UserUpdate) -> Any:
    user_data = user_in.model_dump(exclude_unset=True)
    extra_data = {}
    if "password" in user_data:
        password = user_data["password"]
        hashed_password = get_password_hash(password)
        extra_data["hashed_password"] = hashed_password
        # A password change should also release any failed-login lockout.
        db_user.failed_login_attempts = 0
        db_user.locked_until = None
    db_user.sqlmodel_update(user_data, update=extra_data)
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user


def get_user_by_email(*, session: Session, email: str) -> User | None:
    statement = select(User).where(func.lower(User.email) == email.strip().lower())
    session_user = session.exec(statement).first()
    return session_user


# Dummy hash to use for timing attack prevention when user is not found
# This is an Argon2 hash of a random password, used to ensure constant-time comparison
DUMMY_HASH = "$argon2id$v=19$m=65536,t=3,p=4$MjQyZWE1MzBjYjJlZTI0Yw$YTU4NGM5ZTZmYjE2NzZlZjY0ZWY3ZGRkY2U2OWFjNjk"


def authenticate(*, session: Session, email: str, password: str) -> User | None:
    db_user = get_user_by_email(session=session, email=email)
    if not db_user:
        # Prevent timing attacks by verifying a hash even when the account is unknown.
        verify_password(password, DUMMY_HASH)
        return None

    now = datetime.now(UTC)
    locked_until = db_user.locked_until
    # SQLite test databases may return naive datetimes for timezone-aware columns.
    if locked_until is not None and locked_until.tzinfo is None:
        locked_until = locked_until.replace(tzinfo=UTC)

    if locked_until is not None and locked_until > now:
        # Keep response timing similar while the account is temporarily locked.
        verify_password(password, db_user.hashed_password)
        return None

    if locked_until is not None:
        db_user.locked_until = None
        db_user.failed_login_attempts = 0

    verified, updated_password_hash = verify_password(password, db_user.hashed_password)
    if not verified:
        db_user.failed_login_attempts += 1
        if db_user.failed_login_attempts >= settings.LOGIN_MAX_FAILED_ATTEMPTS:
            db_user.locked_until = now + timedelta(minutes=settings.LOGIN_LOCKOUT_MINUTES)
        session.add(db_user)
        session.commit()
        return None

    if updated_password_hash:
        db_user.hashed_password = updated_password_hash
    db_user.failed_login_attempts = 0
    db_user.locked_until = None
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user


def create_item(*, session: Session, item_in: ItemCreate, owner_id: uuid.UUID) -> Item:
    db_item = Item.model_validate(item_in, update={"owner_id": owner_id})
    session.add(db_item)
    session.commit()
    session.refresh(db_item)
    return db_item
