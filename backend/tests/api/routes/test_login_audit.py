"""Sign-ins, failed sign-ins and denied sign-ins are written to the activity log."""

from fastapi.testclient import TestClient
from sqlmodel import Session, col, func, select

from app.core.config import settings
from app.crud import create_user
from app.models import UserCreate
from app.models_foundation import AuditLog
from tests.utils.utils import random_email, random_lower_string

API = settings.API_V1_STR
LOGIN = f"{API}/login/access-token"


def _rows(db: Session, email: str) -> list[AuditLog]:
    db.expire_all()
    return list(
        db.exec(
            select(AuditLog)
            .where(AuditLog.actor_email == email)
            .where(AuditLog.module == "auth")
            .order_by(col(AuditLog.id))
        ).all()
    )


def _new_user(db: Session, **extra: object) -> tuple[str, str]:
    email, password = random_email(), random_lower_string()
    create_user(session=db, user_create=UserCreate(email=email, password=password, **extra))
    return email, password


def test_successful_login_is_recorded(client: TestClient, db: Session) -> None:
    email, password = _new_user(db)
    r = client.post(LOGIN, data={"username": email, "password": password})
    assert r.status_code == 200

    rows = _rows(db, email)
    assert [(row.action, row.outcome) for row in rows] == [("auth.login", "success")]
    assert rows[0].actor_user_id is not None


def test_failed_login_is_recorded_without_the_password(
    client: TestClient, db: Session
) -> None:
    email, _ = _new_user(db)
    typed = "typed-wrong-secret"
    r = client.post(LOGIN, data={"username": email, "password": typed})
    assert r.status_code == 400

    rows = _rows(db, email)
    assert [(row.action, row.outcome) for row in rows] == [
        ("auth.login_failed", "failed")
    ]
    assert rows[0].details == {"reason": "incorrect_password"}
    assert typed not in str(rows[0].__dict__)


def test_login_while_locked_is_recorded_as_locked(
    client: TestClient, db: Session
) -> None:
    email, password = _new_user(db)
    for _ in range(settings.LOGIN_MAX_FAILED_ATTEMPTS):
        client.post(LOGIN, data={"username": email, "password": "wrong-password"})
    r = client.post(LOGIN, data={"username": email, "password": password})
    assert r.status_code == 400

    rows = _rows(db, email)
    assert rows[-1].details == {"reason": "locked"}
    # The attempt that triggered the lock is still an ordinary wrong password.
    assert rows[-2].details == {"reason": "incorrect_password"}


def test_inactive_account_login_is_denied_and_recorded(
    client: TestClient, db: Session
) -> None:
    email, password = _new_user(db, is_active=False)
    r = client.post(LOGIN, data={"username": email, "password": password})
    assert r.status_code == 400

    rows = _rows(db, email)
    assert [(row.action, row.outcome) for row in rows] == [
        ("auth.login_failed", "denied")
    ]
    assert rows[0].details == {"reason": "inactive"}


def test_unknown_email_is_not_recorded(client: TestClient, db: Session) -> None:
    before = db.exec(select(func.count()).select_from(AuditLog)).one()
    r = client.post(
        LOGIN, data={"username": random_email(), "password": random_lower_string()}
    )
    assert r.status_code == 400
    db.expire_all()
    assert db.exec(select(func.count()).select_from(AuditLog)).one() == before


def test_activity_can_leave_out_sign_ins(client: TestClient, db: Session) -> None:
    email, password = _new_user(db)
    token = client.post(LOGIN, data={"username": email, "password": password}).json()[
        "access_token"
    ]
    headers = {"Authorization": f"Bearer {token}"}

    everything = client.get(f"{API}/activity/", headers=headers).json()
    assert [row["action"] for row in everything["data"]] == ["auth.login"]

    quiet = client.get(
        f"{API}/activity/", headers=headers, params={"exclude_module": "auth"}
    ).json()
    assert quiet["data"] == []
