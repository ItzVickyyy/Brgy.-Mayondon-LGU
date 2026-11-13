"""Last resort for a person who is locked out: run on the server computer.

    docker compose -f compose.yml exec backend python -m app.account_recovery_cli status EMAIL
    docker compose -f compose.yml exec backend python -m app.account_recovery_cli reset-mfa EMAIL --confirm RESET
    docker compose -f compose.yml exec backend python -m app.account_recovery_cli reset-questions EMAIL --confirm RESET
    docker compose -f compose.yml exec backend python -m app.account_recovery_cli reset-password EMAIL --confirm RESET
    docker compose -f compose.yml exec backend python -m app.account_recovery_cli unlock EMAIL

For an administrator who lost the password, the recovery questions AND the
phone. Anyone who can run this already controls the server computer and the
database, so it asks for no password; it asks for ``--confirm RESET`` and
writes a row in the Activity Log for every change (no secret in it).

* ``status``           what is set up for the account (never any secret).
* ``reset-mfa``        turn two-factor off (the person sets it up again).
* ``reset-questions``  clear the three recovery questions.
* ``reset-password``   type a new password twice (not shown). Everyone's open
                       sessions for that account end. The password is NOT
                       temporary; the person can change it in My Account.
* ``unlock``           end a sign-in lock-out after too many wrong tries.

Exit codes: 0 = done, 1 = refused or failed, 2 = bad option.
"""

import argparse
import getpass
import sys

from sqlmodel import Session, col, delete, select

from app import crud
from app.core import security
from app.core.audit import record_audit_event
from app.core.db import engine
from app.models import User, UserUpdate
from app.models_security import MfaRecoveryCode, SecurityAnswer

MIN_PASSWORD_LENGTH = 12
REASON = "Server command (account_recovery_cli)"


def say(message: str, *, error: bool = False) -> None:
    print(message, file=sys.stderr if error else sys.stdout)  # noqa: T201


class RecoveryError(Exception):
    """A refusal; the message is safe to show."""


def find_user(session: Session, email: str) -> User:
    user = crud.get_user_by_email(session=session, email=email.strip().lower())
    if user is None:
        raise RecoveryError("No account has that e-mail address.")
    return user


def status_lines(session: Session, user: User) -> list[str]:
    questions = len(
        session.exec(
            select(SecurityAnswer).where(col(SecurityAnswer.user_id) == user.id)
        ).all()
    )
    unused = len(
        session.exec(
            select(MfaRecoveryCode).where(
                col(MfaRecoveryCode.user_id) == user.id,
                col(MfaRecoveryCode.used_at).is_(None),
            )
        ).all()
    )
    return [
        f"Role: {user.role}",
        f"Active: {'yes' if user.is_active else 'no'}",
        f"Locked after wrong tries: {'yes' if _locked(user) else 'no'}",
        f"Must change password at next sign-in: {'yes' if user.must_change_password else 'no'}",
        f"Recovery questions set: {'yes' if questions == 3 else 'no'}",
        f"Two-factor sign-in: {'on' if user.mfa_enabled else 'off'}",
        f"Unused recovery codes: {unused}",
    ]


def _locked(user: User) -> bool:
    from app.core.mfa_check import is_locked

    return is_locked(user)


def _audit(session: Session, user: User, action: str) -> None:
    record_audit_event(
        session,
        action=action,
        module="auth",
        record_type="user",
        record_id=user.id,
        reason=REASON,
        details={"method": "server_command"},
    )


def reset_mfa(session: Session, user: User) -> None:
    session.execute(
        delete(MfaRecoveryCode).where(col(MfaRecoveryCode.user_id) == user.id)
    )
    user.mfa_enabled = False
    user.mfa_secret_encrypted = None
    user.mfa_last_step = None
    user.mfa_enrolled_at = None
    user.failed_login_attempts = 0
    user.locked_until = None
    session.add(user)
    _audit(session, user, "auth.mfa_reset_by_admin")
    session.commit()


def reset_questions(session: Session, user: User) -> None:
    session.execute(
        delete(SecurityAnswer).where(col(SecurityAnswer.user_id) == user.id)
    )
    _audit(session, user, "auth.recovery_reset_by_admin")
    session.commit()


def reset_password(session: Session, user: User, new_password: str) -> None:
    if len(new_password) < MIN_PASSWORD_LENGTH:
        raise RecoveryError(f"Use at least {MIN_PASSWORD_LENGTH} characters.")
    if new_password == security.DEFAULT_PASSWORD or new_password.startswith(
        "replace-with-"
    ):
        raise RecoveryError("That is a placeholder, not a password.")
    # Through crud, so every open session of this account stops working.
    crud.update_user(
        session=session, db_user=user, user_in=UserUpdate(password=new_password)
    )
    session.refresh(user)
    record_audit_event(
        session,
        action="user.password_change",
        module="users",
        record_type="user",
        record_id=user.id,
        reason=REASON,
    )
    session.commit()


def unlock(session: Session, user: User) -> None:
    user.failed_login_attempts = 0
    user.locked_until = None
    session.add(user)
    session.commit()


def prompt_new_password() -> str:
    first = getpass.getpass("New password (not shown): ")
    if getpass.getpass("Type it again: ") != first:
        raise RecoveryError("Not done: the two passwords are not the same.")
    return first


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="account_recovery_cli", description=__doc__.split("\n")[0]
    )
    parser.add_argument(
        "command",
        choices=("status", "reset-mfa", "reset-questions", "reset-password", "unlock"),
    )
    parser.add_argument("email")
    parser.add_argument("--confirm", default="")
    args = parser.parse_args(argv)
    if args.command not in ("status", "unlock") and args.confirm != "RESET":
        say("Not done: add --confirm RESET (run 'status' first).", error=True)
        return 2
    try:
        with Session(engine) as session:
            user = find_user(session, args.email)
            if args.command == "status":
                for line in status_lines(session, user):
                    say(line)
                return 0
            if args.command == "reset-mfa":
                reset_mfa(session, user)
                say("Done: two-factor sign-in is off. The person sets it up again.")
            elif args.command == "reset-questions":
                reset_questions(session, user)
                say("Done: the recovery questions are cleared.")
            elif args.command == "reset-password":
                reset_password(session, user, prompt_new_password())
                say("Done: the password is changed and open sessions have ended.")
            else:
                unlock(session, user)
                say("Done: the account is unlocked.")
    except RecoveryError as exc:
        say(str(exc), error=True)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
