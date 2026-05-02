from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modules.auth.schemas import CurrentUserResponse

from . import repository
from .schemas import (
    EmployerContactResponse,
    EmployerContactUpsertRequest,
    EmployerListItemResponse,
    EmployerLocationResponse,
    EmployerLocationUpsertRequest,
    EmployerProfileResponse,
    EmployerUpdateRequest,
)


def _normalize_optional_string(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


def _normalize_payload(payload: dict) -> dict:
    return {
        key: _normalize_optional_string(value) if isinstance(value, str) else value
        for key, value in payload.items()
    }


def _raise_not_found(entity_name: str) -> None:
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"{entity_name} not found",
    )


def _handle_integrity_error(exc: IntegrityError) -> None:
    message = str(exc.orig) if exc.orig else str(exc)
    if "duplicate key value" in message.lower():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=message) from exc
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Database constraint violated: {message}",
    ) from exc


def resolve_current_employer(db: Session, current_user: CurrentUserResponse) -> dict:
    if current_user.profile and current_user.profile.type == "EMPLOYER":
        employer = repository.get_employer_by_id(db, current_user.profile.id)
    else:
        employer = repository.get_employer_by_user_id(db, current_user.id)

    if not employer:
        _raise_not_found("Employer profile")

    return employer


def _build_profile_response(db: Session, employer: dict) -> dict:
    contact = repository.get_employer_contact(db, employer["id"])
    location = repository.get_employer_location(db, employer["id"])
    return EmployerProfileResponse(
        id=employer["id"],
        user_id=employer["user_id"],
        legal_name=employer["legal_name"],
        commercial_name=employer["commercial_name"],
        tax_identifier=employer["tax_identifier"],
        sector_code=employer["sector_code"],
        size_category=employer["size_category"],
        status=employer["status"],
        created_at=employer["created_at"],
        updated_at=employer["updated_at"],
        contact=EmployerContactResponse(**contact) if contact else None,
        location=EmployerLocationResponse(**location) if location else None,
    ).model_dump(mode="json")


def get_my_profile(db: Session, current_user: CurrentUserResponse) -> dict:
    return _build_profile_response(db, resolve_current_employer(db, current_user))


def get_profile_by_id(db: Session, employer_id: str) -> dict:
    employer = repository.get_employer_by_id(db, employer_id)
    if not employer:
        _raise_not_found("Employer profile")
    return _build_profile_response(db, employer)


def update_my_profile(
    db: Session,
    current_user: CurrentUserResponse,
    payload: EmployerUpdateRequest,
) -> dict:
    employer = resolve_current_employer(db, current_user)
    data = _normalize_payload(payload.model_dump())

    try:
        repository.update_employer(db, employer["id"], data)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    return get_profile_by_id(db, employer["id"])


def upsert_contact(
    db: Session,
    current_user: CurrentUserResponse,
    payload: EmployerContactUpsertRequest,
) -> dict:
    employer = resolve_current_employer(db, current_user)
    data = _normalize_payload(payload.model_dump())

    try:
        repository.upsert_employer_contact(db, employer["id"], data)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    return get_profile_by_id(db, employer["id"])


def upsert_location(
    db: Session,
    current_user: CurrentUserResponse,
    payload: EmployerLocationUpsertRequest,
) -> dict:
    employer = resolve_current_employer(db, current_user)
    data = _normalize_payload(payload.model_dump())

    try:
        repository.upsert_employer_location(db, employer["id"], data)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    return get_profile_by_id(db, employer["id"])


def list_employers(db: Session) -> list[dict]:
    return [EmployerListItemResponse(**row).model_dump(mode="json") for row in repository.list_employers(db)]


def employer_counts(db: Session) -> dict:
    return repository.count_employers(db)
