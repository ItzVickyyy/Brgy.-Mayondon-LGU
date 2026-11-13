"""Every API operation must demand a sign-in, except a short allow-list.

New routes are picked up automatically from the OpenAPI document, so a route
added without ``CurrentUser`` or ``require_permission`` fails here instead of
going live open. If an operation is meant to be public, add it to PUBLIC on
purpose.
"""

import re
import uuid

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

API = settings.API_V1_STR

# Reachable without credentials by design.
PUBLIC_ALWAYS = {
    ("POST", f"{API}/login/access-token"),
    ("POST", f"{API}/password-recovery"),
    ("POST", f"{API}/password-recovery/questions"),  # decoys for unknown accounts
    ("POST", f"{API}/password-recovery/reset"),  # needs all three answers
    ("POST", f"{API}/reset-password/"),
    ("POST", f"{API}/users/signup"),  # refused unless USERS_OPEN_REGISTRATION
    ("GET", f"{API}/utils/health-check/"),
}
# Only mounted when FASTAPI_ENV=development AND ENABLE_DEV_ROUTES=true (app/api/main.py).
PUBLIC_DEVELOPMENT_ONLY = {
    ("POST", f"{API}/private/users/"),
}
WRITE_METHODS = {"POST", "PUT", "PATCH"}


def _operations() -> list[tuple[str, str, str]]:
    """(method, openapi path, concrete url) for every API operation."""
    spec = app.openapi()
    found: list[tuple[str, str, str]] = []
    for path, operations in spec["paths"].items():
        if not path.startswith(API):
            continue
        for method, operation in operations.items():
            if method.upper() not in {"GET", "POST", "PUT", "PATCH", "DELETE"}:
                continue
            url = path
            for name in re.findall(r"\{([^}]*)\}", path):
                schema: dict[str, str] = next(
                    (
                        parameter["schema"]
                        for parameter in operation.get("parameters", [])
                        if parameter["name"] == name
                    ),
                    {},
                )
                value = "1" if schema.get("type") == "integer" else str(uuid.uuid4())
                url = url.replace("{" + name + "}", value)
            found.append((method.upper(), path, url))
    return found


def test_the_api_is_not_empty() -> None:
    # Guards the test itself: a broken path filter must not pass silently.
    assert len(_operations()) > 40


def test_every_operation_requires_sign_in_except_the_allow_list(
    client: TestClient,
) -> None:
    public = PUBLIC_ALWAYS | PUBLIC_DEVELOPMENT_ONLY
    open_operations: list[tuple[str, str, int]] = []
    for method, path, url in _operations():
        if (method, path) in public:
            continue
        response = (
            client.request(method, url, json={})
            if method in WRITE_METHODS
            else client.request(method, url)
        )
        if response.status_code not in (401, 403):
            open_operations.append((method, path, response.status_code))
    assert open_operations == [], (
        "These operations answered without credentials. Add CurrentUser or "
        "require_permission, or list them as public on purpose: "
        f"{open_operations}"
    )


def test_the_public_list_has_no_stale_entries() -> None:
    present = {(method, path) for method, path, _ in _operations()}
    assert PUBLIC_ALWAYS <= present
    assert PUBLIC_DEVELOPMENT_ONLY <= present or not settings.ENABLE_DEV_ROUTES
