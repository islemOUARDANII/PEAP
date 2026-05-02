from uuid import uuid4

from app.clients.parsing_client import parse_offer
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modules.auth.schemas import CurrentUserResponse
from app.modules.employers.service import resolve_current_employer

from . import repository
from .schemas import (
    JobOfferCreateRequest,
    JobOfferDraftParseRequest,
    JobOfferDraftParseResponse,
    JobOfferDraftRequirementResponse,
    JobOfferListItemResponse,
    JobOfferRequirementResponse,
    JobOfferResponse,
    JobOfferUpdateRequest,
    OfferActionRequest,
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
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{entity_name} not found")


def _derive_offer_title(raw_text: str) -> str:
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    if lines:
        candidate = lines[0]
    else:
        candidate = raw_text.strip()

    sentence = candidate.split(".")[0].strip()
    title = sentence or candidate or "Draft offer"
    return title[:160]


def _handle_integrity_error(exc: IntegrityError) -> None:
    message = str(exc.orig) if exc.orig else str(exc)
    if "duplicate key value" in message.lower():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=message) from exc
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Database constraint violated: {message}",
    ) from exc


def _build_offer_response(
    db: Session,
    offer: dict,
    *,
    warning: str | None = None,
    action_reason: str | None = None,
) -> dict:
    requirements = repository.list_offer_requirements(db, offer["id"])
    return JobOfferResponse(
        **offer,
        requirements=[JobOfferRequirementResponse(**row) for row in requirements],
        warning=warning,
        action_reason=action_reason,
    ).model_dump(mode="json")


def parse_offer_draft(
    db: Session,
    current_user: CurrentUserResponse,
    payload: JobOfferDraftParseRequest,
) -> dict:
    resolve_current_employer(db, current_user)

    raw_text = payload.raw_text.strip()
    title = _normalize_optional_string(payload.title) or _derive_offer_title(raw_text)

    parsed = parse_offer(
        {
            "offer_id": str(uuid4()),
            "title": title,
            "description": raw_text,
            "trace_id": str(uuid4()),
        }
    )

    parsed_offer = (parsed.get("parsed_payload") or {}).get("offer") or {}
    requirements = [
        JobOfferDraftRequirementResponse(
            criterion_type=row.get("criterion_type"),
            node_id=row.get("node_id"),
            raw_value=row.get("raw_value"),
            min_level=row.get("min_level"),
            min_years=row.get("min_years"),
            is_must=bool(row.get("is_must")),
            weight=row.get("weight"),
        )
        for row in (parsed.get("extracted_requirements") or [])
    ]

    response = JobOfferDraftParseResponse(
        parsing_status=parsed.get("parsing_status", "FAILED"),
        title=parsed_offer.get("title") or title,
        description=raw_text,
        company_name=parsed_offer.get("company_name"),
        location=parsed_offer.get("location"),
        employment_type=parsed_offer.get("employment_type"),
        seniority_level=parsed_offer.get("seniority_level"),
        industry_code=parsed_offer.get("industry_code"),
        requirements=requirements,
        warnings=parsed.get("warnings") or [],
        parser_version=parsed.get("parser_version") or "unknown",
    )

    return response.model_dump(mode="json")


def list_my_offers(db: Session, current_user: CurrentUserResponse) -> list[dict]:
    employer = resolve_current_employer(db, current_user)
    offers = repository.list_offers(db, employer["id"])
    return [JobOfferListItemResponse(**row).model_dump(mode="json") for row in offers]


def get_my_offer(db: Session, current_user: CurrentUserResponse, offer_id: str) -> dict:
    employer = resolve_current_employer(db, current_user)
    offer = repository.get_offer_by_id(db, offer_id)
    if not offer or offer["employer_id"] != employer["id"]:
        _raise_not_found("Offer")
    return _build_offer_response(db, offer)


def create_my_offer(
    db: Session,
    current_user: CurrentUserResponse,
    payload: JobOfferCreateRequest,
) -> dict:
    employer = resolve_current_employer(db, current_user)
    data = _normalize_payload(payload.model_dump(mode="json"))
    requirements = data.pop("requirements", [])
    data["employer_id"] = employer["id"]
    data["status"] = "DRAFT"
    data["created_by_user_id"] = current_user.id

    try:
        created = repository.create_offer(db, data)
        for requirement in requirements:
            repository.create_offer_requirement(db, created["id"], requirement)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    offer = repository.get_offer_by_id(db, created["id"])
    return _build_offer_response(db, offer)


def update_my_offer(
    db: Session,
    current_user: CurrentUserResponse,
    offer_id: str,
    payload: JobOfferUpdateRequest,
) -> dict:
    employer = resolve_current_employer(db, current_user)
    existing = repository.get_offer_by_id(db, offer_id)
    if not existing or existing["employer_id"] != employer["id"]:
        _raise_not_found("Offer")

    data = _normalize_payload(payload.model_dump(mode="json"))
    requirements = data.pop("requirements", [])

    try:
        updated = repository.update_offer(db, offer_id, data)
        if not updated:
            db.rollback()
            _raise_not_found("Offer")
        repository.delete_offer_requirements(db, offer_id)
        for requirement in requirements:
            repository.create_offer_requirement(db, offer_id, requirement)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    offer = repository.get_offer_by_id(db, offer_id)
    return _build_offer_response(db, offer)


def archive_my_offer(db: Session, current_user: CurrentUserResponse, offer_id: str) -> dict:
    employer = resolve_current_employer(db, current_user)
    existing = repository.get_offer_by_id(db, offer_id)
    if not existing or existing["employer_id"] != employer["id"]:
        _raise_not_found("Offer")

    warning = None
    try:
        updated = repository.set_offer_status(db, offer_id, status_value="ARCHIVED")
        if not updated:
            db.rollback()
            _raise_not_found("Offer")
        db.commit()
    except IntegrityError:
        db.rollback()
        warning = "ARCHIVED is not accepted by the current DB constraint, so the offer stayed in DRAFT."
        updated = repository.set_offer_status(db, offer_id, status_value="DRAFT")
        db.commit()

    offer = repository.get_offer_by_id(db, offer_id)
    return _build_offer_response(db, offer, warning=warning)


def submit_my_offer(db: Session, current_user: CurrentUserResponse, offer_id: str) -> dict:
    employer = resolve_current_employer(db, current_user)
    existing = repository.get_offer_by_id(db, offer_id)
    if not existing or existing["employer_id"] != employer["id"]:
        _raise_not_found("Offer")

    supported_statuses = set(repository.get_offer_status_values(db))
    warning = None
    target_status = "PENDING_VALIDATION"

    if target_status not in supported_statuses:
        if "SUBMITTED" in supported_statuses:
            target_status = "SUBMITTED"
            warning = "The current database does not support PENDING_VALIDATION, so SUBMITTED was used instead."
        else:
            target_status = "DRAFT"
            warning = "The current database does not support PENDING_VALIDATION, so the offer stayed in DRAFT."

    try:
        updated = repository.set_offer_status(db, offer_id, status_value=target_status)
        if not updated:
            db.rollback()
            _raise_not_found("Offer")
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    offer = repository.get_offer_by_id(db, offer_id)
    return _build_offer_response(db, offer, warning=warning)


def list_offers_for_advisor(db: Session) -> list[dict]:
    offers = repository.list_offers(db)
    return [JobOfferListItemResponse(**row).model_dump(mode="json") for row in offers]


def get_offer_for_advisor(db: Session, offer_id: str) -> dict:
    offer = repository.get_offer_by_id(db, offer_id)
    if not offer:
        _raise_not_found("Offer")
    return _build_offer_response(db, offer)


def validate_offer(db: Session, current_user: CurrentUserResponse, offer_id: str) -> dict:
    if not repository.get_offer_by_id(db, offer_id):
        _raise_not_found("Offer")

    try:
        updated = repository.set_offer_status(
            db,
            offer_id,
            status_value="PUBLISHED",
            validated_by_user_id=current_user.id,
            published_at=True,
        )
        if not updated:
            db.rollback()
            _raise_not_found("Offer")
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    offer = repository.get_offer_by_id(db, offer_id)
    return _build_offer_response(db, offer)


def reject_offer(
    db: Session,
    current_user: CurrentUserResponse,
    offer_id: str,
    payload: OfferActionRequest,
) -> dict:
    if not repository.get_offer_by_id(db, offer_id):
        _raise_not_found("Offer")

    warning = None
    target_status = "REJECTED"
    supported_statuses = set(repository.get_offer_status_values(db))
    if target_status not in supported_statuses:
        target_status = "DRAFT"
        warning = "REJECTED is not accepted by the current DB constraint, so DRAFT was used instead."

    try:
        updated = repository.set_offer_status(
            db,
            offer_id,
            status_value=target_status,
            validated_by_user_id=current_user.id,
        )
        if not updated:
            db.rollback()
            _raise_not_found("Offer")
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    offer = repository.get_offer_by_id(db, offer_id)
    return _build_offer_response(
        db,
        offer,
        warning=warning or "Offer rejection reason is returned in the API response but is not persisted because no dedicated column exists.",
        action_reason=payload.reason,
    )


def offer_counts(db: Session) -> dict:
    return repository.count_offer_stats(db)
