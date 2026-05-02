from pydantic import BaseModel, Field
from typing import Any, Optional
from uuid import UUID


class CvParseRequest(BaseModel):
    cv_record_id: UUID
    job_seeker_id: UUID
    storage_provider: str
    container_name: str
    blob_name: str
    trace_id: Optional[str] = None


class ParsedProfilePatch(BaseModel):
    identity: dict[str, Any] = Field(default_factory=dict)
    education: list[dict[str, Any]] = Field(default_factory=list)
    experience: list[dict[str, Any]] = Field(default_factory=list)
    skills: list[dict[str, Any]] = Field(default_factory=list)
    languages: list[dict[str, Any]] = Field(default_factory=list)


class CvParseResponse(BaseModel):
    cv_record_id: UUID
    job_seeker_id: UUID
    parsing_status: str
    parsed_payload: dict[str, Any] = Field(default_factory=dict)
    mapped_payload: dict[str, Any] = Field(default_factory=dict)
    extracted_profile_patch: ParsedProfilePatch = Field(default_factory=ParsedProfilePatch)
    warnings: list[str] = Field(default_factory=list)
    parser_version: str = "placeholder-v1"


class OfferParseRequest(BaseModel):
    offer_id: UUID
    title: str
    description: Optional[str] = None
    trace_id: Optional[str] = None


class OfferParseResponse(BaseModel):
    offer_id: UUID
    parsing_status: str
    parsed_payload: dict[str, Any] = Field(default_factory=dict)
    mapped_payload: dict[str, Any] = Field(default_factory=dict)
    extracted_requirements: list[dict[str, Any]] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    parser_version: str = "placeholder-v1"