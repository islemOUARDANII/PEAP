from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class OfferBaseModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)


class JobOfferRequirementWriteRequest(OfferBaseModel):
    criterion_type: Literal[
        "SKILL",
        "LANGUAGE",
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
        "SOFT_SKILL",
        "ACTIVITY",
        "OCCUPATION",
        "APPELLATION",
    ]
    node_id: UUID | None = None
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
    raw_value: str | None = None
    min_level: str | None = None
    min_years: Decimal | None = None
    is_must: bool
    weight: int | None = None
    created_at: datetime
    updated_at: datetime


class JobOfferWriteRequest(OfferBaseModel):
    title: str = Field(min_length=1)
    description: str | None = None
    rtmc_occupation_id: UUID | None = None
    number_of_positions: int = Field(default=1, ge=1)
    contract_type: str | None = None
    work_mode: str | None = None
    salary_min: Decimal | None = None
    salary_max: Decimal | None = None
    country: str = Field(min_length=1, default="TN")
    governorate_code: str | None = None
    delegation_code: str | None = None
    deadline_at: datetime | None = None
    requirements: list[JobOfferRequirementWriteRequest] = Field(default_factory=list)


class JobOfferCreateRequest(JobOfferWriteRequest):
    pass


class JobOfferUpdateRequest(JobOfferWriteRequest):
    pass


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


class JobOfferListItemResponse(BaseModel):
    id: str
    aneti_identifier: str | None = None
    employer_id: str
    title: str
    description: str | None = None
    number_of_positions: int
    status: str
    contract_type: str | None = None
    work_mode: str | None = None
    salary_min: Decimal | None = None
    salary_max: Decimal | None = None
    country: str
    governorate_code: str | None = None
    governorate_label: str | None = None
    delegation_code: str | None = None
    delegation_label: str | None = None
    published_at: datetime | None = None
    deadline_at: datetime | None = None
    created_by_user_id: str | None = None
    validated_by_user_id: str | None = None
    created_at: datetime
    updated_at: datetime


class JobOfferResponse(JobOfferListItemResponse):
    employer_name: str | None = None
    requirements: list[JobOfferRequirementResponse] = Field(default_factory=list)
    warning: str | None = None
    action_reason: str | None = None


class OfferActionRequest(OfferBaseModel):
    reason: str | None = None


class JobOfferDraftParseResponse(BaseModel):
    parsing_status: str
    parsed_payload: dict[str, Any] = Field(default_factory=dict)
    mapped_payload: dict[str, Any] = Field(default_factory=dict)
    extracted_requirements: list[dict[str, Any]] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    parser_version: str | None = None
    draft: dict[str, Any] = Field(default_factory=dict)