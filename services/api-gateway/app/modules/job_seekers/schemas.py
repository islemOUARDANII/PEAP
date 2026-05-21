from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class JobSeekerBaseModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)


class JobSeekerUpdateRequest(JobSeekerBaseModel):
    pass  # primary_language removed — no updatable top-level fields remain


class JobSeekerIdentityUpsertRequest(JobSeekerBaseModel):
    cin: str | None = None
    passport_number: str | None = None
    first_name: str = Field(min_length=1)
    last_name: str = Field(min_length=1)
    birth_date: date | None = None
    gender_code: str | None = None
    nationality: str | None = None
    nationality_country_id: UUID | None = None  # FK → geo.country.id
    code_handicap: str | None = None
    code_degre_handicap: str | None = None


class JobSeekerContactUpsertRequest(JobSeekerBaseModel):
    email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None
    # Champs canoniques (IDs)
    country_id: UUID | None = None              # FK → geo.country.id
    governorate_unit_id: UUID | None = None     # FK → geo.admin_unit (niveau 1)
    delegation_unit_id: UUID | None = None      # FK → geo.admin_unit (niveau 2)
    imada_unit_id: UUID | None = None           # FK → geo.admin_unit (niveau 3)
    location_unit_id: UUID | None = None        # FK → geo.admin_unit (plus précis dispo)
    postal_code_id: UUID | None = None          # FK → geo.postal_code.id
    postal_code: str | None = None              # valeur texte du code postal
    # Champs codes (fallback rétrocompatibilité)
    country: str = Field(min_length=1, default="TN")  # ISO2 code — used for country_id lookup
    governorate_code: str | None = None  # lookup param pour governorate_unit_id
    delegation_code: str | None = None   # lookup param pour delegation_unit_id


class JobSeekerEducationWriteRequest(JobSeekerBaseModel):
    level_code: str | None = None
    level_ref_id: UUID | None = None        # FK → reference.ref_value (EDUCATION_LEVEL)
    diploma_code: str | None = None         # code in DIPLOMA group
    diploma_ref_id: UUID | None = None      # FK → reference.ref_value (DIPLOMA)
    specialty_code: str | None = None       # code in SPECIALTY group
    specialty_ref_id: UUID | None = None    # FK → reference.ref_value (SPECIALTY)
    institution: str | None = None
    graduation_year: int | None = Field(default=None, ge=1950, le=2100)


class JobSeekerEducationCreateRequest(JobSeekerEducationWriteRequest):
    pass


class JobSeekerEducationUpdateRequest(JobSeekerEducationWriteRequest):
    pass


class JobSeekerExperienceWriteRequest(JobSeekerBaseModel):
    occupation_node_id: UUID | None = None  # FK → taxonomy.taxonomy_node (OCCUPATION)
    job_title_raw: str | None = None
    company_name: str | None = None
    sector_code: str | None = None          # code in ACTIVITY_SECTOR group
    sector_ref_id: UUID | None = None       # FK → reference.ref_value (ACTIVITY_SECTOR)
    country_id: UUID | None = None          # FK → geo.country
    location_unit_id: UUID | None = None    # FK → geo.admin_unit
    start_date: date | None = None
    end_date: date | None = None
    is_current: bool = False
    duration_months: int | None = Field(default=None, ge=0)
    description: str | None = None


class JobSeekerExperienceCreateRequest(JobSeekerExperienceWriteRequest):
    pass


class JobSeekerExperienceUpdateRequest(JobSeekerExperienceWriteRequest):
    pass


class JobSeekerSkillWriteRequest(JobSeekerBaseModel):
    skill_node_id: UUID | None = None   # FK → taxonomy.taxonomy_node (SKILL)
    level_ref_id: UUID | None = None    # FK → reference.ref_value (SKILL_LEVEL)
    level_code: str | None = None       # code in SKILL_LEVEL group (fallback)
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
    accepts_relocation: bool | None = None
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
    nationality_country_id: str | None = None
    nationality_country_label: str | None = None
    code_handicap: str | None = None
    handicap_label: str | None = None
    code_degre_handicap: str | None = None
    degre_handicap_label: str | None = None


class JobSeekerContactResponse(BaseModel):
    id: str
    email: str | None = None
    phone: str | None = None
    address: str | None = None

    country: str | None = None
    country_id: str | None = None
    country_label: str | None = None

    governorate_unit_id: str | None = None
    governorate_code: str | None = None
    governorate_label: str | None = None

    delegation_unit_id: str | None = None
    delegation_code: str | None = None
    delegation_label: str | None = None

    imada_unit_id: str | None = None
    imada_code: str | None = None
    imada_label: str | None = None

    location_unit_id: str | None = None
    location_code: str | None = None
    location_label: str | None = None

    postal_code_id: str | None = None
    postal_code: str | None = None
    postal_code_value: str | None = None


class JobSeekerEducationResponse(BaseModel):
    id: str
    level_code: str | None = None
    level_ref_id: str | None = None
    level_label: str | None = None
    diploma_label: str | None = None   # join-derived label, kept for frontend compat
    diploma_code: str | None = None
    diploma_ref_id: str | None = None
    specialty: str | None = None       # join-derived label
    specialty_code: str | None = None
    specialty_ref_id: str | None = None
    institution: str | None = None
    graduation_year: int | None = None
    created_at: datetime
    updated_at: datetime


class JobSeekerExperienceResponse(BaseModel):
    id: str
    occupation_node_id: str | None = None
    occupation_label: str | None = None
    job_title_raw: str | None = None
    company_name: str | None = None
    sector_ref_id: str | None = None
    sector_code: str | None = None
    sector_label: str | None = None
    country_id: str | None = None
    country_code: str | None = None
    country_label: str | None = None
    location_unit_id: str | None = None
    location_code: str | None = None
    location_label: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_current: bool = False
    duration_months: int | None = None
    description: str | None = None
    created_at: datetime
    updated_at: datetime


class JobSeekerSkillResponse(BaseModel):
    id: str
    skill_node_id: str | None = None
    skill_node_label: str | None = None
    skill_node_type: str | None = None
    level_ref_id: str | None = None
    level_code: str | None = None
    level_label: str | None = None
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
    contract_type: str | None = None   # code from contract_type_ref_id join
    work_mode: str | None = None       # code from work_mode_ref_id join
    country: str | None = None         # iso2 from country_id join
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


# ─── Interest schemas (replaces legacy keyword schemas) ───────────────────────

class JobSeekerInterestWriteRequest(BaseModel):
    taxonomy_node_id: UUID
    interest_type_code: str | None = None  # code in INTEREST_TYPE group
    source: str | None = None
    weight: float = Field(default=1.0, ge=0, le=10)


class JobSeekerInterestBulkRequest(BaseModel):
    interests: list[JobSeekerInterestWriteRequest]


class JobSeekerInterestResponse(BaseModel):
    id: str
    taxonomy_node_id: str | None = None
    taxonomy_node_label: str | None = None
    taxonomy_node_type: str | None = None
    interest_type_code: str | None = None
    interest_type_label: str | None = None
    source: str | None = None
    weight: float
    created_at: datetime
    updated_at: datetime


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


# ─── Aggregate profile ────────────────────────────────────────────────────────

class CandidateBaseInfoResponse(BaseModel):
    id: str
    user_id: str | None = None
    aneti_identifier: str | None = None
    status: str
    registration_date: date | None = None


class CandidateAggregateProfileResponse(BaseModel):
    profile_version: int = 1
    candidate: CandidateBaseInfoResponse
    identity: JobSeekerIdentityResponse | None = None
    contact: JobSeekerContactResponse | None = None
    preference: JobSeekerPreferenceResponse | None = None
    education: list[JobSeekerEducationResponse] = Field(default_factory=list)
    experience: list[JobSeekerExperienceResponse] = Field(default_factory=list)
    skills: list[JobSeekerSkillResponse] = Field(default_factory=list)
    languages: list[JobSeekerLanguageResponse] = Field(default_factory=list)
    cv: CvMetadataResponse | None = None
    interests: list[JobSeekerInterestResponse] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)  # preferred_labels from interests
    offer_threshold: float = 50.0


# ─── Aggregate profile PATCH request ─────────────────────────────────────────

class CandidateEducationUpsertItem(JobSeekerEducationWriteRequest):
    id: str | None = None


class CandidateExperienceUpsertItem(JobSeekerExperienceWriteRequest):
    id: str | None = None


class CandidateSkillUpsertItem(JobSeekerSkillWriteRequest):
    id: str | None = None


class CandidateLanguageUpsertItem(JobSeekerLanguageWriteRequest):
    id: str | None = None


class EducationChangeset(BaseModel):
    upsert: list[CandidateEducationUpsertItem] = Field(default_factory=list)
    delete_ids: list[str] = Field(default_factory=list)


class ExperienceChangeset(BaseModel):
    upsert: list[CandidateExperienceUpsertItem] = Field(default_factory=list)
    delete_ids: list[str] = Field(default_factory=list)


class SkillChangeset(BaseModel):
    upsert: list[CandidateSkillUpsertItem] = Field(default_factory=list)
    delete_ids: list[str] = Field(default_factory=list)


class LanguageChangeset(BaseModel):
    upsert: list[CandidateLanguageUpsertItem] = Field(default_factory=list)
    delete_ids: list[str] = Field(default_factory=list)


class CandidateProfilePatchRequest(BaseModel):
    """Single-roundtrip profile update. Only include sections that changed."""

    profile_version: int | None = None  # optimistic lock — omit to skip check
    candidate: JobSeekerUpdateRequest | None = None
    identity: JobSeekerIdentityUpsertRequest | None = None
    contact: JobSeekerContactUpsertRequest | None = None
    preference: JobSeekerPreferenceUpsertRequest | None = None
    education: EducationChangeset | None = None
    experience: ExperienceChangeset | None = None
    skills: SkillChangeset | None = None
    languages: LanguageChangeset | None = None
    interests: list[JobSeekerInterestWriteRequest] | None = None
    offer_threshold: float | None = None
