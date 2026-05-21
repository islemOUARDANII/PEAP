from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modules.auth.schemas import CurrentUserResponse
from app.clients.matching_client import execute_run as execute_matching_service_run
from app.modules.matching_runs import repository as matching_run_repository

from . import repository
from .schemas import (
    CandidateAggregateProfileResponse,
    CandidateBaseInfoResponse,
    CandidateListItemResponse,
    CandidateProfilePatchRequest,
    CandidateStatusUpdateRequest,
    CandidateStatusUpdateResponse,
    CvMetadataResponse,
    JobSeekerContactResponse,
    JobSeekerContactUpsertRequest,
    JobSeekerEducationCreateRequest,
    JobSeekerEducationResponse,
    JobSeekerEducationUpdateRequest,
    JobSeekerExperienceCreateRequest,
    JobSeekerExperienceResponse,
    JobSeekerExperienceUpdateRequest,
    JobSeekerIdentityResponse,
    JobSeekerIdentityUpsertRequest,
    JobSeekerInterestBulkRequest,
    JobSeekerInterestResponse,
    JobSeekerLanguageCreateRequest,
    JobSeekerLanguageResponse,
    JobSeekerLanguageUpdateRequest,
    JobSeekerPreferenceResponse,
    JobSeekerPreferenceUpsertRequest,
    JobSeekerProfileResponse,
    JobSeekerSkillCreateRequest,
    JobSeekerSkillResponse,
    JobSeekerSkillUpdateRequest,
    JobSeekerUpdateRequest,
)


LOCKED_IDENTITY_FIELDS = {
    "cin": "CIN",
    "first_name": "Prénom",
    "last_name": "Nom",
    "birth_date": "Date de naissance",
    "gender_code": "Civilité",
    "birth_country_id": "Pays de naissance",
    "birth_governorate_unit_id": "Gouvernorat de naissance",
    "birth_delegation_unit_id": "Délégation de naissance",
    "birth_imada_unit_id": "Imada de naissance",
    "birth_location_unit_id": "Lieu de naissance",
    "father_first_name": "Prénom du père",
}

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
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=message,
        ) from exc

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Database constraint violated: {message}",
    ) from exc


def resolve_current_job_seeker(db: Session, current_user: CurrentUserResponse) -> dict:
    if current_user.profile and current_user.profile.type == "JOB_SEEKER":
        job_seeker = repository.get_job_seeker_by_id(db, current_user.profile.id)
    else:
        job_seeker = repository.get_job_seeker_by_user_id(db, current_user.id)

    if not job_seeker:
        _raise_not_found("Job seeker profile")

    return job_seeker


def _build_profile_response(db: Session, job_seeker: dict) -> dict:
    identity = repository.get_identity(db, job_seeker["id"])
    contact = repository.get_contact(db, job_seeker["id"])
    education = repository.list_education(db, job_seeker["id"])
    experience = repository.list_experience(db, job_seeker["id"])
    skills = repository.list_skills(db, job_seeker["id"])
    languages = repository.list_languages(db, job_seeker["id"])
    preference = repository.get_preference(db, job_seeker["id"])
    current_cv = repository.get_current_cv(db, job_seeker["id"])

    return JobSeekerProfileResponse(
        id=job_seeker["id"],
        user_id=job_seeker["user_id"],
        aneti_identifier=job_seeker["aneti_identifier"],
        status=job_seeker["status"],
        registration_date=job_seeker["registration_date"],
        identity=JobSeekerIdentityResponse(**identity) if identity else None,
        contact=JobSeekerContactResponse(**contact) if contact else None,
        education=[JobSeekerEducationResponse(**row) for row in education],
        experience=[JobSeekerExperienceResponse(**row) for row in experience],
        skills=[JobSeekerSkillResponse(**row) for row in skills],
        languages=[JobSeekerLanguageResponse(**row) for row in languages],
        preference=JobSeekerPreferenceResponse(**preference) if preference else None,
        current_cv=CvMetadataResponse(**current_cv) if current_cv else None,
    ).model_dump(mode="json")


def get_my_profile(db: Session, current_user: CurrentUserResponse) -> dict:
    return _build_profile_response(db, resolve_current_job_seeker(db, current_user))


def get_profile_by_id(db: Session, candidate_id: str) -> dict:
    job_seeker = repository.get_job_seeker_by_id(db, candidate_id)
    if not job_seeker:
        _raise_not_found("Job seeker profile")
    return _build_profile_response(db, job_seeker)


def update_my_profile(
    db: Session,
    current_user: CurrentUserResponse,
    payload: JobSeekerUpdateRequest,
) -> dict:
    job_seeker = resolve_current_job_seeker(db, current_user)

    try:
        repository.update_job_seeker(db, job_seeker["id"], {})
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    return get_profile_by_id(db, job_seeker["id"])


def upsert_identity(
    db: Session,
    current_user: CurrentUserResponse,
    payload: JobSeekerIdentityUpsertRequest,
) -> dict:
    job_seeker = resolve_current_job_seeker(db, current_user)
    data = _normalize_payload(payload.model_dump(mode="json"))

    existing_identity = repository.get_identity(db, job_seeker["id"]) or {}

    locked_changed_fields = []

    for field, label in LOCKED_IDENTITY_FIELDS.items():
        if field not in data:
            continue

        new_value = data.get(field)
        old_value = existing_identity.get(field)

        # Normalisation simple pour comparer dates / UUID / strings.
        new_normalized = str(new_value).strip() if new_value is not None else None
        old_normalized = str(old_value).strip() if old_value is not None else None

        if new_normalized not in (None, "") and old_normalized not in (None, ""):
            if new_normalized != old_normalized:
                locked_changed_fields.append(label)

    if locked_changed_fields:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Ces informations ne sont pas modifiables depuis l’espace candidat : "
                + ", ".join(locked_changed_fields)
            ),
        )

    try:
        repository.upsert_identity(db, job_seeker["id"], data)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    return get_profile_by_id(db, job_seeker["id"])


def upsert_contact(
    db: Session,
    current_user: CurrentUserResponse,
    payload: JobSeekerContactUpsertRequest,
) -> dict:
    job_seeker = resolve_current_job_seeker(db, current_user)
    data = _normalize_payload(payload.model_dump())

    try:
        repository.upsert_contact(db, job_seeker["id"], data)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    return get_profile_by_id(db, job_seeker["id"])


def list_education(db: Session, current_user: CurrentUserResponse) -> list[dict]:
    job_seeker = resolve_current_job_seeker(db, current_user)
    return [
        JobSeekerEducationResponse(**row).model_dump(mode="json")
        for row in repository.list_education(db, job_seeker["id"])
    ]


def create_education(
    db: Session,
    current_user: CurrentUserResponse,
    payload: JobSeekerEducationCreateRequest,
) -> list[dict]:
    job_seeker = resolve_current_job_seeker(db, current_user)
    data = _normalize_payload(payload.model_dump(mode="json"))

    try:
        repository.create_education(db, job_seeker["id"], data)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    return list_education(db, current_user)


def update_education(
    db: Session,
    current_user: CurrentUserResponse,
    education_id: str,
    payload: JobSeekerEducationUpdateRequest,
) -> list[dict]:
    job_seeker = resolve_current_job_seeker(db, current_user)
    data = _normalize_payload(payload.model_dump(mode="json"))

    try:
        updated = repository.update_education(db, job_seeker["id"], education_id, data)
        if not updated:
            db.rollback()
            _raise_not_found("Education record")
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    return list_education(db, current_user)


def delete_education(db: Session, current_user: CurrentUserResponse, education_id: str) -> None:
    job_seeker = resolve_current_job_seeker(db, current_user)
    deleted = repository.delete_education(db, job_seeker["id"], education_id)
    if not deleted:
        db.rollback()
        _raise_not_found("Education record")
    db.commit()


def list_experience(db: Session, current_user: CurrentUserResponse) -> list[dict]:
    job_seeker = resolve_current_job_seeker(db, current_user)
    return [
        JobSeekerExperienceResponse(**row).model_dump(mode="json")
        for row in repository.list_experience(db, job_seeker["id"])
    ]


def create_experience(
    db: Session,
    current_user: CurrentUserResponse,
    payload: JobSeekerExperienceCreateRequest,
) -> list[dict]:
    job_seeker = resolve_current_job_seeker(db, current_user)
    data = _normalize_payload(payload.model_dump(mode="json"))

    try:
        repository.create_experience(db, job_seeker["id"], data)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    return list_experience(db, current_user)


def update_experience(
    db: Session,
    current_user: CurrentUserResponse,
    experience_id: str,
    payload: JobSeekerExperienceUpdateRequest,
) -> list[dict]:
    job_seeker = resolve_current_job_seeker(db, current_user)
    data = _normalize_payload(payload.model_dump(mode="json"))

    try:
        updated = repository.update_experience(db, job_seeker["id"], experience_id, data)
        if not updated:
            db.rollback()
            _raise_not_found("Experience record")
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    return list_experience(db, current_user)


def delete_experience(db: Session, current_user: CurrentUserResponse, experience_id: str) -> None:
    job_seeker = resolve_current_job_seeker(db, current_user)
    deleted = repository.delete_experience(db, job_seeker["id"], experience_id)
    if not deleted:
        db.rollback()
        _raise_not_found("Experience record")
    db.commit()


def list_skills(db: Session, current_user: CurrentUserResponse) -> list[dict]:
    job_seeker = resolve_current_job_seeker(db, current_user)
    return [
        JobSeekerSkillResponse(**row).model_dump(mode="json")
        for row in repository.list_skills(db, job_seeker["id"])
    ]


def create_skill(
    db: Session,
    current_user: CurrentUserResponse,
    payload: JobSeekerSkillCreateRequest,
) -> list[dict]:
    job_seeker = resolve_current_job_seeker(db, current_user)
    data = _normalize_payload(payload.model_dump(mode="json"))

    try:
        repository.create_skill(db, job_seeker["id"], data)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    return list_skills(db, current_user)


def update_skill(
    db: Session,
    current_user: CurrentUserResponse,
    skill_row_id: str,
    payload: JobSeekerSkillUpdateRequest,
) -> list[dict]:
    job_seeker = resolve_current_job_seeker(db, current_user)
    data = _normalize_payload(payload.model_dump(mode="json"))

    try:
        updated = repository.update_skill(db, job_seeker["id"], skill_row_id, data)
        if not updated:
            db.rollback()
            _raise_not_found("Skill record")
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    return list_skills(db, current_user)


def delete_skill(db: Session, current_user: CurrentUserResponse, skill_row_id: str) -> None:
    job_seeker = resolve_current_job_seeker(db, current_user)
    deleted = repository.delete_skill(db, job_seeker["id"], skill_row_id)
    if not deleted:
        db.rollback()
        _raise_not_found("Skill record")
    db.commit()


def list_languages(db: Session, current_user: CurrentUserResponse) -> list[dict]:
    job_seeker = resolve_current_job_seeker(db, current_user)
    return [
        JobSeekerLanguageResponse(**row).model_dump(mode="json")
        for row in repository.list_languages(db, job_seeker["id"])
    ]


def create_language(
    db: Session,
    current_user: CurrentUserResponse,
    payload: JobSeekerLanguageCreateRequest,
) -> list[dict]:
    job_seeker = resolve_current_job_seeker(db, current_user)
    data = _normalize_payload(payload.model_dump())

    try:
        repository.create_language(db, job_seeker["id"], data)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    return list_languages(db, current_user)


def update_language(
    db: Session,
    current_user: CurrentUserResponse,
    language_id: str,
    payload: JobSeekerLanguageUpdateRequest,
) -> list[dict]:
    job_seeker = resolve_current_job_seeker(db, current_user)
    data = _normalize_payload(payload.model_dump())

    try:
        updated = repository.update_language(db, job_seeker["id"], language_id, data)
        if not updated:
            db.rollback()
            _raise_not_found("Language record")
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    return list_languages(db, current_user)


def delete_language(db: Session, current_user: CurrentUserResponse, language_id: str) -> None:
    job_seeker = resolve_current_job_seeker(db, current_user)
    deleted = repository.delete_language(db, job_seeker["id"], language_id)
    if not deleted:
        db.rollback()
        _raise_not_found("Language record")
    db.commit()


def get_preference(db: Session, current_user: CurrentUserResponse) -> dict | None:
    job_seeker = resolve_current_job_seeker(db, current_user)
    preference = repository.get_preference(db, job_seeker["id"])
    return JobSeekerPreferenceResponse(**preference).model_dump(mode="json") if preference else None


def upsert_preference(
    db: Session,
    current_user: CurrentUserResponse,
    payload: JobSeekerPreferenceUpsertRequest,
) -> dict:
    job_seeker = resolve_current_job_seeker(db, current_user)
    data = _normalize_payload(payload.model_dump(mode="json"))

    try:
        repository.upsert_preference(db, job_seeker["id"], data)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    return get_profile_by_id(db, job_seeker["id"])


def list_candidate_summaries(
    db: Session,
    *,
    q: str | None,
    status_value: str | None,
    governorate_code: str | None,
    delegation_code: str | None,
    has_cv: bool | None,
    limit: int,
    offset: int,
) -> list[dict]:
    rows = repository.list_candidate_summaries(
        db,
        q=_normalize_optional_string(q),
        status_value=_normalize_optional_string(status_value),
        governorate_code=_normalize_optional_string(governorate_code),
        delegation_code=_normalize_optional_string(delegation_code),
        has_cv=has_cv,
        limit=limit,
        offset=offset,
    )
    return [CandidateListItemResponse(**row).model_dump(mode="json") for row in rows]


def update_candidate_status(
    db: Session,
    candidate_id: str,
    payload: CandidateStatusUpdateRequest,
) -> dict:
    if not repository.get_job_seeker_by_id(db, candidate_id):
        _raise_not_found("Job seeker profile")

    try:
        updated = repository.update_job_seeker_status(db, candidate_id, payload.status)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    if not updated:
        _raise_not_found("Job seeker profile")

    return CandidateStatusUpdateResponse(
        id=updated["id"],
        status=updated["status"],
        reason=payload.reason,
        warning="Status reason is not persisted because no dedicated status history table is wired here yet.",
    ).model_dump(mode="json")


def candidate_counts(db: Session) -> dict:
    return repository.count_job_seekers(db)

def get_active_offers_count(db: Session) -> dict:
    return {
        "active_offers_count": repository.count_active_offers(db),
    }


def get_my_matched_offers(
    db: Session,
    current_user: CurrentUserResponse,
    *,
    min_score: float | None = None,
    force_refresh: bool = False,
) -> dict:
    job_seeker = resolve_current_job_seeker(db, current_user)

    saved_threshold = repository.get_offer_score_threshold(
        db,
        job_seeker["id"],
    )

    effective_min_score = float(min_score) if min_score is not None else float(saved_threshold)
    normalized_min_score = effective_min_score

    model_version = repository.get_default_candidate_to_offer_model_version(db)
    if not model_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Aucun modèle actif STANDARD_CANDIDATE_TO_OFFER n'est configuré.",
        )

    active_offers_count = repository.count_active_offers(db)

    candidate_last_updated = repository.get_candidate_profile_last_updated(
        db,
        job_seeker["id"],
    )

    offers_last_updated = repository.get_active_offers_last_updated(db)

    timestamps = [
        value
        for value in [candidate_last_updated, offers_last_updated]
        if value is not None
    ]

    min_valid_created_at = max(timestamps) if timestamps else None

    reusable_run = None

    if not force_refresh:
        reusable_run = repository.find_reusable_candidate_to_offer_run(
            db,
            job_seeker_id=job_seeker["id"],
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
                direction="CANDIDATE_TO_OFFER",
                model_version_id=model_version["id"],
                launched_by_user_id=current_user.id,
                source_entity_type="JOB_SEEKER",
                source_entity_id=job_seeker["id"],
                parameters_json={
                    "source": "candidate_portal",
                    "min_score": float(normalized_min_score),
                    "cache_strategy": "profile_and_offers_timestamp",
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
                "trace_id": f"candidate-matched-offers-{run_id}",
                "dry_run": False,
                "admin_override": False,
            },
        )

    rows = repository.list_candidate_matching_results_with_offers(
        db,
        run_id=run_id,
        job_seeker_id=job_seeker["id"],
        min_score=normalized_min_score,
    )

    return {
        "model_code": model_version["model_code"],
        "model_version_id": model_version["id"],
        "run_id": run_id,
        "min_score": float(normalized_min_score),
        "active_offers_count": active_offers_count,
        "total_results": active_offers_count,
        "matched_count": len(rows),
        "offers": rows,
        "cache": {
            "reused": bool(reusable_run),
            "candidate_last_updated": candidate_last_updated.isoformat()
            if candidate_last_updated
            else None,
            "offers_last_updated": offers_last_updated.isoformat()
            if offers_last_updated
            else None,
            "min_valid_created_at": min_valid_created_at.isoformat()
            if min_valid_created_at
            else None,
        },
    }


def get_my_interests(
    db: Session,
    current_user: CurrentUserResponse,
) -> list[dict]:
    job_seeker = resolve_current_job_seeker(db, current_user)
    return [
        JobSeekerInterestResponse(**row).model_dump(mode="json")
        for row in repository.list_job_seeker_interests(db, job_seeker["id"])
    ]


def replace_my_interests(
    db: Session,
    current_user: CurrentUserResponse,
    *,
    interests: list[dict],
) -> list[dict]:
    job_seeker = resolve_current_job_seeker(db, current_user)

    rows = repository.replace_job_seeker_interests(
        db,
        job_seeker_id=job_seeker["id"],
        interests=interests,
    )

    db.commit()
    return [JobSeekerInterestResponse(**row).model_dump(mode="json") for row in rows]


def get_my_offer_score_threshold(
    db: Session,
    current_user: CurrentUserResponse,
) -> dict:
    job_seeker = resolve_current_job_seeker(db, current_user)

    return {
        "min_offer_score_threshold": repository.get_offer_score_threshold(
            db,
            job_seeker["id"],
        )
    }


def update_my_offer_score_threshold(
    db: Session,
    current_user: CurrentUserResponse,
    *,
    min_offer_score_threshold: float,
) -> dict:
    job_seeker = resolve_current_job_seeker(db, current_user)

    if min_offer_score_threshold < 0 or min_offer_score_threshold > 100:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Le seuil doit être compris entre 0 et 100.",
        )

    row = repository.update_offer_score_threshold(
        db,
        job_seeker_id=job_seeker["id"],
        min_offer_score_threshold=min_offer_score_threshold,
    )

    db.commit()
    return row


def apply_to_offer(
    db: Session,
    current_user: CurrentUserResponse,
    *,
    offer_id: str,
    matching_result_id: str | None = None,
    cover_message: str | None = None,
) -> dict:
    job_seeker = resolve_current_job_seeker(db, current_user)

    row = repository.create_job_application(
        db,
        job_seeker_id=job_seeker["id"],
        offer_id=offer_id,
        matching_result_id=matching_result_id,
        cover_message=cover_message,
    )

    db.commit()
    return row


def list_my_applications(
    db: Session,
    current_user: CurrentUserResponse,
) -> list[dict]:
    job_seeker = resolve_current_job_seeker(db, current_user)
    return repository.list_job_applications(db, job_seeker["id"])


# ─── Aggregate profile ────────────────────────────────────────────────────────

def _build_aggregate_profile(
    db: Session,
    job_seeker: dict,
    profile_version: int,
) -> dict:
    js_id = job_seeker["id"]
    identity   = repository.get_identity(db, js_id)
    contact    = repository.get_contact(db, js_id)
    education  = repository.list_education(db, js_id)
    experience = repository.list_experience(db, js_id)
    skills     = repository.list_skills(db, js_id)
    languages  = repository.list_languages(db, js_id)
    preference = repository.get_preference(db, js_id)
    current_cv = repository.get_current_cv(db, js_id)
    interests  = repository.list_job_seeker_interests(db, js_id)
    offer_threshold = repository.get_offer_score_threshold(db, js_id)

    interest_responses = [JobSeekerInterestResponse(**row) for row in interests]
    keywords = [r.taxonomy_node_label for r in interest_responses if r.taxonomy_node_label]

    return CandidateAggregateProfileResponse(
        profile_version=profile_version,
        candidate=CandidateBaseInfoResponse(
            id=job_seeker["id"],
            user_id=job_seeker.get("user_id"),
            aneti_identifier=job_seeker.get("aneti_identifier"),
            status=job_seeker["status"],
            registration_date=job_seeker.get("registration_date"),
        ),
        identity=JobSeekerIdentityResponse(**identity) if identity else None,
        contact=JobSeekerContactResponse(**contact) if contact else None,
        education=[JobSeekerEducationResponse(**row) for row in education],
        experience=[JobSeekerExperienceResponse(**row) for row in experience],
        skills=[JobSeekerSkillResponse(**row) for row in skills],
        languages=[JobSeekerLanguageResponse(**row) for row in languages],
        preference=JobSeekerPreferenceResponse(**preference) if preference else None,
        cv=CvMetadataResponse(**current_cv) if current_cv else None,
        interests=interest_responses,
        keywords=keywords,
        offer_threshold=offer_threshold,
    ).model_dump(mode="json")


def get_aggregate_profile(db: Session, current_user: CurrentUserResponse) -> dict:
    job_seeker = resolve_current_job_seeker(db, current_user)
    profile_version = repository.get_profile_version(db, job_seeker["id"])
    return _build_aggregate_profile(db, job_seeker, profile_version)


def patch_aggregate_profile(
    db: Session,
    current_user: CurrentUserResponse,
    payload: CandidateProfilePatchRequest,
) -> dict:
    job_seeker = resolve_current_job_seeker(db, current_user)
    js_id = job_seeker["id"]

    if payload.profile_version is not None:
        current_version = repository.get_profile_version(db, js_id)
        if payload.profile_version != current_version:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Profile version conflict: client has v{payload.profile_version}, "
                    f"server has v{current_version}."
                ),
            )

    try:
        if payload.candidate is not None:
            repository.update_job_seeker(db, js_id, {})

        if payload.identity is not None:
            data = _normalize_payload(payload.identity.model_dump(mode="json"))
            repository.upsert_identity(db, js_id, data)

        if payload.contact is not None:
            data = _normalize_payload(payload.contact.model_dump())
            repository.upsert_contact(db, js_id, data)

        if payload.preference is not None:
            data = _normalize_payload(payload.preference.model_dump(mode="json"))
            repository.upsert_preference(db, js_id, data)

        if payload.education is not None:
            for edu_id in payload.education.delete_ids:
                repository.delete_education(db, js_id, edu_id)
            for item in payload.education.upsert:
                data = _normalize_payload(item.model_dump(mode="json", exclude={"id"}))
                if item.id:
                    repository.update_education(db, js_id, item.id, data)
                else:
                    repository.create_education(db, js_id, data)

        if payload.experience is not None:
            for exp_id in payload.experience.delete_ids:
                repository.delete_experience(db, js_id, exp_id)
            for item in payload.experience.upsert:
                data = _normalize_payload(item.model_dump(mode="json", exclude={"id"}))
                if item.id:
                    repository.update_experience(db, js_id, item.id, data)
                else:
                    repository.create_experience(db, js_id, data)

        if payload.skills is not None:
            for skill_id in payload.skills.delete_ids:
                repository.delete_skill(db, js_id, skill_id)
            for item in payload.skills.upsert:
                data = _normalize_payload(item.model_dump(mode="json", exclude={"id"}))
                if item.id:
                    repository.update_skill(db, js_id, item.id, data)
                else:
                    repository.create_skill(db, js_id, data)

        if payload.languages is not None:
            for lang_id in payload.languages.delete_ids:
                repository.delete_language(db, js_id, lang_id)
            for item in payload.languages.upsert:
                data = _normalize_payload(item.model_dump(mode="json", exclude={"id"}))
                if item.id:
                    repository.update_language(db, js_id, item.id, data)
                else:
                    repository.create_language(db, js_id, data)

        if payload.interests is not None:
            interest_dicts = [i.model_dump(mode="json") for i in payload.interests]
            repository.replace_job_seeker_interests(
                db, job_seeker_id=js_id, interests=interest_dicts,
            )

        if payload.offer_threshold is not None:
            if not (0 <= payload.offer_threshold <= 100):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="offer_threshold must be between 0 and 100.",
                )
            repository.update_offer_score_threshold(
                db,
                job_seeker_id=js_id,
                min_offer_score_threshold=payload.offer_threshold,
            )

        new_version = repository.increment_profile_version(db, js_id)
        db.commit()

    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    updated_js = repository.get_job_seeker_by_id(db, js_id)
    return _build_aggregate_profile(db, updated_js, new_version)
