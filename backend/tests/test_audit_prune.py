"""Only old READ rows of the audit log can be removed; everything else cannot."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.exc import DBAPIError
from sqlmodel import Session, col, select, text

from app.audit_cli import main, prune_reads
from app.models_foundation import AuditLog


def _insert(db: Session, action: str, days_old: int) -> int:
    when = datetime.now(UTC) - timedelta(days=days_old)
    row = db.execute(
        text(
            "INSERT INTO audit_log (occurred_at, action, outcome, module) "
            "VALUES (:t, :a, 'success', 'records') RETURNING id"
        ),
        {"t": when, "a": action},
    ).one()
    db.commit()
    return row[0]


def _exists(db: Session, row_id: int) -> bool:
    return (
        db.exec(select(AuditLog).where(col(AuditLog.id) == row_id)).first() is not None
    )


def test_database_allows_deleting_only_old_read_rows(db: Session) -> None:
    old_read = _insert(db, "resident.view", 100)
    recent_read = _insert(db, "resident.view", 10)
    old_change = _insert(db, "resident.update", 400)
    old_signin = _insert(db, "auth.login", 400)

    db.execute(text("DELETE FROM audit_log WHERE id = :i"), {"i": old_read})
    db.commit()
    assert not _exists(db, old_read)

    for row_id in (recent_read, old_change, old_signin):
        with pytest.raises(DBAPIError, match="append only"):
            db.execute(text("DELETE FROM audit_log WHERE id = :i"), {"i": row_id})
        db.rollback()
        assert _exists(db, row_id)

    with pytest.raises(DBAPIError, match="append only"):
        db.execute(text("TRUNCATE audit_log"))
    db.rollback()
    with pytest.raises(DBAPIError, match="append only"):
        db.execute(
            text("UPDATE audit_log SET action = 'x' WHERE id = :i"), {"i": old_change}
        )
    db.rollback()


def test_prune_counts_first_and_deletes_only_with_the_flag(db: Session) -> None:
    old_list = _insert(db, "resident.list", 500)
    old_barangay_list = _insert(db, "barangay_id.list", 500)
    old_export = _insert(db, "report.export", 500)
    mid_view = _insert(db, "resident.view", 200)

    counted = prune_reads(db, 365, delete_rows=False)
    assert counted >= 2
    assert _exists(db, old_list)

    removed = prune_reads(db, 365, delete_rows=True)
    assert removed == counted
    assert not _exists(db, old_list)
    assert not _exists(db, old_barangay_list)
    assert _exists(db, old_export)  # not a read action
    assert _exists(db, mid_view)  # younger than 365 days

    record = db.exec(
        select(AuditLog)
        .where(col(AuditLog.action) == "audit.prune")
        .order_by(col(AuditLog.id).desc())
    ).first()
    assert record is not None
    assert record.details == {"count": removed, "keep_days": 365}


def test_prune_without_anything_to_remove_writes_no_record(db: Session) -> None:
    prune_reads(db, 365, delete_rows=True)
    before = db.exec(
        select(AuditLog).where(col(AuditLog.action) == "audit.prune")
    ).all()
    assert prune_reads(db, 365, delete_rows=True) == 0
    after = db.exec(select(AuditLog).where(col(AuditLog.action) == "audit.prune")).all()
    assert len(after) == len(before)


def test_command_refuses_less_than_ninety_days(
    capsys: pytest.CaptureFixture[str],
) -> None:
    assert main(["prune-reads", "--keep-days", "30", "--delete"]) == 2
    assert "at least 90" in capsys.readouterr().err
