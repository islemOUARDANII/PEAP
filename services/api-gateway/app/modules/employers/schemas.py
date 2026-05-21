from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class EmployerBaseModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)


class EmployerUpdateRequest(EmployerBaseModel):
    legal_name: str = Field(min_length=1)
    commercial_name: str | None = None
    tax_identifier: str | None = None
    sector_code: str | None = None
    size_category: str | None = None
    website_url: str | None = None          # canonical field on employer table


class EmployerContactUpsertRequest(EmployerBaseModel):
    contact_name: str = Field(min_length=1)
    job_title: str | None = None
    email: EmailStr | None = None
    phone: str | None = None


class EmployerLocationUpsertRequest(EmployerBaseModel):
    address: str | None = None
    # Champs canoniques (IDs)
    country_id: str | None = None              # UUID → geo.country.id
    governorate_unit_id: str | None = None     # UUID → geo.admin_unit (niveau 1)
    delegation_unit_id: str | None = None      # UUID → geo.admin_unit (niveau 2)
    imada_unit_id: str | None = None           # UUID → geo.admin_unit (niveau 3)
    location_unit_id: str | None = None        # UUID → geo.admin_unit (plus précis)
    postal_code_id: str | None = None          # UUID → geo.postal_code.id
    postal_code: str | None = None             # valeur texte du code postal
    # Champs codes (fallback rétrocompatibilité)
    country: str = Field(min_length=1, default="TN")    # ISO2 code for lookup
    governorate_code: str | None = None                  # lookup param → governorate_unit_id
    delegation_code: str | None = None                   # lookup param → delegation_unit_id


class EmployerContactResponse(BaseModel):
    id: str
    contact_name: str
    job_title: str | None = None
    email: str | None = None
    phone: str | None = None
    created_at: datetime
    updated_at: datetime


class EmployerLocationResponse(BaseModel):
    id: str
    address: str | None = None
    country: str | None = None
    country_id: str | None = None
    governorate_code: str | None = None
    governorate_label: str | None = None
    delegation_code: str | None = None
    delegation_label: str | None = None
    created_at: datetime
    updated_at: datetime


class EmployerProfileResponse(BaseModel):
    id: str
    user_id: str | None = None
    legal_name: str
    commercial_name: str | None = None
    tax_identifier: str | None = None
    sector_code: str | None = None
    size_category: str | None = None
    website_url: str | None = None
    status: str
    created_at: datetime
    updated_at: datetime
    contact: EmployerContactResponse | None = None
    location: EmployerLocationResponse | None = None


class EmployerListItemResponse(BaseModel):
    id: str
    legal_name: str
    commercial_name: str | None = None
    tax_identifier: str | None = None
    sector_code: str | None = None
    size_category: str | None = None
    status: str
    governorate_code: str | None = None
    governorate_label: str | None = None
    delegation_code: str | None = None
    delegation_label: str | None = None
    updated_at: datetime

class EmployerApplicationResponse(BaseModel):
    id: str
    job_seeker_id: str
    offer_id: str
    offer_title: str | None = None
    offer_aneti_identifier: str | None = None

    candidate_name: str | None = None
    candidate_email: str | None = None
    candidate_phone: str | None = None

    matching_result_id: str | None = None
    status: str
    cover_message: str | None = None
    applied_at: datetime
    updated_at: datetime


class EmployerMatchedCandidateResponse(BaseModel):
    result_id: str
    run_id: str
    candidate_id: str

    candidate_name: str | None = None
    candidate_email: str | None = None
    candidate_phone: str | None = None
    candidate_status: str | None = None

    current_cv_id: str | None = None
    cv_parsing_status: str | None = None

    score_global: float
    score_percent: float
    rank: int

    explanation_short: str | None = None
    explanation_json: dict[str, Any] = Field(default_factory=dict)
    has_gaps: bool = False

    already_applied: bool = False
    application_id: str | None = None
    application_status: str | None = None
    applied_at: datetime | None = None

    created_at: datetime


class EmployerMatchedCandidatesResponse(BaseModel):
    model_code: str
    model_version_id: str
    run_id: str
    offer_id: str
    min_score: float
    active_candidates_count: int
    total_results: int
    matched_count: int
    candidates: list[EmployerMatchedCandidateResponse]
    cache: dict[str, Any] = Field(default_factory=dict)