from pydantic import BaseModel, Field


class MappingCandidate(BaseModel):
    entity_type: str
    entity_id: int | None = None
    entity_code: str | None = None
    label: str
    normalized_label: str | None = None
    lexical_score: float | None = None
    vector_score: float | None = None
    final_score: float | None = None
    source: str | None = None


class MappingResult(BaseModel):
    raw_text: str
    normalized_text: str
    candidates: list[MappingCandidate] = Field(default_factory=list)
    selected_candidate: MappingCandidate | None = None
    decision: str | None = None
    confidence_label: str | None = None
    decision_score: float | None = None
    decision_reason: str | None = None
    used_fallback: bool = False
    fallback_provider: str | None = None
