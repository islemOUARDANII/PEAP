from __future__ import annotations

from typing import Any

from app.engines.legacy_matching.utils.path_utils import get_by_path
from app.engines.legacy_matching.utils.score_utils import normalize_list, to_float


def _build_degree_rank_maps(education_params: dict[str, Any] | None) -> tuple[dict[str, int], dict[str, int]]:
    if not education_params:
        return {}, {}

    code_rank_map_raw = education_params.get("degree_rank_map") or {}
    keyword_rank_map_raw = education_params.get("degree_keyword_rank_map") or {}

    code_rank_map: dict[str, int] = {}
    if isinstance(code_rank_map_raw, dict):
        for key, rank in code_rank_map_raw.items():
            try:
                code_rank_map[str(key).strip().upper()] = int(rank)
            except Exception:
                continue

    keyword_rank_map: dict[str, int] = {}
    if isinstance(keyword_rank_map_raw, dict):
        for key, rank in keyword_rank_map_raw.items():
            try:
                keyword_rank_map[str(key).strip().lower()] = int(rank)
            except Exception:
                continue

    return code_rank_map, keyword_rank_map


def _infer_degree_rank(value: Any, education_params: dict[str, Any] | None = None) -> int | None:
    if value is None:
        return None

    code_rank_map, keyword_rank_map = _build_degree_rank_maps(education_params)
    text = str(value).strip().upper()
    if text in code_rank_map:
        return code_rank_map[text]

    lowered = str(value).strip().lower()
    for keyword, rank in sorted(keyword_rank_map.items(), key=lambda item: len(item[0]), reverse=True):
        if keyword and keyword in lowered:
            return rank
    return None


def _highest_degree_rank(values: list[Any], education_params: dict[str, Any] | None = None) -> int | None:
    ranks = [rank for rank in (_infer_degree_rank(value, education_params) for value in values) if rank is not None]
    return max(ranks) if ranks else None


def _collect_codes(entities: list[dict[str, Any]], *, taxonomy_type: str | None = None) -> list[str]:
    codes: list[str] = []
    for entity in entities:
        if not isinstance(entity, dict):
            continue
        if taxonomy_type and entity.get("taxonomy_type") != taxonomy_type:
            continue
        if entity.get("usable_for_scoring") is False:
            continue
        code = entity.get("rtmc_code") or entity.get("taxonomy_code") or entity.get("code")
        if code:
            codes.append(str(code))
    return normalize_list(codes)


def _normalize_scalar_list(value: Any) -> list[str]:
    values = normalize_list(value)
    return [str(item).strip() for item in values if str(item).strip()]


def extract_cv_id(mapped_cv: dict[str, Any]) -> str | None:
    candidates = [
        mapped_cv.get("cv_id"),
        mapped_cv.get("id"),
        get_by_path(mapped_cv, "parsed_cv.cv_id"),
        get_by_path(mapped_cv, "parsed_cv.id"),
        get_by_path(mapped_cv, "_storage.mapped_cv_id"),
        get_by_path(mapped_cv, "_storage.parsed_cv_id"),
        get_by_path(mapped_cv, "_storage.job_seeker_id"),
    ]
    for candidate in candidates:
        if candidate not in (None, ""):
            return str(candidate)
    return None


def extract_offer_id(mapped_offer: dict[str, Any]) -> str | None:
    candidates = [
        mapped_offer.get("offer_id"),
        mapped_offer.get("id"),
        get_by_path(mapped_offer, "parsed_offer.offer_id"),
        get_by_path(mapped_offer, "_storage.mapped_offer_id"),
        get_by_path(mapped_offer, "_storage.parsed_offer_id"),
        get_by_path(mapped_offer, "_storage.job_offer_id"),
    ]
    for candidate in candidates:
        if candidate not in (None, ""):
            return str(candidate)
    return None


def extract_cv_features(
    mapped_cv: dict[str, Any],
    scoring_params: dict[str, dict[str, Any]] | None = None,
) -> dict[str, Any]:
    parsed_cv = mapped_cv.get("parsed_cv") or {}
    scoring_features = dict(mapped_cv.get("scoring_features") or {})
    education_params = (scoring_params or {}).get("education_score") or {}

    mapped_entities = mapped_cv.get("mapped_entities") or {}
    project_entities = mapped_entities.get("projects") or []
    personal_info = parsed_cv.get("personal_info") or {}

    education_degrees = normalize_list(
        scoring_features.get("education_degrees")
        or [entry.get("degree") for entry in parsed_cv.get("education", []) if isinstance(entry, dict)]
    )
    education_degree_rank = scoring_features.get("education_degree_rank")
    if education_degree_rank is None:
        education_degree_rank = _highest_degree_rank(education_degrees, education_params)

    skill_codes = normalize_list(scoring_features.get("skill_codes") or scoring_features.get("accepted_skill_codes"))
    if not skill_codes:
        skill_codes = _collect_codes(mapped_entities.get("skills") or [], taxonomy_type="skill")

    experience_role_codes = normalize_list(
        scoring_features.get("experience_role_codes") or scoring_features.get("accepted_occupation_codes")
    )
    if not experience_role_codes:
        experience_role_codes = _collect_codes(mapped_entities.get("occupations") or [], taxonomy_type="occupation")

    project_skill_codes = normalize_list(scoring_features.get("project_skill_codes"))
    if not project_skill_codes:
        project_skill_codes = _collect_codes(project_entities, taxonomy_type="skill")

    project_domain_codes = normalize_list(scoring_features.get("project_domain_codes"))
    if not project_domain_codes:
        project_domain_codes = _collect_codes(project_entities, taxonomy_type="occupation")

    skill_levels = scoring_features.get("skill_levels")
    if not isinstance(skill_levels, dict):
        skill_levels = {}

    languages = normalize_list(scoring_features.get("languages"))
    if not languages:
        languages = [
            str(item.get("code") or item.get("name") or "").strip()
            for item in parsed_cv.get("languages", [])
            if isinstance(item, dict) and str(item.get("code") or item.get("name") or "").strip()
        ]
        languages = normalize_list(languages)

    education_field_codes = normalize_list(scoring_features.get("education_field_codes"))
    speciality_codes = normalize_list(scoring_features.get("speciality_codes") or education_field_codes)
    location_codes = _normalize_scalar_list(
        scoring_features.get("location_codes")
        or scoring_features.get("locations")
        or personal_info.get("location")
    )
    contract_types = _normalize_scalar_list(scoring_features.get("contract_types"))
    mobility_codes = _normalize_scalar_list(scoring_features.get("mobility_codes"))

    features = {
        "experience_years": to_float(
            scoring_features.get("experience_years")
            or parsed_cv.get("total_career_years")
            or parsed_cv.get("experience_years"),
            default=0.0,
        ),
        "unemployment_months": int(scoring_features.get("unemployment_months") or 0),
        "skill_codes": skill_codes,
        "skill_levels": skill_levels,
        "occupation_codes": experience_role_codes,
        "education_degree_rank": education_degree_rank,
        "education_field_codes": education_field_codes,
        "speciality_codes": speciality_codes,
        "experience_role_codes": experience_role_codes,
        "experience_skill_codes": normalize_list(scoring_features.get("experience_skill_codes") or skill_codes),
        "responsibility_codes": normalize_list(scoring_features.get("responsibility_codes")),
        "project_skill_codes": project_skill_codes,
        "project_domain_codes": project_domain_codes,
        "location_codes": location_codes,
        "contract_types": contract_types,
        "mobility_codes": mobility_codes,
        "certifications": normalize_list(scoring_features.get("certifications") or parsed_cv.get("certifications")),
        "awards": normalize_list(scoring_features.get("awards") or parsed_cv.get("awards")),
        "additional_info": normalize_list(scoring_features.get("additional_info") or parsed_cv.get("additional_info")),
        "languages": languages,
    }

    merged_scoring_features = {
        **scoring_features,
        "experience_years": features["experience_years"],
        "unemployment_months": features["unemployment_months"],
        "skill_codes": features["skill_codes"],
        "accepted_skill_codes": features["skill_codes"],
        "skill_levels": features["skill_levels"],
        "occupation_codes": features["occupation_codes"],
        "education_degree_rank": features["education_degree_rank"],
        "education_field_codes": features["education_field_codes"],
        "speciality_codes": features["speciality_codes"],
        "experience_role_codes": features["experience_role_codes"],
        "accepted_occupation_codes": features["experience_role_codes"],
        "experience_skill_codes": features["experience_skill_codes"],
        "responsibility_codes": features["responsibility_codes"],
        "project_skill_codes": features["project_skill_codes"],
        "project_domain_codes": features["project_domain_codes"],
        "location_codes": features["location_codes"],
        "contract_types": features["contract_types"],
        "mobility_codes": features["mobility_codes"],
        "certifications": features["certifications"],
        "awards": features["awards"],
        "additional_info": features["additional_info"],
        "languages": features["languages"],
    }
    mapped_cv["scoring_features"] = merged_scoring_features
    return features


def extract_offer_features(
    mapped_offer: dict[str, Any],
    scoring_params: dict[str, dict[str, Any]] | None = None,
) -> dict[str, Any]:
    parsed_offer = mapped_offer.get("parsed_offer") or {}
    scoring_features = dict(mapped_offer.get("scoring_features") or {})
    mapped_entities = mapped_offer.get("mapped_entities") or {}
    education_params = (scoring_params or {}).get("education_score") or {}
    offer_data = parsed_offer.get("offer") or {}

    parsed_requirements = parsed_offer.get("requirements") or get_by_path(parsed_offer, "parsed_offer.requirements") or {}

    must_have_skill_codes = normalize_list(
        scoring_features.get("must_have_skill_codes") or scoring_features.get("mandatory_skill_codes")
    )
    if not must_have_skill_codes:
        must_have_skill_codes = _collect_codes(mapped_entities.get("mandatory_skills") or [], taxonomy_type="skill")

    nice_to_have_skill_codes = normalize_list(
        scoring_features.get("nice_to_have_skill_codes") or scoring_features.get("optional_skill_codes")
    )
    if not nice_to_have_skill_codes:
        nice_to_have_skill_codes = _collect_codes(mapped_entities.get("optional_skills") or [], taxonomy_type="skill")

    target_role_codes = normalize_list(
        scoring_features.get("target_role_codes") or scoring_features.get("target_occupation_codes")
    )
    if not target_role_codes:
        target_role_codes = _collect_codes(mapped_entities.get("occupations") or [], taxonomy_type="occupation")

    minimum_degree_rank = scoring_features.get("minimum_degree_rank")
    if minimum_degree_rank is None:
        minimum_degree_rank = _infer_degree_rank(
            scoring_features.get("required_education_level")
            or get_by_path(parsed_requirements, "education_min.code")
            or get_by_path(parsed_offer, "education_min_code"),
            education_params,
        )

    required_languages = normalize_list(scoring_features.get("required_languages") or scoring_features.get("languages"))
    if not required_languages:
        required_languages = normalize_list(
            [
                item.get("code") or item.get("label")
                for item in (parsed_requirements.get("languages") or [])
                if isinstance(item, dict)
            ]
        )

    target_field_codes = normalize_list(scoring_features.get("target_field_codes"))
    contract_types = _normalize_scalar_list(
        scoring_features.get("contract_types")
        or [
            offer_data.get("employment_type"),
            parsed_offer.get("employment_type"),
            parsed_offer.get("contract_type"),
        ]
    )
    location_codes = _normalize_scalar_list(
        scoring_features.get("location_codes")
        or scoring_features.get("locations")
        or offer_data.get("location")
        or parsed_offer.get("location")
    )
    mobility_required = _normalize_scalar_list(
        scoring_features.get("mobility_required")
        or scoring_features.get("mobility_codes")
    )
    remote_flags = {
        flag.casefold()
        for flag in _normalize_scalar_list(
            [
                scoring_features.get("work_mode"),
                offer_data.get("work_mode"),
                parsed_offer.get("work_mode"),
            ]
        )
    }
    location_flexible = bool(scoring_features.get("location_flexible")) or any(
        flag in {"remote", "hybrid", "flexible"} for flag in remote_flags
    )

    features = {
        "required_experience_years": to_float(
            scoring_features.get("required_experience_years")
            or parsed_offer.get("min_years_experience")
            or parsed_requirements.get("required_experience_years"),
            default=0.0,
        ),
        "minimum_degree_rank": minimum_degree_rank,
        "required_skill_codes": normalize_list(must_have_skill_codes + nice_to_have_skill_codes),
        "target_field_codes": target_field_codes,
        "target_role_codes": target_role_codes,
        "target_occupation_codes": target_role_codes,
        "must_have_skill_codes": must_have_skill_codes,
        "nice_to_have_skill_codes": nice_to_have_skill_codes,
        "required_speciality_codes": normalize_list(
            scoring_features.get("required_speciality_codes") or target_field_codes
        ),
        "mission_codes": normalize_list(scoring_features.get("mission_codes")),
        "responsibility_codes": normalize_list(scoring_features.get("responsibility_codes")),
        "location_codes": location_codes,
        "required_languages": required_languages,
        "contract_types": contract_types,
        "mobility_required": mobility_required,
        "location_flexible": location_flexible,
        "strict_must_have": bool(scoring_features.get("strict_must_have") or False),
    }

    merged_scoring_features = {
        **scoring_features,
        "required_experience_years": features["required_experience_years"],
        "minimum_degree_rank": features["minimum_degree_rank"],
        "required_education_level": scoring_features.get("required_education_level")
        or get_by_path(parsed_requirements, "education_min.code"),
        "required_skill_codes": features["required_skill_codes"],
        "target_field_codes": features["target_field_codes"],
        "target_role_codes": features["target_role_codes"],
        "target_occupation_codes": features["target_role_codes"],
        "must_have_skill_codes": features["must_have_skill_codes"],
        "mandatory_skill_codes": features["must_have_skill_codes"],
        "must_have_skill_codes_count": len(features["must_have_skill_codes"]),
        "nice_to_have_skill_codes": features["nice_to_have_skill_codes"],
        "optional_skill_codes": features["nice_to_have_skill_codes"],
        "required_speciality_codes": features["required_speciality_codes"],
        "mission_codes": features["mission_codes"],
        "responsibility_codes": features["responsibility_codes"],
        "location_codes": features["location_codes"],
        "required_languages": features["required_languages"],
        "languages": features["required_languages"],
        "contract_types": features["contract_types"],
        "mobility_required": features["mobility_required"],
        "location_flexible": features["location_flexible"],
        "strict_must_have": features["strict_must_have"],
    }
    mapped_offer["scoring_features"] = merged_scoring_features
    return features
