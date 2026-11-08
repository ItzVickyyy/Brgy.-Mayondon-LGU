"""Run one backup from the command line (used by the Windows scheduled task).

    docker compose -f compose.yml exec -T backend python -m app.backup_cli

Exit code 0 = backup made, 1 = the backup failed, 2 = it could not start
(another backup is running, or pg_dump / the backup folder is missing).
"""

import argparse
import sys

from sqlmodel import Session

from app.core.backup import BackupBusy, BackupUnavailable, create_backup
from app.core.db import engine


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Create a database backup.")
    parser.add_argument("--kind", choices=["scheduled", "manual"], default="scheduled")
    args = parser.parse_args(argv)
    with Session(engine) as session:
        try:
            run = create_backup(session, kind=args.kind)
        except (BackupBusy, BackupUnavailable) as exc:
            print(f"Backup not started: {exc}", file=sys.stderr)  # noqa: T201
            return 2
    if run.status != "ok":
        print(f"Backup failed: {run.error}", file=sys.stderr)  # noqa: T201
        return 1
    print(f"Backup created: {run.file_name} ({run.size_bytes} bytes)")  # noqa: T201
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
