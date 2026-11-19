"""Lookup lists for forms and admin upkeep of editable lists.

Any signed-in user may read every list. Document types are seeded and read-only.
Issuance purposes, sectors, ID types, addressed-office suggestions and
educational-attainment suggestions are admin-managed. Streets and tricycle
associations have the same admin-only upkeep. Referenced lookup items cannot be removed (409). Addressed-office
suggestions are not foreign keys: issued Indigency records retain the office
text entered at issue time, so suggestions can be removed without changing
history.
"""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func as sa_func
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, col, select

from app.api.deps import CurrentUser, SessionDep, require_permission
from app.core.audit import record_audit_event
from app.core.masterlist_import import street_key
from app.core.permissions import Permission
from app.models import User
from app.models_foundation import (
    AddressedOffice,
    DocumentType,
    EducationalAttainment,
    IdType,
    IssuancePurpose,
    Sector,
    Street,
    TricycleAssociation,
)
from app.models_lookups import (
    DocumentTypePublic,
    IdTypeNameIn,
    LookupItem,
    LookupNameIn,
    SectorNameIn,
)

router = APIRouter(prefix="/lookups", tags=["lookups"])

ManageUser = Annotated[User, Depends(require_permission(Permission.LOOKUPS_MANAGE))]


def _names(session: Session, model: Any) -> list[LookupItem]:
    # Sort case-insensitively while retaining a deterministic tie-breaker.
    rows = session.exec(
        select(model).order_by(sa_func.lower(model.name), col(model.name))
    ).all()
    return [LookupItem(id=r.id, name=r.name) for r in rows]


@router.get("/document-types", response_model=list[DocumentTypePublic])
def list_document_types(
    session: SessionDep, _user: CurrentUser
) -> list[DocumentTypePublic]:
    rows = session.exec(select(DocumentType).order_by(col(DocumentType.id))).all()
    return [DocumentTypePublic.model_validate(r, from_attributes=True) for r in rows]


@router.get("/sectors", response_model=list[LookupItem])
def list_sectors(session: SessionDep, _user: CurrentUser) -> list[LookupItem]:
    return _names(session, Sector)


@router.get("/id-types", response_model=list[LookupItem])
def list_id_types(session: SessionDep, _user: CurrentUser) -> list[LookupItem]:
    return _names(session, IdType)


@router.get("/issuance-purposes", response_model=list[LookupItem])
def list_issuance_purposes(session: SessionDep, _user: CurrentUser) -> list[LookupItem]:
    return _names(session, IssuancePurpose)


@router.get("/addressed-offices", response_model=list[LookupItem])
def list_addressed_offices(session: SessionDep, _user: CurrentUser) -> list[LookupItem]:
    return _names(session, AddressedOffice)


@router.get("/educational-attainments", response_model=list[LookupItem])
def list_educational_attainments(
    session: SessionDep, _user: CurrentUser
) -> list[LookupItem]:
    return _names(session, EducationalAttainment)


@router.get("/streets", response_model=list[LookupItem])
def list_streets(session: SessionDep, _user: CurrentUser) -> list[LookupItem]:
    return _names(session, Street)


@router.get("/tricycle-associations", response_model=list[LookupItem])
def list_tricycle_associations(
    session: SessionDep, _user: CurrentUser
) -> list[LookupItem]:
    return _names(session, TricycleAssociation)


# --- Admin upkeep for editable lookup lists --------------------------------------


def _name_taken(
    session: Session, model: Any, name: str, *, except_id: int | None = None
) -> bool:
    """True when another item has the same name once case, accents, spacing,
    punctuation and ``St.``/``Street`` are ignored (``Rizal St.`` is ``Rizal Street``).

    The lists are short (dozens of names), so the comparison is done here. A
    lock keeps two administrators from adding the same name at the same moment;
    it is released when the request commits.
    """
    session.connection().execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:key))").bindparams(
            key=f"lookup:{model.__tablename__}"
        )
    )
    wanted = street_key(name)
    stmt = select(model.id, model.name)
    if except_id is not None:
        stmt = stmt.where(model.id != except_id)
    return any(street_key(other) == wanted for _id, other in session.exec(stmt).all())


def _get_or_404(session: Session, model: Any, item_id: int, label: str) -> Any:
    item = session.get(model, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail=f"{label} not found")
    return item


def _create(
    session: Session,
    user: User,
    model: Any,
    body: LookupNameIn,
    *,
    label: str,
    record_type: str,
) -> LookupItem:
    if _name_taken(session, model, body.name):
        raise HTTPException(status_code=409, detail=f"This {label} already exists")
    item = model(name=body.name)
    session.add(item)
    try:
        session.flush()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail=f"This {label} already exists")
    record_audit_event(
        session,
        action=f"{record_type}.create",
        actor=user,
        module="lookups",
        record_type=record_type,
        record_id=item.id,
        details={"fields": ["name"]},
    )
    session.commit()
    session.refresh(item)
    return LookupItem(id=item.id, name=item.name)


def _rename(
    session: Session,
    user: User,
    model: Any,
    item_id: int,
    body: LookupNameIn,
    *,
    label: str,
    record_type: str,
) -> LookupItem:
    item = _get_or_404(session, model, item_id, label[0].upper() + label[1:])
    if _name_taken(session, model, body.name, except_id=item_id):
        raise HTTPException(status_code=409, detail=f"This {label} already exists")
    item.name = body.name
    session.add(item)
    try:
        session.flush()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail=f"This {label} already exists")
    record_audit_event(
        session,
        action=f"{record_type}.rename",
        actor=user,
        module="lookups",
        record_type=record_type,
        record_id=item_id,
        details={"fields": ["name"]},
    )
    session.commit()
    session.refresh(item)
    return LookupItem(id=item.id, name=item.name)


def _remove(
    session: Session,
    user: User,
    model: Any,
    item_id: int,
    *,
    label: str,
    record_type: str,
) -> Response:
    item = _get_or_404(session, model, item_id, label[0].upper() + label[1:])
    session.delete(item)
    record_audit_event(
        session,
        action=f"{record_type}.delete",
        actor=user,
        module="lookups",
        record_type=record_type,
        record_id=item_id,
    )
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=409,
            detail=f"This {label} is in use and cannot be removed; rename it instead",
        )
    return Response(status_code=204)


@router.post("/issuance-purposes", response_model=LookupItem, status_code=201)
def create_issuance_purpose(
    body: LookupNameIn, session: SessionDep, user: ManageUser
) -> LookupItem:
    return _create(
        session,
        user,
        IssuancePurpose,
        body,
        label="purpose",
        record_type="issuance_purpose",
    )


@router.patch("/issuance-purposes/{item_id}", response_model=LookupItem)
def rename_issuance_purpose(
    item_id: int, body: LookupNameIn, session: SessionDep, user: ManageUser
) -> LookupItem:
    return _rename(
        session,
        user,
        IssuancePurpose,
        item_id,
        body,
        label="purpose",
        record_type="issuance_purpose",
    )


@router.delete("/issuance-purposes/{item_id}", status_code=204)
def delete_issuance_purpose(
    item_id: int, session: SessionDep, user: ManageUser
) -> Response:
    return _remove(
        session,
        user,
        IssuancePurpose,
        item_id,
        label="purpose",
        record_type="issuance_purpose",
    )


@router.post("/addressed-offices", response_model=LookupItem, status_code=201)
def create_addressed_office(
    body: LookupNameIn, session: SessionDep, user: ManageUser
) -> LookupItem:
    return _create(
        session,
        user,
        AddressedOffice,
        body,
        label="addressed office",
        record_type="addressed_office",
    )


@router.patch("/addressed-offices/{item_id}", response_model=LookupItem)
def rename_addressed_office(
    item_id: int, body: LookupNameIn, session: SessionDep, user: ManageUser
) -> LookupItem:
    return _rename(
        session,
        user,
        AddressedOffice,
        item_id,
        body,
        label="addressed office",
        record_type="addressed_office",
    )


@router.delete("/addressed-offices/{item_id}", status_code=204)
def delete_addressed_office(
    item_id: int, session: SessionDep, user: ManageUser
) -> Response:
    return _remove(
        session,
        user,
        AddressedOffice,
        item_id,
        label="addressed office",
        record_type="addressed_office",
    )


@router.post("/educational-attainments", response_model=LookupItem, status_code=201)
def create_educational_attainment(
    body: LookupNameIn, session: SessionDep, user: ManageUser
) -> LookupItem:
    return _create(
        session,
        user,
        EducationalAttainment,
        body,
        label="educational attainment",
        record_type="educational_attainment",
    )


@router.patch("/educational-attainments/{item_id}", response_model=LookupItem)
def rename_educational_attainment(
    item_id: int, body: LookupNameIn, session: SessionDep, user: ManageUser
) -> LookupItem:
    return _rename(
        session,
        user,
        EducationalAttainment,
        item_id,
        body,
        label="educational attainment",
        record_type="educational_attainment",
    )


@router.delete("/educational-attainments/{item_id}", status_code=204)
def delete_educational_attainment(
    item_id: int, session: SessionDep, user: ManageUser
) -> Response:
    return _remove(
        session,
        user,
        EducationalAttainment,
        item_id,
        label="educational attainment",
        record_type="educational_attainment",
    )


@router.post("/streets", response_model=LookupItem, status_code=201)
def create_street(
    body: LookupNameIn, session: SessionDep, user: ManageUser
) -> LookupItem:
    return _create(session, user, Street, body, label="street", record_type="street")


@router.patch("/streets/{street_id}", response_model=LookupItem)
def rename_street(
    street_id: int, body: LookupNameIn, session: SessionDep, user: ManageUser
) -> LookupItem:
    return _rename(
        session, user, Street, street_id, body, label="street", record_type="street"
    )


@router.delete("/streets/{street_id}", status_code=204)
def delete_street(street_id: int, session: SessionDep, user: ManageUser) -> Response:
    return _remove(
        session, user, Street, street_id, label="street", record_type="street"
    )


@router.post("/tricycle-associations", response_model=LookupItem, status_code=201)
def create_tricycle_association(
    body: LookupNameIn, session: SessionDep, user: ManageUser
) -> LookupItem:
    return _create(
        session,
        user,
        TricycleAssociation,
        body,
        label="tricycle association",
        record_type="tricycle_association",
    )


@router.patch("/tricycle-associations/{item_id}", response_model=LookupItem)
def rename_tricycle_association(
    item_id: int, body: LookupNameIn, session: SessionDep, user: ManageUser
) -> LookupItem:
    return _rename(
        session,
        user,
        TricycleAssociation,
        item_id,
        body,
        label="tricycle association",
        record_type="tricycle_association",
    )


@router.delete("/tricycle-associations/{item_id}", status_code=204)
def delete_tricycle_association(
    item_id: int, session: SessionDep, user: ManageUser
) -> Response:
    return _remove(
        session,
        user,
        TricycleAssociation,
        item_id,
        label="tricycle association",
        record_type="tricycle_association",
    )


@router.post("/id-types", response_model=LookupItem, status_code=201)
def create_id_type(
    body: IdTypeNameIn, session: SessionDep, user: ManageUser
) -> LookupItem:
    return _create(session, user, IdType, body, label="ID type", record_type="id_type")


@router.patch("/id-types/{item_id}", response_model=LookupItem)
def rename_id_type(
    item_id: int, body: IdTypeNameIn, session: SessionDep, user: ManageUser
) -> LookupItem:
    return _rename(
        session, user, IdType, item_id, body, label="ID type", record_type="id_type"
    )


@router.delete("/id-types/{item_id}", status_code=204)
def delete_id_type(item_id: int, session: SessionDep, user: ManageUser) -> Response:
    return _remove(
        session, user, IdType, item_id, label="ID type", record_type="id_type"
    )


@router.post("/sectors", response_model=LookupItem, status_code=201)
def create_sector(
    body: SectorNameIn, session: SessionDep, user: ManageUser
) -> LookupItem:
    return _create(session, user, Sector, body, label="sector", record_type="sector")


@router.patch("/sectors/{item_id}", response_model=LookupItem)
def rename_sector(
    item_id: int, body: SectorNameIn, session: SessionDep, user: ManageUser
) -> LookupItem:
    return _rename(
        session, user, Sector, item_id, body, label="sector", record_type="sector"
    )


@router.delete("/sectors/{item_id}", status_code=204)
def delete_sector(item_id: int, session: SessionDep, user: ManageUser) -> Response:
    return _remove(session, user, Sector, item_id, label="sector", record_type="sector")
