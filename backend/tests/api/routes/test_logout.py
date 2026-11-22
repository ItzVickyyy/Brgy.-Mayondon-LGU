"""Signing out ends the token on the server, so a copied token stops working at once."""

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core import security
from app.core.config import settings
from app.models import RevokedToken, User

API = settings.API_V1_STR


def _token(client: TestClient) -> str:
    result = client.post(
        f"{API}/login/access-token",
        data={
            "username": settings.FIRST_SUPERUSER,
            "password": settings.FIRST_SUPERUSER_PASSWORD,
        },
    )
    assert result.status_code == 200
    return result.json()["access_token"]


def test_signed_out_token_is_refused(client: TestClient) -> None:
    token = _token(client)
    headers = {"Authorization": f"Bearer {token}"}
    assert client.get(f"{API}/users/me", headers=headers).status_code == 200

    assert client.post(f"{API}/login/logout", headers=headers).status_code == 200

    assert client.get(f"{API}/users/me", headers=headers).status_code == 403


def test_signing_out_one_token_leaves_the_others(client: TestClient) -> None:
    first, second = _token(client), _token(client)
    client.post(f"{API}/login/logout", headers={"Authorization": f"Bearer {first}"})

    assert (
        client.get(
            f"{API}/users/me", headers={"Authorization": f"Bearer {second}"}
        ).status_code
        == 200
    )


def test_logout_never_fails_on_a_bad_token(client: TestClient) -> None:
    assert (
        client.post(
            f"{API}/login/logout", headers={"Authorization": "Bearer not-a-token"}
        ).status_code
        == 200
    )
    assert client.post(f"{API}/login/logout").status_code == 401


def test_tokens_from_before_the_change_still_work(
    client: TestClient, db: Session
) -> None:
    user = db.exec(select(User).where(User.email == settings.FIRST_SUPERUSER)).one()
    old = security.jwt.encode(
        {
            "exp": datetime.now(UTC) + timedelta(minutes=5),
            "sub": str(user.id),
            "pwdv": security.password_fingerprint(user.hashed_password),
        },
        settings.SECRET_KEY,
        algorithm=security.ALGORITHM,
    )
    headers = {"Authorization": f"Bearer {old}"}
    assert client.get(f"{API}/users/me", headers=headers).status_code == 200


def test_old_revocations_are_cleaned_up(client: TestClient, db: Session) -> None:
    db.add(
        RevokedToken(
            jti="expired-one", expires_at=datetime.now(UTC) - timedelta(days=1)
        )
    )
    db.commit()
    client.post(
        f"{API}/login/logout", headers={"Authorization": f"Bearer {_token(client)}"}
    )
    db.expire_all()
    assert db.get(RevokedToken, "expired-one") is None
