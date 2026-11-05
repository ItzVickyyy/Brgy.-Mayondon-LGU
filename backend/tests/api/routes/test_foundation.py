"""Foundation tables: seed data, constraints and the append-only audit log."""

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlmodel import Session, select

from app.core.audit import record_audit_event
from app.models import User
from app.models_foundation import (
    AuditLog,
    DocumentType,
    IdType,
    IssuancePurpose,
    Sector,
)


def _count(db: Session, table: str) -> int:
    return db.execute(text(f"SELECT count(*) FROM {table}")).scalar_one()


def test_item_table_is_gone(db: Session) -> None:
    exists = db.execute(text("SELECT to_regclass('public.item')")).scalar_one()
    assert exists is None


def test_document_types_seeded_with_nine_kinds(db: Session) -> None:
    rows = db.exec(select(DocumentType)).all()
    by_code = {r.code: r for r in rows}
    assert len(rows) == 9
    assert by_code["BARANGAY_CLEARANCE"].validity_months == 2
    assert by_code["FIRST_TIME_JOBSEEKER"].validity_months == 12
    assert by_code["FIRST_TIME_JOBSEEKER"].one_per_resident is True
    assert by_code["BARANGAY_ID"].category == "id"
    assert by_code["RESIDENCY"].print_mode == "full_page"


def test_lookup_seeds_present_and_unique(db: Session) -> None:
    assert len(db.exec(select(Sector)).all()) == 11
    assert len(db.exec(select(IdType)).all()) == 16
    assert len(db.exec(select(IssuancePurpose)).all()) == 38
    assert _count(db, "streets") == 0
    assert _count(db, "tricycle_associations") == 0


def test_lookup_names_are_unique(db: Session) -> None:
    db.add(Sector(name="Fisherfolk"))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_document_type_check_constraints(db: Session) -> None:
    db.add(
        DocumentType(
            code="BAD_ONE", name="Bad", category="nonsense", print_mode="overlay"
        )
    )
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
    db.add(
        DocumentType(
            code="BAD_TWO",
            name="Bad",
            category="id",
            print_mode="overlay",
            validity_months=0,
        )
    )
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_audit_event_helper_writes_row(db: Session) -> None:
    admin = db.exec(select(User).where(User.role == "admin")).first()
    assert admin is not None
    entry = record_audit_event(
        db,
        action="test.audit_helper",
        actor=admin,
        module="tests",
        record_type="user",
        record_id=admin.id,
        details={"note": "no personal data"},
        commit=True,
    )
    assert entry.id is not None
    assert entry.actor_email == admin.email
    assert entry.outcome == "success"
    assert entry.occurred_at is not None


def test_audit_log_rejects_update_delete_truncate(db: Session) -> None:
    entry = record_audit_event(db, action="test.append_only", commit=True)
    for sql in (
        f"UPDATE audit_log SET action = 'changed' WHERE id = {entry.id}",
        f"DELETE FROM audit_log WHERE id = {entry.id}",
        "TRUNCATE audit_log",
    ):
        with pytest.raises(DBAPIError, match="append only"):
            db.execute(text(sql))
        db.rollback()


def test_audit_log_outcome_is_checked(db: Session) -> None:
    db.add(AuditLog(action="test.bad_outcome", outcome="maybe"))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_deleting_account_keeps_audit_row_and_clears_actor(db: Session) -> None:
    from app.core.security import get_password_hash
    from tests.utils.utils import random_email

    user = User(
        email=random_email(),
        hashed_password=get_password_hash("Throwaway-Pass-123456"),
    )
    db.add(user)
    db.commit()
    email = user.email
    entry = record_audit_event(db, action="test.actor_deleted", actor=user, commit=True)
    entry_id = entry.id
    db.delete(user)
    db.commit()
    db.expire_all()
    kept = db.get(AuditLog, entry_id)
    assert kept is not None
    assert kept.actor_user_id is None
    assert kept.actor_email == email
