from collections.abc import Awaitable, Callable
from pathlib import Path

import sentry_sdk
from fastapi import FastAPI, HTTPException, Request
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import FileResponse, Response
from fastapi.routing import APIRoute
from starlette.middleware.cors import CORSMiddleware

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
    sentry_sdk.init(dsn=str(settings.SENTRY_DSN), enable_tracing=True)

app = FastAPI(
    title=settings.PROJECT_NAME,
    docs_url=None,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    generate_unique_id_function=custom_generate_unique_id,
)


@app.middleware("http")
async def add_security_headers(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    return response


@app.get("/docs", include_in_schema=False)
def custom_swagger_ui_html():
    return get_swagger_ui_html(
        openapi_url=app.openapi_url or f"{settings.API_V1_STR}/openapi.json",
        title=f"{settings.PROJECT_NAME} - API documentation",
        swagger_favicon_url="/favicon.svg",
    )


@app.get("/favicon.svg", include_in_schema=False)
def favicon():
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
            '</svg>'
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

app.include_router(api_router, prefix=settings.API_V1_STR)
# Serve the packaged frontend for self-hosted LAN deployments. The fallback
# returns index.html for client-side routes such as /login, while keeping API
# paths as API 404s and serving existing frontend assets directly.
if FRONTEND_DIR.is_dir():
    FRONTEND_ROOT = FRONTEND_DIR.resolve()

    @app.get("/", include_in_schema=False)
    def frontend_index():
        return FileResponse(FRONTEND_ROOT / "index.html")

    @app.get("/{full_path:path}", include_in_schema=False)
    def frontend_routes(full_path: str):
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
