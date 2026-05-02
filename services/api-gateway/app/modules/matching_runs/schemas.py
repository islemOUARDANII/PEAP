from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class MatchingRunDirection(str, Enum):
    OFFER_TO_CANDIDATES = "OFFER_TO_CANDIDATES"
    CANDIDATE_TO_OFFERS = "CANDIDATE_TO_OFFERS"
    OFFER_TO_CANDIDATE = "OFFER_TO_CANDIDATE"
    CANDIDATE_TO_OFFER = "CANDIDATE_TO_OFFER"


class MatchingSourceEntityType(str, Enum):
    OFFER = "OFFER"
    CANDIDATE = "CANDIDATE"


class MatchingRunType(str, Enum):
    MANUAL = "MANUAL"
    AUTOMATIC = "AUTOMATIC"
    BATCH = "BATCH"
    TEST = "TEST"


class MatchingRunStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class MatchingDecisionStatus(str, Enum):
    PENDING = "PENDING"
    RETAINED = "RETAINED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"


class MatchingRunsBaseModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)


class MatchingRunCreateRequest(MatchingRunsBaseModel):
    run_type: MatchingRunType
    direction: MatchingRunDirection
    model_version_id: UUID
    source_entity_type: MatchingSourceEntityType
    source_entity_id: UUID
    parameters_json: dict[str, Any] = Field(default_factory=dict)


class MatchingRunExecuteRequest(MatchingRunsBaseModel):
    trace_id: str | None = None
    dry_run: bool = False
    admin_override: bool = False


class MatchingRunResponse(BaseModel):
    id: str
    run_type: MatchingRunType
    direction: MatchingRunDirection
    model_version_id: str
    launched_by_user_id: str | None = None
    source_entity_type: MatchingSourceEntityType
    source_entity_id: str
    status: MatchingRunStatus
    parameters_json: dict[str, Any] = Field(default_factory=dict)
    started_at: datetime
    finished_at: datetime | None = None
    error_message: str | None = None


class MatchingExecutionResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    run_id: str
    status: str
    results_count: int = 0
    results: list[dict[str, Any]] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class MatchingResultResponse(BaseModel):
    id: str
    run_id: str
    candidate_id: str | None = None
    candidate_label: str | None = None
    offer_id: str | None = None
    offer_title: str | None = None
    occupation_id: str | None = None
    score_global: float
    score_rule_based: float | None = None
    score_semantic: float | None = None
    rank: int
    eligibility_status: str
    decision_status: MatchingDecisionStatus
    decision_reason: str | None = None
    decision_by_user_id: str | None = None
    decision_at: datetime | None = None
    explanation_short: str | None = None
    explanation_json: dict[str, Any] = Field(default_factory=dict)
    has_gaps: bool = False
    created_at: datetime


class MatchingResultDetailResponse(BaseModel):
    id: str
    result_id: str
    criterion_code: str | None = None
    criterion_label: str | None = None
    score: float | None = None
    weight: float | None = None
    weighted_score: float | None = None
    matched: bool | None = None
    is_gap: bool = False
    gap_type: str | None = None
    gap_message: str | None = None
    recommendation: str | None = None
    metadata_json: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime | None = None


class MatchingResultWithDetailsResponse(BaseModel):
    result: MatchingResultResponse
    details: list[MatchingResultDetailResponse] = Field(default_factory=list)


class MatchingResultDecisionRequest(MatchingRunsBaseModel):
    decision_status: MatchingDecisionStatus
    decision_reason: str | None = None
