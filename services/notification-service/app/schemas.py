from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class NotifyMatchingRunRequest(BaseModel):
    threshold: float | None = None
    top_limit: int | None = None
    force: bool = False


class NotificationItem(BaseModel):
    result_id: UUID | None = None
    candidate_id: UUID | None = None
    offer_id: UUID | None = None
    recipient_email: str | None = None
    candidate_name: str | None = None
    offer_title: str | None = None
    company_name: str | None = None
    match_score: float = 0
    email_status: str
    error_message: str | None = None


class NotifyMatchingRunResponse(BaseModel):
    run_id: UUID
    threshold: float
    top_limit: int
    total_candidates: int
    eligible_count: int
    notifications: dict[str, int] = Field(default_factory=dict)
    details: list[NotificationItem] = Field(default_factory=list)


class NotificationLogItem(BaseModel):
    id: UUID
    run_id: UUID | None = None
    result_id: UUID | None = None
    offer_id: UUID | None = None
    candidate_id: UUID | None = None
    recipient_email: str | None = None
    candidate_name: str | None = None
    company_name: str | None = None
    offer_title: str | None = None
    match_score: float
    common_skills: Any
    email_subject: str
    email_status: str
    error_message: str | None = None
    sent_at: datetime | None = None
    created_at: datetime