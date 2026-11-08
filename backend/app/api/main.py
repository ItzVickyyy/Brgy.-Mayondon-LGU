from fastapi import APIRouter

from app.api.routes import (
    activity,
    backups,
    barangay_ids,
    dashboard,
    issuances,
    login,
    lookups,
    officials,
    private,
    reports,
    residents,
    users,
    utils,
)
from app.core.config import settings


def create_api_router(fastapi_env: str | None) -> APIRouter:
    """Build the API router with development-only routes excluded by default."""
    router = APIRouter()
    router.include_router(login.router)
    router.include_router(users.router)
    router.include_router(residents.router)
    router.include_router(lookups.router)
    router.include_router(officials.router)
    router.include_router(issuances.router)
    router.include_router(barangay_ids.router)
    router.include_router(activity.router)
    router.include_router(dashboard.router)
    router.include_router(reports.router)
    router.include_router(backups.router)
    router.include_router(utils.router)

    if fastapi_env == "development":
        router.include_router(private.router)
        router.include_router(login.dev_router)

    return router


api_router = create_api_router(settings.FASTAPI_ENV)
