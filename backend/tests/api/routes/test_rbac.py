"""Role-based access control, tested through the real API (no UI involved)."""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, col, select, update

from app import crud
from app.core import db as db_module
from app.core.config import settings
from app.core.permissions import ROLE_PERMISSIONS, Permission, role_permissions
from app.models import User, UserCreate, UserRole, UserUpdate
from tests.utils.user import create_user_with_role, user_authentication_headers
from tests.utils.utils import random_email, random_lower_string

API = settings.API_V1_STR
Headers = dict[str, str]


def _other_user(db: Session, role: UserRole = UserRole.staff) -> User:
    return create_user_with_role(db, role)[0]


# --- Seeded accounts -------------------------------------------------------


def test_seeded_admin_has_admin_role(
    client: TestClient, superuser_token_headers: Headers
) -> None:
    me = client.get(f"{API}/users/me", headers=superuser_token_headers).json()
    assert me["role"] == "admin"
    assert me["is_superuser"] is True


def test_init_db_seeds_staff_once(db: Session) -> None:
    email = random_email()
    password = random_lower_string()
    from unittest.mock import patch

    with (
        patch.object(settings, "FIRST_STAFF", email),
        patch.object(settings, "FIRST_STAFF_PASSWORD", password),
    ):
        db_module.init_db(db)
        db_module.init_db(db)  # idempotent
    rows = db.exec(select(User).where(User.email == email)).all()
    assert len(rows) == 1
    assert rows[0].role == UserRole.staff
    assert rows[0].is_superuser is False


# --- Staff are denied account management over the API ----------------------


def test_staff_can_read_own_profile(
    client: TestClient, staff_token_headers: Headers
) -> None:
    r = client.get(f"{API}/users/me", headers=staff_token_headers)
    assert r.status_code == 200
    assert r.json()["role"] == "staff"
    assert r.json()["is_superuser"] is False


def test_staff_cannot_list_users(
    client: TestClient, staff_token_headers: Headers
) -> None:
    assert client.get(f"{API}/users/", headers=staff_token_headers).status_code == 403


def test_staff_cannot_create_user(
    client: TestClient, staff_token_headers: Headers
) -> None:
    r = client.post(
        f"{API}/users/",
        headers=staff_token_headers,
        json={"email": random_email(), "password": random_lower_string()},
    )
    assert r.status_code == 403


def test_staff_cannot_read_another_user(
    client: TestClient, staff_token_headers: Headers, db: Session
) -> None:
    other = _other_user(db)
    r = client.get(f"{API}/users/{other.id}", headers=staff_token_headers)
    assert r.status_code == 403


def test_staff_cannot_update_or_delete_users(
    client: TestClient, staff_token_headers: Headers, db: Session
) -> None:
    other = _other_user(db)
    r = client.patch(
        f"{API}/users/{other.id}", headers=staff_token_headers, json={"role": "admin"}
    )
    assert r.status_code == 403
    r = client.delete(f"{API}/users/{other.id}", headers=staff_token_headers)
    assert r.status_code == 403
    db.refresh(other)
    assert other.role == UserRole.staff


@pytest.mark.parametrize(
    "payload", [{"role": "admin"}, {"is_superuser": True}, {"is_active": False}]
)
def test_staff_cannot_escalate_through_own_profile(
    client: TestClient, db: Session, payload: dict[str, object]
) -> None:
    user, password = create_user_with_role(db, UserRole.staff)
    headers = user_authentication_headers(
        client=client, email=user.email, password=password
    )
    client.patch(f"{API}/users/me", headers=headers, json=payload)
    db.refresh(user)
    assert user.role == UserRole.staff
    assert user.is_superuser is False
    assert user.is_active is True
    assert client.get(f"{API}/users/", headers=headers).status_code == 403


def test_staff_cannot_self_register_as_admin(client: TestClient) -> None:
    # Open registration is off, and the signup model has no role field anyway.
    r = client.post(
        f"{API}/users/signup",
        json={
            "email": random_email(),
            "password": random_lower_string(),
            "role": "admin",
        },
    )
    assert r.status_code == 403


def test_unauthenticated_requests_are_rejected(client: TestClient) -> None:
    assert client.get(f"{API}/users/").status_code == 401
    assert client.get(f"{API}/users/me").status_code == 401


# --- Administrators can manage roles ---------------------------------------


def test_admin_creates_staff_by_default(
    client: TestClient, superuser_token_headers: Headers
) -> None:
    r = client.post(
        f"{API}/users/",
        headers=superuser_token_headers,
        json={"email": random_email(), "password": random_lower_string()},
    )
    assert r.status_code == 200
    assert r.json()["role"] == "staff"
    assert r.json()["is_superuser"] is False


@pytest.mark.parametrize(
    ("payload", "role", "flag"),
    [
        ({"role": "admin"}, "admin", True),
        ({"role": "staff"}, "staff", False),
        ({"is_superuser": True}, "admin", True),  # legacy clients still work
        ({"is_superuser": False}, "staff", False),
    ],
)
def test_admin_creates_user_with_role_or_legacy_flag(
    client: TestClient,
    superuser_token_headers: Headers,
    payload: dict[str, object],
    role: str,
    flag: bool,
) -> None:
    r = client.post(
        f"{API}/users/",
        headers=superuser_token_headers,
        json={"email": random_email(), "password": random_lower_string(), **payload},
    )
    assert r.status_code == 200
    assert r.json()["role"] == role
    assert r.json()["is_superuser"] is flag


def test_conflicting_role_and_flag_is_rejected(
    client: TestClient, superuser_token_headers: Headers
) -> None:
    r = client.post(
        f"{API}/users/",
        headers=superuser_token_headers,
        json={
            "email": random_email(),
            "password": random_lower_string(),
            "role": "staff",
            "is_superuser": True,
        },
    )
    assert r.status_code == 422


def test_invalid_role_is_rejected(
    client: TestClient, superuser_token_headers: Headers
) -> None:
    r = client.post(
        f"{API}/users/",
        headers=superuser_token_headers,
        json={
            "email": random_email(),
            "password": random_lower_string(),
            "role": "superadmin",
        },
    )
    assert r.status_code == 422


def test_role_change_takes_effect_without_new_login(
    client: TestClient, superuser_token_headers: Headers, db: Session
) -> None:
    user, password = create_user_with_role(db, UserRole.staff)
    headers = user_authentication_headers(
        client=client, email=user.email, password=password
    )
    assert client.get(f"{API}/users/", headers=headers).status_code == 403

    r = client.patch(
        f"{API}/users/{user.id}",
        headers=superuser_token_headers,
        json={"role": "admin"},
    )
    assert r.status_code == 200 and r.json()["is_superuser"] is True
    assert client.get(f"{API}/users/", headers=headers).status_code == 200  # same token

    r = client.patch(
        f"{API}/users/{user.id}",
        headers=superuser_token_headers,
        json={"role": "staff"},
    )
    assert r.status_code == 200 and r.json()["is_superuser"] is False
    assert client.get(f"{API}/users/", headers=headers).status_code == 403


def test_role_change_is_audited(
    client: TestClient,
    superuser_token_headers: Headers,
    db: Session,
    caplog: pytest.LogCaptureFixture,
) -> None:
    import logging

    caplog.set_level(logging.INFO, logger="app.audit")
    user = _other_user(db)
    client.patch(
        f"{API}/users/{user.id}",
        headers=superuser_token_headers,
        json={"role": "admin"},
    )
    assert "user.role_change" in caplog.text
    assert "SampleAdminPassword" not in caplog.text


# --- The last administrator cannot be removed ------------------------------


def _only_admin(db: Session) -> User:
    """Make the seeded admin the only active admin for the duration of a test."""
    admin = crud.get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
    assert admin
    db.exec(  # type: ignore[call-overload]
        update(User)
        .where(col(User.role) == UserRole.admin, col(User.id) != admin.id)
        .values(is_active=False, role=UserRole.staff, is_superuser=False)
    )
    db.commit()
    db.refresh(admin)
    return admin


def test_last_admin_cannot_be_demoted_deactivated_or_deleted(
    client: TestClient, db: Session
) -> None:
    admin = _only_admin(db)
    headers = user_authentication_headers(
        client=client,
        email=settings.FIRST_SUPERUSER,
        password=settings.FIRST_SUPERUSER_PASSWORD,
    )
    for payload in ({"role": "staff"}, {"is_superuser": False}, {"is_active": False}):
        r = client.patch(f"{API}/users/{admin.id}", headers=headers, json=payload)
        assert r.status_code == 400, payload
    db.refresh(admin)
    assert admin.role == UserRole.admin and admin.is_active

    # A second admin makes the same demotion legitimate.
    second = _other_user(db, UserRole.admin)
    r = client.patch(
        f"{API}/users/{second.id}", headers=headers, json={"role": "staff"}
    )
    assert r.status_code == 200


def test_last_admin_cannot_be_deleted_by_another_route(
    client: TestClient, db: Session
) -> None:
    admin = _only_admin(db)
    # An admin cannot delete themselves at all...
    headers = user_authentication_headers(
        client=client,
        email=settings.FIRST_SUPERUSER,
        password=settings.FIRST_SUPERUSER_PASSWORD,
    )
    assert client.delete(f"{API}/users/{admin.id}", headers=headers).status_code == 403
    assert client.delete(f"{API}/users/me", headers=headers).status_code == 403
    # ...and the guard also holds for the crud helper used by the delete route.
    assert crud.is_last_active_admin(session=db, user=admin)


# --- Permission matrix and database constraints ----------------------------

ADMIN_ONLY = {
    Permission.USERS_MANAGE,
    Permission.REGISTRATIONS_REVIEW,
    Permission.OFFICIALS_MANAGE,
    Permission.LOOKUPS_MANAGE,
    Permission.RECORDS_IMPORT,
    Permission.RECORDS_ARCHIVE,
    Permission.ISSUANCE_VOID,
    Permission.ID_OVERRIDE,
    Permission.ACTIVITY_VIEW_ALL,
    Permission.REPORTS_VIEW,
    Permission.BACKUP_RESTORE,
}


def test_permission_matrix_matches_docs() -> None:
    admin = ROLE_PERMISSIONS[UserRole.admin]
    staff = ROLE_PERMISSIONS[UserRole.staff]
    assert admin == frozenset(Permission)
    assert staff == frozenset(Permission) - ADMIN_ONLY
    assert not (staff & ADMIN_ONLY)


@pytest.mark.parametrize("role", [None, "", "superadmin", "ADMIN"])
def test_unknown_role_has_no_permissions(role: str | None) -> None:
    assert role_permissions(role) == frozenset()


def test_database_rejects_inconsistent_role(db: Session) -> None:
    bad = User(
        email=random_email(),
        hashed_password="x",
        role=UserRole.admin,
        is_superuser=False,
    )
    db.add(bad)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_database_rejects_unknown_role(db: Session) -> None:
    bad = User(email=random_email(), hashed_password="x", role="owner")  # type: ignore[arg-type]
    db.add(bad)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_crud_update_keeps_role_and_flag_in_sync(db: Session) -> None:
    user = _other_user(db)
    updated = crud.update_user(
        session=db, db_user=user, user_in=UserUpdate(is_superuser=True)
    )
    assert updated.role == UserRole.admin and updated.is_superuser is True
    updated = crud.update_user(
        session=db, db_user=user, user_in=UserUpdate(role=UserRole.staff)
    )
    assert updated.role == UserRole.staff and updated.is_superuser is False
    assert isinstance(uuid.UUID(str(updated.id)), uuid.UUID)
    assert UserCreate(email=random_email(), password=random_lower_string()).role == (
        UserRole.staff
    )
