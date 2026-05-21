from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import require_roles
from app.modules.auth.schemas import CurrentUserResponse

from .schemas import (
    CandidateAggregateProfileResponse,
    CandidateListItemResponse,
    CandidateProfilePatchRequest,
    CandidateStatusUpdateRequest,
    CandidateStatusUpdateResponse,
    CandidateActiveOffersCountResponse,
    CandidateMatchedOffersResponse,
    JobSeekerContactUpsertRequest,
    JobSeekerEducationCreateRequest,
    JobSeekerEducationResponse,
    JobSeekerEducationUpdateRequest,
    JobSeekerExperienceCreateRequest,
    JobSeekerExperienceResponse,
    JobSeekerExperienceUpdateRequest,
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
    JobApplicationCreateRequest,
    JobApplicationResponse,
    JobSeekerOfferThresholdRequest,
    JobSeekerOfferThresholdResponse,
)
from .service import (
    create_education,
    create_experience,
    create_language,
    create_skill,
    delete_education,
    delete_experience,
    delete_language,
    delete_skill,
    get_aggregate_profile,
    get_my_profile,
    get_preference,
    get_active_offers_count,
    get_my_matched_offers,
    get_my_interests,
    replace_my_interests,
    list_education,
    list_experience,
    list_languages,
    list_skills,
    patch_aggregate_profile,
    update_my_profile,
    update_education,
    update_experience,
    update_language,
    update_skill,
    upsert_contact,
    upsert_identity,
    upsert_preference,
    get_my_offer_score_threshold,
    update_my_offer_score_threshold,
    apply_to_offer,
    list_my_applications,
)

router = APIRouter(tags=["Candidates"])


@router.get("/candidates/me/profile", response_model=CandidateAggregateProfileResponse)
def get_my_aggregate_profile_endpoint(
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    return get_aggregate_profile(db, current_user)


@router.patch("/candidates/me/profile", response_model=CandidateAggregateProfileResponse)
def patch_my_aggregate_profile_endpoint(
    payload: CandidateProfilePatchRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    return patch_aggregate_profile(db, current_user, payload)


@router.get("/candidates/me", response_model=JobSeekerProfileResponse)
@router.get("/job-seekers/me", response_model=JobSeekerProfileResponse, include_in_schema=False)
@router.get("/candidate/me", response_model=JobSeekerProfileResponse, include_in_schema=False)
def get_my_profile_endpoint(
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    return get_my_profile(db, current_user)


@router.put("/candidates/me", response_model=JobSeekerProfileResponse)
@router.put("/job-seekers/me", response_model=JobSeekerProfileResponse, include_in_schema=False)
def update_my_profile_endpoint(
    payload: JobSeekerUpdateRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    return update_my_profile(db, current_user, payload)


@router.put("/candidates/me/identity", response_model=JobSeekerProfileResponse)
@router.put("/job-seekers/me/identity", response_model=JobSeekerProfileResponse, include_in_schema=False)
def upsert_identity_endpoint(
    payload: JobSeekerIdentityUpsertRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    return upsert_identity(db, current_user, payload)


@router.put("/candidates/me/contact", response_model=JobSeekerProfileResponse)
@router.put("/job-seekers/me/contact", response_model=JobSeekerProfileResponse, include_in_schema=False)
def upsert_contact_endpoint(
    payload: JobSeekerContactUpsertRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    return upsert_contact(db, current_user, payload)


@router.get("/candidates/me/education", response_model=list[JobSeekerEducationResponse])
@router.get("/job-seekers/me/education", response_model=list[JobSeekerEducationResponse], include_in_schema=False)
def list_education_endpoint(
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    return list_education(db, current_user)


@router.post("/candidates/me/education", response_model=list[JobSeekerEducationResponse], status_code=status.HTTP_201_CREATED)
@router.post("/job-seekers/me/education", response_model=list[JobSeekerEducationResponse], status_code=status.HTTP_201_CREATED, include_in_schema=False)
def create_education_endpoint(
    payload: JobSeekerEducationCreateRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    return create_education(db, current_user, payload)


@router.put("/candidates/me/education/{education_id}", response_model=list[JobSeekerEducationResponse])
@router.put("/job-seekers/me/education/{education_id}", response_model=list[JobSeekerEducationResponse], include_in_schema=False)
def update_education_endpoint(
    education_id: UUID,
    payload: JobSeekerEducationUpdateRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    return update_education(db, current_user, str(education_id), payload)


@router.delete("/candidates/me/education/{education_id}", status_code=status.HTTP_204_NO_CONTENT)
@router.delete("/job-seekers/me/education/{education_id}", status_code=status.HTTP_204_NO_CONTENT, include_in_schema=False)
def delete_education_endpoint(
    education_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    delete_education(db, current_user, str(education_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/candidates/me/experience", response_model=list[JobSeekerExperienceResponse])
@router.get("/job-seekers/me/experience", response_model=list[JobSeekerExperienceResponse], include_in_schema=False)
def list_experience_endpoint(
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    return list_experience(db, current_user)


@router.post("/candidates/me/experience", response_model=list[JobSeekerExperienceResponse], status_code=status.HTTP_201_CREATED)
@router.post("/job-seekers/me/experience", response_model=list[JobSeekerExperienceResponse], status_code=status.HTTP_201_CREATED, include_in_schema=False)
def create_experience_endpoint(
    payload: JobSeekerExperienceCreateRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    return create_experience(db, current_user, payload)


@router.put("/candidates/me/experience/{experience_id}", response_model=list[JobSeekerExperienceResponse])
@router.put("/job-seekers/me/experience/{experience_id}", response_model=list[JobSeekerExperienceResponse], include_in_schema=False)
def update_experience_endpoint(
    experience_id: UUID,
    payload: JobSeekerExperienceUpdateRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    return update_experience(db, current_user, str(experience_id), payload)


@router.delete("/candidates/me/experience/{experience_id}", status_code=status.HTTP_204_NO_CONTENT)
@router.delete("/job-seekers/me/experience/{experience_id}", status_code=status.HTTP_204_NO_CONTENT, include_in_schema=False)
def delete_experience_endpoint(
    experience_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    delete_experience(db, current_user, str(experience_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/candidates/me/skills", response_model=list[JobSeekerSkillResponse])
@router.get("/job-seekers/me/skills", response_model=list[JobSeekerSkillResponse], include_in_schema=False)
def list_skills_endpoint(
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    return list_skills(db, current_user)


@router.post("/candidates/me/skills", response_model=list[JobSeekerSkillResponse], status_code=status.HTTP_201_CREATED)
@router.post("/job-seekers/me/skills", response_model=list[JobSeekerSkillResponse], status_code=status.HTTP_201_CREATED, include_in_schema=False)
def create_skill_endpoint(
    payload: JobSeekerSkillCreateRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    return create_skill(db, current_user, payload)


@router.put("/candidates/me/skills/{skill_row_id}", response_model=list[JobSeekerSkillResponse])
@router.put("/job-seekers/me/skills/{skill_row_id}", response_model=list[JobSeekerSkillResponse], include_in_schema=False)
def update_skill_endpoint(
    skill_row_id: UUID,
    payload: JobSeekerSkillUpdateRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    return update_skill(db, current_user, str(skill_row_id), payload)


@router.delete("/candidates/me/skills/{skill_row_id}", status_code=status.HTTP_204_NO_CONTENT)
@router.delete("/job-seekers/me/skills/{skill_row_id}", status_code=status.HTTP_204_NO_CONTENT, include_in_schema=False)
def delete_skill_endpoint(
    skill_row_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    delete_skill(db, current_user, str(skill_row_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/candidates/me/languages", response_model=list[JobSeekerLanguageResponse])
@router.get("/job-seekers/me/languages", response_model=list[JobSeekerLanguageResponse], include_in_schema=False)
def list_languages_endpoint(
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    return list_languages(db, current_user)


@router.post("/candidates/me/languages", response_model=list[JobSeekerLanguageResponse], status_code=status.HTTP_201_CREATED)
@router.post("/job-seekers/me/languages", response_model=list[JobSeekerLanguageResponse], status_code=status.HTTP_201_CREATED, include_in_schema=False)
def create_language_endpoint(
    payload: JobSeekerLanguageCreateRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    return create_language(db, current_user, payload)


@router.put("/candidates/me/languages/{language_id}", response_model=list[JobSeekerLanguageResponse])
@router.put("/job-seekers/me/languages/{language_id}", response_model=list[JobSeekerLanguageResponse], include_in_schema=False)
def update_language_endpoint(
    language_id: UUID,
    payload: JobSeekerLanguageUpdateRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    return update_language(db, current_user, str(language_id), payload)


@router.delete("/candidates/me/languages/{language_id}", status_code=status.HTTP_204_NO_CONTENT)
@router.delete("/job-seekers/me/languages/{language_id}", status_code=status.HTTP_204_NO_CONTENT, include_in_schema=False)
def delete_language_endpoint(
    language_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    delete_language(db, current_user, str(language_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/candidates/me/preference", response_model=JobSeekerPreferenceResponse | None)
@router.get("/job-seekers/me/preference", response_model=JobSeekerPreferenceResponse | None, include_in_schema=False)
def get_preference_endpoint(
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    return get_preference(db, current_user)


@router.put("/candidates/me/preference", response_model=JobSeekerProfileResponse)
@router.put("/job-seekers/me/preference", response_model=JobSeekerProfileResponse, include_in_schema=False)
def upsert_preference_endpoint(
    payload: JobSeekerPreferenceUpsertRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    return upsert_preference(db, current_user, payload)

@router.get(
    "/candidates/me/offers/active-count",
    response_model=CandidateActiveOffersCountResponse,
)
def get_my_active_offers_count_endpoint(
    db: Session = Depends(get_db),
    _current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    return get_active_offers_count(db)


@router.get(
    "/candidates/me/matched-offers",
    response_model=CandidateMatchedOffersResponse,
)
def get_my_matched_offers_endpoint(
    min_score: float | None = Query(default=None, ge=0, le=100),
    force_refresh: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    return get_my_matched_offers(
        db,
        current_user,
        min_score=min_score,
        force_refresh=force_refresh,
    )

@router.get(
    "/candidates/me/interests",
    response_model=list[JobSeekerInterestResponse],
)
@router.get(
    "/candidates/me/keywords",
    response_model=list[JobSeekerInterestResponse],
    include_in_schema=False,
)
def get_my_interests_endpoint(
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    return get_my_interests(db, current_user)


@router.put(
    "/candidates/me/interests",
    response_model=list[JobSeekerInterestResponse],
)
@router.put(
    "/candidates/me/keywords",
    response_model=list[JobSeekerInterestResponse],
    include_in_schema=False,
)
def replace_my_interests_endpoint(
    payload: JobSeekerInterestBulkRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    return replace_my_interests(
        db,
        current_user,
        interests=[i.model_dump(mode="json") for i in payload.interests],
    )


@router.get(
    "/candidates/me/preferences/offer-threshold",
    response_model=JobSeekerOfferThresholdResponse,
)
def get_my_offer_threshold_endpoint(
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    return get_my_offer_score_threshold(db, current_user)


@router.put(
    "/candidates/me/preferences/offer-threshold",
    response_model=JobSeekerOfferThresholdResponse,
)
def update_my_offer_threshold_endpoint(
    payload: JobSeekerOfferThresholdRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    return update_my_offer_score_threshold(
        db,
        current_user,
        min_offer_score_threshold=payload.min_offer_score_threshold,
    )


@router.post(
    "/candidates/me/applications",
    response_model=JobApplicationResponse,
)
def apply_to_offer_endpoint(
    payload: JobApplicationCreateRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    return apply_to_offer(
        db,
        current_user,
        offer_id=payload.offer_id,
        matching_result_id=payload.matching_result_id,
        cover_message=payload.cover_message,
    )


@router.get(
    "/candidates/me/applications",
    response_model=list[JobApplicationResponse],
)
def list_my_applications_endpoint(
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    return list_my_applications(db, current_user)