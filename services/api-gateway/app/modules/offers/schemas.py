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
    node_id: UUID | None = None          # taxonomy_node.id
    ref_value_id: UUID | None = None     # reference.ref_value.id
    raw_value: str | None = None
    min_level: str | None = None
    min_years: Decimal | None = Field(default=None, ge=0)
    is_must: bool = False
    weight: int | None = Field(default=None, ge=0, le=100)


class JobOfferRequirementResponse(BaseModel):
    id: str
    criterion_type: str
    node_id: str | None = None
    node_label: str | None = None
    node_type: str | None = None
    ref_value_id: str | None = None
    raw_value: str | None = None
    min_level: str | None = None
    min_years: Decimal | None = None
    is_must: bool
    weight: int | None = None
    created_at: datetime
    updated_at: datetime


# ─── Language requirement ─────────────────────────────────────────────────────

class JobOfferLanguageRequirementWriteRequest(OfferBaseModel):
    language_code: str = Field(min_length=1)
    level_code: str | None = None
    is_mandatory: bool = False


class JobOfferLanguageRequirementResponse(BaseModel):
    id: str
    language_code: str | None = None
    level_code: str | None = None
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

    # Geo (canonical)
    country_id: UUID | None = None
    location_unit_id: UUID | None = None
    governorate_unit_id: UUID | None = None
    delegation_unit_id: UUID | None = None

    # Geo (legacy fallback — kept for backward compat)
    country: str = Field(default="TN")
    governorate_code: str | None = None
    delegation_code: str | None = None

    # Contract / work mode
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

    # Structured requirements (SKILL / SOFT_SKILL / OCCUPATION / etc.)
    requirements: list[JobOfferRequirementWriteRequest] = Field(default_factory=list)

    # Structured language requirements
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
    node_id: str | None = None
    raw_value: str | None = None
    min_level: str | None = None
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
    contract_type: str | None = None
    work_mode: str | None = None
    salary_min: Decimal | None = None
    salary_max: Decimal | None = None
    salary_currency_code: str = "TND"
    country: str = "TN"
    governorate_code: str | None = None
    governorate_label: str | None = None
    delegation_code: str | None = None
    delegation_label: str | None = None
    # Canonical geo ids surfaced for front display
    country_id: str | None = None
    governorate_unit_id: str | None = None
    delegation_unit_id: str | None = None
    occupation_node_id: str | None = None
    occupation_node_label: str | None = None
    # New fields
    min_experience_months: int | None = None
    diploma_ref_id: str | None = None
    specialty_ref_id: str | None = None
    is_accessible_to_disabled: bool = False
    accessibility_notes: str | None = None
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
