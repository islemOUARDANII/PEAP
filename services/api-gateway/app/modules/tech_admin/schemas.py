from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class TechAdminBaseModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)


class TechAdminDashboardResponse(BaseModel):
    api_gateway: str
    database: str
    parsing_service: str
    matching_service: str
    search_service: str
    storage_provider: str
    kafka_status: str


class ServiceHealthResponse(BaseModel):
    service: str
    url: str | None = None
    status: str
    detail: str | None = None


class TechAdminUserCreateRequest(TechAdminBaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    phone: str | None = None
    status: Literal["PENDING_VERIFICATION", "ACTIVE", "SUSPENDED", "DISABLED", "DELETED"] = "ACTIVE"


class TechAdminUserUpdateRequest(TechAdminBaseModel):
    email: EmailStr
    phone: str | None = None
    password: str | None = Field(default=None, min_length=8)
    status: Literal["PENDING_VERIFICATION", "ACTIVE", "SUSPENDED", "DISABLED", "DELETED"]


class TechAdminUserStatusUpdateRequest(TechAdminBaseModel):
    status: Literal["PENDING_VERIFICATION", "ACTIVE", "SUSPENDED", "DISABLED", "DELETED"]


class TechAdminRoleAssignRequest(TechAdminBaseModel):
    role_id: UUID


class TechAdminRoleResponse(BaseModel):
    id: str
    code: str
    label: str


class TechAdminUserResponse(BaseModel):
    id: str
    email: str
    phone: str | None = None
    status: str
    created_at: datetime
    updated_at: datetime
    roles: list[TechAdminRoleResponse] = Field(default_factory=list)
