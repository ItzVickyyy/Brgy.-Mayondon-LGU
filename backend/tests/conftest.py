import os
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, col, delete

from app.core import field_crypto
from app.core.config import settings
from app.core.db import engine, init_db
from app.core.login_throttle import login_ip_key
from app.main import app
from app.models import PasswordRecoveryRateLimit, User
from app.models_issuance import Issuance, Tricycle
from app.models_residents import Resident
from tests.utils.user import authentication_token_from_email, staff_headers
from tests.utils.utils import get_superuser_token_headers


def _refuse_real_database() -> None:
    """The test teardown deletes every resident, issuance and account.

    Stop before that can happen to the real database (called ``app``). Allowed:
    a database whose name ends in ``_dev`` or ``_test``, the CI runner (``CI`` is
    set there), or ``ALLOW_TESTS_ON_THIS_DATABASE=1`` for a throwaway database.
    """
    name = (settings.DATABASE_URL.path or "").lstrip("/")
    if (
        name.endswith(("_dev", "_test"))
        or os.environ.get("CI")
        or os.environ.get("ALLOW_TESTS_ON_THIS_DATABASE")
    ):
        return
    pytest.exit(
        f"Refusing to run the tests on database '{name}': they delete all residents, "
        "issuances and accounts. Point DATABASE_URL at the development database "
        "(docs/12-Development-Database.md) or set ALLOW_TESTS_ON_THIS_DATABASE=1.",
        returncode=2,
    )


@pytest.fixture(autouse=True)
def _no_protection_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    """The data-protection status is cached for minutes in the real program; every test needs a
    fresh count."""
    monkeypatch.setattr(field_crypto, "PROTECTION_CACHE_SECONDS", 0.0)


@pytest.fixture(autouse=True)
def _allow_shared_logins(monkeypatch: pytest.MonkeyPatch) -> None:
    """Tests sign the same account in many times; only test_single_session.py turns the
    one-computer-per-account rule back on."""
    monkeypatch.setattr(settings, "SINGLE_SESSION_PER_ACCOUNT", False)


@pytest.fixture(scope="session", autouse=True)
def db() -> Generator[Session]:
    _refuse_real_database()
    with Session(engine) as session:
        init_db(session)
        # Per-IP recovery attempts pile up across local runs and make
        # test_password_recovery_sends_email_for_registered_user fail.
        session.execute(delete(PasswordRecoveryRateLimit))
        session.commit()
        yield session
        session.execute(delete(PasswordRecoveryRateLimit))
        # Corrections point at the issuance they correct, so remove them first.
        session.execute(
            delete(Issuance).where(col(Issuance.corrects_issuance_id).is_not(None))
        )
        session.execute(delete(Issuance))
        session.execute(delete(Tricycle))
        session.execute(delete(Resident))
        statement = delete(User)
        session.execute(statement)
        session.commit()


@pytest.fixture(scope="module")
def client() -> Generator[TestClient]:
    with TestClient(app) as c:
        yield c


@pytest.fixture
def superuser_token_headers(client: TestClient) -> dict[str, str]:
    return get_superuser_token_headers(client)


@pytest.fixture
def staff_token_headers(client: TestClient, db: Session) -> dict[str, str]:
    """Headers for a fresh Staff account created through the real crud layer."""
    return staff_headers(client=client, db=db)


@pytest.fixture(scope="module")
def normal_user_token_headers(client: TestClient, db: Session) -> dict[str, str]:
    return authentication_token_from_email(
        client=client, email=settings.EMAIL_TEST_USER, db=db
    )


@pytest.fixture(autouse=True)
def _clean_login_ip_bucket(db: Session) -> Generator[None]:
    """The test client always comes from one address, and the per-computer sign-in limit would
    otherwise carry wrong attempts from one test into the next."""

    def clear() -> None:
        db.execute(
            delete(PasswordRecoveryRateLimit).where(
                col(PasswordRecoveryRateLimit.bucket_key) == login_ip_key("testclient")
            )
        )
        db.commit()

    clear()
    yield
    clear()


@pytest.fixture(autouse=True)
def _wide_issue_date_window(monkeypatch: pytest.MonkeyPatch) -> None:
    """Most tests back-date on purpose (expiry, reports); the rule has its own tests."""
    monkeypatch.setattr(settings, "ISSUANCE_BACKDATE_MAX_DAYS", 100_000)
