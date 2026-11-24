import base64
import hashlib
import re
from collections.abc import Awaitable, Callable
from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import FileResponse, HTMLResponse, Response
from fastapi.routing import APIRoute
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from starlette.routing import Match
from starlette.types import ASGIApp, Receive, Scope, Send

from app.api.main import api_router
from app.core.config import settings

FRONTEND_DIR = Path(__file__).parent / "frontend"
BRGY_ICON_PATHS = (
    FRONTEND_DIR / "assets" / "images" / "brgy-icon.svg",
    Path(__file__).resolve().parents[2]
    / "frontend"
    / "public"
    / "assets"
    / "images"
    / "brgy-icon.svg",
)


def custom_generate_unique_id(route: APIRoute) -> str:
    tag = route.tags[0] if route.tags else "untagged"
    return f"{tag}-{route.name}"


if settings.SENTRY_DSN and settings.FASTAPI_ENV != "development":
    # Imported only when used: it takes about a tenth of a second to load, for nothing on an
    # office computer that has no Sentry address.
    import sentry_sdk

    sentry_sdk.init(dsn=str(settings.SENTRY_DSN), enable_tracing=True)

# The interactive API page and the endpoint list are for developers only. On a real installation
# (no FASTAPI_ENV=development) anyone on the network could otherwise read a map of every
# endpoint without signing in. The client generator reads app.openapi() directly, not this URL.
DOCS_ENABLED = settings.FASTAPI_ENV == "development"

app = FastAPI(
    title=settings.PROJECT_NAME,
    docs_url=None,
    openapi_url=f"{settings.API_V1_STR}/openapi.json" if DOCS_ENABLED else None,
    generate_unique_id_function=custom_generate_unique_id,
)


# Vite names the files it builds ``name-<hash>.ext`` directly in /assets, and a changed file gets a
# new name, so a browser may keep such a file for good. Other files (index.html, the print-form
# pictures in /assets/print-forms) keep their names when they change and must be re-checked.
_HASHED_ASSET = re.compile(r"^/assets/[^/]+-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$")

# Photo background removal files (MediaPipe model and WebAssembly), copied into the build by Vite.
_VISION_PREFIX = "/vision/selfie-segmentation/"

# Already compressed or encrypted: squeezing them again costs processor time and saves nothing.
_NOT_COMPRESSED_SUFFIXES = (
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".ico",
    ".woff",
    ".woff2",
    ".zip",
    ".enc",
    "/photo",
)


class CompressTextOnly:
    """gzip for pages, scripts, styles and JSON (the first load of the program is mostly a
    script bundle). Resident photos, pictures, fonts and backup downloads pass through as they
    are."""

    def __init__(self, app: ASGIApp) -> None:
        self._app = app
        self._gzip = GZipMiddleware(app, minimum_size=1024, compresslevel=5)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            path = scope["path"]
            if path.endswith(_NOT_COMPRESSED_SUFFIXES) or path.startswith(
                f"{settings.API_V1_STR}/backups/"
            ):
                await self._app(scope, receive, send)
                return
        await self._gzip(scope, receive, send)


_INLINE_SCRIPT = re.compile(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", re.S)


@lru_cache(maxsize=1)
def _content_security_policy() -> str:
    """What the browser may load for the app pages.

    Only the app's own files, plus the single inline script in index.html (it sets the saved theme
    before the first paint), allowed by its hash and read from the built page, so a change to that
    script needs no edit here. Nothing from another site, no plug-ins, and the page cannot be put in
    a frame. Styles allow inline because the interface sets some at run time.
    """
    hashes = []
    index = FRONTEND_DIR / "index.html"
    if index.is_file():
        for body in _INLINE_SCRIPT.findall(index.read_text(encoding="utf-8")):
            digest = hashlib.sha256(body.encode("utf-8")).digest()
            hashes.append(f"'sha256-{base64.b64encode(digest).decode()}'")
    scripts = " ".join(["'self'", *hashes])
    return "; ".join(
        [
            "default-src 'self'",
            f"script-src {scripts}",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "font-src 'self' data:",
            "connect-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
        ]
    )


@app.middleware("http")
async def add_security_headers(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    if request.url.scheme == "https":
        # Only sent over HTTPS (browsers ignore it on HTTP). 30 days, no
        # subdomains: short enough to undo if the office goes back to HTTP.
        response.headers.setdefault("Strict-Transport-Security", "max-age=2592000")
    path = request.url.path
    if not path.startswith("/api/") and path != "/docs":
        # The developer API page loads its viewer from another site, so it is left out.
        response.headers.setdefault(
            "Content-Security-Policy", _content_security_policy()
        )
    if request.url.path.startswith("/api/"):
        # Resident data must never be kept in a browser or proxy cache on a
        # shared office computer.
        response.headers.setdefault("Cache-Control", "no-store")
    elif _HASHED_ASSET.match(path):
        # The browser keeps the program's own scripts and styles and does not ask the server
        # about them again on every page load (the single biggest saving on a slow office network).
        response.headers.setdefault(
            "Cache-Control", "public, max-age=31536000, immutable"
        )
    elif (
        path.startswith(_VISION_PREFIX)
        and response.status_code == 200
        and not response.headers.get("content-type", "").startswith("text/html")
    ):
        # The photo cut-out files (one is 5.7 MB) keep their names when they change, so they are
        # kept one day, not for good. A missing file falls back to index.html (HTML) and is left
        # to the HTML rule below, so a mistyped path is never remembered for a day.
        response.headers.setdefault("Cache-Control", "public, max-age=86400")
    elif response.headers.get("content-type", "").startswith("text/html"):
        # index.html names the current scripts, so after an update it must be fetched again.
        # "no-cache" still lets the browser reuse it when the server says it did not change.
        response.headers.setdefault("Cache-Control", "no-cache")
    return response


@app.get("/docs", include_in_schema=False)
def custom_swagger_ui_html() -> HTMLResponse:
    if not DOCS_ENABLED:
        raise HTTPException(status_code=404, detail="Not Found")
    return get_swagger_ui_html(
        openapi_url=app.openapi_url or f"{settings.API_V1_STR}/openapi.json",
        title=f"{settings.PROJECT_NAME} - API documentation",
        swagger_favicon_url="/favicon.svg",
    )


@app.get("/favicon.svg", include_in_schema=False)
def favicon() -> Response:
    for icon_path in BRGY_ICON_PATHS:
        if icon_path.is_file():
            return FileResponse(icon_path, media_type="image/svg+xml")
    # Keep API docs branded even if the frontend's static assets are absent.
    return Response(
        content=(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" '
            'fill="none" stroke="#15803d" stroke-width="2" '
            'stroke-linecap="round" stroke-linejoin="round">'
            '<line x1="3" x2="21" y1="22" y2="22"/>'
            '<line x1="6" x2="6" y1="18" y2="11"/>'
            '<line x1="10" x2="10" y1="18" y2="11"/>'
            '<line x1="14" x2="14" y1="18" y2="11"/>'
            '<line x1="18" x2="18" y1="18" y2="11"/>'
            '<polygon points="12 2 20 7 4 7"/>'
            "</svg>"
        ),
        media_type="image/svg+xml",
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(CompressTextOnly)

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.api_route(
    "/api/{_rest_of_path:path}",
    methods=["POST", "PUT", "PATCH", "DELETE"],
    include_in_schema=False,
)
def unknown_api_write(request: Request, _rest_of_path: str) -> None:
    """Reached only when no real route took a write request under /api/.

    A path that exists for other methods keeps the usual 405. A path that does
    not exist at all answers 404 and names the route, so an out-of-date backend
    (for example one without POST /api/v1/backups/) is not mistaken for a wrong
    method.
    """
    path = request.url.path
    own_paths = {"/api/{_rest_of_path:path}", "/{full_path:path}", "/"}
    allowed = []
    for method in ("GET", "POST", "PUT", "PATCH", "DELETE"):
        scope: dict[str, Any] = {
            "type": "http",
            "path": path,
            "method": method,
            "root_path": "",
            "headers": [],
            "query_string": b"",
        }
        if any(
            getattr(route, "path", None) not in own_paths
            and route.matches(scope)[0] == Match.FULL
            for route in app.router.routes
        ):
            allowed.append(method)
    if allowed:
        raise HTTPException(
            status_code=405,
            detail="Method Not Allowed",
            headers={"Allow": ", ".join(allowed)},
        )
    raise HTTPException(
        status_code=404,
        detail=f"No API route {request.method} {path}. The server may be out of date.",
    )


# Serve the packaged frontend for self-hosted LAN deployments. The fallback
# returns index.html for client-side routes such as /login, while keeping API
# paths as API 404s and serving existing frontend assets directly.
if FRONTEND_DIR.is_dir():
    FRONTEND_ROOT = FRONTEND_DIR.resolve()

    @app.get("/", include_in_schema=False)
    def frontend_index() -> FileResponse:
        return FileResponse(FRONTEND_ROOT / "index.html")

    @app.get("/{full_path:path}", include_in_schema=False)
    def frontend_routes(full_path: str) -> FileResponse:
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")

        requested_path = (FRONTEND_ROOT / full_path).resolve()
        try:
            requested_path.relative_to(FRONTEND_ROOT)
        except ValueError:
            raise HTTPException(status_code=404, detail="Not Found") from None

        if requested_path.is_file():
            return FileResponse(requested_path)
        return FileResponse(FRONTEND_ROOT / "index.html")
