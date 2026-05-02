from __future__ import annotations

from typing import Any


def _extract_cv_for_mapper(parsed_payload: dict[str, Any]) -> dict[str, Any]:
    """
    Le parser peut retourner une enveloppe.
    Le mapper attend directement le contenu structuré du CV.
    """
    if not isinstance(parsed_payload, dict):
        return {}

    cv_data = parsed_payload.get("cv_data")
    if isinstance(cv_data, dict) and cv_data:
        return cv_data

    raw_json = parsed_payload.get("raw_json")
    if isinstance(raw_json, dict) and raw_json:
        return raw_json

    return parsed_payload


def map_cv_to_rtmc(
    *,
    parsed_payload: dict[str, Any],
    use_vector: bool = False,
    use_llm: bool = False,
) -> dict[str, Any]:
    """
    Adapter entre le parsing-service et mapper_app.

    use_vector=False pour l’instant :
    - plus rapide
    - pas besoin de sentence-transformers
    - on valide d’abord BM25 + alias + exact

    use_llm=False pour l’instant :
    - pas d’appel externe
    - résultat plus stable pour les tests
    """

    from mapper_app.pipeline.map_cv import map_parsed_cv

    cv_for_mapper = _extract_cv_for_mapper(parsed_payload)

    rtmc_mapping = map_parsed_cv(
        cv_for_mapper,
        use_vector=use_vector,
        use_llm=use_llm,
    )

    return {
        **parsed_payload,
        "rtmc_mapping": rtmc_mapping,
    }