"""Backups from the command line (Windows scheduled task, key set-up, restore).

    docker compose -f compose.yml exec -T backend python -m app.backup_cli
    docker compose -f compose.yml exec backend python -m app.backup_cli make-key
    ... python -m app.backup_cli decrypt --in FILE.dump.enc --key KEY.pem (--out FILE.dump | --check)

Without a sub-command it makes one backup. Exit code 0 = backup made, 1 = the
backup failed, 2 = it could not start (another backup is running, pg_dump or the
backup folder is missing, or encryption is required and no key is set up).

``make-key`` makes the key pair that locks every backup (see
``app/core/backup_crypto.py``). ``decrypt`` opens an encrypted backup; with
``--check`` it only proves the passphrase and key work. The passphrase is read
from the ``BACKUP_PASSPHRASE`` environment variable or typed (never put on the
command line).
"""

import argparse
import getpass
import os
import sys
from pathlib import Path

from sqlmodel import Session

from app.core import backup_crypto
from app.core.backup import BackupBusy, BackupUnavailable, create_backup
from app.core.config import settings
from app.core.db import engine


def say(message: str, *, error: bool = False) -> None:
    print(message, file=sys.stderr if error else sys.stdout)  # noqa: T201


def _passphrase(*, confirm: bool) -> str:
    from_env = os.environ.get("BACKUP_PASSPHRASE")
    if from_env:
        return from_env
    first = getpass.getpass("Passphrase: ")
    if confirm and getpass.getpass("Type the passphrase again: ") != first:
        raise backup_crypto.CryptoError("The two passphrases are not the same.")
    return first


def make_key() -> int:
    public_file = Path(settings.BACKUP_PUBLIC_KEY_FILE)
    private_file = public_file.with_name("backup-private.pem")
    if public_file.exists() or private_file.exists():
        say(
            f"A key already exists ({public_file.name} or {private_file.name}). "
            "Not replacing it: backups made with the old key could never be opened "
            "with a new one. Move the old files away yourself if you really mean it.",
            error=True,
        )
        return 2
    try:
        public_pem, private_pem = backup_crypto.generate_keypair(
            _passphrase(confirm=True)
        )
    except backup_crypto.CryptoError as exc:
        say(f"Key not made: {exc}", error=True)
        return 1
    public_file.parent.mkdir(parents=True, exist_ok=True)
    public_file.write_bytes(public_pem)
    private_file.write_bytes(private_pem)
    private_file.chmod(0o600)
    say(f"Public key saved: {public_file}  (stays on this computer; it can only lock)")
    say(f"Private key saved: {private_file}  (locked with your passphrase)")
    say("NEXT, now:")
    say("  1. Write the passphrase on paper and seal it. It cannot be recovered.")
    say("  2. Copy backup-private.pem to a USB drive kept away from this computer,")
    say("     then delete it from the backups folder.")
    say("  3. Set BACKUP_REQUIRE_ENCRYPTION=true in .env and restart the backend.")
    say("  4. Make a backup, then prove it opens: decrypt --check (docs/11 section G).")
    return 0


def decrypt(source: Path, key_file: Path, out: Path | None) -> int:
    try:
        key = backup_crypto.load_private_key(key_file, _passphrase(confirm=False))
        written = backup_crypto.decrypt_file(source, out, key)
    except backup_crypto.CryptoError as exc:
        say(f"Not decrypted: {exc}", error=True)
        return 1
    except (OSError, ValueError) as exc:
        say(f"Not decrypted: {exc}", error=True)
        return 1
    if out is None:
        say(f"OK: the passphrase and key open this backup ({written} bytes inside).")
    else:
        say(f"Decrypted {source.name} to {out} ({written} bytes).")
    return 0


def backup(kind: str) -> int:
    with Session(engine) as session:
        try:
            run = create_backup(session, kind=kind)
        except (BackupBusy, BackupUnavailable) as exc:
            say(f"Backup not started: {exc}", error=True)
            return 2
    if run.status != "ok":
        say(f"Backup failed: {run.error}", error=True)
        return 1
    say(f"Backup created: {run.file_name} ({run.size_bytes} bytes)")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Database backups.")
    parser.add_argument("--kind", choices=["scheduled", "manual"], default="scheduled")
    sub = parser.add_subparsers(dest="command")
    sub.add_parser("make-key", help="Make the key pair that locks every backup.")
    opener = sub.add_parser("decrypt", help="Open an encrypted backup.")
    opener.add_argument("--in", dest="source", required=True, type=Path)
    opener.add_argument("--key", required=True, type=Path)
    target = opener.add_mutually_exclusive_group(required=True)
    target.add_argument("--out", type=Path)
    target.add_argument("--check", action="store_true")
    args = parser.parse_args(argv)
    if args.command == "make-key":
        return make_key()
    if args.command == "decrypt":
        return decrypt(args.source, args.key, None if args.check else args.out)
    return backup(args.kind)


if __name__ == "__main__":
    raise SystemExit(main())
