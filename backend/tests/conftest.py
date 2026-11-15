import os
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, col, delete

from app.core.config import settings
from app.core.db import engine, init_db
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
def _wide_issue_date_window(monkeypatch: pytest.MonkeyPatch) -> None:
    """Most tests back-date on purpose (expiry, reports); the rule has its own tests."""
    monkeypatch.setattr(settings, "ISSUANCE_BACKDATE_MAX_DAYS", 100_000)
