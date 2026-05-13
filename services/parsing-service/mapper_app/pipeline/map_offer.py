"""
Pipeline de mapping RTMC a partir d'une offre deja parsee.

Lancement :
    python -m mapper_app.pipeline.map_offer data/test/parsed_offer_backend.json --out data/test/mapped_offer_backend.json
"""

from __future__ import annotations

import argparse
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING, Any

from mapper_app.pipeline.common_mapping import map_entities_with_agent
from mapper_app.pipeline.hybrid_signals import (
    as_list as _signals_as_list,
    build_signal,
    clean_text as _signal_clean_text,
    dedupe_signals,
    extract_named_value as _signal_extract_named_value,
    signal_from_mapped_entity,
    signal_terms,
    signal_unmapped_terms,
)

if TYPE_CHECKING:
    from mapper_app.service import MapperService


def load_json(path: str | Path) -> dict:
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def save_json(data: dict, path: str | Path) -> Path:
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)
    return output_path


def _clean_text(value: Any) -> str:
    if value is None:
        return ""
    return " ".join(str(value).split()).strip()


def _as_list(value: Any) -> list:
    if not value:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _append_entity(
    bucket: list[dict],
    *,
    source_path: str,
    entity_kind: str,
    original_text: Any,
    preferred_types: list[str],
    context: str = "offer",
) -> None:
    text = _clean_text(original_text)
    if not text:
        return
    bucket.append(
        {
            "source_path": source_path,
            "entity_kind": entity_kind,
            "original_text": text,
            "preferred_types": preferred_types,
            "context": context,
        }
    )


def _deduplicate_entities(entities: list[dict]) -> list[dict]:
    out = []
    seen = set()

    for entity in entities:
        key = (
            entity.get("entity_kind", ""),
            _clean_text(entity.get("original_text")).casefold(),
        )
        if key in seen:
            continue
        seen.add(key)
        out.append(entity)

    return out


def _extract_skill_text(skill: Any) -> str:
    if isinstance(skill, dict):
        return (
            _clean_text(skill.get("raw_label"))
            or _clean_text(skill.get("normalized_label"))
            or _clean_text(skill.get("skill"))
            or _clean_text(skill.get("name"))
            or _clean_text(skill.get("label"))
        )
    return _clean_text(skill)


def _extract_occupation_text(occupation: Any) -> str:
    if isinstance(occupation, dict):
        return (
            _clean_text(occupation.get("label"))
            or _clean_text(occupation.get("title"))
            or _clean_text(occupation.get("name"))
            or _clean_text(occupation.get("raw_label"))
        )
    return _clean_text(occupation)


def extract_offer_entities(parsed_offer: dict) -> dict:
    offer = parsed_offer.get("offer") or {}
    requirements = parsed_offer.get("requirements") or {}

    entities = {
        "occupations": [],
        "mandatory_skills": [],
        "optional_skills": [],
        "languages": [],
    }

    title = _clean_text(offer.get("title"))
    if title and title.casefold() not in {"non specifie", "non spécifié", "unknown"}:
        _append_entity(
            entities["occupations"],
            source_path="offer.title",
            entity_kind="occupation",
            original_text=title,
            preferred_types=["occupation"],
        )

    for idx, occupation in enumerate(_as_list(parsed_offer.get("occupations_target"))):
        _append_entity(
            entities["occupations"],
            source_path=f"occupations_target[{idx}]",
            entity_kind="occupation",
            original_text=_extract_occupation_text(occupation),
            preferred_types=["occupation"],
        )

    for idx, skill in enumerate(_as_list(requirements.get("mandatory_skills"))):
        _append_entity(
            entities["mandatory_skills"],
            source_path=f"requirements.mandatory_skills[{idx}]",
            entity_kind="skill",
            original_text=_extract_skill_text(skill),
            preferred_types=["skill"],
        )

    for idx, skill in enumerate(_as_list(requirements.get("optional_skills"))):
        _append_entity(
            entities["optional_skills"],
            source_path=f"requirements.optional_skills[{idx}]",
            entity_kind="skill",
            original_text=_extract_skill_text(skill),
            preferred_types=["skill"],
        )

    for idx, language in enumerate(_as_list(requirements.get("languages"))):
        if isinstance(language, dict):
            label = _clean_text(language.get("label")) or _clean_text(language.get("code"))
            if not label:
                continue
            entities["languages"].append(
                {
                    "source_path": f"requirements.languages[{idx}]",
                    "original_text": label,
                    "level": _clean_text(language.get("min_level")) or None,
                    "context": "offer",
                }
            )
        else:
            label = _clean_text(language)
            if not label:
                continue
            entities["languages"].append(
                {
                    "source_path": f"requirements.languages[{idx}]",
                    "original_text": label,
                    "level": None,
                    "context": "offer",
                }
            )

    entities["occupations"] = _deduplicate_entities(entities["occupations"])
    entities["mandatory_skills"] = _deduplicate_entities(entities["mandatory_skills"])
    entities["optional_skills"] = _deduplicate_entities(entities["optional_skills"])

    return entities


def _parse_float(value: Any) -> float | None:
    if value in (None, "", "null", "none"):
        return None
    try:
        return float(value)
    except Exception:
        return None


def _extract_required_education(parsed_offer: dict) -> Any:
    requirements = parsed_offer.get("requirements") or {}
    education = requirements.get("education_min")
    if isinstance(education, dict):
        return education.get("code") or education.get("label") or education
    return education


def _collect_review_items(mapped_entities: dict, section_names: tuple[str, ...]) -> tuple[list[dict], list[dict]]:
    manual_review_entities = []
    rejected_entities = []

    for section_name in section_names:
        for item in mapped_entities.get(section_name, []):
            decision = item.get("decision")
            if decision == "manual_review":
                manual_review_entities.append(
                    {
                        "source_path": item.get("source_path"),
                        "original_text": item.get("original_text"),
                        "entity_kind": item.get("entity_kind"),
                        "decision_reason": item.get("decision_reason"),
                    }
                )
            elif decision == "reject":
                rejected_entities.append(
                    {
                        "source_path": item.get("source_path"),
                        "original_text": item.get("original_text"),
                        "entity_kind": item.get("entity_kind"),
                        "decision_reason": item.get("decision_reason"),
                    }
                )

    return manual_review_entities, rejected_entities


def _unique_preserve_order(values: list[Any]) -> list[Any]:
    out = []
    seen = set()
    for value in values:
        key = json.dumps(value, sort_keys=True, ensure_ascii=False) if isinstance(value, dict) else str(value)
        if key in seen:
            continue
        seen.add(key)
        out.append(value)
    return out


def build_offer_matching_signals(
    parsed_offer: dict,
    mapped_entities: dict,
    *,
    required_education_level: Any,
    minimum_degree_rank: float | None,
) -> dict[str, Any]:
    offer = parsed_offer.get("offer") or {}
    requirements = parsed_offer.get("requirements") or {}

    target_role_signals: list[dict[str, Any]] = []
    must_have_skill_signals: list[dict[str, Any]] = []
    nice_to_have_skill_signals: list[dict[str, Any]] = []
    language_signals: list[dict[str, Any]] = []

    for item in mapped_entities.get("occupations", []):
        if isinstance(item, dict):
            signal = signal_from_mapped_entity(item, group="target_roles")
            if signal:
                target_role_signals.append(signal)

    title_signal = build_signal(
        raw_term=offer.get("title"),
        source_path="offer.title",
        group="target_roles",
        entity_kind="occupation",
        signal_origin="parsed_only",
    )
    if title_signal:
        target_role_signals.append(title_signal)

    for idx, occupation in enumerate(_signals_as_list(parsed_offer.get("occupations_target"))):
        signal = build_signal(
            raw_term=_signal_extract_named_value(occupation),
            source_path=f"occupations_target[{idx}]",
            group="target_roles",
            entity_kind="occupation",
            signal_origin="parsed_only",
        )
        if signal:
            target_role_signals.append(signal)

    for item in mapped_entities.get("mandatory_skills", []):
        if isinstance(item, dict):
            signal = signal_from_mapped_entity(item, group="must_have_skills")
            if signal:
                must_have_skill_signals.append(signal)

    for idx, skill in enumerate(_signals_as_list(requirements.get("mandatory_skills"))):
        signal = build_signal(
            raw_term=_signal_extract_named_value(skill),
            source_path=f"requirements.mandatory_skills[{idx}]",
            group="must_have_skills",
            entity_kind="skill",
            signal_origin="parsed_only",
        )
        if signal:
            must_have_skill_signals.append(signal)

    for item in mapped_entities.get("optional_skills", []):
        if isinstance(item, dict):
            signal = signal_from_mapped_entity(item, group="nice_to_have_skills")
            if signal:
                nice_to_have_skill_signals.append(signal)

    for idx, skill in enumerate(_signals_as_list(requirements.get("optional_skills"))):
        signal = build_signal(
            raw_term=_signal_extract_named_value(skill),
            source_path=f"requirements.optional_skills[{idx}]",
            group="nice_to_have_skills",
            entity_kind="skill",
            signal_origin="parsed_only",
        )
        if signal:
            nice_to_have_skill_signals.append(signal)

    for idx, item in enumerate(mapped_entities.get("languages", [])):
        if not isinstance(item, dict):
            continue
        signal = build_signal(
            raw_term=item.get("original_text"),
            source_path=_signal_clean_text(item.get("source_path")) or f"requirements.languages[{idx}]",
            group="languages",
            entity_kind="language",
            signal_origin="mapped_entity",
            extra={"level": _signal_clean_text(item.get("level")) or None},
        )
        if signal:
            language_signals.append(signal)

    return {
        "strategy": "taxonomy_assisted",
        "target_roles": dedupe_signals(target_role_signals),
        "must_have_skills": dedupe_signals(must_have_skill_signals),
        "nice_to_have_skills": dedupe_signals(nice_to_have_skill_signals),
        "education": {
            "required_level_raw": _clean_text(required_education_level) or None,
            "minimum_degree_rank": minimum_degree_rank,
        },
        "languages": dedupe_signals(language_signals),
    }


def build_offer_scoring_features(parsed_offer: dict, mapped_entities: dict) -> dict:
    target_occupation_codes: list[str] = []
    target_occupation_labels: list[str] = []
    mandatory_skill_codes: list[str] = []
    mandatory_skill_labels: list[str] = []
    optional_skill_codes: list[str] = []
    optional_skill_labels: list[str] = []

    for item in mapped_entities.get("occupations", []):
        if item.get("usable_for_scoring"):
            if item.get("rtmc_code"):
                target_occupation_codes.append(item["rtmc_code"])
            if item.get("rtmc_label"):
                target_occupation_labels.append(item["rtmc_label"])

    for item in mapped_entities.get("mandatory_skills", []):
        if item.get("usable_for_scoring"):
            if item.get("rtmc_code"):
                mandatory_skill_codes.append(item["rtmc_code"])
            if item.get("rtmc_label"):
                mandatory_skill_labels.append(item["rtmc_label"])

    for item in mapped_entities.get("optional_skills", []):
        if item.get("usable_for_scoring"):
            if item.get("rtmc_code"):
                optional_skill_codes.append(item["rtmc_code"])
            if item.get("rtmc_label"):
                optional_skill_labels.append(item["rtmc_label"])

    manual_review_entities, rejected_entities = _collect_review_items(
        mapped_entities,
        ("occupations", "mandatory_skills", "optional_skills"),
    )
    required_education_level = _extract_required_education(parsed_offer)
    matching_signals = build_offer_matching_signals(
        parsed_offer,
        mapped_entities,
        required_education_level=required_education_level,
        minimum_degree_rank=None,
    )

    return {
        "matching_strategy": "taxonomy_assisted",
        "taxonomy_assisted": True,
        "target_occupation_codes": _unique_preserve_order(target_occupation_codes),
        "target_occupation_labels": _unique_preserve_order(target_occupation_labels),
        "mandatory_skill_codes": _unique_preserve_order(mandatory_skill_codes),
        "mandatory_skill_labels": _unique_preserve_order(mandatory_skill_labels),
        "optional_skill_codes": _unique_preserve_order(optional_skill_codes),
        "optional_skill_labels": _unique_preserve_order(optional_skill_labels),
        "required_experience_years": _parse_float(
            (parsed_offer.get("requirements") or {}).get("min_years_experience")
        ),
        "required_education_level": required_education_level,
        "must_have_skill_terms": signal_terms(matching_signals["must_have_skills"]),
        "nice_to_have_skill_terms": signal_terms(matching_signals["nice_to_have_skills"]),
        "target_role_terms": signal_terms(matching_signals["target_roles"]),
        "unmapped_must_have_skill_terms": signal_unmapped_terms(matching_signals["must_have_skills"]),
        "unmapped_nice_to_have_skill_terms": signal_unmapped_terms(matching_signals["nice_to_have_skills"]),
        "languages": _unique_preserve_order(
            [
                item.get("original_text")
                for item in mapped_entities.get("languages", [])
                if item.get("original_text")
            ]
        ),
        "must_have_skill_codes_count": max(
            len(_unique_preserve_order(mandatory_skill_codes)),
            len(signal_terms(matching_signals["must_have_skills"])),
        ),
        "manual_review_entities": manual_review_entities,
        "rejected_entities": rejected_entities,
        "matching_signal_counts": {
            "target_roles": len(matching_signals["target_roles"]),
            "must_have_skills": len(matching_signals["must_have_skills"]),
            "nice_to_have_skills": len(matching_signals["nice_to_have_skills"]),
        },
    }


def build_mapping_quality(mapped_entities: dict) -> dict:
    mapped_lists = (
        mapped_entities.get("occupations", [])
        + mapped_entities.get("mandatory_skills", [])
        + mapped_entities.get("optional_skills", [])
    )

    return {
        "total_entities": len(mapped_lists),
        "auto_accept_count": sum(1 for item in mapped_lists if item.get("decision") == "auto_accept"),
        "manual_review_count": sum(1 for item in mapped_lists if item.get("decision") == "manual_review"),
        "reject_count": sum(1 for item in mapped_lists if item.get("decision") == "reject"),
    }


def map_parsed_offer(
    parsed_offer: dict,
    use_vector: bool = True,
    use_llm: bool = True,
    mapper_service: "MapperService | None" = None,
) -> dict:
    if not isinstance(parsed_offer, dict):
        raise TypeError("parsed_offer must be a dict")

    if mapper_service is None:
        from mapper_app.service import MapperService

        mapper_service = MapperService()

    extracted_entities = extract_offer_entities(parsed_offer)
    mapped_entities = {
        "occupations": map_entities_with_agent(
            extracted_entities["occupations"],
            use_vector=use_vector,
            use_llm=use_llm,
            mapper_service=mapper_service,
        ),
        "mandatory_skills": map_entities_with_agent(
            extracted_entities["mandatory_skills"],
            use_vector=use_vector,
            use_llm=use_llm,
            mapper_service=mapper_service,
        ),
        "optional_skills": map_entities_with_agent(
            extracted_entities["optional_skills"],
            use_vector=use_vector,
            use_llm=use_llm,
            mapper_service=mapper_service,
        ),
        "languages": extracted_entities["languages"],
    }

    scoring_features = build_offer_scoring_features(parsed_offer, mapped_entities)
    mapping_quality = build_mapping_quality(mapped_entities)

    return {
        "document_type": "mapped_offer",
        "mapped_offer_id": str(uuid.uuid4()),
        "mapping_metadata": {
            "mapper_version": "v1",
            "taxonomy": "RTMC",
            "mapping_agent": "MapperService",
            "use_vector": bool(use_vector),
            "use_llm": bool(use_llm),
            "mapped_at": datetime.now(timezone.utc).isoformat(),
        },
        "parsed_offer": parsed_offer,
        "mapped_entities": mapped_entities,
        "scoring_features": scoring_features,
        "matching_signals": build_offer_matching_signals(
            parsed_offer,
            mapped_entities,
            required_education_level=scoring_features.get("required_education_level"),
            minimum_degree_rank=None,
        ),
        "mapping_quality": mapping_quality,
    }


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Map une offre parsee vers RTMC.")
    parser.add_argument("input_json", help="Chemin vers le JSON parsed offer.")
    parser.add_argument("--out", required=True, help="Chemin du mapped_offer.json de sortie.")
    parser.add_argument("--no-vector", action="store_true", help="Desactive la recherche vectorielle.")
    parser.add_argument("--no-llm", action="store_true", help="Desactive le fallback LLM.")
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    parsed_offer = load_json(args.input_json)
    mapped_offer = map_parsed_offer(
        parsed_offer,
        use_vector=not args.no_vector,
        use_llm=not args.no_llm,
    )
    output_path = save_json(mapped_offer, args.out)
    quality = mapped_offer["mapping_quality"]

    print("=" * 72)
    print("  OFFER JSON -> RTMC MAPPING")
    print("=" * 72)
    print(f"Total entities : {quality['total_entities']}")
    print(f"Auto accept    : {quality['auto_accept_count']}")
    print(f"Manual review  : {quality['manual_review_count']}")
    print(f"Reject         : {quality['reject_count']}")
    print(f"Output path    : {output_path}")
    print("=" * 72)


if __name__ == "__main__":
    main()
