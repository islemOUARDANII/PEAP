from datetime import datetime
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class OfferBaseModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)


# ─── Requirement ──────────────────────────────────────────────────────────────

class JobOfferRequirementWriteRequest(OfferBaseModel):
    criterion_type: Literal[
        "SKILL",
        "SOFT_SKILL",
        "OCCUPATION",
        "APPELLATION",
        "LANGUAGE",
        "EDUCATION",
        "DIPLOMA",
        "SPECIALTY",
        "EXPERIENCE_YEARS",
        "CERTIFICATION",
        "LOCATION",
        "GOVERNORATE",
        "DELEGATION",
        "CONTRACT",
        "WORK_REGIME",
        "WORK_TIME_ORGANIZATION",
        "PERMIT_TYPE",
        "ACTIVITY",
        "AVAILABILITY",
        "OTHER",
    ]
    criterion_type_ref_id: UUID | None = None  # FK → reference.ref_value (CRITERION_TYPE)
    taxonomy_node_id: UUID | None = None        # FK → taxonomy.taxonomy_node
    ref_value_id: UUID | None = None            # FK → reference.ref_value
    min_level_ref_id: UUID | None = None        # FK → reference.ref_value (level)
    min_level_code: str | None = None           # fallback code for min_level lookup
    min_years: Decimal | None = Field(default=None, ge=0)
    is_must: bool = False
    weight: int | None = Field(default=None, ge=0, le=100)


class JobOfferRequirementResponse(BaseModel):
    id: str
    criterion_type: str | None = None           # code from criterion_type_ref_id join
    criterion_type_ref_id: str | None = None
    criterion_type_label: str | None = None
    taxonomy_node_id: str | None = None
    node_label: str | None = None
    node_type: str | None = None
    ref_value_id: str | None = None
    ref_value_label: str | None = None
    min_level: str | None = None                # code from min_level_ref_id join
    min_level_ref_id: str | None = None
    min_level_label: str | None = None
    min_years: Decimal | None = None
    is_must: bool
    weight: int | None = None
    created_at: datetime
    updated_at: datetime


# ─── Language requirement ─────────────────────────────────────────────────────

class JobOfferLanguageRequirementWriteRequest(OfferBaseModel):
    language_ref_id: UUID | None = None         # FK → reference.ref_value (LANGUAGE)
    language_code: str | None = None            # code fallback for lookup
    level_ref_id: UUID | None = None            # FK → reference.ref_value (LANGUAGE_LEVEL)
    level_code: str | None = None               # code fallback for lookup
    is_mandatory: bool = False


class JobOfferLanguageRequirementResponse(BaseModel):
    id: str
    language_ref_id: str | None = None
    language_code: str | None = None            # code from join
    language_label: str | None = None
    level_ref_id: str | None = None
    level_code: str | None = None               # code from join
    level_label: str | None = None
    is_mandatory: bool
    created_at: datetime
    updated_at: datetime


# ─── Offer write request ──────────────────────────────────────────────────────

class JobOfferWriteRequest(OfferBaseModel):
    title: str = Field(min_length=1)
    company_name: str | None = None
    description: str | None = None

    # Occupation (canonical)
    occupation_node_id: UUID | None = None

    # Geo — canonical FKs
    country_id: UUID | None = None
    governorate_unit_id: UUID | None = None     # gouvernorat (niveau 1)
    delegation_unit_id: UUID | None = None      # délégation (niveau 2)
    imada_unit_id: UUID | None = None           # imada (niveau 3)
    location_unit_id: UUID | None = None        # plus précis disponible (imada > délégation > gouvernorat)
    postal_code_id: UUID | None = None          # FK → geo.postal_code
    postal_code: str | None = None              # valeur texte du code postal

    # Geo — code fallbacks accepted from frontend for lookup
    country: str = Field(default="TN")
    governorate_code: str | None = None
    delegation_code: str | None = None

    # Contract / work mode — string codes resolved to ref_value FKs server-side
    contract_type: str | None = None
    work_mode: str | None = None

    # Salary
    salary_min: Decimal | None = None
    salary_max: Decimal | None = None
    salary_currency_code: str = "TND"

    # Experience & education
    min_experience_months: int | None = Field(default=None, ge=0)
    diploma_ref_id: UUID | None = None
    specialty_ref_id: UUID | None = None

    # Accessibility
    is_accessible_to_disabled: bool = False
    accessibility_notes: str | None = None

    number_of_positions: int = Field(default=1, ge=1)
    deadline_at: datetime | None = None

    # Structured requirements
    requirements: list[JobOfferRequirementWriteRequest] = Field(default_factory=list)
    language_requirements: list[JobOfferLanguageRequirementWriteRequest] = Field(default_factory=list)


class JobOfferCreateRequest(JobOfferWriteRequest):
    pass


class JobOfferUpdateRequest(JobOfferWriteRequest):
    pass


# ─── Parse request/response ───────────────────────────────────────────────────

class JobOfferDraftParseRequest(OfferBaseModel):
    raw_text: str = Field(min_length=1)
    title: str | None = None


class JobOfferDraftRequirementResponse(BaseModel):
    criterion_type: str
    taxonomy_node_id: str | None = None
    min_level_code: str | None = None
    min_years: Decimal | None = None
    is_must: bool
    weight: int | None = None


# ─── Offer list / detail responses ───────────────────────────────────────────

class JobOfferListItemResponse(BaseModel):
    id: str
    aneti_identifier: str | None = None
    employer_id: str
    company_name: str | None = None
    title: str
    description: str | None = None
    number_of_positions: int
    status: str
    contract_type: str | None = None            # code from contract_type_ref_id join
    work_mode: str | None = None                # code from work_mode_ref_id join
    salary_min: Decimal | None = None
    salary_max: Decimal | None = None
    salary_currency_code: str = "TND"
    country: str = "TN"                         # iso2 from country_id join
    governorate_code: str | None = None
    governorate_label: str | None = None
    delegation_code: str | None = None
    delegation_label: str | None = None
    # Canonical geo ids
    country_id: str | None = None
    governorate_unit_id: str | None = None
    delegation_unit_id: str | None = None
    occupation_node_id: str | None = None
    occupation_node_label: str | None = None
    min_experience_months: int | None = None
    diploma_ref_id: str | None = None
    specialty_ref_id: str | None = None
    is_accessible_to_disabled: bool = False
    accessibility_notes: str | None = None
    submitted_at: datetime | None = None
    published_at: datetime | None = None
    deadline_at: datetime | None = None
    created_by_user_id: str | None = None
    validated_by_user_id: str | None = None
    created_at: datetime
    updated_at: datetime


class JobOfferResponse(JobOfferListItemResponse):
    employer_name: str | None = None
    requirements: list[JobOfferRequirementResponse] = Field(default_factory=list)
    language_requirements: list[JobOfferLanguageRequirementResponse] = Field(default_factory=list)
    warning: str | None = None
    action_reason: str | None = None


# ─── Advisor actions ──────────────────────────────────────────────────────────

class OfferActionRequest(OfferBaseModel):
    reason: str | None = None


# ─── Draft parse response ─────────────────────────────────────────────────────

class JobOfferDraftParseResponse(BaseModel):
    parsing_status: str
    parsed_payload: dict[str, Any] = Field(default_factory=dict)
    mapped_payload: dict[str, Any] = Field(default_factory=dict)
    extracted_requirements: list[dict[str, Any]] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    parser_version: str | None = None
    draft: dict[str, Any] = Field(default_factory=dict)
