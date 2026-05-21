from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modules.auth.schemas import CurrentUserResponse
from app.clients.matching_client import execute_run as execute_matching_service_run
from app.modules.matching_runs import repository as matching_run_repository

from . import repository
from .schemas import (
    EmployerContactResponse,
    EmployerContactUpsertRequest,
    EmployerListItemResponse,
    EmployerLocationResponse,
    EmployerLocationUpsertRequest,
    EmployerProfileResponse,
    EmployerUpdateRequest,
    EmployerApplicationResponse,
    EmployerMatchedCandidateResponse,
    EmployerMatchedCandidatesResponse,
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
        website_url=employer.get("website_url"),
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

def list_my_applications(
    db: Session,
    current_user: CurrentUserResponse,
    offer_id: str | None = None,
) -> list[dict]:
    employer = resolve_current_employer(db, current_user)

    rows = repository.list_employer_applications(
        db,
        employer["id"],
        offer_id=offer_id,
    )

    return [
        EmployerApplicationResponse(**row).model_dump(mode="json")
        for row in rows
    ]

def get_my_offer_matched_candidates(
    db: Session,
    current_user: CurrentUserResponse,
    *,
    offer_id: str,
    min_score: float | None = None,
    force_refresh: bool = False,
) -> dict:
    employer = resolve_current_employer(db, current_user)

    offer = repository.get_offer_for_employer(
        db,
        employer_id=employer["id"],
        offer_id=offer_id,
    )

    if not offer:
        _raise_not_found("Offer")

    effective_min_score = float(min_score) if min_score is not None else 0.0

    model_version = repository.get_default_offer_to_candidate_model_version(db)

    if not model_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Aucun modèle actif STANDARD_OFFER_TO_CANDIDATE n'est configuré.",
        )

    active_candidates_count = repository.count_active_candidates(db)

    offer_last_updated = repository.get_offer_matching_source_last_updated(db, offer_id)
    candidates_last_updated = repository.get_candidates_last_updated(db)

    timestamps = [
        value
        for value in [offer_last_updated, candidates_last_updated]
        if value is not None
    ]

    min_valid_created_at = max(timestamps) if timestamps else None

    reusable_run = None

    if not force_refresh:
        reusable_run = repository.find_reusable_offer_to_candidate_run(
            db,
            offer_id=offer_id,
            model_version_id=model_version["id"],
            min_created_at=min_valid_created_at,
        )

    if reusable_run:
        run_id = reusable_run["id"]
    else:
        try:
            run = matching_run_repository.create_matching_run(
                db,
                run_type="AUTOMATIC",
                direction="OFFER_TO_CANDIDATE",
                model_version_id=model_version["id"],
                launched_by_user_id=current_user.id,
                source_entity_type="JOB_OFFER",
                source_entity_id=offer_id,
                parameters_json={
                    "source": "employer_portal",
                    "min_score": float(effective_min_score),
                    "cache_strategy": "offer_and_candidates_timestamp",
                },
            )
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            _handle_integrity_error(exc)

        run_id = run["id"]

        execute_matching_service_run(
            run_id,
            {
                "run_id": run_id,
                "trace_id": f"employer-matched-candidates-{run_id}",
                "dry_run": False,
                "admin_override": False,
            },
        )

    rows = repository.list_offer_matching_results_with_candidates(
        db,
        run_id=run_id,
        offer_id=offer_id,
        min_score=effective_min_score,
    )

    return EmployerMatchedCandidatesResponse(
        model_code=model_version["model_code"],
        model_version_id=model_version["id"],
        run_id=run_id,
        offer_id=offer_id,
        min_score=float(effective_min_score),
        active_candidates_count=active_candidates_count,
        total_results=active_candidates_count,
        matched_count=len(rows),
        candidates=[
            EmployerMatchedCandidateResponse(**row)
            for row in rows
        ],
        cache={
            "reused": bool(reusable_run),
            "offer_last_updated": offer_last_updated.isoformat()
            if offer_last_updated
            else None,
            "candidates_last_updated": candidates_last_updated.isoformat()
            if candidates_last_updated
            else None,
            "min_valid_created_at": min_valid_created_at.isoformat()
            if min_valid_created_at
            else None,
        },
    ).model_dump(mode="json")