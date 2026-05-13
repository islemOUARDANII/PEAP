from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class JobSeekerBaseModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)


class JobSeekerUpdateRequest(JobSeekerBaseModel):
    primary_language: str | None = None


class JobSeekerIdentityUpsertRequest(JobSeekerBaseModel):
    cin: str | None = None
    passport_number: str | None = None
    first_name: str = Field(min_length=1)
    last_name: str = Field(min_length=1)
    birth_date: date | None = None
    gender_code: str | None = None
    nationality: str | None = None
    code_handicap: str | None = None
    code_degre_handicap: str | None = None


class JobSeekerContactUpsertRequest(JobSeekerBaseModel):
    email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None
    country: str = Field(min_length=1, default="TN")
    governorate_code: str | None = None
    delegation_code: str | None = None


class JobSeekerEducationWriteRequest(JobSeekerBaseModel):
    level_code: str | None = None
    diploma_label: str | None = None
    specialty: str | None = None
    institution: str | None = None
    graduation_year: int | None = Field(default=None, ge=1950, le=2100)
    rtmc_education_node_id: UUID | None = None


class JobSeekerEducationCreateRequest(JobSeekerEducationWriteRequest):
    pass


class JobSeekerEducationUpdateRequest(JobSeekerEducationWriteRequest):
    pass


class JobSeekerExperienceWriteRequest(JobSeekerBaseModel):
    occupation_id: UUID | None = None
    job_title_raw: str | None = None
    company_name: str | None = None
    sector: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    duration_months: int | None = Field(default=None, ge=0)
    description: str | None = None


class JobSeekerExperienceCreateRequest(JobSeekerExperienceWriteRequest):
    pass


class JobSeekerExperienceUpdateRequest(JobSeekerExperienceWriteRequest):
    pass


class JobSeekerSkillWriteRequest(JobSeekerBaseModel):
    skill_id: UUID | None = None
    skill_label_raw: str | None = None
    level: str | None = None
    years: Decimal | None = Field(default=None, ge=0)
    evidence: str | None = None
    source: Literal["CV", "MANUAL", "ADVISOR", "IMPORT", "PARSING"] | None = None


class JobSeekerSkillCreateRequest(JobSeekerSkillWriteRequest):
    pass


class JobSeekerSkillUpdateRequest(JobSeekerSkillWriteRequest):
    pass


class JobSeekerLanguageWriteRequest(JobSeekerBaseModel):
    language_code: str = Field(min_length=1)
    level: str | None = None
    evidence: str | None = None


class JobSeekerLanguageCreateRequest(JobSeekerLanguageWriteRequest):
    pass


class JobSeekerLanguageUpdateRequest(JobSeekerLanguageWriteRequest):
    pass


class JobSeekerPreferenceUpsertRequest(JobSeekerBaseModel):
    preferred_contract_type: str | None = None
    preferred_governorate: str | None = None
    mobility_radius_km: Decimal | None = Field(default=None, ge=0)
    accepts_relocation: bool = False
    desired_salary_min: Decimal | None = None
    desired_salary_max: Decimal | None = None


class CvMetadataResponse(BaseModel):
    id: str
    cv_id: str
    storage_provider: str
    container_name: str
    blob_name: str
    storage_key: str
    blob_url: str | None = None
    original_filename: str | None = None
    mime_type: str
    file_size_bytes: int | None = None
    status: str
    is_current: bool
    parsing_status: str
    uploaded_by_user_id: str | None = None
    uploaded_at: datetime
    created_at: datetime
    updated_at: datetime


class JobSeekerIdentityResponse(BaseModel):
    id: str
    cin: str | None = None
    passport_number: str | None = None
    first_name: str
    last_name: str
    birth_date: date | None = None
    gender_code: str | None = None
    gender_label: str | None = None
    nationality: str | None = None
    code_handicap: str | None = None
    handicap_label: str | None = None
    code_degre_handicap: str | None = None
    degre_handicap_label: str | None = None


class JobSeekerContactResponse(BaseModel):
    id: str
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    country: str
    governorate_code: str | None = None
    governorate_label: str | None = None
    delegation_code: str | None = None
    delegation_label: str | None = None


class JobSeekerEducationResponse(BaseModel):
    id: str
    level_code: str | None = None
    level_label: str | None = None
    diploma_label: str | None = None
    specialty: str | None = None
    institution: str | None = None
    graduation_year: int | None = None
    rtmc_education_node_id: str | None = None
    created_at: datetime
    updated_at: datetime


class JobSeekerExperienceResponse(BaseModel):
    id: str
    occupation_id: str | None = None
    job_title_raw: str | None = None
    company_name: str | None = None
    sector: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    duration_months: int | None = None
    description: str | None = None
    created_at: datetime
    updated_at: datetime


class JobSeekerSkillResponse(BaseModel):
    id: str
    skill_id: str | None = None
    skill_label_raw: str | None = None
    skill_node_label: str | None = None
    skill_node_type: str | None = None
    level: str | None = None
    years: Decimal | None = None
    evidence: str | None = None
    source: str | None = None
    created_at: datetime
    updated_at: datetime


class JobSeekerLanguageResponse(BaseModel):
    id: str
    language_code: str
    language_label_fr: str | None = None
    language_label_en: str | None = None
    level: str | None = None
    level_label_fr: str | None = None
    level_label_en: str | None = None
    evidence: str | None = None
    created_at: datetime
    updated_at: datetime


class JobSeekerPreferenceResponse(BaseModel):
    id: str
    preferred_contract_type: str | None = None
    preferred_governorate: str | None = None
    preferred_governorate_label: str | None = None
    mobility_radius_km: Decimal | None = None
    accepts_relocation: bool
    desired_salary_min: Decimal | None = None
    desired_salary_max: Decimal | None = None


class JobSeekerProfileResponse(BaseModel):
    id: str
    user_id: str | None = None
    aneti_identifier: str | None = None
    status: str
    registration_date: date | None = None
    primary_language: str | None = None
    identity: JobSeekerIdentityResponse | None = None
    contact: JobSeekerContactResponse | None = None
    education: list[JobSeekerEducationResponse] = Field(default_factory=list)
    experience: list[JobSeekerExperienceResponse] = Field(default_factory=list)
    skills: list[JobSeekerSkillResponse] = Field(default_factory=list)
    languages: list[JobSeekerLanguageResponse] = Field(default_factory=list)
    preference: JobSeekerPreferenceResponse | None = None
    current_cv: CvMetadataResponse | None = None


class CandidateListItemResponse(BaseModel):
    id: str
    aneti_identifier: str | None = None
    full_name: str | None = None
    status: str
    governorate_code: str | None = None
    governorate_label: str | None = None
    delegation_code: str | None = None
    delegation_label: str | None = None
    current_cv_exists: bool
    updated_at: datetime


class CandidateStatusUpdateRequest(JobSeekerBaseModel):
    status: str = Field(min_length=1)
    reason: str | None = None


class CandidateStatusUpdateResponse(BaseModel):
    id: str
    status: str
    reason: str | None = None
    warning: str | None = None

class CandidateActiveOffersCountResponse(BaseModel):
    active_offers_count: int

class CandidateMatchedOfferItemResponse(BaseModel):
    result_id: str
    run_id: str
    offer_id: str
    title: str | None = None
    employer_name: str | None = None
    description: str | None = None
    status: str | None = None
    contract_type: str | None = None
    work_mode: str | None = None
    country: str | None = None
    governorate_code: str | None = None
    governorate_label: str | None = None
    delegation_code: str | None = None
    delegation_label: str | None = None
    published_at: datetime | None = None
    deadline_at: datetime | None = None

    score_global: float
    score_percent: float
    rank: int
    explanation_short: str | None = None
    explanation_json: dict[str, Any] = {}
    has_gaps: bool = False

    already_applied: bool = False
    application_id: str | None = None
    application_status: str | None = None
    
class CandidateMatchingCacheInfoResponse(BaseModel):
    reused: bool
    candidate_last_updated: str | None = None
    offers_last_updated: str | None = None
    min_valid_created_at: str | None = None

class CandidateMatchedOffersResponse(BaseModel):
    model_code: str
    model_version_id: str
    run_id: str
    min_score: float
    active_offers_count: int
    total_results: int
    matched_count: int
    offers: list[CandidateMatchedOfferItemResponse]
    cache: CandidateMatchingCacheInfoResponse | None = None

class JobSeekerKeywordResponse(BaseModel):
    id: str
    keyword: str
    keyword_type: str
    source: str
    weight: float
    created_at: datetime
    updated_at: datetime


class JobSeekerKeywordUpsertRequest(BaseModel):
    keywords: list[str]


class JobApplicationCreateRequest(BaseModel):
    offer_id: str
    matching_result_id: str | None = None
    cover_message: str | None = None


class JobApplicationResponse(BaseModel):
    id: str
    job_seeker_id: str
    offer_id: str
    matching_result_id: str | None = None
    status: str
    cover_message: str | None = None
    applied_at: datetime
    updated_at: datetime


class JobSeekerOfferThresholdRequest(BaseModel):
    min_offer_score_threshold: float


class JobSeekerOfferThresholdResponse(BaseModel):
    min_offer_score_threshold: float