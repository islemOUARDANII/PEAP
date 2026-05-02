from __future__ import annotations

import re
from typing import Any

from app.engines.offer_mapper_adapter import map_offer_to_rtmc
from app.engines.language_normalizer import split_skills_and_languages
from app.engines.education_normalizer_adapter import normalize_education_entry

from app.engines.legacy_parsing.offer_parser_app.parser import (
    PARSER_VERSION,
    parse_offer,
    to_schema_json,
)

def _extract_language_candidates_from_raw_text(raw_text: str) -> list[str]:
    """
    Extrait des segments courts contenant probablement une langue + niveau.
    Exemple :
    'Nous cherchons Python, PostgreSQL, Français B2, Anglais courant.'
    -> ['Français B2', 'Anglais courant']
    """
    if not raw_text:
        return []

    candidates: list[str] = []

    # Découpe simple sur ponctuation / séparateurs.
    parts = re.split(r"[,;|\n•.]+", raw_text)

    language_keywords = [
        "français",
        "francais",
        "french",
        "anglais",
        "english",
        "arabe",
        "arabic",
        "allemand",
        "german",
        "espagnol",
        "spanish",
        "italien",
        "italian",
        "portugais",
        "portuguese",
        "chinois",
        "chinese",
        "japonais",
        "japanese",
        "coréen",
        "coreen",
        "korean",
        "russe",
        "russian",
    ]

    for part in parts:
        part = part.strip(" :-\t")
        if not part:
            continue

        normalized = part.lower()

        if any(keyword in normalized for keyword in language_keywords):
            candidates.append(part)

    return candidates

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

    extracted_requirements = _extract_offer_requirements(
        parsed_payload=parsed_payload,
        raw_text=raw_text,
    )

    mapped_payload = {
        **mapped_payload,
        "requirements": parsed_payload.get("requirements") or {},
    }
    return {
        "parsing_status": "PARSED",
        "parsed_payload": parsed_payload,
        "mapped_payload": mapped_payload,
        "extracted_requirements": extracted_requirements,
        "warnings": warnings,
        "parser_version": PARSER_VERSION,
    }

def _merge_languages(*language_groups: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_code: dict[str, dict[str, Any]] = {}

    for group in language_groups:
        for lang in group or []:
            language_code = lang.get("language_code")
            if not language_code:
                continue

            existing = by_code.get(language_code)

            if existing is None:
                by_code[language_code] = lang
                continue

            existing_has_level = bool(existing.get("level"))
            new_has_level = bool(lang.get("level"))

            # Si la nouvelle version contient un niveau et l'ancienne non, on remplace.
            if new_has_level and not existing_has_level:
                by_code[language_code] = lang
                continue

            # Sinon on garde l'existante, mais on enrichit evidence si besoin.
            if not existing.get("evidence") and lang.get("evidence"):
                existing["evidence"] = lang.get("evidence")

    return list(by_code.values())

def _education_min_to_text(value: Any) -> str:
    if not value:
        return ""

    if isinstance(value, dict):
        return (
            value.get("label")
            or value.get("degree")
            or value.get("diploma_label")
            or value.get("code")
            or ""
        )

    return str(value)


def _split_offer_education_text(value: str) -> list[str]:
    """
    Exemple :
    'Master / Ingénieur / MBA'
    -> ['Master', 'Ingénieur', 'MBA']

    'BTS ou Licence'
    -> ['BTS', 'Licence']
    """
    text_value = str(value or "").strip()

    if not text_value:
        return []

    parts = re.split(r"\s*(?:/|,|;|\bou\b|\bor\b)\s*", text_value, flags=re.IGNORECASE)

    cleaned: list[str] = []

    for part in parts:
        part = part.strip(" .:-\t")
        if not part:
            continue

        # On évite les morceaux trop génériques.
        if part.lower() in {"equivalent", "équivalent", "ou equivalent", "ou équivalent"}:
            continue

        cleaned.append(part)

    return cleaned or [text_value]


def _normalize_offer_education_requirements(education_min: Any) -> list[dict[str, Any]]:
    raw_text = _education_min_to_text(education_min)

    if not raw_text:
        return []

    education_parts = _split_offer_education_text(raw_text)

    normalized_rows: list[dict[str, Any]] = []
    seen_levels: set[str] = set()

    for part in education_parts:
        normalized = normalize_education_entry(
            {
                "degree": part,
                "institution": "",
                "end_date": "",
            }
        )

        level_code = normalized.get("level_code") or ""
        diploma_label = normalized.get("diploma_label") or part

        # Si le normalizer ne reconnaît rien, on garde quand même le texte brut.
        dedupe_key = level_code or diploma_label.lower()

        if dedupe_key in seen_levels:
            continue

        seen_levels.add(dedupe_key)

        normalized_rows.append(
            {
                "raw_text": part,
                "level_code": level_code,
                "diploma_label": diploma_label,
                "specialty": normalized.get("specialty") or "",
                "specialty_code": normalized.get("specialty_code") or "",
                "normalization": normalized.get("normalization") or {},
            }
        )

    return normalized_rows



def _extract_offer_requirements(parsed_payload: dict[str, Any], raw_text: str | None = None,) -> list[dict[str, Any]]:
    requirements = parsed_payload.get("requirements") or {}

    rows: list[dict[str, Any]] = []

    mandatory_skills = requirements.get("mandatory_skills") or []
    optional_skills = requirements.get("optional_skills") or []
    existing_languages = requirements.get("languages") or []

    clean_mandatory_skills, mandatory_languages = split_skills_and_languages(
        skills=mandatory_skills,
        existing_languages=[],
    )

    clean_optional_skills, optional_languages = split_skills_and_languages(
        skills=optional_skills,
        existing_languages=[],
    )

    raw_text_language_candidates = _extract_language_candidates_from_raw_text(raw_text or "")

    _, normalized_existing_languages = split_skills_and_languages(
        skills=[],
        existing_languages=existing_languages,
    )

    _, normalized_raw_text_languages = split_skills_and_languages(
        skills=[],
        existing_languages=raw_text_language_candidates,
    )

    mandatory_skills = clean_mandatory_skills
    optional_skills = clean_optional_skills

    normalized_languages = _merge_languages(
        mandatory_languages,
        optional_languages,
        normalized_raw_text_languages,
        normalized_existing_languages,
    )

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
    normalized_educations = _normalize_offer_education_requirements(education_min)

    for education in normalized_educations:
        rows.append(
            {
                "criterion_type": "DIPLOMA",
                "node_id": None,
                "raw_value": education.get("diploma_label") or education.get("raw_text"),
                "min_level": education.get("level_code") or None,
                "min_years": None,
                "is_must": False,
                "weight": 10,
                "metadata": {
                    **education,
                    "source": "education_normalizer",
                },
            }
        )

    for lang in normalized_languages:
        rows.append(
            {
                "criterion_type": "LANGUAGE",
                "node_id": None,
                "raw_value": lang.get("language_code"),
                "min_level": lang.get("level"),
                "min_years": None,
                "is_must": False,
                "weight": 5,
                "metadata": {
                    **lang,
                    "source": "language_normalizer",
                },
            }
        )

    return rows