from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class SelectedSegment:
    id: str
    code: str
    label: str
    priority: int


@dataclass
class SelectedModel:
    model_id: str
    model_code: str
    model_version_id: str
    version_number: int
    case_id: str | None = None
    case_code: str | None = None
    assignment_id: str | None = None
    segment_id: str | None = None
    segment_code: str | None = None


@dataclass
class ScoringConfig:
    criteria: list[dict[str, Any]] = field(default_factory=list)
    weights: dict[str, float] = field(default_factory=dict)
    params: dict[str, dict[str, Any]] = field(default_factory=dict)
    hard_filters: list[dict[str, Any]] = field(default_factory=list)
    bonus_rules: list[dict[str, Any]] = field(default_factory=list)
    formula: dict[str, Any] = field(default_factory=dict)
    decision_thresholds: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class ScoringResult:
    cv_id: Any
    offer_id: Any
    segment_code: str
    model_code: str
    model_version_id: str
    final_score: float | None
    rule_score: float | None
    semantic_score: float | None
    decision: str
    hard_filter_passed: bool
    rejection_reason: str | None
    sub_scores: dict[str, Any]
    weights_used: dict[str, Any]
    hard_filters_result: dict[str, Any]
    bonus_result: dict[str, Any]
    explanation: dict[str, Any]
    direction: str = "CANDIDATE_TO_OFFER"
    service: str | None = None
    segment_id: str | None = None
    case_id: str | None = None
    assignment_id: str | None = None
    run_id: str | None = None

    def __post_init__(self) -> None:
        self.semantic_score = 0.0 if self.semantic_score is None else self.semantic_score
        if self.rule_score is not None:
            self.final_score = self.rule_score

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
