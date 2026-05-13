from __future__ import annotations

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

        parsed_payload = _parse_result_to_dict(result)
        profile_patch = _build_profile_patch(parsed_payload)
        parsed_payload = enrich_cv_locations(parsed_payload)

        raw_skills = profile_patch.get("skills") or []
        raw_languages = profile_patch.get("languages") or []

        clean_skills, normalized_languages = split_skills_and_languages(
            skills=raw_skills,
            existing_languages=raw_languages,
        )

        profile_patch["skills"] = clean_skills
        profile_patch["languages"] = normalized_languages

        parsing_status = "PARSED" if result.status in {"success", "partial"} else "FAILED"

        try:
            mapped_payload = map_cv_to_rtmc(
                parsed_payload=parsed_payload,
                use_vector=False,
                use_llm=True,
            )
        except Exception as exc:
            mapped_payload = {
                **parsed_payload,
                "rtmc_mapping": {
                    "status": "FAILED",
                    "error": str(exc),
                },
            }

            if result.warnings is None:
                result.warnings = []

            result.warnings.append(f"RTMC mapper failed: {exc}")

        return {
            "parsing_status": parsing_status,
            "parsed_payload": parsed_payload,
            "mapped_payload": mapped_payload,
            "extracted_profile_patch": profile_patch,
            "warnings": result.warnings or [],
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
        "education": normalize_education_entries(education) if isinstance(education, list) else [],
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


def _extract_skills(
    *,
    cv_data: dict[str, Any],
    raw_json: dict[str, Any],
) -> list[dict[str, Any]]:
    skills: list[dict[str, Any]] = []

    simple_skills = cv_data.get("skills") or raw_json.get("skills") or []
    if isinstance(simple_skills, list):
        for item in simple_skills:
            if isinstance(item, str):
                skills.append({"skill_label_raw": item, "source": "CV_PARSER"})
            elif isinstance(item, dict):
                label = item.get("name") or item.get("label") or item.get("skill") or item.get("raw_label")
                if label:
                    skills.append(
                        {
                            "skill_label_raw": label,
                            "level": item.get("level"),
                            "source": "CV_PARSER",
                            "metadata": item,
                        }
                    )

    technical = cv_data.get("technical_skills") or raw_json.get("technical_skills") or {}
    if isinstance(technical, dict):
        for category, values in technical.items():
            if not isinstance(values, list):
                continue
            for value in values:
                if value:
                    skills.append(
                        {
                            "skill_label_raw": str(value),
                            "source": "CV_PARSER",
                            "metadata": {"category": category},
                        }
                    )

    seen = set()
    deduped = []
    for skill in skills:
        key = str(skill.get("skill_label_raw") or "").strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        deduped.append(skill)

    return deduped
