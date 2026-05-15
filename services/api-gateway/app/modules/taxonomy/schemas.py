from datetime import datetime

from pydantic import BaseModel


class TaxonomyModelResponse(BaseModel):
    id: str
    code: str
    label: str
    version: str | None = None
    source: str | None = None
    is_active: bool
    is_default: bool
    released_at: datetime | None = None
    imported_at: datetime | None = None
    metadata_json: dict | None = None


class TaxonomySummaryResponse(BaseModel):
    total_models: int
    active_models: int
    total_nodes: int
    active_nodes: int
    total_aliases: int
    total_relations: int
    total_crosswalks: int


class TaxonomyNodeResponse(BaseModel):
    id: str
    model_id: str
    parent_id: str | None = None
    external_code: str | None = None
    external_uri: str | None = None
    node_type: str
    preferred_label: str
    normalized_label: str | None = None
    description: str | None = None
    language_code: str | None = None
    active: bool
    metadata_json: dict | None = None
    created_at: datetime
    updated_at: datetime


class TaxonomyNodeListResponse(BaseModel):
    total: int
    items: list[TaxonomyNodeResponse]


class TaxonomyAliasResponse(BaseModel):
    id: str
    node_id: str
    alias: str
    normalized_alias: str | None = None
    language_code: str | None = None
    source: str | None = None
    confidence: float | None = None
    active: bool
    metadata_json: dict | None = None
    created_at: datetime


class TaxonomyRelationResponse(BaseModel):
    id: str
    model_id: str
    source_node_id: str
    target_node_id: str
    relation_type: str
    weight: float | None = None
    confidence: float | None = None
    active: bool
    metadata_json: dict | None = None
    created_at: datetime


class TaxonomyCrosswalkResponse(BaseModel):
    id: str
    import_batch_id: str | None = None
    source_node_id: str
    target_node_id: str
    mapping_type: str | None = None
    confidence: float | None = None
    method: str | None = None
    validated: bool
    validated_by: str | None = None
    validated_at: datetime | None = None
    active: bool
    metadata: dict | None = None
    created_at: datetime


class TaxonomyCrosswalkReviewItemResponse(BaseModel):
    """Enriched crosswalk row returned by GET /taxonomy/crosswalks/review.

    Populated either from taxonomy.v_crosswalk_review (if the view exists) or
    from a live JOIN across taxonomy_crosswalk / taxonomy_node / taxonomy_model.
    Label and model fields are nullable because the JOIN uses LEFT JOINs — a
    node referenced by the crosswalk may have been deleted since import.
    """

    id: str
    source_model_code: str | None = None
    source_model_version: str | None = None
    source_node_id: str
    source_node_type: str | None = None
    source_label: str | None = None
    target_model_code: str | None = None
    target_model_version: str | None = None
    target_node_id: str
    target_node_type: str | None = None
    target_label: str | None = None
    mapping_type: str | None = None
    confidence: float | None = None
    method: str | None = None
    validated: bool
    active: bool
    metadata: dict | None = None
    created_at: datetime


class TaxonomyCrosswalkListResponse(BaseModel):
    """Used by GET /taxonomy/crosswalks/review (enriched items) and as the
    pagination wrapper for crosswalk write-endpoint callers."""

    total: int
    items: list[TaxonomyCrosswalkReviewItemResponse]


class CrosswalkValidateRequest(BaseModel):
    mapping_type: str | None = None
    confidence: float | None = None
    note: str | None = None


class CrosswalkRejectRequest(BaseModel):
    reason: str
