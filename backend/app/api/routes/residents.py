"""Resident records API.

Every route needs a permission (``require_permission``): search, view, add, edit
and photos need RECORDS_EDIT (Staff and System Administrator); archive and
restore need RECORDS_ARCHIVE, and recording, correcting or voiding a death needs
RECORDS_DECEASED (both System Administrator only). Every write adds an audit row
in the same transaction. Audit details hold field names and codes, never personal
values.
"""

import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import and_
from sqlalchemy import func as sa_func
from sqlmodel import Session, col, delete, select

from app.api.deps import SessionDep, require_permission
from app.core.audit import record_audit_event, record_read_event
from app.core.dates import age_on, today_manila
from app.core.duplicates import find_possible_duplicates, lock_person
from app.core.permissions import Permission
from app.core.resident_validation import check_values
from app.core.search import search_words, word_matches
from app.models import User
from app.models_foundation import Sector, Street
from app.models_issuance import ID_EXPIRING_SOON_DAYS, Issuance, IssuanceBarangayId
from app.models_residents import (
    MAX_PHOTO_BYTES,
    ArchiveRequest,
    DeathCorrectRequest,
    DeathRecordRequest,
    DeathVoidRequest,
    Resident,
    ResidentCreate,
    ResidentDeath,
    ResidentDeathPublic,
    ResidentPhoto,
    ResidentPublic,
    ResidentSector,
    ResidentSectorCount,
    ResidentsPublic,
    ResidentUpdate,
    SectorSummary,
    VoterProofRequest,
    build_full_name,
    id_validity_months,
)

router = APIRouter(prefix="/residents", tags=["residents"])

EditUser = Annotated[User, Depends(require_permission(Permission.RECORDS_EDIT))]
ArchiveUser = Annotated[User, Depends(require_permission(Permission.RECORDS_ARCHIVE))]

DeceasedUser = Annotated[User, Depends(require_permission(Permission.RECORDS_DECEASED))]

MODULE = "records"

PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


def _now() -> datetime:
    return datetime.now(UTC)


def _sector_ids(
    session: Session, resident_ids: list[uuid.UUID]
) -> dict[uuid.UUID, list[int]]:
    result: dict[uuid.UUID, list[int]] = {rid: [] for rid in resident_ids}
    if not resident_ids:
        return result
    rows = session.exec(
        select(ResidentSector).where(col(ResidentSector.resident_id).in_(resident_ids))
    ).all()
    for row in rows:
        result[row.resident_id].append(row.sector_id)
    for ids in result.values():
        ids.sort()
    return result


def _photo_ids(session: Session, resident_ids: list[uuid.UUID]) -> set[uuid.UUID]:
    if not resident_ids:
        return set()
    return set(
        session.exec(
            select(ResidentPhoto.resident_id).where(
                col(ResidentPhoto.resident_id).in_(resident_ids)
            )
        ).all()
    )


def _id_valid_untils(
    session: Session, resident_ids: list[uuid.UUID]
) -> dict[uuid.UUID, date]:
    """The ``valid_until`` of each resident's latest issued, unarchived ID."""
    if not resident_ids:
        return {}

    latest = (
        select(col(Issuance.id).label("id"))
        .join(
            IssuanceBarangayId,
            col(IssuanceBarangayId.issuance_id) == col(Issuance.id),
        )
        .where(
            Issuance.status == "issued",
            col(Issuance.archived_at).is_(None),
            col(Issuance.resident_id).in_(resident_ids),
        )
        .distinct(col(Issuance.resident_id))
        .order_by(col(Issuance.resident_id), col(Issuance.issued_at).desc())
        .subquery()
    )
    rows = session.exec(
        select(col(Issuance.resident_id), col(IssuanceBarangayId.valid_until))
        .join(latest, latest.c.id == col(Issuance.id))
        .join(
            IssuanceBarangayId,
            col(IssuanceBarangayId.issuance_id) == col(Issuance.id),
        )
    ).all()
    return dict(rows)


def _id_status_of(
    valid_until: date | None,
) -> Literal["none", "valid", "expiring_soon", "expired"]:
    if valid_until is None:
        return "none"
    today = today_manila()
    if valid_until < today:
        return "expired"
    if valid_until <= today + timedelta(days=ID_EXPIRING_SOON_DAYS):
        return "expiring_soon"
    return "valid"


def _current_deaths(
    session: Session, resident_ids: list[uuid.UUID]
) -> dict[uuid.UUID, ResidentDeath]:
    """The death record in force (not voided) of each deceased resident."""
    if not resident_ids:
        return {}
    rows = session.exec(
        select(ResidentDeath).where(
            col(ResidentDeath.resident_id).in_(resident_ids),
            col(ResidentDeath.voided_at).is_(None),
        )
    ).all()
    return {row.resident_id: row for row in rows}


def _death_public(
    resident: Resident, death: ResidentDeath | None, names: dict[uuid.UUID, str]
) -> ResidentDeathPublic | None:
    if death is None:
        return None
    age = (
        age_on(resident.birthdate, death.date_of_death)
        if death.date_precision == "day"
        else None
    )
    return ResidentDeathPublic.model_validate(
        {
            **death.model_dump(),
            "age_at_death": age,
            "recorded_by_name": names.get(death.recorded_by_user_id),  # type: ignore[arg-type]
        }
    )


def _verifier_names(
    session: Session,
    residents: list[Resident],
    deaths: dict[uuid.UUID, ResidentDeath],
) -> dict[uuid.UUID, str]:
    """Full name (else e-mail) of the accounts that recorded a voter proof,
    archived a resident or recorded a death, keyed by user id."""
    user_ids: set[uuid.UUID] = {
        d.recorded_by_user_id
        for d in deaths.values()
        if d.recorded_by_user_id is not None
    }
    for r in residents:
        if r.voter_proof_verified_by_user_id is not None:
            user_ids.add(r.voter_proof_verified_by_user_id)
        if r.archived_by_user_id is not None:
            user_ids.add(r.archived_by_user_id)
    if not user_ids:
        return {}
    users = session.exec(select(User).where(col(User.id).in_(user_ids))).all()
    return {u.id: (u.full_name or u.email) for u in users}


def _to_public(
    resident: Resident,
    sectors: list[int],
    has_photo: bool,
    id_valid_until: date | None,
    verifier_name: str | None = None,
    archiver_name: str | None = None,
    death: ResidentDeathPublic | None = None,
) -> ResidentPublic:
    data = resident.model_dump()
    return ResidentPublic.model_validate(
        {
            **data,
            "full_name": build_full_name(resident),
            # Someone who has died stops ageing: the age at death, if known.
            "age": death.age_at_death
            if resident.status == "deceased" and death
            else age_on(resident.birthdate),
            "death": death,
            "sector_ids": sectors,
            "has_photo": has_photo,
            # A deceased resident's card no longer counts as valid or expiring.
            "id_status": "none"
            if resident.status == "deceased"
            else _id_status_of(id_valid_until),
            "id_valid_until": None if resident.status == "deceased" else id_valid_until,
            "id_validity_months": id_validity_months(
                resident.residency_type, resident.voter_proof_verified_at
            ),
            "voter_proof_verified_by_name": verifier_name,
            "archived_by_name": archiver_name,
        }
    )


def _public(session: Session, resident: Resident) -> ResidentPublic:
    deaths = _current_deaths(session, [resident.id])
    names = _verifier_names(session, [resident], deaths)
    return _to_public(
        resident,
        _sector_ids(session, [resident.id])[resident.id],
        resident.id in _photo_ids(session, [resident.id]),
        _id_valid_untils(session, [resident.id]).get(resident.id),
        names.get(resident.voter_proof_verified_by_user_id),  # type: ignore[arg-type]
        names.get(resident.archived_by_user_id),  # type: ignore[arg-type]
        _death_public(resident, deaths.get(resident.id), names),
    )


def _get_or_404(session: Session, resident_id: uuid.UUID) -> Resident:
    resident = session.get(Resident, resident_id)
    if resident is None:
        raise HTTPException(status_code=404, detail="Resident not found")
    return resident


def _locked_or_404(session: Session, resident_id: uuid.UUID) -> Resident:
    """Lock the resident row, so a change of status cannot slip in between the
    check and the write."""
    resident = session.exec(
        select(Resident).where(Resident.id == resident_id).with_for_update()
    ).first()
    if resident is None:
        raise HTTPException(status_code=404, detail="Resident not found")
    return resident


def _refuse_frozen(resident: Resident) -> None:
    """Archived and deceased records are read only."""
    if resident.status == "archived":
        raise HTTPException(
            status_code=409, detail="Archived residents cannot be edited; restore first"
        )
    if resident.status == "deceased":
        raise HTTPException(
            status_code=409, detail="Deceased residents cannot be edited"
        )


def _check_references(
    session: Session, *, street_id: int | None, sector_ids: list[int] | None
) -> list[int] | None:
    if street_id is not None and session.get(Street, street_id) is None:
        raise HTTPException(status_code=422, detail="Unknown street")
    if sector_ids is None:
        return None
    unique = sorted(set(sector_ids))
    if unique:
        found = session.exec(select(Sector.id).where(col(Sector.id).in_(unique))).all()
        if len(found) != len(unique):
            raise HTTPException(status_code=422, detail="Unknown sector")
    return unique


def _check_id_number_free(
    session: Session, id_number: str | None, *, except_id: uuid.UUID | None = None
) -> None:
    if id_number is None:
        return
    stmt = select(Resident.id).where(Resident.id_number == id_number)
    if except_id is not None:
        stmt = stmt.where(Resident.id != except_id)
    if session.exec(stmt).first() is not None:
        raise HTTPException(
            status_code=409, detail="This ID number is already assigned to a resident"
        )


def _set_sectors(
    session: Session, resident_id: uuid.UUID, sector_ids: list[int]
) -> None:
    session.exec(
        delete(ResidentSector).where(col(ResidentSector.resident_id) == resident_id)
    )
    for sector_id in sector_ids:
        session.add(ResidentSector(resident_id=resident_id, sector_id=sector_id))


ResidentSort = Literal[
    "name",
    "address",
    "birthdate",
    "sex",
    "civil_status",
    "occupation",
    "archived_at",
    "archived_by",
    "archive_reason",
    "death_date",
    "death_evidence",
    "death_recorded_by",
]


def _sorted_residents(stmt: Any, sort_by: ResidentSort | None, sort_dir: str) -> Any:
    """Order a resident query by a heading the person clicked (315).

    Empty values go last either way. Ties, and the default order, are
    last name, first name, then id, so a page never reshuffles between clicks.
    """
    keys: list[Any] = []
    if sort_by == "name":
        keys = [sa_func.lower(Resident.last_name), sa_func.lower(Resident.first_name)]
    elif sort_by == "address":
        stmt = stmt.join(
            Street, col(Resident.street_id) == col(Street.id), isouter=True
        )
        keys = [
            sa_func.lower(Street.name),
            col(Resident.house_number),
            col(Resident.purok),
        ]
    elif sort_by == "archived_by":
        stmt = stmt.join(
            User, col(Resident.archived_by_user_id) == col(User.id), isouter=True
        )
        keys = [sa_func.lower(sa_func.coalesce(User.full_name, User.email))]
    elif sort_by in ("death_date", "death_evidence", "death_recorded_by"):
        # The death record in force: at most one per resident (partial unique
        # index), so the join never repeats a resident.
        stmt = stmt.join(
            ResidentDeath,
            and_(
                col(ResidentDeath.resident_id) == col(Resident.id),
                col(ResidentDeath.voided_at).is_(None),
            ),
            isouter=True,
        )
        if sort_by == "death_date":
            # An unknown date is empty, so it comes last either way.
            keys = [col(ResidentDeath.date_of_death)]
        elif sort_by == "death_evidence":
            keys = [col(ResidentDeath.evidence)]
        else:
            stmt = stmt.join(
                User,
                col(ResidentDeath.recorded_by_user_id) == col(User.id),
                isouter=True,
            )
            keys = [sa_func.lower(sa_func.coalesce(User.full_name, User.email))]
    elif sort_by:
        keys = [col(getattr(Resident, sort_by))]
    ordering = [
        key.desc().nulls_last() if sort_dir == "desc" else key.asc().nulls_last()
        for key in keys
    ]
    return stmt.order_by(
        *ordering,
        sa_func.lower(Resident.last_name),
        sa_func.lower(Resident.first_name),
        col(Resident.id),
    )


@router.get("/", response_model=ResidentsPublic)
def list_residents(
    session: SessionDep,
    user: EditUser,
    q: Annotated[str | None, Query(max_length=100, description="Name search")] = None,
    status: Literal["active", "archived", "deceased", "all"] = "active",
    sector_id: int | None = None,
    sort_by: Annotated[
        ResidentSort | None,
        Query(description="Sort the whole result by this column (default: by name)"),
    ] = None,
    sort_dir: Literal["asc", "desc"] = "asc",
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> Any:
    """Search residents. Every word typed must match the first, middle or last name.

    Case, accents, commas and spaces are ignored (``Pena``, ``Delacruz`` and
    ``Dela Cruz, Juan`` all work), see ``app.core.search``.

    Browsing the list without a name search is a bulk read of personal data and
    adds a ``resident.list`` audit row (once per 10 minutes per person).
    """
    stmt = select(Resident)
    if status != "all":
        stmt = stmt.where(Resident.status == status)
    if sector_id is not None:
        stmt = stmt.where(
            col(Resident.id).in_(
                select(ResidentSector.resident_id).where(
                    ResidentSector.sector_id == sector_id
                )
            )
        )
    for word in search_words(q):
        stmt = stmt.where(
            word_matches(
                word,
                [Resident.first_name, Resident.last_name, Resident.middle_name],
                [Resident.id_number, Resident.house_number],
            )
            | col(Resident.street_id).in_(
                select(Street.id).where(word_matches(word, [], [Street.name]))
            )
        )
    count = session.exec(select(sa_func.count()).select_from(stmt.subquery())).one()
    stmt = _sorted_residents(stmt, sort_by, sort_dir)
    rows: list[Resident] = list(session.exec(stmt.offset(skip).limit(limit)).all())
    ids = [r.id for r in rows]
    sectors = _sector_ids(session, ids)
    photos = _photo_ids(session, ids)
    valid_untils = _id_valid_untils(session, ids)
    deaths = _current_deaths(session, ids)
    verifiers = _verifier_names(session, list(rows), deaths)
    if not search_words(q) and rows:
        record_read_event(
            session,
            action="resident.list",
            actor=user,
            module=MODULE,
            record_type="resident",
            details={"status": status, "count": count},
        )
    return ResidentsPublic(
        data=[
            _to_public(
                r,
                sectors[r.id],
                r.id in photos,
                valid_untils.get(r.id),
                verifiers.get(r.voter_proof_verified_by_user_id),  # type: ignore[arg-type]
                verifiers.get(r.archived_by_user_id),  # type: ignore[arg-type]
                _death_public(r, deaths.get(r.id), verifiers),
            )
            for r in rows
        ],
        count=count,
    )


@router.get("/sector-summary", response_model=SectorSummary)
def sector_summary(session: SessionDep, _user: EditUser) -> Any:
    """Every sector with its number of active residents (zero is listed too).

    ``residents_with_sector`` counts each active resident once, however many
    sectors they belong to, so it is not the sum of the rows.
    """
    rows = session.exec(
        select(col(Sector.id), col(Sector.name), sa_func.count(col(Resident.id)))
        .select_from(Sector)
        .outerjoin(ResidentSector, col(ResidentSector.sector_id) == col(Sector.id))
        .outerjoin(
            Resident,
            (col(Resident.id) == col(ResidentSector.resident_id))
            & (col(Resident.status) == "active"),
        )
        .group_by(col(Sector.id), col(Sector.name))
    ).all()
    data = sorted(
        (
            ResidentSectorCount(sector_id=sid, name=name, active_residents=n)
            for sid, name, n in rows
            if sid is not None  # a primary key is never empty; narrows the type
        ),
        key=lambda item: item.name.casefold(),
    )
    distinct = session.exec(
        select(sa_func.count(sa_func.distinct(ResidentSector.resident_id)))
        .select_from(ResidentSector)
        .join(Resident, col(Resident.id) == col(ResidentSector.resident_id))
        .where(col(Resident.status) == "active")
    ).one()
    return SectorSummary(data=data, residents_with_sector=distinct)


@router.get("/{resident_id}", response_model=ResidentPublic)
def read_resident(resident_id: uuid.UUID, session: SessionDep, user: EditUser) -> Any:
    """One resident's full profile. Adds a ``resident.view`` audit row (once per
    10 minutes per person and resident); the row holds no personal values."""
    resident = _get_or_404(session, resident_id)
    record_read_event(
        session,
        action="resident.view",
        actor=user,
        module=MODULE,
        record_type="resident",
        record_id=resident.id,
    )
    return _public(session, resident)


def _refuse_bad_values(
    values: dict[str, Any], current: dict[str, Any] | None = None
) -> None:
    problem = check_values(values, current=current)
    if problem:
        raise HTTPException(status_code=422, detail=problem)


def _refuse_possible_duplicates(
    session: Session,
    *,
    first_name: str,
    middle_name: str | None,
    last_name: str,
    suffix: str | None,
    birthdate: date | None,
    except_id: uuid.UUID | None = None,
) -> None:
    """409 ``possible_duplicate`` naming who matched; the clerk may confirm."""
    matches = find_possible_duplicates(
        session,
        first_name=first_name,
        middle_name=middle_name,
        last_name=last_name,
        suffix=suffix,
        birthdate=birthdate,
        except_id=except_id,
    )
    if not matches:
        return
    raise HTTPException(
        status_code=409,
        detail={
            "code": "possible_duplicate",
            "message": "A resident with the same name and birthdate exists.",
            "resident_ids": [str(m.id) for m in matches],
            "matches": [
                {
                    "id": str(m.id),
                    "full_name": build_full_name(m),
                    "birthdate": m.birthdate.isoformat() if m.birthdate else None,
                    "status": m.status,
                }
                for m in matches
            ],
        },
    )


@router.post("/", response_model=ResidentPublic, status_code=201)
def create_resident(
    *,
    session: SessionDep,
    user: EditUser,
    body: ResidentCreate,
    confirm_duplicate: Annotated[
        bool, Query(description="Set true after the clerk confirms a namesake")
    ] = False,
) -> Any:
    """Add a resident. Same names and birthdate as an existing record are warned
    about (409, code ``possible_duplicate``), not blocked: the clerk can confirm."""
    _refuse_bad_values(body.model_dump())
    sector_ids = _check_references(
        session, street_id=body.street_id, sector_ids=body.sector_ids
    )
    _check_id_number_free(session, body.id_number)
    # Two clerks adding the same person at once must see each other, so the
    # check and the insert run under one lock on the person (released at commit).
    lock_person(session, body.first_name, body.last_name, body.birthdate)
    if not confirm_duplicate:
        _refuse_possible_duplicates(
            session,
            first_name=body.first_name,
            middle_name=body.middle_name,
            last_name=body.last_name,
            suffix=body.suffix,
            birthdate=body.birthdate,
        )
    now = _now()
    resident = Resident.model_validate(
        body.model_dump(exclude={"sector_ids"}),
        update={
            "created_at": now,
            "updated_at": now,
            "created_by_user_id": user.id,
            "updated_by_user_id": user.id,
        },
    )
    session.add(resident)
    session.flush()
    _set_sectors(session, resident.id, sector_ids or [])
    record_audit_event(
        session,
        action="resident.create",
        actor=user,
        module="records",
        record_type="resident",
        record_id=resident.id,
    )
    session.commit()
    session.refresh(resident)
    return _public(session, resident)


@router.patch("/{resident_id}", response_model=ResidentPublic)
def update_resident(
    *,
    resident_id: uuid.UUID,
    session: SessionDep,
    user: EditUser,
    body: ResidentUpdate,
    confirm_duplicate: Annotated[
        bool, Query(description="Set true after the clerk confirms a namesake")
    ] = False,
) -> Any:
    resident = _locked_or_404(session, resident_id)
    _refuse_frozen(resident)
    changes = body.model_dump(exclude_unset=True)
    for required in ("first_name", "last_name"):
        if required in changes and changes[required] is None:
            raise HTTPException(status_code=422, detail=f"{required} cannot be empty")
    if changes.get("resident_since_birth") is None:
        changes.pop("resident_since_birth", None)
    # Only values that differ from the stored ones are checked (old records stay editable).
    _refuse_bad_values(
        {
            "birthdate": resident.birthdate,
            **changes,
        },
        current={key: getattr(resident, key, None) for key in changes},
    )
    sector_ids = _check_references(
        session,
        street_id=changes.get("street_id"),
        sector_ids=changes.pop("sector_ids", None),
    )
    if "id_number" in changes:
        value = (changes["id_number"] or "").strip() or None
        changes["id_number"] = value
        _check_id_number_free(session, value, except_id=resident.id)
    for key in (
        "middle_name",
        "birth_place",
        "occupation",
        "house_number",
        "resident_type",
        "emergency_contact_name",
        "emergency_contact_address",
        "emergency_contact_phone",
    ):
        if key in changes and isinstance(changes[key], str):
            changes[key] = changes[key].strip() or None
    new_year = changes.get("resident_since_year", resident.resident_since_year)
    new_birth = changes.get("resident_since_birth", resident.resident_since_birth)
    if new_year is not None and new_birth:
        raise HTTPException(
            status_code=422,
            detail="resident_since_year and resident_since_birth cannot both be set",
        )
    # The form sends every field, so only log the ones whose value really changed.
    changed_fields = [
        key for key, value in changes.items() if getattr(resident, key, None) != value
    ]
    if sector_ids is not None:
        current_sector_ids = set(
            session.exec(
                select(ResidentSector.sector_id).where(
                    col(ResidentSector.resident_id) == resident.id
                )
            ).all()
        )
        if current_sector_ids != set(sector_ids):
            changed_fields.append("sector_ids")
    identity_fields = {"first_name", "middle_name", "last_name", "suffix", "birthdate"}
    if identity_fields & set(changed_fields):
        # Renaming someone into an existing person is a duplicate too.
        def _after(key: str) -> Any:
            return changes[key] if key in changes else getattr(resident, key)

        lock_person(
            session, _after("first_name"), _after("last_name"), _after("birthdate")
        )
        if not confirm_duplicate:
            _refuse_possible_duplicates(
                session,
                first_name=_after("first_name"),
                middle_name=_after("middle_name"),
                last_name=_after("last_name"),
                suffix=_after("suffix"),
                birthdate=_after("birthdate"),
                except_id=resident.id,
            )
    if not changed_fields:
        # Saved with nothing changed: no new timestamp and no Activity Log row.
        return _public(session, resident)
    for key, value in changes.items():
        setattr(resident, key, value)
    resident.updated_at = _now()
    resident.updated_by_user_id = user.id
    if sector_ids is not None:
        _set_sectors(session, resident.id, sector_ids)
    session.add(resident)
    record_audit_event(
        session,
        action="resident.update",
        actor=user,
        module="records",
        record_type="resident",
        record_id=resident.id,
        details={"fields": sorted(changed_fields)},
    )
    session.commit()
    session.refresh(resident)
    return _public(session, resident)


def _proof_resident(session: Session, resident_id: uuid.UUID) -> Resident:
    """Lock the resident row and refuse read-only ones."""
    resident = _locked_or_404(session, resident_id)
    _refuse_frozen(resident)
    return resident


@router.post("/{resident_id}/voter-proof", response_model=ResidentPublic)
def verify_voter_proof(
    *,
    resident_id: uuid.UUID,
    session: SessionDep,
    user: EditUser,
    body: VoterProofRequest,
) -> Any:
    """Record that proof of voter registration was seen (new or renting only).

    It changes the DEFAULT validity of the next Barangay ID only; an ID that is
    already issued is never touched.
    """
    resident = _proof_resident(session, resident_id)
    if resident.residency_type not in ("new", "renting"):
        raise HTTPException(
            status_code=409,
            detail={
                "code": "not_new_or_renting",
                "message": "Only a new or renting resident needs proof of "
                "voter registration",
            },
        )
    if resident.voter_proof_verified_at is not None:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "already_verified",
                "message": "Proof is already recorded; clear it first to change it",
            },
        )
    verified_on = body.verified_on or today_manila()
    if verified_on > today_manila():
        raise HTTPException(
            status_code=422,
            detail={
                "code": "verified_on_future",
                "message": "The verification date cannot be in the future",
            },
        )
    resident.voter_proof_verified_at = verified_on
    resident.voter_proof_verified_by_user_id = user.id
    resident.updated_at = _now()
    resident.updated_by_user_id = user.id
    session.add(resident)
    record_audit_event(
        session,
        action="resident.voter_proof_verify",
        actor=user,
        module=MODULE,
        record_type="resident",
        record_id=resident.id,
        details={"verified_on": verified_on.isoformat()},
    )
    session.commit()
    session.refresh(resident)
    return _public(session, resident)


@router.post("/{resident_id}/voter-proof/clear", response_model=ResidentPublic)
def clear_voter_proof(
    resident_id: uuid.UUID, session: SessionDep, user: EditUser
) -> Any:
    """Undo a recorded verification (for example a wrong date)."""
    resident = _proof_resident(session, resident_id)
    previous = resident.voter_proof_verified_at
    if previous is None:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "not_verified",
                "message": "No voter-registration proof is recorded",
            },
        )
    resident.voter_proof_verified_at = None
    resident.voter_proof_verified_by_user_id = None
    resident.updated_at = _now()
    resident.updated_by_user_id = user.id
    session.add(resident)
    record_audit_event(
        session,
        action="resident.voter_proof_clear",
        actor=user,
        module=MODULE,
        record_type="resident",
        record_id=resident.id,
        details={"previous_verified_on": previous.isoformat()},
    )
    session.commit()
    session.refresh(resident)
    return _public(session, resident)


@router.post("/{resident_id}/archive", response_model=ResidentPublic)
def archive_resident(
    resident_id: uuid.UUID, body: ArchiveRequest, session: SessionDep, user: ArchiveUser
) -> Any:
    resident = _locked_or_404(session, resident_id)
    if resident.status == "archived":
        raise HTTPException(status_code=409, detail="Resident is already archived")
    if resident.status == "deceased":
        raise HTTPException(
            status_code=409, detail="A deceased resident cannot be archived"
        )
    now = _now()
    resident.status = "archived"
    resident.archive_reason = body.reason
    resident.archived_at = now
    resident.archived_by_user_id = user.id
    resident.updated_at = now
    resident.updated_by_user_id = user.id
    session.add(resident)
    record_audit_event(
        session,
        action="resident.archive",
        actor=user,
        module="records",
        record_type="resident",
        record_id=resident.id,
        reason=body.reason,
    )
    session.commit()
    session.refresh(resident)
    return _public(session, resident)


@router.post("/{resident_id}/restore", response_model=ResidentPublic)
def restore_resident(
    resident_id: uuid.UUID, session: SessionDep, user: ArchiveUser
) -> Any:
    resident = _locked_or_404(session, resident_id)
    if resident.status != "archived":
        raise HTTPException(status_code=409, detail="Resident is not archived")
    resident.status = "active"
    resident.archive_reason = None
    resident.archived_at = None
    resident.archived_by_user_id = None
    resident.updated_at = _now()
    resident.updated_by_user_id = user.id
    session.add(resident)
    record_audit_event(
        session,
        action="resident.restore",
        actor=user,
        module="records",
        record_type="resident",
        record_id=resident.id,
    )
    session.commit()
    session.refresh(resident)
    return _public(session, resident)


# --- Death records (patch 327) ----------------------------------------------


def _refuse_death_before_birth(resident: Resident, body: DeathRecordRequest) -> None:
    """Compare only as far as the date of death is known."""
    born, died = resident.birthdate, body.date_of_death
    if born is None or died is None:
        return
    if body.date_precision == "month":
        born = born.replace(day=1)
    elif body.date_precision == "year":
        born = born.replace(month=1, day=1)
    if died < born:
        raise HTTPException(
            status_code=422, detail="The date of death is before the birthdate"
        )


def _deceased_with_record(
    session: Session, resident_id: uuid.UUID
) -> tuple[Resident, ResidentDeath]:
    resident = _locked_or_404(session, resident_id)
    death = _current_deaths(session, [resident.id]).get(resident.id)
    if resident.status != "deceased" or death is None:
        raise HTTPException(
            status_code=409, detail="Resident is not recorded as deceased"
        )
    return resident, death


def _new_death(
    resident: Resident, body: DeathRecordRequest, user: User, now: datetime
) -> ResidentDeath:
    return ResidentDeath(
        resident_id=resident.id,
        date_of_death=body.date_of_death,
        date_precision=body.date_precision,
        evidence=body.evidence,
        source_note=body.source_note,
        recorded_at=now,
        recorded_by_user_id=user.id,
    )


def _void_death_row(
    death: ResidentDeath, reason: str, user: User, now: datetime
) -> None:
    death.voided_at = now
    death.voided_by_user_id = user.id
    death.void_reason = reason


@router.post("/{resident_id}/deceased", response_model=ResidentPublic)
def record_death(
    resident_id: uuid.UUID,
    body: DeathRecordRequest,
    session: SessionDep,
    user: DeceasedUser,
) -> Any:
    """Record that an active resident has died. They leave the population counts
    and expiry lists, cannot be edited or archived, and get no new documents.
    Documents already issued are not changed."""
    resident = _locked_or_404(session, resident_id)
    if resident.status == "deceased":
        raise HTTPException(
            status_code=409, detail="Resident is already recorded as deceased"
        )
    if resident.status == "archived":
        raise HTTPException(
            status_code=409,
            detail="Restore the archived resident before recording a death",
        )
    _refuse_death_before_birth(resident, body)
    now = _now()
    resident.status = "deceased"
    resident.updated_at = now
    resident.updated_by_user_id = user.id
    session.add(resident)
    session.add(_new_death(resident, body, user, now))
    record_audit_event(
        session,
        action="resident.death_record",
        actor=user,
        module=MODULE,
        record_type="resident",
        record_id=resident.id,
        details={"evidence": body.evidence, "date_precision": body.date_precision},
    )
    session.commit()
    session.refresh(resident)
    return _public(session, resident)


@router.put("/{resident_id}/deceased", response_model=ResidentPublic)
def correct_death(
    resident_id: uuid.UUID,
    body: DeathCorrectRequest,
    session: SessionDep,
    user: DeceasedUser,
) -> Any:
    """Replace the death record, for example when the certificate arrives
    (reported to verified) or a date was wrong. The old row is voided and kept."""
    resident, old = _deceased_with_record(session, resident_id)
    _refuse_death_before_birth(resident, body)
    changed = [
        field
        for field in ("date_of_death", "date_precision", "evidence", "source_note")
        if getattr(old, field) != getattr(body, field)
    ]
    if not changed:
        # Saved with nothing changed: no new row and no Activity Log row.
        return _public(session, resident)
    now = _now()
    _void_death_row(old, body.reason, user, now)
    session.add(old)
    # Only one row per resident may be in force: write the voided one first.
    session.flush()
    session.add(_new_death(resident, body, user, now))
    resident.updated_at = now
    resident.updated_by_user_id = user.id
    session.add(resident)
    record_audit_event(
        session,
        action="resident.death_correct",
        actor=user,
        module=MODULE,
        record_type="resident",
        record_id=resident.id,
        reason=body.reason,
        details={
            "fields": sorted(changed),
            "evidence": body.evidence,
            "date_precision": body.date_precision,
        },
    )
    session.commit()
    session.refresh(resident)
    return _public(session, resident)


@router.post("/{resident_id}/deceased/void", response_model=ResidentPublic)
def void_death(
    resident_id: uuid.UUID,
    body: DeathVoidRequest,
    session: SessionDep,
    user: DeceasedUser,
) -> Any:
    """The death was recorded by mistake (for example a namesake): the resident
    becomes active again. The voided record is kept."""
    resident, death = _deceased_with_record(session, resident_id)
    now = _now()
    _void_death_row(death, body.reason, user, now)
    session.add(death)
    resident.status = "active"
    resident.updated_at = now
    resident.updated_by_user_id = user.id
    session.add(resident)
    record_audit_event(
        session,
        action="resident.death_void",
        actor=user,
        module=MODULE,
        record_type="resident",
        record_id=resident.id,
        reason=body.reason,
    )
    session.commit()
    session.refresh(resident)
    return _public(session, resident)


# --- Photo -------------------------------------------------------------------


def _detect_photo_type(data: bytes) -> str | None:
    """Type from the file's first bytes, never from its name or header."""
    if data.startswith(PNG_MAGIC):
        return "image/png"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


@router.put("/{resident_id}/photo", response_model=ResidentPublic)
async def put_photo(
    resident_id: uuid.UUID, request: Request, session: SessionDep, user: EditUser
) -> Any:
    """Store the processed photo. Send the raw PNG or WebP bytes as the body."""
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > MAX_PHOTO_BYTES:
        raise HTTPException(status_code=413, detail="Photo is larger than 300 KB")
    data = await request.body()
    if len(data) > MAX_PHOTO_BYTES:
        raise HTTPException(status_code=413, detail="Photo is larger than 300 KB")
    content_type = _detect_photo_type(data)
    if content_type is None:
        raise HTTPException(status_code=415, detail="Photo must be a PNG or WebP image")
    # The database work may wait for a row lock, so it must not run on the event loop.
    return await run_in_threadpool(
        _store_photo, session, user, resident_id, data, content_type
    )


def _store_photo(
    session: Session,
    user: User,
    resident_id: uuid.UUID,
    data: bytes,
    content_type: str,
) -> ResidentPublic:
    resident = _locked_or_404(session, resident_id)
    _refuse_frozen(resident)
    now = _now()
    photo = session.get(ResidentPhoto, resident_id)
    if photo is None:
        photo = ResidentPhoto(
            resident_id=resident_id,
            content=data,
            content_type=content_type,
            byte_size=len(data),
            updated_at=now,
            updated_by_user_id=user.id,
        )
    else:
        photo.content = data
        photo.content_type = content_type
        photo.byte_size = len(data)
        photo.updated_at = now
        photo.updated_by_user_id = user.id
    session.add(photo)
    resident.updated_at = now
    resident.updated_by_user_id = user.id
    session.add(resident)
    record_audit_event(
        session,
        action="resident.photo_set",
        actor=user,
        module="records",
        record_type="resident",
        record_id=resident_id,
    )
    session.commit()
    session.refresh(resident)
    return _public(session, resident)


@router.get("/{resident_id}/photo")
def get_photo(resident_id: uuid.UUID, session: SessionDep, _user: EditUser) -> Response:
    photo = session.get(ResidentPhoto, resident_id)
    if photo is None:
        raise HTTPException(status_code=404, detail="No photo for this resident")
    if not photo.content:
        raise HTTPException(
            status_code=409,
            detail="The photo cannot be read with the key on this computer",
        )
    return Response(
        content=photo.content,
        media_type=photo.content_type,
        headers={"Cache-Control": "private, no-store"},
    )


@router.delete("/{resident_id}/photo", response_model=ResidentPublic)
def delete_photo(resident_id: uuid.UUID, session: SessionDep, user: EditUser) -> Any:
    resident = _locked_or_404(session, resident_id)
    _refuse_frozen(resident)
    photo = session.get(ResidentPhoto, resident_id)
    if photo is None:
        raise HTTPException(status_code=404, detail="No photo for this resident")
    session.delete(photo)
    resident.updated_at = _now()
    resident.updated_by_user_id = user.id
    session.add(resident)
    record_audit_event(
        session,
        action="resident.photo_remove",
        actor=user,
        module="records",
        record_type="resident",
        record_id=resident_id,
    )
    session.commit()
    session.refresh(resident)
    return _public(session, resident)
