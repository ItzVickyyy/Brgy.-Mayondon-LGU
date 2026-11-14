"""Two-factor sign-in with an authenticator app (step 14)."""

import uuid
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, col, select

from app.core import mfa
from app.core.config import settings
from app.models import User, UserRole
from app.models_foundation import AuditLog
from app.models_security import MfaRecoveryCode
from tests.utils.user import create_user_with_role, user_authentication_headers

API = settings.API_V1_STR
TEST_KEY = "unit-test-mfa-encryption-key-0123456789-abcdef"
RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"  # ASCII "12345678901234567890"


@pytest.fixture(autouse=True)
def _mfa_key(monkeypatch: pytest.MonkeyPatch) -> Generator[None]:
    monkeypatch.setattr(settings, "MFA_ENCRYPTION_KEY", TEST_KEY)
    yield


def _code(secret: str, offset: int = 0) -> str:
    return mfa.totp(secret, step=mfa.current_step() + offset)


def _audit(db: Session, action: str, user: User) -> list[AuditLog]:
    db.expire_all()
    return list(
        db.exec(
            select(AuditLog).where(
                col(AuditLog.action) == action,
                col(AuditLog.actor_user_id) == user.id,
            )
        ).all()
    )


def _enrol(client: TestClient, db: Session, role: UserRole = UserRole.staff):
    user, password = create_user_with_role(db, role)
    headers = user_authentication_headers(
        client=client, email=user.email, password=password
    )
    r = client.post(
        f"{API}/users/me/mfa/setup",
        headers=headers,
        json={"current_password": password},
    )
    assert r.status_code == 200, r.text
    secret = r.json()["secret"]
    r = client.post(
        f"{API}/users/me/mfa/enable", headers=headers, json={"code": _code(secret)}
    )
    assert r.status_code == 200, r.text
    return user, password, headers, secret, r.json()["recovery_codes"]


def _fresh_steps(db: Session, user: User) -> None:
    """Forget the last accepted step, so a test can sign in more than once."""
    db.expire_all()
    row = db.get(User, user.id)
    assert row is not None
    row.mfa_last_step = None
    db.add(row)
    db.commit()


def _password_step(client: TestClient, user: User, password: str):
    return client.post(
        f"{API}/login/access-token",
        data={"username": user.email, "password": password},
    )


def _second_step(client: TestClient, token: str, code: str):
    return client.post(f"{API}/login/mfa", json={"mfa_token": token, "code": code})


# ----- the codes themselves --------------------------------------------------


@pytest.mark.parametrize(
    ("moment", "expected"),
    [
        (59, "94287082"),
        (1111111109, "07081804"),
        (1111111111, "14050471"),
        (1234567890, "89005924"),
        (2000000000, "69279037"),
        (20000000000, "65353130"),
    ],
)
def test_rfc_6238_vectors(moment: int, expected: str) -> None:
    assert mfa.totp(RFC_SECRET, step=moment // 30, digits=8) == expected


def test_window_is_one_step_either_side() -> None:
    now = 1_700_000_000.0
    step = mfa.current_step(now)
    for offset, ok in [(-2, False), (-1, True), (0, True), (1, True), (2, False)]:
        code = mfa.totp(RFC_SECRET, step=step + offset)
        assert (mfa.match_step(RFC_SECRET, code, now=now) == step + offset) is ok


def test_match_step_rejects_junk() -> None:
    for junk in ["", "12345", "1234567", "abcdef", "١٢٣٤٥٦", "12 34 5"]:
        assert mfa.match_step(RFC_SECRET, junk) is None


def test_secret_is_encrypted_and_bound_to_the_person() -> None:
    owner, other = uuid.uuid4(), uuid.uuid4()
    stored = mfa.encrypt_secret(RFC_SECRET, owner)
    assert RFC_SECRET not in stored
    assert mfa.decrypt_secret(stored, owner) == RFC_SECRET
    assert mfa.decrypt_secret(stored, other) is None
    assert mfa.decrypt_secret(stored, owner, key="another-key-" * 4) is None
    assert mfa.decrypt_secret("garbage", owner) is None


def test_recovery_codes_are_readable_and_distinct() -> None:
    codes = {mfa.new_recovery_code() for _ in range(50)}
    assert len(codes) == 50
    assert all(len(c) == 11 and c[5] == "-" for c in codes)
    assert not any(ch in "01OIL" for c in codes for ch in c)


# ----- setting up ------------------------------------------------------------


def test_status_and_unavailable_without_a_key(
    client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    user, password = create_user_with_role(db, UserRole.staff)
    headers = user_authentication_headers(
        client=client, email=user.email, password=password
    )
    status = client.get(f"{API}/users/me/mfa", headers=headers).json()
    assert status["available"] is True and status["enabled"] is False
    assert status["recovery_codes_remaining"] == 0 and status["server_time"]
    monkeypatch.setattr(settings, "MFA_ENCRYPTION_KEY", "")
    assert (
        client.get(f"{API}/users/me/mfa", headers=headers).json()["available"] is False
    )
    r = client.post(
        f"{API}/users/me/mfa/setup",
        headers=headers,
        json={"current_password": password},
    )
    assert r.status_code == 409


def test_setup_needs_the_password_and_stores_only_ciphertext(
    client: TestClient, db: Session
) -> None:
    user, password = create_user_with_role(db, UserRole.staff)
    headers = user_authentication_headers(
        client=client, email=user.email, password=password
    )
    url = f"{API}/users/me/mfa/setup"
    assert (
        client.post(url, headers=headers, json={"current_password": "nope"}).status_code
        == 400
    )
    r = client.post(url, headers=headers, json={"current_password": password})
    body = r.json()
    assert r.status_code == 200
    assert body["otpauth_uri"].startswith("otpauth://totp/")
    assert f"secret={body['secret']}" in body["otpauth_uri"]
    db.expire_all()
    row = db.get(User, user.id)
    assert row is not None and row.mfa_enabled is False
    assert row.mfa_secret_encrypted and body["secret"] not in row.mfa_secret_encrypted
    status = client.get(f"{API}/users/me/mfa", headers=headers).json()
    assert status["setup_pending"] is True and status["enabled"] is False


def test_enable_needs_a_correct_code_and_gives_ten_recovery_codes(
    client: TestClient, db: Session
) -> None:
    user, password = create_user_with_role(db, UserRole.staff)
    headers = user_authentication_headers(
        client=client, email=user.email, password=password
    )
    secret = client.post(
        f"{API}/users/me/mfa/setup",
        headers=headers,
        json={"current_password": password},
    ).json()["secret"]
    url = f"{API}/users/me/mfa/enable"
    assert client.post(url, headers=headers, json={"code": "000000"}).status_code in (
        400,
    )
    r = client.post(url, headers=headers, json={"code": _code(secret)})
    codes = r.json()["recovery_codes"]
    assert r.status_code == 200 and len(codes) == 10 and len(set(codes)) == 10
    status = client.get(f"{API}/users/me/mfa", headers=headers).json()
    assert status["enabled"] is True and status["recovery_codes_remaining"] == 10
    assert len(_audit(db, "auth.mfa_enabled", user)) == 1
    # Turning it on twice, or starting a new set-up while on, is refused.
    assert (
        client.post(url, headers=headers, json={"code": _code(secret, 1)}).status_code
        == 409
    )
    assert (
        client.post(
            f"{API}/users/me/mfa/setup",
            headers=headers,
            json={"current_password": password},
        ).status_code
        == 409
    )
    # Recovery codes are stored hashed.
    stored = db.exec(
        select(MfaRecoveryCode).where(col(MfaRecoveryCode.user_id) == user.id)
    ).all()
    assert len(stored) == 10 and not any(c.code_hash in codes for c in stored)


def test_no_response_ever_carries_a_secret(client: TestClient, db: Session) -> None:
    _, _, headers, secret, codes = _enrol(client, db)
    for url in (f"{API}/users/me", f"{API}/users/me/mfa"):
        text = client.get(url, headers=headers).text
        assert secret not in text and "mfa_secret" not in text
        assert not any(c in text for c in codes)
    assert client.get(f"{API}/users/me", headers=headers).json()["mfa_enabled"] is True


# ----- signing in ------------------------------------------------------------


def test_password_alone_is_not_a_sign_in(client: TestClient, db: Session) -> None:
    user, password, _, _, _ = _enrol(client, db)
    r = _password_step(client, user, password)
    body = r.json()
    assert r.status_code == 200
    assert body["mfa_required"] is True and body["access_token"] is None
    token = body["mfa_token"]
    # The short token opens nothing: not /users/me, not the temporary-password routes.
    r = client.get(f"{API}/users/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403
    r = client.post(
        f"{API}/login/test-token", headers={"Authorization": f"Bearer {token}"}
    )
    assert r.status_code == 403


def test_sign_in_with_the_code_then_it_cannot_be_replayed(
    client: TestClient, db: Session
) -> None:
    user, password, _, secret, _ = _enrol(client, db)
    token = _password_step(client, user, password).json()["mfa_token"]
    code = _code(secret, 1)  # the enrolment already used the current step
    r = _second_step(client, token, code)
    assert r.status_code == 200 and r.json()["access_token"]
    me = client.get(
        f"{API}/users/me",
        headers={"Authorization": f"Bearer {r.json()['access_token']}"},
    )
    assert me.status_code == 200
    # The same code again, even with a fresh password step: refused.
    token = _password_step(client, user, password).json()["mfa_token"]
    assert _second_step(client, token, code).status_code == 400
    # An older code (already past) is refused too.
    assert _second_step(client, token, _code(secret, 0)).status_code == 400


def test_a_full_access_token_is_not_a_two_factor_token(
    client: TestClient, db: Session
) -> None:
    _, _, headers, secret, _ = _enrol(client, db)
    token = headers["Authorization"].split(" ", 1)[1]
    assert _second_step(client, token, _code(secret, 1)).status_code == 400
    assert _second_step(client, "not-a-token", "123456").status_code == 400


def test_two_factor_token_goes_stale_when_the_password_changes(
    client: TestClient, db: Session
) -> None:
    user, password, headers, secret, _ = _enrol(client, db)
    token = _password_step(client, user, password).json()["mfa_token"]
    r = client.patch(
        f"{API}/users/me/password",
        headers=headers,
        json={
            "current_password": password,
            "new_password": "a-different-long-password",
        },
    )
    assert r.status_code == 200, r.text
    assert _second_step(client, token, _code(secret, 1)).status_code == 400


def test_wrong_codes_lock_the_account_like_wrong_passwords(
    client: TestClient, db: Session
) -> None:
    user, password, _, secret, _ = _enrol(client, db)
    token = _password_step(client, user, password).json()["mfa_token"]
    for _ in range(settings.LOGIN_MAX_FAILED_ATTEMPTS):
        assert _second_step(client, token, "000000").status_code == 400
    db.expire_all()
    row = db.get(User, user.id)
    assert row is not None and row.locked_until is not None
    # Even the right code is refused while locked, and so is the password step.
    assert _second_step(client, token, _code(secret, 1)).status_code == 400
    assert _password_step(client, user, password).status_code == 400
    failed = _audit(db, "auth.mfa_failed", user)
    assert len(failed) >= settings.LOGIN_MAX_FAILED_ATTEMPTS


def test_a_correct_password_does_not_wipe_wrong_code_counts(
    client: TestClient, db: Session
) -> None:
    user, password, _, secret, _ = _enrol(client, db)
    token = _password_step(client, user, password).json()["mfa_token"]
    for _ in range(2):
        _second_step(client, token, "000000")
    _password_step(client, user, password)  # a correct password alone
    db.expire_all()
    row = db.get(User, user.id)
    assert row is not None and row.failed_login_attempts == 2
    # A correct code does clear it.
    token = _password_step(client, user, password).json()["mfa_token"]
    assert _second_step(client, token, _code(secret, 1)).status_code == 200
    db.expire_all()
    row = db.get(User, user.id)
    assert row is not None and row.failed_login_attempts == 0


def test_recovery_code_signs_in_once(client: TestClient, db: Session) -> None:
    user, password, headers, _, codes = _enrol(client, db)
    token = _password_step(client, user, password).json()["mfa_token"]
    typed = codes[0].lower().replace("-", " ")  # case and spacing do not matter
    r = _second_step(client, token, typed)
    assert r.status_code == 200 and r.json()["access_token"]
    assert len(_audit(db, "auth.mfa_recovery_code_used", user)) == 1
    status = client.get(
        f"{API}/users/me/mfa",
        headers={"Authorization": f"Bearer {r.json()['access_token']}"},
    ).json()
    assert status["recovery_codes_remaining"] == 9
    token = _password_step(client, user, password).json()["mfa_token"]
    assert _second_step(client, token, codes[0]).status_code == 400
    assert _second_step(client, token, codes[1]).status_code == 200


def test_recovery_codes_work_without_the_encryption_key(
    client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    user, password, _, _, codes = _enrol(client, db)
    monkeypatch.setattr(settings, "MFA_ENCRYPTION_KEY", "")
    token = _password_step(client, user, password).json()["mfa_token"]
    assert _second_step(client, token, "123456").status_code == 400
    assert _second_step(client, token, codes[2]).status_code == 200


def test_inactive_user_cannot_finish(client: TestClient, db: Session) -> None:
    user, password, _, secret, _ = _enrol(client, db)
    token = _password_step(client, user, password).json()["mfa_token"]
    db.expire_all()
    row = db.get(User, user.id)
    assert row is not None
    row.is_active = False
    db.add(row)
    db.commit()
    assert _second_step(client, token, _code(secret, 1)).status_code == 400


# ----- turning off and new codes ---------------------------------------------


def test_turn_off_needs_password_and_a_code(client: TestClient, db: Session) -> None:
    user, password, headers, secret, _ = _enrol(client, db)
    url = f"{API}/users/me/mfa/disable"
    _fresh_steps(db, user)
    bad = client.post(
        url, headers=headers, json={"current_password": "x", "code": _code(secret)}
    )
    assert bad.status_code == 400
    bad = client.post(
        url, headers=headers, json={"current_password": password, "code": "000000"}
    )
    assert bad.status_code == 400
    db.expire_all()
    row = db.get(User, user.id)
    assert (
        row is not None and row.mfa_enabled is True and row.failed_login_attempts == 1
    )
    ok = client.post(
        url, headers=headers, json={"current_password": password, "code": _code(secret)}
    )
    assert ok.status_code == 200, ok.text
    db.expire_all()
    row = db.get(User, user.id)
    assert row is not None
    assert (row.mfa_enabled, row.mfa_secret_encrypted, row.mfa_last_step) == (
        False,
        None,
        None,
    )
    assert (
        db.exec(
            select(MfaRecoveryCode).where(col(MfaRecoveryCode.user_id) == user.id)
        ).all()
        == []
    )
    assert len(_audit(db, "auth.mfa_disabled", user)) == 1
    # Sign-in is password-only again.
    assert _password_step(client, user, password).json()["access_token"]


def test_turn_off_with_a_recovery_code(client: TestClient, db: Session) -> None:
    user, password, headers, _, codes = _enrol(client, db)
    r = client.post(
        f"{API}/users/me/mfa/disable",
        headers=headers,
        json={"current_password": password, "code": codes[0]},
    )
    assert r.status_code == 200


def test_new_recovery_codes_replace_the_old_ones(
    client: TestClient, db: Session
) -> None:
    user, password, headers, secret, old = _enrol(client, db)
    _fresh_steps(db, user)
    r = client.post(
        f"{API}/users/me/mfa/recovery-codes",
        headers=headers,
        json={"current_password": password, "code": _code(secret)},
    )
    assert r.status_code == 200, r.text
    new = r.json()["recovery_codes"]
    assert len(new) == 10 and not set(new) & set(old)
    assert len(_audit(db, "auth.mfa_codes_renewed", user)) == 1
    token = _password_step(client, user, password).json()["mfa_token"]
    assert _second_step(client, token, old[0]).status_code == 400
    assert _second_step(client, token, new[0]).status_code == 200


# ----- administrator ----------------------------------------------------------


def test_admin_resets_a_staff_persons_two_factor(
    client: TestClient, db: Session, superuser_token_headers: dict[str, str]
) -> None:
    user, password, _, secret, _ = _enrol(client, db)
    url = f"{API}/users/{user.id}/mfa"
    assert client.get(url, headers=superuser_token_headers).json() == {
        "enabled": True,
        "required": False,
    }
    r = client.delete(url, headers=superuser_token_headers)
    assert r.status_code == 200, r.text
    assert client.get(url, headers=superuser_token_headers).json() == {
        "enabled": False,
        "required": False,
    }
    assert _password_step(client, user, password).json()["access_token"]
    db.expire_all()
    admin = db.exec(select(User).where(User.email == settings.FIRST_SUPERUSER)).one()
    assert len(_audit(db, "auth.mfa_reset_by_admin", admin)) >= 1
    # The person can set it up again.
    headers = user_authentication_headers(
        client=client, email=user.email, password=password
    )
    assert (
        client.post(
            f"{API}/users/me/mfa/setup",
            headers=headers,
            json={"current_password": password},
        ).status_code
        == 200
    )


def test_admin_reset_also_frees_a_locked_person(
    client: TestClient, db: Session, superuser_token_headers: dict[str, str]
) -> None:
    user, password, _, _, _ = _enrol(client, db)
    token = _password_step(client, user, password).json()["mfa_token"]
    for _ in range(settings.LOGIN_MAX_FAILED_ATTEMPTS):
        _second_step(client, token, "000000")
    assert _password_step(client, user, password).status_code == 400
    client.delete(f"{API}/users/{user.id}/mfa", headers=superuser_token_headers)
    assert _password_step(client, user, password).status_code == 200


def test_admin_reset_rules(
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
    staff_token_headers: dict[str, str],
) -> None:
    other_admin, _, _, _, _ = _enrol(client, db, UserRole.admin)
    r = client.delete(
        f"{API}/users/{other_admin.id}/mfa", headers=superuser_token_headers
    )
    assert r.status_code == 400 and "server" in r.json()["detail"]
    me = client.get(f"{API}/users/me", headers=superuser_token_headers).json()
    assert (
        client.delete(
            f"{API}/users/{me['id']}/mfa", headers=superuser_token_headers
        ).status_code
        == 400
    )
    missing = uuid.uuid4()
    assert (
        client.delete(
            f"{API}/users/{missing}/mfa", headers=superuser_token_headers
        ).status_code
        == 404
    )
    # Staff cannot reset or even look.
    assert (
        client.delete(
            f"{API}/users/{other_admin.id}/mfa", headers=staff_token_headers
        ).status_code
        == 403
    )
    assert (
        client.get(
            f"{API}/users/{other_admin.id}/mfa", headers=staff_token_headers
        ).status_code
        == 403
    )
