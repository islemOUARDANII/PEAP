from __future__ import annotations

import re
import tempfile
from pathlib import Path
from typing import Any

from app.engines.rtmc_mapper_adapter import map_cv_to_rtmc
from app.engines.legacy_parsing.parser_app.config import Settings
from app.engines.legacy_parsing.parser_app.pipeline import CVParsingPipeline
from app.engines.geo_normalizer_adapter import enrich_cv_locations
from app.engines.education_normalizer_adapter import normalize_education_entries
from app.engines.language_normalizer import split_skills_and_languages


def parse_cv_file_to_payload(
    *,
    file_bytes: bytes,
    original_filename: str,
) -> dict[str, Any]:
    suffix = Path(original_filename).suffix or ".pdf"

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        settings = Settings()
        pipeline = CVParsingPipeline(settings)

        result = pipeline.parse(
            tmp_path,
            save_output=False,
            verbose=False,
        )

        warnings: list[Any] = list(result.warnings or [])
        parsed_payload = _parse_result_to_dict(result)

        try:
            parsed_payload = enrich_cv_locations(parsed_payload)
        except Exception as exc:
            warnings.append(f"Geo normalizer failed: {exc}")

        try:
            profile_patch = _build_profile_patch(parsed_payload)
        except Exception as exc:
            warnings.append(f"Profile patch builder failed: {exc}")
            profile_patch = _build_minimal_profile_patch(parsed_payload)

        raw_skills = profile_patch.get("skills") or []
        raw_languages = profile_patch.get("languages") or []

        try:
            clean_skills, normalized_languages = split_skills_and_languages(
                skills=raw_skills,
                existing_languages=raw_languages,
            )

            profile_patch["skills"] = clean_skills
            profile_patch["languages"] = normalized_languages
        except Exception as exc:
            warnings.append(f"Language normalizer failed: {exc}")
            profile_patch["skills"] = raw_skills
            profile_patch["languages"] = raw_languages if isinstance(raw_languages, list) else []

        parsing_status = "PARSED" if result.status in {"success", "partial"} else "FAILED"

        try:
            mapped_payload = map_cv_to_rtmc(
                parsed_payload=parsed_payload,
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
            warnings.append(f"RTMC mapper failed: {exc}")

        return {
            "parsing_status": parsing_status,
            "parsed_payload": parsed_payload,
            "mapped_payload": mapped_payload,
            "extracted_profile_patch": profile_patch,
            "warnings": warnings,
            "errors": [],
            "parser_version": "cv-parser-legacy-v1",
        }
    finally:
        try:
            Path(tmp_path).unlink(missing_ok=True)
        except Exception:
            pass


def _parse_result_to_dict(result) -> dict[str, Any]:
    cv_data = result.cv_data

    if hasattr(cv_data, "model_dump"):
        cv_dict = cv_data.model_dump()
    elif hasattr(cv_data, "dict"):
        cv_dict = cv_data.dict()
    else:
        cv_dict = {}

    return {
        "file_name": result.file_name,
        "status": result.status,
        "processing_time": result.processing_time,
        "raw_json": result.raw_json or {},
        "cv_data": cv_dict,
    }


def _normalize_experience_entry(
    entry: dict[str, Any],
    default_entry_type: str = "experience",
) -> dict[str, Any]:
    title = (
        entry.get("title")
        or entry.get("job_title")
        or entry.get("position")
        or entry.get("role")
    )

    return {
        "title": title,
        "company": entry.get("company"),
        "location": entry.get("location"),
        "start_date": entry.get("start_date"),
        "end_date": entry.get("end_date"),
        "is_current": bool(entry.get("is_current") or False),
        "description": entry.get("description"),
        "responsibilities": entry.get("responsibilities") or [],
        "technologies": entry.get("technologies") or [],
        "projects": entry.get("projects") or [],
        "duration_months": entry.get("duration_months"),
        "duration_years": entry.get("duration_years"),
        "entry_type": entry.get("entry_type") or default_entry_type,
        "source_section": entry.get("source_section"),
        "confidence": entry.get("confidence"),
    }


def _safe_normalize_education_entries(education: list[Any]) -> list[dict[str, Any]]:
    if not isinstance(education, list):
        return []

    dict_entries = [item for item in education if isinstance(item, dict)]

    try:
        return normalize_education_entries(dict_entries)
    except Exception as exc:
        return [
            {
                **entry,
                "raw_degree": entry.get("degree") or entry.get("diploma_label") or entry.get("diploma") or "",
                "level_code": "",
                "diploma_label": entry.get("degree") or entry.get("diploma_label") or entry.get("diploma") or "",
                "specialty": entry.get("field") or entry.get("specialty") or "",
                "specialty_code": "",
                "institution": entry.get("institution") or "",
                "graduation_year": entry.get("graduation_year") or entry.get("end_date") or "",
                "normalization": {
                    "diploma_matched": False,
                    "specialty_matched": False,
                    "source": "education_normalizer",
                    "error": str(exc),
                },
            }
            for entry in dict_entries
        ]


def _build_profile_patch(parsed_payload: dict[str, Any]) -> dict[str, Any]:
    cv_data = parsed_payload.get("cv_data") or {}
    raw_json = parsed_payload.get("raw_json") or {}

    personal = cv_data.get("personal_info") or raw_json.get("personal_info") or {}

    identity = {
        "first_name": personal.get("first_name") or personal.get("firstname"),
        "last_name": personal.get("last_name") or personal.get("lastname"),
        "birth_date": personal.get("birth_date"),
        "nationality": personal.get("nationality"),
    }

    education = cv_data.get("education") or raw_json.get("education") or []
    experience = cv_data.get("experience") or raw_json.get("experience") or []
    raw_stages = cv_data.get("stages") or raw_json.get("stages") or []

    skills = _extract_skills(cv_data=cv_data, raw_json=raw_json)
    languages = cv_data.get("languages") or raw_json.get("languages") or []

    return {
        "identity": {k: v for k, v in identity.items() if v},
        "education": _safe_normalize_education_entries(education) if isinstance(education, list) else [],
        "experience": [
            _normalize_experience_entry(item, default_entry_type="experience")
            for item in experience
            if isinstance(item, dict)
        ] if isinstance(experience, list) else [],
        "stages": [
            _normalize_experience_entry(item, default_entry_type="internship")
            for item in raw_stages
            if isinstance(item, dict)
        ] if isinstance(raw_stages, list) else [],
        "skills": skills,
        "languages": languages if isinstance(languages, list) else [],
    }


def _build_minimal_profile_patch(parsed_payload: dict[str, Any]) -> dict[str, Any]:
    cv_data = parsed_payload.get("cv_data") if isinstance(parsed_payload.get("cv_data"), dict) else {}
    raw_json = parsed_payload.get("raw_json") if isinstance(parsed_payload.get("raw_json"), dict) else {}

    personal = cv_data.get("personal_info") or raw_json.get("personal_info") or {}

    return {
        "identity": {
            k: v
            for k, v in {
                "first_name": personal.get("first_name") or personal.get("firstname"),
                "last_name": personal.get("last_name") or personal.get("lastname"),
                "birth_date": personal.get("birth_date"),
                "nationality": personal.get("nationality"),
            }.items()
            if v
        },
        "education": [],
        "experience": [],
        "stages": [],
        "skills": _extract_skills(cv_data=cv_data, raw_json=raw_json),
        "languages": [],
    }


def _normalize_skill_label(value: Any) -> str | None:
    """Return a clean skill label from parser output without stringifying objects."""
    if value is None:
        return None

    if isinstance(value, str):
        label = value.strip(" \t\n\r:-•")
    else:
        label = str(value).strip(" \t\n\r:-•")

    if not label:
        return None

    # Avoid keeping section titles as skills.
    normalized = label.lower().strip()
    if normalized in {
        "skill",
        "skills",
        "competence",
        "competences",
        "compétence",
        "compétences",
        "technical skills",
        "competences techniques",
        "compétences techniques",
        "technologies",
        "tools",
        "outils",
        "language",
        "languages",
        "langue",
        "langues",
    }:
        return None

    return label


def _extract_skill_label(item: Any) -> str | None:
    """Extract one skill label from a primitive or a parser dictionary."""
    if isinstance(item, str):
        return _normalize_skill_label(item)

    if not isinstance(item, dict):
        return _normalize_skill_label(item)

    # Common parser keys. Do not fallback to str(dict), because that creates fake skills.
    for key in (
        "skill_label_raw",
        "raw_label",
        "name",
        "label",
        "skill",
        "technology",
        "tool",
        "title",
        "text",
        "value",
    ):
        value = item.get(key)
        if isinstance(value, (str, int, float)):
            label = _normalize_skill_label(value)
            if label:
                return label

    return None


def _split_skill_string(value: str) -> list[str]:
    """Split compact skill strings without destroying names like C++ or Node.js."""
    raw = str(value or "").strip()
    if not raw:
        return []

    # Split only on strong separators. We avoid splitting on '+' or '.' because of C++/Node.js.
    parts = re.split(r"[,;|\n•]+", raw)
    cleaned = [_normalize_skill_label(part) for part in parts]
    return [part for part in cleaned if part]


def _append_skill(
    skills: list[dict[str, Any]],
    item: Any,
    *,
    source: str = "CV_PARSER",
    metadata: dict[str, Any] | None = None,
) -> None:
    label = _extract_skill_label(item)
    if not label:
        return

    labels = _split_skill_string(label)

    for one_label in labels:
        skill: dict[str, Any] = {
            "skill_label_raw": one_label,
            "source": source,
        }

        if isinstance(item, dict):
            level = item.get("level") or item.get("proficiency")
            if level:
                skill["level"] = level

            skill_metadata = dict(metadata or {})
            skill_metadata.update({k: v for k, v in item.items() if k not in {"items"}})
            if skill_metadata:
                skill["metadata"] = skill_metadata
        elif metadata:
            skill["metadata"] = metadata

        skills.append(skill)


def _extract_skills(
    *,
    cv_data: dict[str, Any],
    raw_json: dict[str, Any],
) -> list[dict[str, Any]]:
    skills: list[dict[str, Any]] = []

    simple_skills = cv_data.get("skills") or raw_json.get("skills") or []
    if isinstance(simple_skills, list):
        for item in simple_skills:
            if isinstance(item, dict) and isinstance(item.get("items"), list):
                category = item.get("category") or item.get("label") or item.get("name")
                for child in item.get("items") or []:
                    _append_skill(
                        skills,
                        child,
                        metadata={"category": category} if category else None,
                    )
            else:
                _append_skill(skills, item)

    technical = cv_data.get("technical_skills") or raw_json.get("technical_skills") or {}
    if isinstance(technical, dict):
        for category, values in technical.items():
            if isinstance(values, list):
                for value in values:
                    _append_skill(
                        skills,
                        value,
                        metadata={"category": category},
                    )
            else:
                _append_skill(
                    skills,
                    values,
                    metadata={"category": category},
                )

    # Some parsers put technologies directly inside experiences or internships.
    for section_name in ("experience", "experiences", "stages", "projects"):
        entries = cv_data.get(section_name) or raw_json.get(section_name) or []
        if not isinstance(entries, list):
            continue

        for entry in entries:
            if not isinstance(entry, dict):
                continue

            for key in ("technologies", "tools", "technical_environment", "environment"):
                values = entry.get(key)
                if isinstance(values, list):
                    for value in values:
                        _append_skill(
                            skills,
                            value,
                            metadata={"section": section_name, "field": key},
                        )
                elif isinstance(values, str):
                    _append_skill(
                        skills,
                        values,
                        metadata={"section": section_name, "field": key},
                    )

    seen = set()
    deduped: list[dict[str, Any]] = []

    for skill in skills:
        label = str(skill.get("skill_label_raw") or "").strip()
        key = label.lower()

        if not key or key in seen:
            continue

        seen.add(key)
        deduped.append(skill)

    return deduped
