from __future__ import annotations

from typing import Any
from app.engines.offer_mapper_adapter import map_offer_to_rtmc
from app.engines.legacy_parsing.offer_parser_app.parser import (
    PARSER_VERSION,
    parse_offer,
    to_schema_json,
)


def parse_offer_text_to_payload(
    *,
    offer_id: str,
    title: str,
    description: str | None,
) -> dict[str, Any]:
    """
    Adapter propre autour du parser legacy d'offre.

    Input officiel:
    - offer_id depuis aneti.job_offer.id
    - title / description depuis notre DB ou depuis API

    Output:
    - parsed_payload: output brut du parser legacy
    - mapped_payload: pour l'instant même structure, mapping RTMC avancé plus tard
    - extracted_requirements: exigences compatibles avec aneti.job_offer_requirement
    """

    raw_text = f"{title or ''}\n\n{description or ''}".strip()

    if not raw_text:
        return {
            "parsing_status": "FAILED",
            "parsed_payload": {},
            "mapped_payload": {},
            "extracted_requirements": [],
            "warnings": ["Offer text is empty"],
            "parser_version": PARSER_VERSION,
        }

    parsed_offer_obj = parse_offer(raw_text)
    parsed_payload = to_schema_json(
        parsed_offer_obj,
        filename=f"offer_{offer_id}.txt",
        mime_type="text/plain",
    )

    warnings: list[str] = []

    try:
        mapped_payload = map_offer_to_rtmc(
            parsed_offer=parsed_payload,
            use_vector=False,
            use_llm=False,
        )
    except Exception as exc:
        mapped_payload = {
            **parsed_payload,
            "rtmc_mapping": {
                "status": "FAILED",
                "error": str(exc),
            },
        }
        warnings.append(f"RTMC offer mapper failed: {exc}")

    extracted_requirements = _extract_offer_requirements(parsed_payload)

    return {
        "parsing_status": "PARSED",
        "parsed_payload": parsed_payload,
        "mapped_payload": mapped_payload,
        "extracted_requirements": extracted_requirements,
        "warnings": warnings,
        "parser_version": PARSER_VERSION,
    }


def _extract_offer_requirements(parsed_payload: dict[str, Any]) -> list[dict[str, Any]]:
    requirements = parsed_payload.get("requirements") or {}

    rows: list[dict[str, Any]] = []

    mandatory_skills = requirements.get("mandatory_skills") or []
    optional_skills = requirements.get("optional_skills") or []

    for skill in mandatory_skills:
        rows.append(
            {
                "criterion_type": "SKILL",
                "node_id": None,
                "raw_value": skill.get("normalized_label") or skill.get("raw_label"),
                "min_level": skill.get("min_level"),
                "min_years": None,
                "is_must": True,
                "weight": 20,
                "metadata": skill,
            }
        )

    for skill in optional_skills:
        rows.append(
            {
                "criterion_type": "SKILL",
                "node_id": None,
                "raw_value": skill.get("normalized_label") or skill.get("raw_label"),
                "min_level": skill.get("min_level"),
                "min_years": None,
                "is_must": False,
                "weight": 10,
                "metadata": skill,
            }
        )

    min_years = requirements.get("min_years_experience")
    if min_years is not None:
        rows.append(
            {
                "criterion_type": "EXPERIENCE_YEARS",
                "node_id": None,
                "raw_value": f"{min_years} years",
                "min_level": None,
                "min_years": min_years,
                "is_must": False,
                "weight": 15,
                "metadata": {"source": "parsed_offer.requirements.min_years_experience"},
            }
        )

    education_min = requirements.get("education_min")
    if education_min:
        rows.append(
            {
                "criterion_type": "DIPLOMA",
                "node_id": None,
                "raw_value": education_min,
                "min_level": None,
                "min_years": None,
                "is_must": False,
                "weight": 10,
                "metadata": {"source": "parsed_offer.requirements.education_min"},
            }
        )

    for lang in requirements.get("languages") or []:
        rows.append(
            {
                "criterion_type": "LANGUAGE",
                "node_id": None,
                "raw_value": lang.get("language") or lang.get("name") or str(lang),
                "min_level": lang.get("min_level"),
                "min_years": None,
                "is_must": False,
                "weight": 5,
                "metadata": lang,
            }
        )

    return rows