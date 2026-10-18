from pathlib import Path

import sentry_sdk
from fastapi import FastAPI
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import FileResponse
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
    return {
        "detail": "Barangay favicon was not found in the frontend assets."
    }


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
