from fastapi.testclient import TestClient

from app.core.config import settings

URL = f"{settings.API_V1_STR}/users/me/preferences"


def test_preferences_start_empty(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    client.put(
        URL,
        headers=normal_user_token_headers,
        json={"font_size": "medium"},
    )
    # A second call proves the round trip; the first reset any earlier value.
    # The accent was not sent, so it is the default: purple.
    r = client.get(URL, headers=normal_user_token_headers)
    assert r.status_code == 200
    assert r.json() == {
        "theme": None,
        "accent": "purple",
        "font_size": "medium",
    }


def test_preferences_round_trip_and_stay_per_account(
    client: TestClient,
    normal_user_token_headers: dict[str, str],
    superuser_token_headers: dict[str, str],
) -> None:
    saved = {
        "theme": "dark",
        "accent": "teal",
        "font_size": "large",
    }
    r = client.put(URL, headers=normal_user_token_headers, json=saved)
    assert r.status_code == 200
    assert r.json() == saved
    assert client.get(URL, headers=normal_user_token_headers).json() == saved
    # Another account is not affected.
    other = client.put(
        URL,
        headers=superuser_token_headers,
        json={"accent": "rose", "font_size": "small"},
    )
    assert other.status_code == 200
    assert client.get(URL, headers=normal_user_token_headers).json() == saved


def test_old_gold_accent_field_is_ignored(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    # The gold switch was removed (patch 305): an older client that still
    # sends it is accepted, and the field is neither stored nor returned.
    r = client.put(
        URL,
        headers=normal_user_token_headers,
        json={"accent": "navy", "font_size": "medium", "gold_accent": False},
    )
    assert r.status_code == 200
    assert "gold_accent" not in r.json()
    saved = client.get(URL, headers=normal_user_token_headers).json()
    assert "gold_accent" not in saved


def test_preferences_reject_unknown_values(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    for body in (
        {"accent": "hotpink", "font_size": "medium"},
        {"accent": "navy", "font_size": "huge"},
        {"theme": "blue", "accent": "navy", "font_size": "medium"},
    ):
        r = client.put(URL, headers=normal_user_token_headers, json=body)
        assert r.status_code == 422


def test_preferences_need_sign_in(client: TestClient) -> None:
    assert client.get(URL).status_code == 401
    assert client.put(URL, json={}).status_code == 401
