"""
Common RTMC mapping helpers shared by CV and offer pipelines.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Iterable

if TYPE_CHECKING:
    from mapper_app.service import MapperService


def _clean_text(value: Any) -> str:
    if value is None:
        return ""
    return " ".join(str(value).split()).strip()


def _serialize_candidate(candidate: Any) -> dict:
    if candidate is None:
        return {}

    if hasattr(candidate, "model_dump"):
        data = candidate.model_dump()
    elif isinstance(candidate, dict):
        data = candidate
    elif hasattr(candidate, "__dict__"):
        data = {
            key: value
            for key, value in vars(candidate).items()
            if not key.startswith("_")
        }
    else:
        data = {}

    return {
        "entity_type": data.get("entity_type"),
        "entity_id": data.get("entity_id"),
        "entity_code": data.get("entity_code"),
        "label": data.get("label"),
        "normalized_label": data.get("normalized_label"),
        "lexical_score": data.get("lexical_score"),
        "vector_score": data.get("vector_score"),
        "final_score": data.get("final_score"),
        "source": data.get("source"),
    }


def _empty_mapping_record(
    entity: dict,
    reason: str,
    *,
    confidence_label: str = "very_low",
    decision: str = "reject",
    decision_score: float = 0.0,
) -> dict:
    return {
        "source_path": entity.get("source_path", ""),
        "original_text": _clean_text(entity.get("original_text")),
        "entity_kind": entity.get("entity_kind", ""),
        "rtmc_code": None,
        "rtmc_label": None,
        "taxonomy_type": None,
        "decision": decision,
        "confidence_label": confidence_label,
        "decision_score": float(decision_score),
        "decision_reason": reason,
        "used_fallback": False,
        "fallback_provider": None,
        "usable_for_scoring": False,
        "candidates": [],
    }


def _normalize_decision(decision: str | None) -> str:
    if decision == "auto_accept":
        return "auto_accept"
    if decision == "reject":
        return "reject"
    if decision == "llm_accept":
        return "manual_review"
    return "manual_review"


def _project_text_too_long(entity: dict, text: str) -> bool:
    return (
        entity.get("entity_kind") == "project"
        and (len(text) > 120 or len(text.split()) > 18)
    )


def normalize_mapping_result(entity: dict, mapping_result: Any) -> dict:
    selected = _serialize_candidate(getattr(mapping_result, "selected_candidate", None))
    candidates = [
        _serialize_candidate(candidate)
        for candidate in (getattr(mapping_result, "candidates", None) or [])
    ]

    decision = _normalize_decision(getattr(mapping_result, "decision", None))
    rtmc_code = selected.get("entity_code")
    rtmc_label = selected.get("label")
    taxonomy_type = selected.get("entity_type")

    # A rejected mapping must not expose a chosen RTMC code in the normalized
    # payload, otherwise downstream scoring can accidentally rely on a false hit.
    if decision == "reject":
        rtmc_code = None
        rtmc_label = None
        taxonomy_type = None

    return {
        "source_path": entity.get("source_path", ""),
        "original_text": _clean_text(entity.get("original_text")),
        "entity_kind": entity.get("entity_kind", ""),
        "rtmc_code": rtmc_code,
        "rtmc_label": rtmc_label,
        "taxonomy_type": taxonomy_type,
        "decision": decision,
        "confidence_label": getattr(mapping_result, "confidence_label", None) or "unknown",
        "decision_score": float(getattr(mapping_result, "decision_score", 0.0) or 0.0),
        "decision_reason": getattr(mapping_result, "decision_reason", None) or "",
        "used_fallback": bool(getattr(mapping_result, "used_fallback", False)),
        "fallback_provider": getattr(mapping_result, "fallback_provider", None),
        "usable_for_scoring": bool(decision in ("auto_accept", "manual_review") and rtmc_code),
        "candidates": candidates,
    }


def call_mapper_service(
    text: str,
    preferred_types: list[str] | None = None,
    *,
    use_vector: bool = True,
    use_llm: bool = True,
    mapper_service: "MapperService | None" = None,
) -> Any:
    if mapper_service is None:
        from mapper_app.service import MapperService

        mapper_service = MapperService()

    service = mapper_service
    return service.map_text_to_rtmc(
        text,
        entity_types=preferred_types or None,
        include_vector=use_vector,
        allow_llm_fallback=use_llm,
    )


def map_entity(
    entity: dict,
    *,
    use_vector: bool = True,
    use_llm: bool = True,
    mapper_service: "MapperService | None" = None,
) -> dict:
    text = _clean_text(entity.get("original_text"))
    if not text:
        return _empty_mapping_record(entity, "empty_entity_text")

    if _project_text_too_long(entity, text):
        return _empty_mapping_record(entity, "project_text_too_long_for_mapping")

    try:
        if use_vector:
            base_result = call_mapper_service(
                text,
                entity.get("preferred_types") or None,
                use_vector=False,
                use_llm=use_llm,
                mapper_service=mapper_service,
            )
            base_decision = _normalize_decision(getattr(base_result, "decision", None))
            base_candidates = list(getattr(base_result, "candidates", None) or [])

            # Short technical labels with no lexical hit tend to produce noisy
            # vector-only matches in RTMC. In that case we keep the clean reject.
            if base_decision == "auto_accept":
                return normalize_mapping_result(entity, base_result)

            if entity.get("entity_kind") == "skill" and not base_candidates:
                return normalize_mapping_result(entity, base_result)

        mapping_result = call_mapper_service(
            text,
            entity.get("preferred_types") or None,
            use_vector=use_vector,
            use_llm=use_llm,
            mapper_service=mapper_service,
        )
    except Exception as exc:
        return _empty_mapping_record(entity, f"mapping_error: {exc}")

    return normalize_mapping_result(entity, mapping_result)


def map_entities_with_agent(
    entities: Iterable[dict],
    use_vector: bool = True,
    use_llm: bool = True,
    *,
    mapper_service: "MapperService | None" = None,
) -> list[dict]:
    if mapper_service is None:
        from mapper_app.service import MapperService

        mapper_service = MapperService()

    service = mapper_service
    return [
        map_entity(
            entity,
            use_vector=use_vector,
            use_llm=use_llm,
            mapper_service=service,
        )
        for entity in entities
    ]


__all__ = [
    "call_mapper_service",
    "map_entity",
    "map_entities_with_agent",
    "normalize_mapping_result",
]
