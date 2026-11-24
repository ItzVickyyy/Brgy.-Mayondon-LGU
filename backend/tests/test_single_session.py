"""One account, one computer at a time (patch 259)."""

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, col, select, update

from app.core.config import settings
from app.models import User, UserRole
from tests.utils.user import create_user_with_role, user_authentication_headers

ME = f"{settings.API_V1_STR}/users/me"
LOGOUT = f"{settings.API_V1_STR}/login/logout"


@pytest.fixture
def one_session(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "SINGLE_SESSION_PER_ACCOUNT", True)


def _sign_in_twice(
    client: TestClient, db: Session
) -> tuple[dict[str, str], dict[str, str]]:
    user, password = create_user_with_role(db, UserRole.staff)
    first = user_authentication_headers(
        client=client, email=user.email, password=password
    )
    second = user_authentication_headers(
        client=client, email=user.email, password=password
    )
    return first, second


@pytest.mark.usefixtures("one_session")
def test_newest_sign_in_replaces_the_older_one(client: TestClient, db: Session) -> None:
    first, second = _sign_in_twice(client, db)
    assert client.get(ME, headers=second).status_code == 200
    older = client.get(ME, headers=first)
    assert older.status_code == 403
    assert older.json()["detail"]["code"] == "signed_in_elsewhere"


@pytest.mark.usefixtures("one_session")
def test_different_accounts_do_not_affect_each_other(
    client: TestClient, db: Session
) -> None:
    a, _ = create_user_with_role(db, UserRole.staff)
    b, password_b = create_user_with_role(db, UserRole.staff)
    first = user_authentication_headers(
        client=client, email=b.email, password=password_b
    )
    other = _sign_in_twice(client, db)
    assert client.get(ME, headers=first).status_code == 200
    assert client.get(ME, headers=other[1]).status_code == 200
    assert a.email != b.email


@pytest.mark.usefixtures("one_session")
def test_signing_out_then_in_again_works(client: TestClient, db: Session) -> None:
    user, password = create_user_with_role(db, UserRole.staff)
    first = user_authentication_headers(
        client=client, email=user.email, password=password
    )
    assert client.post(LOGOUT, headers=first).status_code == 200
    second = user_authentication_headers(
        client=client, email=user.email, password=password
    )
    assert client.get(ME, headers=second).status_code == 200


def test_rule_can_be_switched_off(client: TestClient, db: Session) -> None:
    # The conftest default for tests is off: both tokens keep working.
    first, second = _sign_in_twice(client, db)
    assert client.get(ME, headers=first).status_code == 200
    assert client.get(ME, headers=second).status_code == 200


@pytest.mark.usefixtures("one_session")
def test_account_with_no_recorded_sign_in_is_not_refused(
    client: TestClient, db: Session
) -> None:
    user, password = create_user_with_role(db, UserRole.staff)
    headers = user_authentication_headers(
        client=client, email=user.email, password=password
    )
    # The sign-in must have stored a jti, or clearing it below proves nothing.
    db.expire_all()
    stored = db.exec(
        select(User.active_session_jti).where(col(User.id) == user.id)
    ).one()
    assert stored is not None
    # An account from before the migration: clear the column with a real UPDATE.
    # (Setting the attribute on ``user`` would send nothing: the object already holds
    # None from before the sign-in, so SQLAlchemy sees no change.)
    db.exec(update(User).where(col(User.id) == user.id).values(active_session_jti=None))
    db.commit()
    db.expire_all()
    assert (
        db.exec(select(User.active_session_jti).where(col(User.id) == user.id)).one()
        is None
    )
    assert client.get(ME, headers=headers).status_code == 200
