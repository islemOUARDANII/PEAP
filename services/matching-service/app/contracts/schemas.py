from pydantic import BaseModel, Field
from typing import Any, Optional
from uuid import UUID


class MatchingExecutionRequest(BaseModel):
    run_id: UUID
    trace_id: Optional[str] = None
    dry_run: bool = False


class MatchingResultItem(BaseModel):
    candidate_id: Optional[UUID] = None
    offer_id: Optional[UUID] = None
    occupation_id: Optional[str] = None

    score_global: float
    score_rule_based: Optional[float] = None
    score_semantic: Optional[float] = None
    rank: int

    eligibility_status: str = "ELIGIBLE"
    explanation_short: Optional[str] = None
    explanation_json: dict[str, Any] = Field(default_factory=dict)
    details: list[dict[str, Any]] = Field(default_factory=list)


class MatchingExecutionResponse(BaseModel):
    run_id: UUID
    status: str
    results_count: int = 0
    results: list[MatchingResultItem] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)