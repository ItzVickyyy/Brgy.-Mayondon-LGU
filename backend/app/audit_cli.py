"""Expire old READ rows of the Activity Log (off unless you run it).

    docker compose -f compose.yml exec backend python -m app.audit_cli prune-reads
    docker compose -f compose.yml exec backend python -m app.audit_cli prune-reads --keep-days 365 --delete

Only rows that record a READ (``resident.view``, ``resident.list``,
``barangay_id.list``) can ever be removed, and only when older than
``--keep-days`` (default 365, never below 90). Rows about changes, sign-ins,
printing, exports and every other action are never touched, and the database
itself refuses to delete them. Without ``--delete`` the command only counts.
When rows are removed one row ``audit.prune`` is written so the clean-up is
itself on record. Exit code 0 = done, 2 = bad option.
"""

import argparse
import sys
from datetime import UTC, datetime, timedelta

from sqlmodel import Session, col, delete, func, select

from app.core.audit import READ_ACTIONS, record_audit_event
from app.core.db import engine
from app.models_foundation import AuditLog

MIN_KEEP_DAYS = 90  # the database trigger enforces the same floor
DEFAULT_KEEP_DAYS = 365


def say(message: str, *, error: bool = False) -> None:
    print(message, file=sys.stderr if error else sys.stdout)  # noqa: T201


def prune_reads(session: Session, keep_days: int, *, delete_rows: bool) -> int:
    """Count (and optionally delete) read rows older than ``keep_days``."""
    cutoff = datetime.now(UTC) - timedelta(days=keep_days)
    old_reads = (
        col(AuditLog.action).in_(READ_ACTIONS),
        col(AuditLog.occurred_at) < cutoff,
    )
    count = session.exec(
        select(func.count()).select_from(AuditLog).where(*old_reads)
    ).one()
    if not delete_rows or count == 0:
        return count
    session.execute(delete(AuditLog).where(*old_reads))
    record_audit_event(
        session,
        action="audit.prune",
        module="audit",
        details={"count": count, "keep_days": keep_days},
    )
    session.commit()
    return count


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Activity Log clean-up.")
    sub = parser.add_subparsers(dest="command", required=True)
    prune = sub.add_parser("prune-reads", help="Expire old 'viewed' rows only.")
    prune.add_argument("--keep-days", type=int, default=DEFAULT_KEEP_DAYS)
    prune.add_argument(
        "--delete", action="store_true", help="Really delete (default: only count)."
    )
    args = parser.parse_args(argv)
    if args.keep_days < MIN_KEEP_DAYS:
        say(f"--keep-days must be at least {MIN_KEEP_DAYS}.", error=True)
        return 2
    with Session(engine) as session:
        count = prune_reads(session, args.keep_days, delete_rows=args.delete)
    if args.delete:
        say(f"Removed {count} 'viewed' rows older than {args.keep_days} days.")
    else:
        say(
            f"{count} 'viewed' rows are older than {args.keep_days} days. "
            "Nothing was deleted; add --delete to remove them."
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
