"""Issuance API: drafts, issuing, correcting and voiding documents.

Supported document types are listed in ``DOCUMENT_RULES`` (models_issuance.py);
a type without an entry answers 501.
Every route needs ISSUANCE_WRITE (Staff and System Administrator), except void,
which needs ISSUANCE_VOID (System Administrator only). Barangay ID drafts also
need ID_WRITE (docs/05), checked once the document type is known.

Life of a document:
  draft  --issue-->  issued  --void (admin, reason)-->  voided
An issued row is never edited or deleted. ``POST /{id}/correct`` makes a new
draft that points back at the issued one; issuing that draft completes the
correction. Drafts can be edited and discarded freely and are not audited;
issue, correct and void each add an audit row in the same transaction.
Audit details hold field names and reference numbers, never personal values.
"""

import uuid
from datetime import UTC, datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Response
from sqlalchemy import func as sa_func
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, col, delete, select

from app.api.deps import SessionDep, require_permission
from app.core.audit import record_audit_event
from app.core.dates import add_months, today_manila
from app.core.permissions import Permission, has_permission
from app.models import User
from app.models_foundation import (
    DocumentType,
    IdType,
    IssuancePurpose,
    Official,
    Sector,
    Street,
    TricycleAssociation,
)
from app.models_issuance import (
    ALL_SECTIONS,
    DEFAULT_CLEARANCE_REMARKS,
    DOCUMENT_RULES,
    FREE_RECEIPT,
    RESTRICTED,
    SECTOR_LIMITS,
    AssistancePublic,
    BarangayIdPublic,
    FranchiseIn,
    FranchisePublic,
    IdentificationPublic,
    IndigencyPublic,
    Issuance,
    IssuanceAssistance,
    IssuanceBarangayId,
    IssuanceCreate,
    IssuanceFirstTimeJobseeker,
    IssuanceFranchise,
    IssuanceIdentification,
    IssuanceIndigency,
    IssuanceListItem,
    IssuanceMarginalizedSector,
    IssuancePayment,
    IssuancePublic,
    IssuanceResidentSnapshot,
    IssuanceSector,
    IssuancesPublic,
    IssuanceUpdate,
    IssuanceUtility,
    IssueRequest,
    JobseekerPublic,
    MarginalizedPublic,
    PaymentPublic,
    ReasonRequest,
    SectorPublic,
    SnapshotPublic,
    Tricycle,
    UtilityPublic,
)
from app.models_residents import Resident, ResidentPhoto, build_full_name

router = APIRouter(prefix="/issuances", tags=["issuances"])

WriteUser = Annotated[User, Depends(require_permission(Permission.ISSUANCE_WRITE))]
VoidUser = Annotated[User, Depends(require_permission(Permission.ISSUANCE_VOID))]

MODULE = "issuance"


# --- Lookups and loading ------------------------------------------------------


def _get_or_404(session: Session, issuance_id: uuid.UUID) -> Issuance:
    issuance = session.get(Issuance, issuance_id)
    if issuance is None:
        raise HTTPException(status_code=404, detail="Issuance not found")
    return issuance


def _doc_type(session: Session, document_type_id: int) -> DocumentType:
    doc_type = session.get(DocumentType, document_type_id)
    if doc_type is None:
        raise HTTPException(status_code=422, detail="Unknown document type")
    if doc_type.code not in DOCUMENT_RULES:
        raise HTTPException(
            status_code=501,
            detail=f"{doc_type.name} cannot be issued through the API yet",
        )
    return doc_type


def _resident(session: Session, resident_id: uuid.UUID) -> Resident:
    resident = session.get(Resident, resident_id)
    if resident is None:
        raise HTTPException(status_code=422, detail="Unknown resident")
    return resident


def _require_active(resident: Resident) -> None:
    if resident.status != "active":
        raise HTTPException(
            status_code=409, detail="An archived resident cannot receive documents"
        )


def _require_draft(issuance: Issuance) -> None:
    if issuance.status != "draft":
        raise HTTPException(
            status_code=409,
            detail="Only a draft can be edited. Use correct to change an issued document",
        )


def _require_id_permission(user: User, code: str) -> None:
    """Barangay ID work needs ID_WRITE as well (docs/05). Today Staff and the
    System Administrator both hold it; the check keeps the two apart if the
    matrix ever changes."""
    if code == "BARANGAY_ID" and not has_permission(user, Permission.ID_WRITE):
        raise HTTPException(
            status_code=403, detail="Not allowed to work with Barangay IDs"
        )


def _check_core_references(
    session: Session, *, purpose_id: int | None, official_id: uuid.UUID | None
) -> None:
    if purpose_id is not None and session.get(IssuancePurpose, purpose_id) is None:
        raise HTTPException(status_code=422, detail="Unknown purpose")
    if official_id is not None and session.get(Official, official_id) is None:
        raise HTTPException(status_code=422, detail="Unknown signatory")


# --- Writing the parts of a draft ----------------------------------------------


def _norm(value: str) -> str:
    return " ".join(value.split())


def _same(a: str, b: str) -> bool:
    return _norm(a).casefold() == _norm(b).casefold()


def _resolve_tricycle(
    session: Session, data: FranchiseIn, current_id: int | None, issuance_id: uuid.UUID
) -> Tricycle:
    """Find the tricycle by plate or motor number, or create it.

    A tricycle is stored once. If it already exists with different details, the
    clerk is told (409) instead of silently changing a franchise that was
    already issued. A tricycle used only by this draft may be corrected.
    """
    if session.get(TricycleAssociation, data.association_id) is None:
        raise HTTPException(status_code=422, detail="Unknown tricycle association")
    plate = _norm(data.plate_number).upper()
    motor = _norm(data.motor_number).upper()
    matches = list(
        session.exec(
            select(Tricycle).where(
                (col(Tricycle.plate_number) == plate)
                | (col(Tricycle.motor_number) == motor)
            )
        ).all()
    )
    if len({t.id for t in matches}) > 1:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "tricycle_conflict",
                "message": "The plate and motor numbers belong to different tricycles",
            },
        )

    def used_elsewhere(tricycle_id: int) -> bool:
        return (
            session.exec(
                select(IssuanceFranchise.issuance_id).where(
                    IssuanceFranchise.tricycle_id == tricycle_id,
                    IssuanceFranchise.issuance_id != issuance_id,
                )
            ).first()
            is not None
        )

    def apply(tricycle: Tricycle) -> Tricycle:
        tricycle.association_id = data.association_id
        tricycle.make = _norm(data.make)
        tricycle.body_type = _norm(data.body_type)
        tricycle.color = _norm(data.color)
        tricycle.plate_number = plate
        tricycle.motor_number = motor
        session.add(tricycle)
        session.flush()
        return tricycle

    if matches:
        found = matches[0]
        if (
            found.association_id == data.association_id
            and _same(found.make, data.make)
            and _same(found.body_type, data.body_type)
            and _same(found.color, data.color)
            and found.plate_number == plate
            and found.motor_number == motor
        ):
            return found
        assert found.id is not None
        if found.id == current_id and not used_elsewhere(found.id):
            return apply(found)
        raise HTTPException(
            status_code=409,
            detail={
                "code": "tricycle_mismatch",
                "message": "This plate or motor number is already registered "
                "with different details",
            },
        )
    if current_id is not None and not used_elsewhere(current_id):
        current = session.get(Tricycle, current_id)
        if current is not None:
            return apply(current)
    created = Tricycle(
        association_id=data.association_id,
        make=_norm(data.make),
        body_type=_norm(data.body_type),
        motor_number=motor,
        color=_norm(data.color),
        plate_number=plate,
    )
    session.add(created)
    session.flush()
    return created


def _replace_one(
    session: Session,
    model: type[Any],
    issuance_id: uuid.UUID,
    values: dict[str, Any] | None,
) -> None:
    session.exec(delete(model).where(col(model.issuance_id) == issuance_id))
    if values is not None:
        session.add(model(issuance_id=issuance_id, **values))


def _apply_sections(
    session: Session,
    issuance: Issuance,
    code: str,
    data: IssuanceCreate | IssuanceUpdate,
) -> None:
    rules = DOCUMENT_RULES[code]
    allowed = rules["sections"] + rules.get("optional_sections", ())
    sent = data.model_fields_set
    for name in ALL_SECTIONS:
        if name in sent and getattr(data, name) is not None and name not in allowed:
            raise HTTPException(
                status_code=422, detail=f"{name} does not apply to this document type"
            )

    today = today_manila()
    if "identification" in sent and "identification" in allowed:
        ident = data.identification
        if ident is not None and session.get(IdType, ident.id_type_id) is None:
            raise HTTPException(status_code=422, detail="Unknown ID type")
        _replace_one(
            session,
            IssuanceIdentification,
            issuance.id,
            None
            if ident is None
            else {
                "id_type_id": ident.id_type_id,
                "id_number": ident.id_number,
                "place_of_issue": ident.place_of_issue,
                "date_of_issue": ident.date_of_issue or today,
            },
        )
    if "payment" in sent and "payment" in allowed:
        pay = data.payment
        _replace_one(
            session,
            IssuancePayment,
            issuance.id,
            None
            if pay is None
            else {
                "is_free": pay.is_free,
                "official_receipt_no": FREE_RECEIPT
                if pay.is_free
                else pay.official_receipt_no,
                "date_of_payment": pay.date_of_payment or today,
                "certified_by": pay.certified_by,
            },
        )
    if "sectors" in sent and "sectors" in allowed:
        sectors = data.sectors or []
        ids = [s.sector_id for s in sectors]
        if len(set(ids)) != len(ids):
            raise HTTPException(status_code=422, detail="Duplicate sector")
        if len(ids) > SECTOR_LIMITS[code][1]:
            raise HTTPException(
                status_code=422,
                detail=f"At most {SECTOR_LIMITS[code][1]} sector(s) for this document",
            )
        if ids:
            found = session.exec(select(Sector.id).where(col(Sector.id).in_(ids))).all()
            if len(found) != len(ids):
                raise HTTPException(status_code=422, detail="Unknown sector")
        session.exec(
            delete(IssuanceSector).where(col(IssuanceSector.issuance_id) == issuance.id)
        )
        for s in sectors:
            session.add(
                IssuanceSector(
                    issuance_id=issuance.id,
                    sector_id=s.sector_id,
                    sector_id_number=s.sector_id_number,
                )
            )
    if "utility" in sent and "utility" in allowed:
        _replace_one(
            session,
            IssuanceUtility,
            issuance.id,
            None if data.utility is None else data.utility.model_dump(),
        )
    if "indigency" in sent and "indigency" in allowed:
        _replace_one(
            session,
            IssuanceIndigency,
            issuance.id,
            None if data.indigency is None else data.indigency.model_dump(),
        )
    if "franchise" in sent and "franchise" in allowed:
        existing = session.get(IssuanceFranchise, issuance.id)
        if data.franchise is None:
            _replace_one(session, IssuanceFranchise, issuance.id, None)
        else:
            tricycle = _resolve_tricycle(
                session,
                data.franchise,
                existing.tricycle_id if existing else None,
                issuance.id,
            )
            _replace_one(
                session, IssuanceFranchise, issuance.id, {"tricycle_id": tricycle.id}
            )
    if "marginalized" in sent and "marginalized" in allowed:
        _replace_one(
            session,
            IssuanceMarginalizedSector,
            issuance.id,
            None if data.marginalized is None else data.marginalized.model_dump(),
        )
    if "assistance" in sent and "assistance" in allowed:
        _replace_one(
            session,
            IssuanceAssistance,
            issuance.id,
            None if data.assistance is None else data.assistance.model_dump(),
        )
    if "barangay_id" in sent and "barangay_id" in allowed:
        card = data.barangay_id
        # A card that is still a draft keeps the number the clerk typed, if any.
        _replace_one(
            session,
            IssuanceBarangayId,
            issuance.id,
            None if card is None else card.model_dump(),
        )
    if "jobseeker" in sent and "jobseeker" in allowed:
        job = data.jobseeker
        if (
            job is not None
            and job.witness_official_id is not None
            and session.get(Official, job.witness_official_id) is None
        ):
            raise HTTPException(status_code=422, detail="Unknown witness")
        _replace_one(
            session,
            IssuanceFirstTimeJobseeker,
            issuance.id,
            None if job is None else job.model_dump(),
        )


# --- Reading ------------------------------------------------------------------


def _item_fields(
    issuance: Issuance, doc_code: str, resident: Resident
) -> dict[str, Any]:
    return {
        **issuance.model_dump(
            include={
                "id",
                "reference_no",
                "status",
                "document_type_id",
                "resident_id",
                "issue_date",
                "purpose_id",
                "expires_on",
                "issued_at",
                "corrects_issuance_id",
                "created_at",
            }
        ),
        "document_type_code": doc_code,
        "resident_name": build_full_name(resident),
    }


def _public(
    session: Session, issuance: Issuance, *, reveal_sensitive: bool = False
) -> IssuancePublic:
    """Build the full response. The health condition is masked unless
    ``reveal_sensitive`` is set; only the audited single read sets it."""
    doc_type = session.get(DocumentType, issuance.document_type_id)
    resident = session.get(Resident, issuance.resident_id)
    assert doc_type is not None and resident is not None
    data: dict[str, Any] = {
        **_item_fields(issuance, doc_type.code, resident),
        **issuance.model_dump(
            include={
                "remarks",
                "signatory_official_id",
                "issued_by_user_id",
                "correction_reason",
                "void_reason",
                "updated_at",
            }
        ),
    }
    ident = session.get(IssuanceIdentification, issuance.id)
    if ident:
        data["identification"] = IdentificationPublic.model_validate(ident.model_dump())
    pay = session.get(IssuancePayment, issuance.id)
    if pay:
        data["payment"] = PaymentPublic.model_validate(pay.model_dump())
    data["sectors"] = [
        SectorPublic.model_validate(s.model_dump())
        for s in session.exec(
            select(IssuanceSector)
            .where(IssuanceSector.issuance_id == issuance.id)
            .order_by(col(IssuanceSector.sector_id))
        ).all()
    ]
    util = session.get(IssuanceUtility, issuance.id)
    if util:
        data["utility"] = UtilityPublic.model_validate(util.model_dump())
    indig = session.get(IssuanceIndigency, issuance.id)
    if indig:
        data["indigency"] = IndigencyPublic.model_validate(indig.model_dump())
    fr = session.get(IssuanceFranchise, issuance.id)
    if fr:
        tricycle = session.get(Tricycle, fr.tricycle_id)
        assert tricycle is not None
        data["franchise"] = FranchisePublic.model_validate(
            {**tricycle.model_dump(), "tricycle_id": tricycle.id}
        )
    marg = session.get(IssuanceMarginalizedSector, issuance.id)
    if marg:
        data["marginalized"] = MarginalizedPublic(
            health_condition=marg.health_condition if reveal_sensitive else RESTRICTED
        )
    assist = session.get(IssuanceAssistance, issuance.id)
    if assist:
        data["assistance"] = AssistancePublic.model_validate(assist.model_dump())
    job = session.get(IssuanceFirstTimeJobseeker, issuance.id)
    if job:
        data["jobseeker"] = JobseekerPublic.model_validate(job.model_dump())
    card = session.get(IssuanceBarangayId, issuance.id)
    if card:
        data["barangay_id"] = BarangayIdPublic.model_validate(card.model_dump())
    snap = session.get(IssuanceResidentSnapshot, issuance.id)
    if snap:
        data["snapshot"] = SnapshotPublic.model_validate(snap.model_dump())
    return IssuancePublic.model_validate(data)


# --- Routes -------------------------------------------------------------------


@router.get("/", response_model=IssuancesPublic)
def list_issuances(
    session: SessionDep,
    _user: WriteUser,
    q: Annotated[
        str | None,
        Query(max_length=100, description="Reference number or resident name words"),
    ] = None,
    status: Literal["draft", "issued", "voided", "all"] = "all",
    document_type_id: int | None = None,
    resident_id: uuid.UUID | None = None,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> Any:
    stmt = (
        select(Issuance, DocumentType.code, Resident)
        .join(DocumentType, col(DocumentType.id) == col(Issuance.document_type_id))
        .join(Resident, col(Resident.id) == col(Issuance.resident_id))
    )
    if status != "all":
        stmt = stmt.where(Issuance.status == status)
    if document_type_id is not None:
        stmt = stmt.where(Issuance.document_type_id == document_type_id)
    if resident_id is not None:
        stmt = stmt.where(Issuance.resident_id == resident_id)
    for word in (q or "").split():
        pattern = f"%{word}%"
        stmt = stmt.where(
            col(Issuance.reference_no).ilike(pattern)
            | col(Resident.first_name).ilike(pattern)
            | col(Resident.last_name).ilike(pattern)
            | col(Resident.middle_name).ilike(pattern)
        )
    count = session.exec(select(sa_func.count()).select_from(stmt.subquery())).one()
    rows = session.exec(
        stmt.order_by(col(Issuance.created_at).desc(), col(Issuance.id))
        .offset(skip)
        .limit(limit)
    ).all()
    return IssuancesPublic(
        data=[
            IssuanceListItem.model_validate(_item_fields(i, code, r))
            for i, code, r in rows
        ],
        count=count,
    )


@router.post("/", response_model=IssuancePublic, status_code=201)
def create_issuance(
    body: IssuanceCreate, session: SessionDep, user: WriteUser
) -> IssuancePublic:
    """Create a draft. Detail sections are saved when they are sent complete."""
    doc_type = _doc_type(session, body.document_type_id)
    _require_id_permission(user, doc_type.code)
    _require_active(_resident(session, body.resident_id))
    _check_core_references(
        session, purpose_id=body.purpose_id, official_id=body.signatory_official_id
    )
    remarks = body.remarks
    if remarks is None and doc_type.code == "BARANGAY_CLEARANCE":
        remarks = DEFAULT_CLEARANCE_REMARKS
    issuance = Issuance(
        document_type_id=doc_type.id,  # type: ignore[arg-type]
        resident_id=body.resident_id,
        issue_date=body.issue_date or today_manila(),
        purpose_id=body.purpose_id,
        remarks=remarks,
        signatory_official_id=body.signatory_official_id,
        created_by_user_id=user.id,
    )
    session.add(issuance)
    session.flush()
    _apply_sections(session, issuance, doc_type.code, body)
    session.commit()
    session.refresh(issuance)
    return _public(session, issuance)


@router.get("/{issuance_id}", response_model=IssuancePublic)
def get_issuance(
    issuance_id: uuid.UUID, session: SessionDep, user: WriteUser
) -> IssuancePublic:
    """The only response that carries the health condition (decision 3).

    Every read that returns it adds an ``issuance.view_sensitive`` audit row.
    The row names the field, never the value.
    """
    issuance = _get_or_404(session, issuance_id)
    if session.get(IssuanceMarginalizedSector, issuance.id) is None:
        return _public(session, issuance)
    record_audit_event(
        session,
        action="issuance.view_sensitive",
        actor=user,
        module=MODULE,
        record_type="issuance",
        record_id=issuance.id,
        details={"field": "health_condition"},
        commit=True,
    )
    return _public(session, issuance, reveal_sensitive=True)


@router.patch("/{issuance_id}", response_model=IssuancePublic)
def update_draft(
    issuance_id: uuid.UUID, body: IssuanceUpdate, session: SessionDep, user: WriteUser
) -> IssuancePublic:
    issuance = _get_or_404(session, issuance_id)
    _require_draft(issuance)
    doc_type = session.get(DocumentType, issuance.document_type_id)
    assert doc_type is not None
    _require_id_permission(user, doc_type.code)
    _require_active(_resident(session, issuance.resident_id))
    sent = body.model_fields_set
    if "issue_date" in sent:
        if body.issue_date is None:
            raise HTTPException(status_code=422, detail="issue_date cannot be cleared")
        issuance.issue_date = body.issue_date
    if "purpose_id" in sent or "signatory_official_id" in sent:
        _check_core_references(
            session, purpose_id=body.purpose_id, official_id=body.signatory_official_id
        )
    if "purpose_id" in sent:
        issuance.purpose_id = body.purpose_id
    if "signatory_official_id" in sent:
        issuance.signatory_official_id = body.signatory_official_id
    if "remarks" in sent:
        issuance.remarks = body.remarks
    issuance.updated_at = datetime.now(UTC)
    session.add(issuance)
    session.flush()
    _apply_sections(session, issuance, doc_type.code, body)
    session.commit()
    session.refresh(issuance)
    return _public(session, issuance)


@router.delete("/{issuance_id}", status_code=204)
def discard_draft(
    issuance_id: uuid.UUID, session: SessionDep, user: WriteUser
) -> Response:
    """Discard a draft. Issued and voided documents are never deleted."""
    issuance = _get_or_404(session, issuance_id)
    if issuance.status != "draft":
        raise HTTPException(
            status_code=409, detail="Only a draft can be discarded. Void it instead"
        )
    doc_type = session.get(DocumentType, issuance.document_type_id)
    assert doc_type is not None
    _require_id_permission(user, doc_type.code)
    session.delete(issuance)
    session.commit()
    return Response(status_code=204)


def _missing_sections(session: Session, issuance: Issuance, code: str) -> list[str]:
    present = {
        "identification": session.get(IssuanceIdentification, issuance.id) is not None,
        "payment": session.get(IssuancePayment, issuance.id) is not None,
        "utility": session.get(IssuanceUtility, issuance.id) is not None,
        "indigency": session.get(IssuanceIndigency, issuance.id) is not None,
        "franchise": session.get(IssuanceFranchise, issuance.id) is not None,
        "marginalized": session.get(IssuanceMarginalizedSector, issuance.id)
        is not None,
        "assistance": session.get(IssuanceAssistance, issuance.id) is not None,
        "jobseeker": session.get(IssuanceFirstTimeJobseeker, issuance.id) is not None,
        "barangay_id": session.get(IssuanceBarangayId, issuance.id) is not None,
        "sectors": session.exec(
            select(IssuanceSector.sector_id).where(
                IssuanceSector.issuance_id == issuance.id
            )
        ).first()
        is not None,
    }
    return [s for s in DOCUMENT_RULES[code]["sections"] if not present[s]]


def _resident_field_missing(session: Session, resident: Resident, field: str) -> bool:
    if field == "photo":
        return session.get(ResidentPhoto, resident.id) is None
    if field == "resident_since":
        return (
            resident.resident_since_year is None and not resident.resident_since_birth
        )
    return getattr(resident, field) in (None, "")


def _address_line(session: Session, resident: Resident) -> str | None:
    street = session.get(Street, resident.street_id) if resident.street_id else None
    first = " ".join(
        p for p in (resident.house_number, street.name if street else None) if p
    )
    parts = [first or None, f"Purok {resident.purok}" if resident.purok else None]
    return ", ".join(p for p in parts if p) or None


def _resolve_purpose(session: Session, issuance: Issuance, name: str | None) -> bool:
    """Remember a purpose typed by the clerk; return True if a row was added."""
    if issuance.purpose_id is not None or not name:
        return False
    clean = _norm(name)
    if not clean:
        return False
    existing = session.exec(
        select(IssuancePurpose).where(
            sa_func.lower(col(IssuancePurpose.name)) == clean.lower()
        )
    ).first()
    added = existing is None
    purpose = existing or IssuancePurpose(name=clean)
    if added:
        session.add(purpose)
        session.flush()
    issuance.purpose_id = purpose.id
    return added


def _issued_card_exists(session: Session, resident_id: uuid.UUID) -> bool:
    return (
        session.exec(
            select(Issuance.id)
            .join(
                IssuanceBarangayId,
                col(IssuanceBarangayId.issuance_id) == col(Issuance.id),
            )
            .where(Issuance.resident_id == resident_id, Issuance.status == "issued")
        ).first()
        is not None
    )


def _prepare_id_card(
    session: Session, issuance: Issuance, resident: Resident
) -> IssuanceBarangayId:
    """Check the ID card rules and settle its number. Raises 409 or 422.

    The numbering series is still open (D-43), so the clerk types the number
    for a new card; a renewal or replacement keeps the resident's current
    number unless another is typed. ``valid_until`` is also typed because the
    validity length is open (D-18).
    """
    card = session.get(IssuanceBarangayId, issuance.id)
    assert card is not None
    if card.valid_until <= issuance.issue_date:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "invalid_valid_until",
                "message": "valid_until must be after the issue date",
            },
        )
    # A correction replaces a card that is already in the history; skip the
    # new/renewal check for it.
    if issuance.corrects_issuance_id is None:
        has_card = _issued_card_exists(session, resident.id)
        has_number = resident.id_number is not None
        if card.transaction_type == "new" and (has_card or has_number):
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "id_already_exists",
                    "message": "This resident already has an ID. "
                    "Use renewal or replacement",
                },
            )
        if card.transaction_type != "new" and not (has_card or has_number):
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "no_earlier_id",
                    "message": "This resident has no earlier ID. Use new",
                },
            )
    number = card.id_number or resident.id_number
    if number is None:
        raise HTTPException(status_code=422, detail={"code": "id_number_required"})
    clash = (
        session.exec(
            select(Resident.id).where(
                sa_func.lower(col(Resident.id_number)) == number.lower(),
                Resident.id != resident.id,
            )
        ).first()
        or session.exec(
            select(Issuance.id)
            .join(
                IssuanceBarangayId,
                col(IssuanceBarangayId.issuance_id) == col(Issuance.id),
            )
            .where(
                Issuance.status == "issued",
                Issuance.resident_id != resident.id,
                sa_func.lower(col(IssuanceBarangayId.id_number)) == number.lower(),
            )
        ).first()
    )
    if clash is not None:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "id_number_in_use",
                "message": "This ID number belongs to another resident",
            },
        )
    card.id_number = number
    return card


@router.post("/{issuance_id}/issue", response_model=IssuancePublic)
def issue(
    issuance_id: uuid.UUID,
    session: SessionDep,
    user: WriteUser,
    body: Annotated[IssueRequest | None, Body()] = None,
) -> IssuancePublic:
    """Turn a complete draft into an issued document with a reference number."""
    issuance = session.exec(
        select(Issuance).where(Issuance.id == issuance_id).with_for_update()
    ).first()
    if issuance is None:
        raise HTTPException(status_code=404, detail="Issuance not found")
    _require_draft(issuance)
    doc_type = session.get(DocumentType, issuance.document_type_id)
    assert doc_type is not None
    resident = _resident(session, issuance.resident_id)
    _require_active(resident)

    missing = _missing_sections(session, issuance, doc_type.code)
    if missing:
        raise HTTPException(
            status_code=422, detail={"code": "missing_sections", "sections": missing}
        )
    missing_fields = [
        f
        for f in DOCUMENT_RULES[doc_type.code]["resident_fields"]
        if _resident_field_missing(session, resident, f)
    ]
    if missing_fields:
        raise HTTPException(
            status_code=422,
            detail={"code": "missing_resident_fields", "fields": missing_fields},
        )
    if doc_type.one_per_resident:
        # Lock the resident so two issues for the same person cannot both pass.
        session.exec(
            select(Resident.id).where(Resident.id == resident.id).with_for_update()
        ).first()
        existing = select(Issuance.id).where(
            Issuance.resident_id == issuance.resident_id,
            Issuance.document_type_id == issuance.document_type_id,
            Issuance.status == "issued",
        )
        if issuance.corrects_issuance_id is not None:
            existing = existing.where(Issuance.id != issuance.corrects_issuance_id)
        if session.exec(existing).first() is not None:
            raise HTTPException(
                status_code=409,
                detail="This resident already has this document. "
                "Void it first or correct it",
            )
    payment = session.get(IssuancePayment, issuance.id)
    if payment is not None and not payment.is_free:
        clash = (
            select(Issuance.id)
            .join(IssuancePayment, col(IssuancePayment.issuance_id) == col(Issuance.id))
            .where(
                IssuancePayment.official_receipt_no == payment.official_receipt_no,
                Issuance.status == "issued",
                Issuance.id != issuance.id,
            )
        )
        if issuance.corrects_issuance_id is not None:
            clash = clash.where(Issuance.id != issuance.corrects_issuance_id)
        if session.exec(clash).first() is not None:
            raise HTTPException(
                status_code=409,
                detail="This official receipt number is already used by another document",
            )

    card: IssuanceBarangayId | None = None
    if doc_type.code == "BARANGAY_ID":
        _require_id_permission(user, doc_type.code)
        # Lock the resident so two cards cannot take the same number or
        # both be "new" for one person.
        session.exec(
            select(Resident.id).where(Resident.id == resident.id).with_for_update()
        ).first()
        card = _prepare_id_card(session, issuance, resident)

    purpose_added = _resolve_purpose(
        session, issuance, body.purpose_name if body else None
    )
    sequence_value = session.execute(
        text("SELECT nextval('issuance_reference_seq')")
    ).scalar_one()
    now = datetime.now(UTC)
    issuance.reference_no = f"ISS-{today_manila().year}-{sequence_value:06d}"
    issuance.status = "issued"
    issuance.issued_at = now
    issuance.issued_by_user_id = user.id
    issuance.updated_at = now
    if doc_type.validity_months:
        issuance.expires_on = add_months(issuance.issue_date, doc_type.validity_months)
    if card is not None:
        issuance.expires_on = card.valid_until
        session.add(card)
        resident.id_number = card.id_number
        resident.updated_at = now
        session.add(resident)
    session.add(issuance)
    session.add(
        IssuanceResidentSnapshot(
            issuance_id=issuance.id,
            full_name=build_full_name(resident),
            address_line=_address_line(session, resident),
            birth_date=resident.birthdate,
            birth_place=resident.birth_place,
            sex=resident.sex,
            civil_status=resident.civil_status,
            resident_since_year=resident.resident_since_year,
            resident_since_birth=resident.resident_since_birth,
            emergency_contact_name=resident.emergency_contact_name if card else None,
            emergency_contact_address=(
                resident.emergency_contact_address if card else None
            ),
            emergency_contact_phone=resident.emergency_contact_phone if card else None,
        )
    )
    details: dict[str, Any] = {
        "document_type": doc_type.code,
        "reference_no": issuance.reference_no,
    }
    if card is not None:
        details["id_transaction"] = card.transaction_type
    if purpose_added:
        details["purpose_added"] = True
    if issuance.corrects_issuance_id is not None:
        details["corrects"] = str(issuance.corrects_issuance_id)
    record_audit_event(
        session,
        action="issuance.issue",
        actor=user,
        module=MODULE,
        record_type="issuance",
        record_id=issuance.id,
        details=details,
    )
    try:
        session.commit()
    except IntegrityError as exc:
        # Two clerks took the same ID number at once; the unique index decided.
        session.rollback()
        if card is None:
            raise
        raise HTTPException(
            status_code=409,
            detail={
                "code": "id_number_in_use",
                "message": "This ID number belongs to another resident",
            },
        ) from exc
    session.refresh(issuance)
    return _public(session, issuance)


@router.post("/{issuance_id}/correct", response_model=IssuancePublic, status_code=201)
def correct(
    issuance_id: uuid.UUID, body: ReasonRequest, session: SessionDep, user: WriteUser
) -> IssuancePublic:
    """Start a correction: a new draft copied from an issued document.

    The issued document is not changed. Edit the draft, then issue it. The
    original stays valid until a System Administrator voids it.
    """
    original = _get_or_404(session, issuance_id)
    if original.status != "issued":
        raise HTTPException(
            status_code=409, detail="Only an issued document can be corrected"
        )
    original_type = session.get(DocumentType, original.document_type_id)
    assert original_type is not None
    _require_id_permission(user, original_type.code)
    _require_active(_resident(session, original.resident_id))
    open_draft = session.exec(
        select(Issuance.id).where(
            Issuance.corrects_issuance_id == original.id, Issuance.status == "draft"
        )
    ).first()
    if open_draft is not None:
        raise HTTPException(
            status_code=409,
            detail={"code": "correction_in_progress", "draft_id": str(open_draft)},
        )
    draft = Issuance(
        document_type_id=original.document_type_id,
        resident_id=original.resident_id,
        issue_date=today_manila(),
        purpose_id=original.purpose_id,
        remarks=original.remarks,
        signatory_official_id=original.signatory_official_id,
        corrects_issuance_id=original.id,
        correction_reason=body.reason,
        created_by_user_id=user.id,
    )
    session.add(draft)
    session.flush()
    for model in (
        IssuanceIdentification,
        IssuancePayment,
        IssuanceUtility,
        IssuanceIndigency,
        IssuanceFranchise,
        IssuanceMarginalizedSector,
        IssuanceAssistance,
        IssuanceFirstTimeJobseeker,
        IssuanceBarangayId,
    ):
        row = session.get(model, original.id)
        if row is not None:
            session.add(model(**{**row.model_dump(), "issuance_id": draft.id}))
    for sector in session.exec(
        select(IssuanceSector).where(IssuanceSector.issuance_id == original.id)
    ).all():
        session.add(IssuanceSector(**{**sector.model_dump(), "issuance_id": draft.id}))
    record_audit_event(
        session,
        action="issuance.correct",
        actor=user,
        module=MODULE,
        record_type="issuance",
        record_id=original.id,
        reason=body.reason,
        details={"draft_id": str(draft.id), "reference_no": original.reference_no},
    )
    session.commit()
    session.refresh(draft)
    return _public(session, draft)


@router.post("/{issuance_id}/void", response_model=IssuancePublic)
def void(
    issuance_id: uuid.UUID, body: ReasonRequest, session: SessionDep, user: VoidUser
) -> IssuancePublic:
    issuance = session.exec(
        select(Issuance).where(Issuance.id == issuance_id).with_for_update()
    ).first()
    if issuance is None:
        raise HTTPException(status_code=404, detail="Issuance not found")
    if issuance.status != "issued":
        raise HTTPException(
            status_code=409, detail="Only an issued document can be voided"
        )
    issuance.status = "voided"
    issuance.void_reason = body.reason
    issuance.updated_at = datetime.now(UTC)
    session.add(issuance)
    record_audit_event(
        session,
        action="issuance.void",
        actor=user,
        module=MODULE,
        record_type="issuance",
        record_id=issuance.id,
        reason=body.reason,
        details={"reference_no": issuance.reference_no},
    )
    session.commit()
    session.refresh(issuance)
    return _public(session, issuance)
