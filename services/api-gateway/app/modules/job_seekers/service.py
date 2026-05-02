from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modules.auth.schemas import CurrentUserResponse

from . import repository
from .schemas import (
    CandidateListItemResponse,
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
        primary_language=job_seeker["primary_language"],
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
    data = _normalize_payload(payload.model_dump())

    try:
        repository.update_job_seeker(db, job_seeker["id"], data)
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
