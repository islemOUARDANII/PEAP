from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class AdvisorActivityResponse(BaseModel):
    id: str
    activity_time: datetime

    actor_user_id: str | None = None
    actor_email: str | None = None
    actor_role: str | None = None

    activity_type: str
    target_type: str
    direction: str | None = None
    action_label: str

    query_text: str | None = None
    filters_json: dict[str, Any] = Field(default_factory=dict)

    model_id: str | None = None
    model_version_id: str | None = None
    model_code: str | None = None
    model_label: str | None = None

    source_entity_type: str | None = None
    source_entity_id: str | None = None
    run_id: str | None = None

    result_count: int | None = None
    duration_ms: int | None = None

    status: str
    error_message: str | None = None
    metadata_json: dict[str, Any] = Field(default_factory=dict)