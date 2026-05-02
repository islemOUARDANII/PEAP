"""
Pipeline de mapping RTMC a partir d'un CV deja parse.

Lancement :
    python -m mapper_app.pipeline.map_cv data/test/parsed_cv_nour.json --out data/test/mapped_cv_nour.json
"""

from __future__ import annotations

import argparse
import json
from decimal import Decimal
from pathlib import Path
from typing import TYPE_CHECKING, Any


class _JSONEncoder(json.JSONEncoder):
    def default(self, o: object) -> object:
        if isinstance(o, Decimal):
            return float(o)
        return super().default(o)

from mapper_app.pipeline.common_mapping import (
    map_entities_with_agent,
    map_entity as map_entity_with_agent,
)
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


TECHNICAL_SKILL_FIELDS = (
    "programming_languages",
    "frameworks_libraries",
    "databases",
    "devops_tools",
    "data_ai_tools",
    "web_technologies",
    "api_backend",
    "other_technical_tools",
)

DEGREE_RANK_KEYWORDS = (
    ("phd", 8),
    ("doctor", 8),
    ("doctorate", 8),
    ("engineering degree", 6),
    ("ingenieur", 6),
    ("engineer", 6),
    ("master", 6),
    ("msc", 6),
    ("bachelor", 4),
    ("licence", 4),
    ("business computing", 4),
    ("associate", 3),
    ("technician", 3),
)

EDUCATION_FIELD_KEYWORDS = {
    "data science": "FIELD_DATA_SCIENCE",
    "business intelligence": "FIELD_BUSINESS_INTELLIGENCE",
    "business computing": "FIELD_BUSINESS_COMPUTING",
    "computer science": "FIELD_COMPUTER_SCIENCE",
    "software engineering": "FIELD_SOFTWARE_ENGINEERING",
    "informatics": "FIELD_COMPUTER_SCIENCE",
    "information system": "FIELD_INFORMATION_SYSTEMS",
}


def load_json(path: str | Path) -> dict:
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def save_json(data: dict, path: str | Path) -> Path:
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False, cls=_JSONEncoder)
    return output_path


def _clean_text(value: Any) -> str:
    if value is None:
        return ""
    return " ".join(str(value).split()).strip()


def _normalize_for_match(value: Any) -> str:
    return _clean_text(value).casefold()


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
    context: str = "cv",
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


def _project_description_is_short_enough(value: Any) -> bool:
    text = _clean_text(value)
    return bool(text) and len(text) <= 120 and len(text.split()) <= 18


def flatten_technical_skills(parsed_cv: dict) -> list[dict]:
    technical_skills = parsed_cv.get("technical_skills") or {}
    flattened: list[dict] = []

    for category in TECHNICAL_SKILL_FIELDS:
        values = _as_list(technical_skills.get(category))
        for idx, value in enumerate(values):
            _append_entity(
                flattened,
                source_path=f"technical_skills.{category}[{idx}]",
                entity_kind="skill",
                original_text=value,
                preferred_types=["skill"],
            )

    return flattened


def extract_cv_entities(parsed_cv: dict) -> dict:
    entities = {
        "occupations": [],
        "skills": [],
        "education": [],
        "projects": [],
        "certifications": [],
        "languages": [],
    }

    for section_name in ("experience", "stages"):
        for idx, entry in enumerate(_as_list(parsed_cv.get(section_name))):
            if not isinstance(entry, dict):
                continue
            title_field = "title" if _clean_text(entry.get("title")) else "job_title"
            _append_entity(
                entities["occupations"],
                source_path=f"{section_name}[{idx}].{title_field}",
                entity_kind="occupation",
                original_text=entry.get(title_field),
                preferred_types=["occupation"],
            )

    for group_idx, group in enumerate(_as_list(parsed_cv.get("skills"))):
        if not isinstance(group, dict):
            continue
        for item_idx, item in enumerate(_as_list(group.get("items"))):
            if isinstance(item, dict):
                text = item.get("name")
            else:
                text = item
            _append_entity(
                entities["skills"],
                source_path=f"skills[{group_idx}].items[{item_idx}].name",
                entity_kind="skill",
                original_text=text,
                preferred_types=["skill"],
            )

    entities["skills"].extend(flatten_technical_skills(parsed_cv))

    for idx, entry in enumerate(_as_list(parsed_cv.get("education"))):
        if not isinstance(entry, dict):
            continue
        _append_entity(
            entities["education"],
            source_path=f"education[{idx}].degree",
            entity_kind="education",
            original_text=entry.get("degree"),
            preferred_types=["occupation", "skill"],
        )

    for idx, entry in enumerate(_as_list(parsed_cv.get("projects"))):
        if not isinstance(entry, dict):
            continue
        _append_entity(
            entities["projects"],
            source_path=f"projects[{idx}].name",
            entity_kind="project",
            original_text=entry.get("name"),
            preferred_types=["occupation", "skill"],
        )
        if _project_description_is_short_enough(entry.get("description")):
            _append_entity(
                entities["projects"],
                source_path=f"projects[{idx}].description",
                entity_kind="project",
                original_text=entry.get("description"),
                preferred_types=["skill"],
            )

    for idx, entry in enumerate(_as_list(parsed_cv.get("certifications"))):
        if not isinstance(entry, dict):
            continue
        _append_entity(
            entities["certifications"],
            source_path=f"certifications[{idx}].name",
            entity_kind="certification",
            original_text=entry.get("name"),
            preferred_types=["skill"],
        )

    for idx, entry in enumerate(_as_list(parsed_cv.get("languages"))):
        if isinstance(entry, dict):
            name = _clean_text(entry.get("name"))
            if not name:
                continue
            entities["languages"].append(
                {
                    "source_path": f"languages[{idx}].name",
                    "original_text": name,
                    "level": _clean_text(entry.get("level")) or None,
                    "context": "cv",
                }
            )
        else:
            name = _clean_text(entry)
            if not name:
                continue
            entities["languages"].append(
                {
                    "source_path": f"languages[{idx}]",
                    "original_text": name,
                    "level": None,
                    "context": "cv",
                }
            )

    return entities


def map_entity(
    entity: dict,
    mapper_service: "MapperService",
    use_vector: bool = True,
    use_llm: bool = True,
) -> dict:
    return map_entity_with_agent(
        entity,
        use_vector=use_vector,
        use_llm=use_llm,
        mapper_service=mapper_service,
    )


def _parse_years(value: Any) -> float | None:
    if value in (None, "", "null", "none"):
        return None
    try:
        return float(value)
    except Exception:
        return None


def build_candidate_profile(parsed_cv: dict) -> dict:
    years = _parse_years(parsed_cv.get("experience_years"))
    source_field = "experience_years"

    if years is None:
        years = _parse_years(parsed_cv.get("total_career_years"))
        source_field = "total_career_years"

    if years is None:
        years = 0.0
        source_field = "default_0"

    if years <= 3:
        profile_type = "beginner"
        rule = "<= 3 years => beginner"
    elif years <= 7:
        profile_type = "intermediate"
        rule = "> 3 and <= 7 years => intermediate"
    else:
        profile_type = "experienced"
        rule = "> 7 years => experienced"

    return {
        "profile_type": profile_type,
        "experience_years_used": round(years, 1),
        "source_field": source_field,
        "rule": rule,
    }


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


def build_cv_matching_signals(
    parsed_cv: dict,
    mapped_entities: dict,
    *,
    education_degrees: list[str],
    education_degree_rank: int | None,
    education_field_codes: list[str],
) -> dict[str, Any]:
    role_signals: list[dict[str, Any]] = []
    skill_signals: list[dict[str, Any]] = []
    project_skill_signals: list[dict[str, Any]] = []
    project_domain_signals: list[dict[str, Any]] = []
    language_signals: list[dict[str, Any]] = []

    for item in mapped_entities.get("occupations", []):
        if isinstance(item, dict):
            signal = signal_from_mapped_entity(item, group="roles")
            if signal:
                role_signals.append(signal)

    for section_name in ("experience", "stages"):
        for idx, entry in enumerate(_signals_as_list(parsed_cv.get(section_name))):
            if not isinstance(entry, dict):
                continue
            title = _signal_clean_text(entry.get("title") or entry.get("job_title"))
            signal = build_signal(
                raw_term=title,
                source_path=f"{section_name}[{idx}].title",
                group="roles",
                entity_kind="occupation",
                signal_origin="parsed_only",
            )
            if signal:
                role_signals.append(signal)

    for item in mapped_entities.get("skills", []):
        if isinstance(item, dict):
            signal = signal_from_mapped_entity(item, group="skills")
            if signal:
                skill_signals.append(signal)

    for group_idx, group in enumerate(_signals_as_list(parsed_cv.get("skills"))):
        if not isinstance(group, dict):
            continue
        for item_idx, item in enumerate(_signals_as_list(group.get("items"))):
            signal = build_signal(
                raw_term=_signal_extract_named_value(item),
                source_path=f"skills[{group_idx}].items[{item_idx}]",
                group="skills",
                entity_kind="skill",
                signal_origin="parsed_only",
            )
            if signal:
                skill_signals.append(signal)

    technical_skills = parsed_cv.get("technical_skills") or {}
    if isinstance(technical_skills, dict):
        for category, values in technical_skills.items():
            for idx, item in enumerate(_signals_as_list(values)):
                signal = build_signal(
                    raw_term=_signal_extract_named_value(item),
                    source_path=f"technical_skills.{category}[{idx}]",
                    group="skills",
                    entity_kind="skill",
                    signal_origin="parsed_only",
                )
                if signal:
                    skill_signals.append(signal)

    for section_name in ("experience", "stages"):
        for entry_idx, entry in enumerate(_signals_as_list(parsed_cv.get(section_name))):
            if not isinstance(entry, dict):
                continue
            for tech_idx, item in enumerate(_signals_as_list(entry.get("technologies"))):
                signal = build_signal(
                    raw_term=_signal_extract_named_value(item),
                    source_path=f"{section_name}[{entry_idx}].technologies[{tech_idx}]",
                    group="skills",
                    entity_kind="skill",
                    signal_origin="parsed_only",
                )
                if signal:
                    skill_signals.append(signal)

    for idx, item in enumerate(mapped_entities.get("projects", [])):
        if not isinstance(item, dict):
            continue
        taxonomy_type = _clean_text(item.get("taxonomy_type"))
        if taxonomy_type == "skill":
            signal = signal_from_mapped_entity(item, group="project_skills")
            if signal:
                project_skill_signals.append(signal)
        elif taxonomy_type == "occupation":
            signal = signal_from_mapped_entity(item, group="project_domains")
            if signal:
                project_domain_signals.append(signal)

    for project_idx, project in enumerate(_signals_as_list(parsed_cv.get("projects"))):
        if not isinstance(project, dict):
            continue
        signal = build_signal(
            raw_term=project.get("name"),
            source_path=f"projects[{project_idx}].name",
            group="project_skills",
            entity_kind="project",
            signal_origin="parsed_only",
        )
        if signal:
            project_skill_signals.append(signal)

        for tech_idx, item in enumerate(_signals_as_list(project.get("technologies"))):
            signal = build_signal(
                raw_term=_signal_extract_named_value(item),
                source_path=f"projects[{project_idx}].technologies[{tech_idx}]",
                group="project_skills",
                entity_kind="skill",
                signal_origin="parsed_only",
            )
            if signal:
                project_skill_signals.append(signal)

    for idx, item in enumerate(mapped_entities.get("languages", [])):
        if not isinstance(item, dict):
            continue
        signal = build_signal(
            raw_term=item.get("original_text"),
            source_path=_signal_clean_text(item.get("source_path")) or f"languages[{idx}]",
            group="languages",
            entity_kind="language",
            signal_origin="mapped_entity",
            extra={"level": _signal_clean_text(item.get("level")) or None},
        )
        if signal:
            language_signals.append(signal)

    return {
        "strategy": "taxonomy_assisted",
        "roles": dedupe_signals(role_signals),
        "skills": dedupe_signals(skill_signals),
        "project_skills": dedupe_signals(project_skill_signals),
        "project_domains": dedupe_signals(project_domain_signals),
        "education": {
            "degrees": _unique_preserve_order(education_degrees),
            "degree_rank": education_degree_rank,
            "field_codes": _unique_preserve_order(education_field_codes),
        },
        "languages": dedupe_signals(language_signals),
    }


def _infer_degree_rank(degrees: list[str]) -> int | None:
    best_rank: int | None = None
    for degree in degrees:
        normalized = _normalize_for_match(degree)
        if not normalized:
            continue
        for keyword, rank in DEGREE_RANK_KEYWORDS:
            if keyword in normalized:
                best_rank = rank if best_rank is None else max(best_rank, rank)
                break
    return best_rank


def _infer_education_field_codes(degrees: list[str]) -> list[str]:
    field_codes: list[str] = []
    for degree in degrees:
        normalized = _normalize_for_match(degree)
        if not normalized:
            continue
        for keyword, field_code in EDUCATION_FIELD_KEYWORDS.items():
            if keyword in normalized:
                field_codes.append(field_code)
    return _unique_preserve_order(field_codes)


def _collect_project_skill_codes(
    parsed_cv: dict,
    mapped_entities: dict,
    accepted_skill_pairs: list[tuple[str, str]],
) -> list[str]:
    project_skill_codes: list[str] = []

    for item in mapped_entities.get("projects", []):
        if item.get("decision") not in ("auto_accept", "manual_review"):
            continue
        if item.get("taxonomy_type") == "skill" and item.get("rtmc_code"):
            project_skill_codes.append(item["rtmc_code"])

    for entry in _as_list(parsed_cv.get("projects")):
        if not isinstance(entry, dict):
            continue
        combined_text = " ".join(
            filter(
                None,
                (
                    _clean_text(entry.get("name")),
                    _clean_text(entry.get("description")),
                ),
            )
        )
        normalized_text = _normalize_for_match(combined_text)
        if not normalized_text:
            continue
        for original_text, code in accepted_skill_pairs:
            if original_text and original_text in normalized_text:
                project_skill_codes.append(code)

    return _unique_preserve_order(project_skill_codes)


def _collect_project_domain_codes(
    parsed_cv: dict,
    mapped_entities: dict,
    accepted_occupation_codes: list[str],
) -> list[str]:
    project_domain_codes: list[str] = []

    for item in mapped_entities.get("projects", []):
        if item.get("decision") not in ("auto_accept", "manual_review"):
            continue
        if item.get("taxonomy_type") == "occupation" and item.get("rtmc_code"):
            project_domain_codes.append(item["rtmc_code"])

    if not project_domain_codes and _as_list(parsed_cv.get("projects")):
        project_domain_codes.extend(accepted_occupation_codes)

    return _unique_preserve_order(project_domain_codes)


def build_scoring_features(parsed_cv: dict, mapped_entities: dict) -> dict:
    candidate_profile = build_candidate_profile(parsed_cv)
    accepted_occupation_codes: list[str] = []
    accepted_occupation_labels: list[str] = []
    accepted_skill_codes: list[str] = []
    accepted_skill_labels: list[str] = []
    accepted_skill_pairs: list[tuple[str, str]] = []
    manual_review_entities: list[dict] = []
    rejected_entities: list[dict] = []

    for section_name in ("occupations", "skills", "education", "projects", "certifications"):
        for item in mapped_entities.get(section_name, []):
            decision = item.get("decision")
            taxonomy_type = item.get("taxonomy_type")
            code = item.get("rtmc_code")
            label = item.get("rtmc_label")

            if section_name == "occupations" and decision in ("auto_accept", "manual_review") and code:
                if taxonomy_type == "occupation":
                    if code:
                        accepted_occupation_codes.append(code)
                    if label:
                        accepted_occupation_labels.append(label)
            elif section_name == "skills" and decision in ("auto_accept", "manual_review") and code:
                if taxonomy_type == "skill":
                    accepted_skill_codes.append(code)
                    accepted_skill_pairs.append((_normalize_for_match(item.get("original_text")), code))
                    if label:
                        accepted_skill_labels.append(label)

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

    education_degrees = [
        _clean_text(entry.get("degree"))
        for entry in _as_list(parsed_cv.get("education"))
        if isinstance(entry, dict) and _clean_text(entry.get("degree"))
    ]
    certifications = [
        _clean_text(entry.get("name"))
        for entry in _as_list(parsed_cv.get("certifications"))
        if isinstance(entry, dict) and _clean_text(entry.get("name"))
    ]
    professional_experience_years = _parse_years(parsed_cv.get("experience_years")) or 0.0
    stage_years = _parse_years(parsed_cv.get("stage_years")) or 0.0
    total_career_years = _parse_years(parsed_cv.get("total_career_years")) or 0.0
    education_degree_rank = _infer_degree_rank(education_degrees)
    education_field_codes = _infer_education_field_codes(education_degrees)
    project_skill_codes = _collect_project_skill_codes(parsed_cv, mapped_entities, accepted_skill_pairs)
    project_domain_codes = _collect_project_domain_codes(parsed_cv, mapped_entities, accepted_occupation_codes)
    languages = [
        item.get("original_text")
        for item in mapped_entities.get("languages", [])
        if item.get("original_text")
    ]
    matching_signals = build_cv_matching_signals(
        parsed_cv,
        mapped_entities,
        education_degrees=education_degrees,
        education_degree_rank=education_degree_rank,
        education_field_codes=education_field_codes,
    )

    return {
        "matching_strategy": "taxonomy_assisted",
        "taxonomy_assisted": True,
        "profile_type": candidate_profile["profile_type"],
        "experience_years": candidate_profile["experience_years_used"],
        "professional_experience_years": round(professional_experience_years, 1),
        "stage_years": round(stage_years, 1),
        "total_career_years": round(total_career_years, 1),
        "accepted_occupation_codes": _unique_preserve_order(accepted_occupation_codes),
        "accepted_occupation_labels": _unique_preserve_order(accepted_occupation_labels),
        "accepted_skill_codes": _unique_preserve_order(accepted_skill_codes),
        "accepted_skill_labels": _unique_preserve_order(accepted_skill_labels),
        "education_degree_rank": education_degree_rank,
        "education_field_codes": education_field_codes,
        "speciality_codes": education_field_codes,
        "project_skill_codes": project_skill_codes,
        "project_domain_codes": project_domain_codes,
        "skill_terms": signal_terms(matching_signals["skills"]),
        "experience_role_terms": signal_terms(matching_signals["roles"]),
        "project_skill_terms": signal_terms(matching_signals["project_skills"]),
        "unmapped_skill_terms": signal_unmapped_terms(matching_signals["skills"]),
        "manual_review_entities": manual_review_entities,
        "rejected_entities": rejected_entities,
        "education_degrees": _unique_preserve_order(education_degrees),
        "certifications": _unique_preserve_order(certifications),
        "languages": _unique_preserve_order(languages),
        "matching_signal_counts": {
            "roles": len(matching_signals["roles"]),
            "skills": len(matching_signals["skills"]),
            "project_skills": len(matching_signals["project_skills"]),
            "project_domains": len(matching_signals["project_domains"]),
        },
    }


def map_parsed_cv(
    parsed_cv: dict,
    use_vector: bool = True,
    use_llm: bool = True,
    mapper_service: "MapperService | None" = None,
) -> dict:
    if not isinstance(parsed_cv, dict):
        raise TypeError("parsed_cv must be a dict")

    if mapper_service is None:
        from mapper_app.service import get_mapper_service

        mapper_service = get_mapper_service()
    extracted_entities = extract_cv_entities(parsed_cv)

    mapped_entities = {
        "occupations": [],
        "skills": [],
        "education": [],
        "projects": [],
        "certifications": [],
        "languages": extracted_entities["languages"],
    }

    for section_name in ("occupations", "skills", "education", "projects", "certifications"):
        mapped_entities[section_name] = map_entities_with_agent(
            extracted_entities[section_name],
            use_vector=use_vector,
            use_llm=use_llm,
            mapper_service=mapper_service,
        )

    candidate_profile = build_candidate_profile(parsed_cv)
    scoring_features = build_scoring_features(parsed_cv, mapped_entities)

    mapped_lists = (
        mapped_entities["occupations"]
        + mapped_entities["skills"]
        + mapped_entities["education"]
        + mapped_entities["projects"]
        + mapped_entities["certifications"]
    )

    mapping_quality = {
        "total_entities": len(mapped_lists),
        "auto_accept_count": sum(1 for item in mapped_lists if item.get("decision") == "auto_accept"),
        "manual_review_count": sum(1 for item in mapped_lists if item.get("decision") == "manual_review"),
        "reject_count": sum(1 for item in mapped_lists if item.get("decision") == "reject"),
    }

    return {
        "document_type": "mapped_cv",
        "mapping_metadata": {
            "mapper_version": "v1",
            "taxonomy": "RTMC",
            "mapping_agent": "MapperService",
            "use_vector": bool(use_vector),
            "use_llm": bool(use_llm),
        },
        "parsed_cv": parsed_cv,
        "candidate_profile": candidate_profile,
        "mapped_entities": mapped_entities,
        "scoring_features": scoring_features,
        "matching_signals": build_cv_matching_signals(
            parsed_cv,
            mapped_entities,
            education_degrees=scoring_features.get("education_degrees", []),
            education_degree_rank=scoring_features.get("education_degree_rank"),
            education_field_codes=scoring_features.get("education_field_codes", []),
        ),
        "mapping_quality": mapping_quality,
    }


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Map un parsed CV JSON vers RTMC.")
    parser.add_argument("input_json", help="Chemin vers le JSON parsed CV.")
    parser.add_argument("--out", required=True, help="Chemin du mapped_cv.json de sortie.")
    parser.add_argument("--no-vector", action="store_true", help="Desactive la recherche vectorielle.")
    parser.add_argument("--no-llm", action="store_true", help="Desactive le fallback LLM.")
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    parsed_cv = load_json(args.input_json)
    mapped_cv = map_parsed_cv(
        parsed_cv,
        use_vector=not args.no_vector,
        use_llm=not args.no_llm,
    )
    output_path = save_json(mapped_cv, args.out)
    quality = mapped_cv["mapping_quality"]

    print("=" * 72)
    print("  CV JSON -> RTMC MAPPING")
    print("=" * 72)
    print(f"Total entities : {quality['total_entities']}")
    print(f"Auto accept    : {quality['auto_accept_count']}")
    print(f"Manual review  : {quality['manual_review_count']}")
    print(f"Reject         : {quality['reject_count']}")
    print(f"Output path    : {output_path}")
    print("=" * 72)


if __name__ == "__main__":
    main()
