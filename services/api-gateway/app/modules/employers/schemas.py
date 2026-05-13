from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class EmployerBaseModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)


class EmployerUpdateRequest(EmployerBaseModel):
    legal_name: str = Field(min_length=1)
    commercial_name: str | None = None
    tax_identifier: str | None = None
    sector_code: str | None = None
    size_category: str | None = None


class EmployerContactUpsertRequest(EmployerBaseModel):
    contact_name: str = Field(min_length=1)
    job_title: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    website: str | None = None


class EmployerLocationUpsertRequest(EmployerBaseModel):
    address: str | None = None
    country: str = Field(min_length=1, default="TN")
    governorate_code: str | None = None
    delegation_code: str | None = None


class EmployerContactResponse(BaseModel):
    id: str
    contact_name: str
    job_title: str | None = None
    email: str | None = None
    phone: str | None = None
    website: str | None = None
    created_at: datetime
    updated_at: datetime


class EmployerLocationResponse(BaseModel):
    id: str
    address: str | None = None
    country: str
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