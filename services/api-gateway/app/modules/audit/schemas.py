from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class AuditBaseModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)


class AuditEventFilters(AuditBaseModel):
    event_category: str | None = None
    event_type: str | None = None
    severity: str | None = None
    actor_email: str | None = None
    entity_type: str | None = None
    entity_id: str | None = None
    trace_id: str | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
    limit: int = Field(default=100, ge=1, le=500)
    offset: int = Field(default=0, ge=0)


class AuditEventResponse(BaseModel):
    id: str
    event_time: datetime
    event_category: str
    event_type: str
    severity: str
    actor_user_id: str | None = None
    actor_email: str | None = None
    actor_roles: list[str] | None = None
    entity_type: str | None = None
    entity_id: str | None = None
    action: str | None = None
    status: str | None = None
    request_id: str | None = None
    trace_id: str | None = None
    correlation_id: str | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    request_method: str | None = None
    request_path: str | None = None
    message: str | None = None
    error_code: str | None = None
    error_message: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class AuditSummaryBucketResponse(BaseModel):
    key: str
    count: int


class AuditSummaryResponse(BaseModel):
    total_events: int
    error_events: int
    latest_event_time: datetime | None = None
    by_category: list[AuditSummaryBucketResponse] = Field(default_factory=list)
    by_severity: list[AuditSummaryBucketResponse] = Field(default_factory=list)
    by_event_type: list[AuditSummaryBucketResponse] = Field(default_factory=list)
