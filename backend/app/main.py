from pathlib import Path

import sentry_sdk
from fastapi import FastAPI
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
    return f"{route.tags[0]}-{route.name}"


if settings.SENTRY_DSN and settings.FASTAPI_ENV != "development":
    sentry_sdk.init(dsn=str(settings.SENTRY_DSN), enable_tracing=True)

app = FastAPI(
    title=settings.PROJECT_NAME,
    docs_url=None,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    generate_unique_id_function=custom_generate_unique_id,
)


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
# Serve the built frontend only when it exists (local/self-hosted builds).
# On Vercel the frontend is deployed separately, so a backend-only deploy and
# plain `pytest` runs must not crash when this folder is missing.
if FRONTEND_DIR.is_dir():
    app.frontend("/", directory=FRONTEND_DIR)
