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


@pytest.fixture(scope="session", autouse=True)
def db() -> Generator[Session]:
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
