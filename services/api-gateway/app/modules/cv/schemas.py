from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class CvRecordResponse(BaseModel):
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
    parsed_resume_id: str | None = None
    parsing_status: str
    uploaded_by_user_id: str | None = None
    uploaded_at: datetime
    created_at: datetime
    updated_at: datetime


class ParsedProfilePatchResponse(BaseModel):
    identity: dict[str, Any] = Field(default_factory=dict)
    education: list[dict[str, Any]] = Field(default_factory=list)
    experience: list[dict[str, Any]] = Field(default_factory=list)
    skills: list[dict[str, Any]] = Field(default_factory=list)
    languages: list[dict[str, Any]] = Field(default_factory=list)


class CvParseResponse(BaseModel):
    cv_record_id: str
    job_seeker_id: str
    parsing_status: str
    parsed_payload: dict[str, Any] = Field(default_factory=dict)
    mapped_payload: dict[str, Any] = Field(default_factory=dict)
    extracted_profile_patch: ParsedProfilePatchResponse = Field(default_factory=ParsedProfilePatchResponse)
    warnings: list[str] = Field(default_factory=list)
    parser_version: str

class ParsedResumeSnapshotResponse(BaseModel):
    id: str
    job_seeker_id: str
    cv_record_id: str

    parsing_status: str
    parser_name: str | None = None
    parser_version: str | None = None
    source: str | None = None

    parsed_payload: dict[str, Any] = Field(default_factory=dict)
    mapped_payload: dict[str, Any] = Field(default_factory=dict)
    extracted_profile_patch: dict[str, Any] = Field(default_factory=dict)

    warnings: list[Any] = Field(default_factory=list)
    errors: list[Any] = Field(default_factory=list)

    created_by_user_id: str | None = None
    created_at: datetime