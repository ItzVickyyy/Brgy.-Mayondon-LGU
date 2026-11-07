"""Activity Log: read access to the append-only ``audit_log``.

Staff see only their own actions (``ACTIVITY_VIEW_OWN``); a System
Administrator sees everyone's and can filter by person
(``ACTIVITY_VIEW_ALL``). Nothing here writes: the table is append-only and a
database trigger blocks UPDATE, DELETE and TRUNCATE.
"""

import uuid
from datetime import date, datetime, time, timedelta
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func as sa_func
from sqlmodel import col, select

from app.api.deps import SessionDep, require_permission
from app.core.dates import MANILA_TZ
from app.core.permissions import Permission, has_permission
from app.models import User
from app.models_activity import (
    ActivityActor,
    ActivityItem,
    ActivityOptions,
    ActivityPublic,
)
from app.models_foundation import AuditLog

router = APIRouter(prefix="/activity", tags=["activity"])

ActivityUser = Annotated[
    User, Depends(require_permission(Permission.ACTIVITY_VIEW_OWN))
]

OUTCOMES = ("success", "failed", "denied")


def _sees_everyone(user: User) -> bool:
    return has_permission(user, Permission.ACTIVITY_VIEW_ALL)


def _day_start(day: date) -> datetime:
    """Midnight at the start of ``day`` in Manila time (business dates)."""
    return datetime.combine(day, time.min, tzinfo=MANILA_TZ)


@router.get("/", response_model=ActivityPublic)
def list_activity(
    session: SessionDep,
    user: ActivityUser,
    q: Annotated[
        str | None,
        Query(
            max_length=100,
            description="Words matched against person, action, module, record and reason",
        ),
    ] = None,
    module: Annotated[str | None, Query(max_length=60)] = None,
    exclude_module: Annotated[
        str | None,
        Query(
            max_length=60,
            description="Leave out one module, e.g. auth to hide sign-ins",
        ),
    ] = None,
    action: Annotated[str | None, Query(max_length=80)] = None,
    outcome: Literal["success", "failed", "denied"] | None = None,
    actor_user_id: uuid.UUID | None = None,
    record_type: Annotated[str | None, Query(max_length=60)] = None,
    record_id: Annotated[str | None, Query(max_length=80)] = None,
    date_from: Annotated[
        date | None, Query(description="Manila date, inclusive")
    ] = None,
    date_to: Annotated[date | None, Query(description="Manila date, inclusive")] = None,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> Any:
    """Newest first. Staff always get their own rows; asking for another
    person's rows is a 403, not an empty list."""
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="date_from is after date_to")
    stmt = select(AuditLog)
    if _sees_everyone(user):
        if actor_user_id is not None:
            stmt = stmt.where(AuditLog.actor_user_id == actor_user_id)
    else:
        if actor_user_id is not None and actor_user_id != user.id:
            raise HTTPException(
                status_code=403, detail="You can only view your own activity"
            )
        stmt = stmt.where(AuditLog.actor_user_id == user.id)
    if module:
        stmt = stmt.where(AuditLog.module == module)
    if exclude_module:
        stmt = stmt.where(col(AuditLog.module).is_distinct_from(exclude_module))
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if outcome:
        stmt = stmt.where(AuditLog.outcome == outcome)
    if record_type:
        stmt = stmt.where(AuditLog.record_type == record_type)
    if record_id:
        stmt = stmt.where(AuditLog.record_id == record_id)
    if date_from:
        stmt = stmt.where(col(AuditLog.occurred_at) >= _day_start(date_from))
    if date_to:
        stmt = stmt.where(
            col(AuditLog.occurred_at) < _day_start(date_to + timedelta(days=1))
        )
    for word in (q or "").split():
        pattern = f"%{word}%"
        stmt = stmt.where(
            col(AuditLog.actor_email).ilike(pattern)
            | col(AuditLog.action).ilike(pattern)
            | col(AuditLog.module).ilike(pattern)
            | col(AuditLog.record_id).ilike(pattern)
            | col(AuditLog.reason).ilike(pattern)
        )
    count = session.exec(select(sa_func.count()).select_from(stmt.subquery())).one()
    rows = session.exec(
        stmt.order_by(col(AuditLog.occurred_at).desc(), col(AuditLog.id).desc())
        .offset(skip)
        .limit(limit)
    ).all()
    return ActivityPublic(
        data=[
            ActivityItem(
                id=row.id or 0,
                occurred_at=row.occurred_at,
                actor_user_id=row.actor_user_id,
                actor_email=row.actor_email,
                is_own=row.actor_user_id == user.id,
                action=row.action,
                module=row.module,
                record_type=row.record_type,
                record_id=row.record_id,
                outcome=row.outcome,
                reason=row.reason,
                details=row.details,
            )
            for row in rows
        ],
        count=count,
    )


@router.get("/options", response_model=ActivityOptions)
def activity_options(session: SessionDep, user: ActivityUser) -> Any:
    """Distinct modules, actions and people for the filter drop-downs."""
    everyone = _sees_everyone(user)

    def scoped(stmt: Any) -> Any:
        return stmt if everyone else stmt.where(AuditLog.actor_user_id == user.id)

    modules = session.exec(
        scoped(select(AuditLog.module).where(col(AuditLog.module).is_not(None)))
        .distinct()
        .order_by(col(AuditLog.module))
    ).all()
    actions = session.exec(
        scoped(select(AuditLog.action)).distinct().order_by(col(AuditLog.action))
    ).all()
    actors: list[ActivityActor] = []
    if everyone:
        actors = [
            ActivityActor(id=actor_id, email=email)
            for actor_id, email in session.exec(
                select(AuditLog.actor_user_id, AuditLog.actor_email)
                .where(
                    col(AuditLog.actor_user_id).is_not(None),
                    col(AuditLog.actor_email).is_not(None),
                )
                .distinct()
                .order_by(col(AuditLog.actor_email))
            ).all()
            if actor_id is not None and email is not None
        ]
    return ActivityOptions(
        modules=[m for m in modules if m],
        actions=list(actions),
        outcomes=list(OUTCOMES),
        actors=actors,
    )
