from fastapi import APIRouter

from app.api.routes import (
    activity,
    backups,
    barangay_ids,
    dashboard,
    imports,
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


def create_api_router(
    fastapi_env: str | None, enable_dev_routes: bool = False
) -> APIRouter:
    """Build the API router with development-only routes excluded by default.

    The unauthenticated helper routes need BOTH ``FASTAPI_ENV=development`` and an
    explicit ``ENABLE_DEV_ROUTES=true``, so a copied ``.env`` can never open them.
    """
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
    router.include_router(imports.router)
    router.include_router(utils.router)

    if fastapi_env == "development" and enable_dev_routes:
        router.include_router(private.router)
        router.include_router(login.dev_router)

    return router


api_router = create_api_router(settings.FASTAPI_ENV, settings.ENABLE_DEV_ROUTES)
