from fastapi import APIRouter

from app.api.routes import items, login, private, users, utils
from app.core.config import settings


def create_api_router(fastapi_env: str | None) -> APIRouter:
    """Build the API router with development-only routes excluded by default."""
    router = APIRouter()
    router.include_router(login.router)
    router.include_router(users.router)
    router.include_router(utils.router)
    router.include_router(items.router)

    if fastapi_env == "development":
        router.include_router(private.router)
        router.include_router(login.dev_router)

    return router


api_router = create_api_router(settings.FASTAPI_ENV)
