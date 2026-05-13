from __future__ import annotations

import logging
from typing import Any, Callable

from app.engines.legacy_matching.utils.score_utils import clamp, normalize_list, safe_divide, to_float


CriterionCalculator = Callable[[dict[str, Any], dict[str, Any], dict[str, Any]], dict[str, Any]]
CriterionRegistryEntry = tuple[CriterionCalculator, str]

logger = logging.getLogger(__name__)


def _as_set(values: Any) -> set[str]:
    return {str(value).strip() for value in normalize_list(values) if str(value).strip()}


def _has_param(params: dict[str, Any], *names: str) -> bool:
    return any(name in params for name in names)


def _param_value(params: dict[str, Any], *names: str, default: float | None = None) -> float:
    for name in names:
        if name in params and params[name] is not None:
            return to_float(params[name], default=0.0)
    if default is not None:
        return float(default)
    raise RuntimeError(f"Parametre de scoring obligatoire absent: {' / '.join(names)}")


def _level_scores(params: dict[str, Any]) -> dict[str, float]:
    return {
        "beginner": _param_value(params, "level_beginner"),
        "intermediate": _param_value(params, "level_intermediate"),
        "advanced": _param_value(params, "level_advanced"),
        "expert": _param_value(params, "level_expert"),
    }


def _family_key(code: str) -> str:
    cleaned = str(code).strip().upper()
    if not cleaned:
        return cleaned
    if "_" in cleaned:
        parts = [part for part in cleaned.split("_") if part]
        return "_".join(parts[:2]) if len(parts) >= 2 else parts[0]
    if "-" in cleaned:
        parts = [part for part in cleaned.split("-") if part]
        return "-".join(parts[:2]) if len(parts) >= 2 else parts[0]
    return cleaned[:3]


def _has_family_overlap(left_values: set[str], right_values: set[str]) -> bool:
    left_families = {_family_key(value) for value in left_values}
    right_families = {_family_key(value) for value in right_values}
    return bool(left_families & right_families)


def calculate_must_have_skill_rate(
    cv_features: dict[str, Any],
    offer_features: dict[str, Any],
    params: dict[str, Any] | None = None,
) -> float:
    params = params or {}
    must_have = _as_set(offer_features.get("must_have_skill_codes"))
    if not must_have:
        return clamp(_param_value(params, "must_have_rate_if_no_requirement", default=1.0))
    skill_codes = _as_set(cv_features.get("skill_codes"))
    return clamp(safe_divide(len(skill_codes & must_have), len(must_have), default=0.0))


def calculate_skills_score(cv_features: dict[str, Any], offer_features: dict[str, Any], params: dict[str, Any]) -> dict[str, Any]:
    skill_codes = _as_set(cv_features.get("skill_codes"))
    must_have = _as_set(offer_features.get("must_have_skill_codes"))
    nice_to_have = _as_set(offer_features.get("nice_to_have_skill_codes"))

    must_have_rate = calculate_must_have_skill_rate(cv_features, offer_features, params)
    nice_to_have_rate = (
        clamp(_param_value(params, "nice_to_have_rate_if_no_requirement"))
        if not nice_to_have
        else clamp(safe_divide(len(skill_codes & nice_to_have), len(nice_to_have)))
    )

    must_have_weight = _param_value(params, "must_have_weight", "mandatory_skill_weight")
    nice_to_have_weight = _param_value(params, "nice_to_have_weight", "optional_skill_weight")
    coverage_weight = _param_value(params, "coverage_weight")
    level_weight = _param_value(params, "level_weight")

    if must_have and nice_to_have:
        skill_coverage = (must_have_weight * must_have_rate) + (nice_to_have_weight * nice_to_have_rate)
    elif must_have:
        skill_coverage = must_have_rate
    elif nice_to_have:
        skill_coverage = nice_to_have_rate
    else:
        skill_coverage = clamp(_param_value(params, "skill_coverage_if_no_requirement"))

    requested_codes = list(must_have | nice_to_have)
    levels = cv_features.get("skill_levels") or {}
    level_score_map = _level_scores(params)
    level_scores = [
        level_score_map.get(str(levels[code]).strip().lower())
        for code in requested_codes
        if code in levels and level_score_map.get(str(levels[code]).strip().lower()) is not None
    ]
    skill_level_score = None
    if level_scores:
        skill_level_score = clamp(sum(level_scores) / len(level_scores))

    if skill_level_score is not None:
        skills_score = clamp((coverage_weight * skill_coverage) + (level_weight * skill_level_score))
    else:
        skills_score = clamp(skill_coverage)

    return {
        "skills_score": skills_score,
        "skill_coverage": clamp(skill_coverage),
        "skill_level_score": skill_level_score,
        "must_have_rate": must_have_rate,
        "nice_to_have_rate": clamp(nice_to_have_rate),
    }


def calculate_occupation_score(cv_features: dict[str, Any], offer_features: dict[str, Any], params: dict[str, Any]) -> dict[str, Any]:
    target_codes = _as_set(offer_features.get("target_occupation_codes") or offer_features.get("target_role_codes"))
    candidate_codes = _as_set(cv_features.get("occupation_codes")) | _as_set(cv_features.get("experience_role_codes"))

    if not target_codes:
        score = _param_value(params, "no_requirement_score")
        return {"occupation_score": clamp(score), "match_type": "no_requirement"}

    exact_match = bool(candidate_codes & target_codes)
    same_family_match = not exact_match and _has_family_overlap(candidate_codes, target_codes)
    if exact_match:
        score = _param_value(params, "exact_match_score")
        match_type = "exact_match"
    elif same_family_match:
        score = _param_value(params, "same_family_score")
        match_type = "same_family"
    else:
        score = _param_value(params, "mismatch_score")
        match_type = "mismatch"

    return {
        "occupation_score": clamp(score),
        "match_type": match_type,
        "exact_match": exact_match,
        "same_family_match": same_family_match,
    }


def calculate_education_score(cv_features: dict[str, Any], offer_features: dict[str, Any], params: dict[str, Any]) -> dict[str, Any]:
    minimum_degree_rank = offer_features.get("minimum_degree_rank")
    education_degree_rank = cv_features.get("education_degree_rank")
    target_fields = _as_set(offer_features.get("target_field_codes"))
    cv_fields = _as_set(cv_features.get("education_field_codes"))

    if minimum_degree_rank is None and education_degree_rank is None and not target_fields and not cv_fields:
        return {"education_score": None, "degree_level_fit": None, "field_fit": None}

    if minimum_degree_rank is None:
        degree_level_fit = _param_value(params, "degree_fit_no_requirement")
    elif education_degree_rank is None:
        degree_level_fit = _param_value(params, "degree_fit_missing_cv")
    elif education_degree_rank < minimum_degree_rank:
        degree_level_fit = _param_value(params, "degree_fit_below_requirement")
    elif education_degree_rank == minimum_degree_rank:
        degree_level_fit = _param_value(params, "degree_fit_equal_requirement")
    else:
        degree_level_fit = _param_value(params, "degree_fit_above_requirement")

    if not target_fields:
        field_fit = _param_value(params, "field_fit_no_requirement")
    elif cv_fields & target_fields:
        field_fit = _param_value(params, "field_fit_match")
    else:
        field_fit = _param_value(params, "field_fit_mismatch")

    degree_weight = _param_value(params, "degree_level_weight")
    field_weight = _param_value(params, "field_weight")
    education_score = clamp((degree_weight * degree_level_fit) + (field_weight * field_fit))
    return {
        "education_score": education_score,
        "degree_level_fit": clamp(degree_level_fit),
        "field_fit": clamp(field_fit),
    }


def calculate_speciality_score(cv_features: dict[str, Any], offer_features: dict[str, Any], params: dict[str, Any]) -> dict[str, Any]:
    required_specialities = _as_set(offer_features.get("required_speciality_codes"))
    candidate_specialities = _as_set(cv_features.get("speciality_codes")) | _as_set(cv_features.get("education_field_codes"))

    if not required_specialities:
        score = _param_value(params, "no_requirement_score")
        return {"speciality_score": clamp(score), "match_type": "no_requirement"}

    matched = bool(required_specialities & candidate_specialities)
    score = _param_value(params, "match_score" if matched else "mismatch_score")
    return {
        "speciality_score": clamp(score),
        "match_type": "match" if matched else "mismatch",
    }


def calculate_experience_score(cv_features: dict[str, Any], offer_features: dict[str, Any], params: dict[str, Any]) -> dict[str, Any]:
    experience_years = to_float(cv_features.get("experience_years"), default=0.0)
    required_years = to_float(offer_features.get("required_experience_years"), default=0.0)
    years_fit = (
        _param_value(params, "years_fit_if_no_requirement")
        if required_years <= 0
        else clamp(min(1.0, safe_divide(experience_years, required_years, default=0.0)))
    )

    target_roles = _as_set(offer_features.get("target_occupation_codes") or offer_features.get("target_role_codes"))
    cv_roles = _as_set(cv_features.get("experience_role_codes")) | _as_set(cv_features.get("occupation_codes"))
    if not target_roles:
        role_fit = _param_value(params, "role_fit_if_no_target")
    elif cv_roles & target_roles:
        role_fit = _param_value(params, "role_fit_match")
    else:
        role_fit = _param_value(params, "role_fit_mismatch")

    demanded_skills = _as_set(offer_features.get("required_skill_codes")) or (
        _as_set(offer_features.get("must_have_skill_codes")) | _as_set(offer_features.get("nice_to_have_skill_codes"))
    )
    experience_skills = _as_set(cv_features.get("experience_skill_codes"))
    tech_coverage = (
        _param_value(params, "tech_coverage_if_no_demand")
        if not demanded_skills
        else clamp(safe_divide(len(demanded_skills & experience_skills), len(demanded_skills)))
    )

    expected_responsibilities = _as_set(offer_features.get("mission_codes")) | _as_set(offer_features.get("responsibility_codes"))
    actual_responsibilities = _as_set(cv_features.get("responsibility_codes"))
    responsibility_coverage = (
        _param_value(params, "responsibility_fit_if_no_demand")
        if not expected_responsibilities
        else clamp(safe_divide(len(expected_responsibilities & actual_responsibilities), len(expected_responsibilities)))
    )

    task_tech_weight = _param_value(params, "task_tech_weight")
    task_resp_weight = _param_value(params, "task_responsibility_weight")
    task_fit = clamp((task_tech_weight * tech_coverage) + (task_resp_weight * responsibility_coverage))

    years_weight = _param_value(params, "years_weight")
    role_weight = _param_value(params, "role_weight")
    task_weight = _param_value(params, "task_weight")
    experience_score = clamp((years_weight * years_fit) + (role_weight * role_fit) + (task_weight * task_fit))

    return {
        "experience_score": experience_score,
        "years_fit": clamp(years_fit),
        "role_fit": clamp(role_fit),
        "tech_coverage": clamp(tech_coverage),
        "responsibility_coverage": clamp(responsibility_coverage),
        "task_fit": task_fit,
    }


def calculate_location_score(cv_features: dict[str, Any], offer_features: dict[str, Any], params: dict[str, Any]) -> dict[str, Any]:
    offer_locations = _as_set(offer_features.get("location_codes"))
    cv_locations = _as_set(cv_features.get("location_codes"))
    if offer_features.get("location_flexible"):
        score = _param_value(params, "remote_or_flexible_score")
        return {"location_score": clamp(score), "match_type": "flexible"}
    if not offer_locations:
        score = _param_value(params, "no_requirement_score")
        return {"location_score": clamp(score), "match_type": "no_requirement"}

    exact_match = bool(offer_locations & cv_locations)
    partial_match = not exact_match and _has_family_overlap(offer_locations, cv_locations)
    if exact_match:
        score = _param_value(params, "exact_match_score")
        match_type = "exact_match"
    elif partial_match:
        score = _param_value(params, "partial_match_score")
        match_type = "partial_match"
    else:
        score = _param_value(params, "mismatch_score")
        match_type = "mismatch"
    return {
        "location_score": clamp(score),
        "match_type": match_type,
    }

_LANGUAGE_LEVEL_RANKS = {
    "A1": 10,
    "A2": 20,
    "beginner": 20,
    "B1": 30,
    "intermediate": 30,
    "B2": 40,
    "advanced": 50,
    "C1": 50,
    "fluent": 55,
    "C2": 60,
    "native": 70,
}


def _normalize_language_code(value: Any) -> str:
    return str(value or "").strip().lower()


def _normalize_language_level(value: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""

    upper = raw.upper()
    if upper in {"A1", "A2", "B1", "B2", "C1", "C2"}:
        return upper

    lowered = raw.lower()
    aliases = {
        "debutant": "beginner",
        "débutant": "beginner",
        "beginner": "beginner",
        "intermediaire": "intermediate",
        "intermédiaire": "intermediate",
        "intermediate": "intermediate",
        "courant": "fluent",
        "fluent": "fluent",
        "avance": "advanced",
        "avancé": "advanced",
        "advanced": "advanced",
        "natif": "native",
        "native": "native",
        "langue maternelle": "native",
        "maternelle": "native",
    }

    return aliases.get(lowered, lowered)


def _language_level_rank(value: Any) -> int | None:
    normalized = _normalize_language_level(value)
    if not normalized:
        return None

    return _LANGUAGE_LEVEL_RANKS.get(normalized)


def _level_is_sufficient(candidate_level: Any, required_level: Any) -> bool | None:
    required_rank = _language_level_rank(required_level)

    if required_rank is None:
        return True

    candidate_rank = _language_level_rank(candidate_level)

    if candidate_rank is None:
        return None

    return candidate_rank >= required_rank

def calculate_language_score(cv_features: dict[str, Any], offer_features: dict[str, Any], params: dict[str, Any]) -> dict[str, Any]:
    required_languages = {
        _normalize_language_code(value)
        for value in normalize_list(offer_features.get("required_languages"))
        if _normalize_language_code(value)
    }

    candidate_languages = {
        _normalize_language_code(value)
        for value in normalize_list(cv_features.get("languages"))
        if _normalize_language_code(value)
    }

    candidate_levels = {
        _normalize_language_code(code): level
        for code, level in (cv_features.get("language_levels") or {}).items()
        if _normalize_language_code(code)
    }

    required_levels = {
        _normalize_language_code(code): level
        for code, level in (offer_features.get("required_language_levels") or {}).items()
        if _normalize_language_code(code)
    }

    if not required_languages:
        score = _param_value(params, "no_requirement_score")
        return {
            "language_score": clamp(score),
            "coverage": None,
            "required_languages": [],
            "matched_languages": [],
            "missing_languages": [],
            "level_gaps": [],
        }

    match_score = _param_value(params, "match_score", default=1.0)
    partial_match_score = _param_value(params, "partial_match_score", default=0.5)
    mismatch_score = _param_value(params, "mismatch_score", default=0.0)

    per_language_scores: list[float] = []
    matched_languages: list[str] = []
    missing_languages: list[str] = []
    level_gaps: list[dict[str, Any]] = []

    for language_code in sorted(required_languages):
        required_level = required_levels.get(language_code)

        if language_code not in candidate_languages:
            per_language_scores.append(mismatch_score)
            missing_languages.append(language_code)
            continue

        candidate_level = candidate_levels.get(language_code)
        level_check = _level_is_sufficient(candidate_level, required_level)

        if level_check is True:
            per_language_scores.append(match_score)
            matched_languages.append(language_code)
        elif level_check is None:
            per_language_scores.append(partial_match_score)
            matched_languages.append(language_code)
            level_gaps.append(
                {
                    "language_code": language_code,
                    "candidate_level": candidate_level,
                    "required_level": required_level,
                    "reason": "candidate_level_unknown",
                }
            )
        else:
            per_language_scores.append(partial_match_score)
            matched_languages.append(language_code)
            level_gaps.append(
                {
                    "language_code": language_code,
                    "candidate_level": candidate_level,
                    "required_level": required_level,
                    "reason": "candidate_level_below_requirement",
                }
            )

    coverage = clamp(safe_divide(len(required_languages & candidate_languages), len(required_languages), default=0.0))
    score = clamp(sum(per_language_scores) / len(per_language_scores))

    return {
        "language_score": score,
        "coverage": coverage,
        "required_languages": sorted(required_languages),
        "candidate_languages": sorted(candidate_languages),
        "matched_languages": matched_languages,
        "missing_languages": missing_languages,
        "required_language_levels": required_levels,
        "candidate_language_levels": candidate_levels,
        "level_gaps": level_gaps,
    }

def calculate_contract_score(cv_features: dict[str, Any], offer_features: dict[str, Any], params: dict[str, Any]) -> dict[str, Any]:
    required_contracts = _as_set(offer_features.get("contract_types"))
    candidate_contracts = _as_set(cv_features.get("contract_types"))
    if not required_contracts:
        score = _param_value(params, "no_requirement_score")
        return {"contract_score": clamp(score), "match_type": "no_requirement"}
    compatible = bool(required_contracts & candidate_contracts)
    score = _param_value(params, "compatible_score" if compatible else "mismatch_score")
    return {
        "contract_score": clamp(score),
        "match_type": "compatible" if compatible else "mismatch",
    }


def calculate_mobility_score(cv_features: dict[str, Any], offer_features: dict[str, Any], params: dict[str, Any]) -> dict[str, Any]:
    required_mobility = _as_set(offer_features.get("mobility_required"))
    candidate_mobility = _as_set(cv_features.get("mobility_codes"))
    if not required_mobility:
        score = _param_value(params, "no_requirement_score")
        return {"mobility_score": clamp(score), "match_type": "no_requirement"}
    matched = bool(required_mobility & candidate_mobility)
    score = _param_value(params, "match_score" if matched else "mismatch_score")
    return {
        "mobility_score": clamp(score),
        "match_type": "match" if matched else "mismatch",
    }


def calculate_project_score(cv_features: dict[str, Any], offer_features: dict[str, Any], params: dict[str, Any]) -> dict[str, Any]:
    project_skill_codes = _as_set(cv_features.get("project_skill_codes"))
    project_domain_codes = _as_set(cv_features.get("project_domain_codes"))
    if not project_skill_codes and not project_domain_codes:
        if _has_param(params, "missing_project_score"):
            missing_project_score = params.get("missing_project_score")
            score_value = None if missing_project_score is None else clamp(to_float(missing_project_score, default=0.0))
            return {"project_score": score_value, "project_tech_fit": None, "project_domain_fit": None}
        raise RuntimeError("Parametre de scoring obligatoire absent: missing_project_score")

    demanded_skills = _as_set(offer_features.get("required_skill_codes")) or (
        _as_set(offer_features.get("must_have_skill_codes")) | _as_set(offer_features.get("nice_to_have_skill_codes"))
    )
    target_fields = _as_set(offer_features.get("target_field_codes"))

    project_tech_fit = (
        _param_value(params, "project_tech_fit_if_no_demand")
        if not demanded_skills
        else clamp(safe_divide(len(project_skill_codes & demanded_skills), len(demanded_skills)))
    )
    if not target_fields:
        project_domain_fit = _param_value(params, "project_domain_fit_if_no_target")
    else:
        project_domain_fit = (
            _param_value(params, "project_domain_fit_match")
            if project_domain_codes & target_fields
            else _param_value(params, "project_domain_fit_mismatch")
        )

    tech_weight = _param_value(params, "project_tech_weight")
    domain_weight = _param_value(params, "project_domain_weight")
    project_score = clamp((tech_weight * project_tech_fit) + (domain_weight * project_domain_fit))
    return {
        "project_score": project_score,
        "project_tech_fit": clamp(project_tech_fit),
        "project_domain_fit": clamp(project_domain_fit),
    }


_CALCULATOR_REGISTRY: dict[str, tuple[CriterionCalculator, str]] = {
    "skills_score": (calculate_skills_score, "skills_score"),
    "occupation_score": (calculate_occupation_score, "occupation_score"),
    "metier_rtmc_score": (calculate_occupation_score, "occupation_score"),
    "education_score": (calculate_education_score, "education_score"),
    "speciality_score": (calculate_speciality_score, "speciality_score"),
    "experience_score": (calculate_experience_score, "experience_score"),
    "location_score": (calculate_location_score, "location_score"),
    "language_score": (calculate_language_score, "language_score"),
    "contract_score": (calculate_contract_score, "contract_score"),
    "mobility_score": (calculate_mobility_score, "mobility_score"),
    "project_score": (calculate_project_score, "project_score"),
}

CRITERION_ALIASES: dict[str, list[str]] = {
    "SKILLS_MATCH": ["skills_score", "skill", "rtmc_skill", "skills"],
    "SKILL_MATCH": ["skills_score", "skill", "rtmc_skill", "skills"],
    "RTMC_SKILL": ["skills_score", "skill", "rtmc_skill", "skills"],
    "EDUCATION_MATCH": ["education_score", "diploma", "education"],
    "DIPLOMA_MATCH": ["education_score", "diploma", "education"],
    "EXPERIENCE_MATCH": ["experience_score", "experience", "years_experience"],
    "LANGUAGE_MATCH": ["language_score", "language", "languages"],
    "LOCATION_MATCH": ["location_score", "location", "distance"],
    "DISTANCE_MATCH": ["location_score", "location", "distance"],
    "CONTRACT_MATCH": ["contract_score", "contract", "contract_type"],
}

_LOGGED_RESOLVED_CRITERIA: set[tuple[str, str]] = set()
_LOGGED_MISSING_CRITERIA: set[str] = set()


def normalize_criterion_code(code: str | None) -> str:
    normalized = str(code or "").strip().upper()
    if not normalized:
        return ""
    aliases = {
        "SKILLS_MATCH": "skills_score",
        "SKILL_MATCH": "skills_score",
        "RTMC_SKILL": "skills_score",
        "EDUCATION_MATCH": "education_score",
        "DIPLOMA_MATCH": "education_score",
        "EXPERIENCE_MATCH": "experience_score",
        "LANGUAGE_MATCH": "language_score",
        "LOCATION_MATCH": "location_score",
        "DISTANCE_MATCH": "location_score",
        "CONTRACT_MATCH": "contract_score",
    }
    return aliases.get(normalized, normalized.lower())


def _lookup_candidates(code: str | None) -> list[str]:
    normalized = str(code or "").strip()
    if not normalized:
        return []

    cleaned_upper = normalized.upper()
    lowered = normalized.lower()
    candidates: list[str] = [
        lowered,
        normalize_criterion_code(cleaned_upper),
    ]

    if cleaned_upper in CRITERION_ALIASES:
        candidates.extend(alias.lower() for alias in CRITERION_ALIASES[cleaned_upper])

    if lowered.endswith("_match"):
        candidates.append(lowered[:-6] + "_score")
    elif not lowered.endswith("_score"):
        candidates.append(lowered + "_score")

    if lowered.endswith("s_match"):
        candidates.append(lowered[:-7] + "_score")

    seen: set[str] = set()
    unique_candidates: list[str] = []
    for candidate in candidates:
        if not candidate or candidate in seen:
            continue
        seen.add(candidate)
        unique_candidates.append(candidate)
    return unique_candidates


def get_calculator_for_criterion(
    calculators: dict[str, CriterionRegistryEntry],
    criterion_code: str | None,
) -> tuple[str | None, CriterionRegistryEntry | None]:
    for candidate_code in _lookup_candidates(criterion_code):
        calculator = calculators.get(candidate_code)
        if calculator is not None:
            return candidate_code, calculator
    return None, None


def _get_params_for_criterion(
    params: dict[str, Any],
    criterion_code: str | None,
    resolved_code: str | None,
) -> dict[str, Any]:
    for candidate_code in _lookup_candidates(criterion_code):
        candidate_params = params.get(candidate_code)
        if isinstance(candidate_params, dict):
            return candidate_params

    if resolved_code:
        resolved_params = params.get(resolved_code)
        if isinstance(resolved_params, dict):
            return resolved_params

    original_params = params.get(criterion_code or "")
    return original_params if isinstance(original_params, dict) else {}


def _log_resolution(original_code: str, resolved_code: str) -> None:
    key = (original_code, resolved_code)
    if key in _LOGGED_RESOLVED_CRITERIA:
        return
    _LOGGED_RESOLVED_CRITERIA.add(key)
    logger.debug(
        "Resolved scoring calculator for criterion '%s' to '%s'.",
        original_code,
        resolved_code,
    )


def _log_missing_resolution(original_code: str, calculators: dict[str, CriterionRegistryEntry]) -> None:
    if original_code in _LOGGED_MISSING_CRITERIA:
        return
    _LOGGED_MISSING_CRITERIA.add(original_code)
    logger.warning(
        "No scoring calculator found for criterion '%s'. Available calculator codes: %s",
        original_code,
        sorted(calculators),
    )


def calculate_all_subscores(cv_features: dict[str, Any], offer_features: dict[str, Any], config: dict[str, Any]) -> dict[str, Any]:
    params = config.get("params") or {}
    weights = config.get("weights") or {}

    sub_scores: dict[str, Any] = {}
    details: dict[str, Any] = {}
    hard_filter_context: dict[str, Any] = {}
    warnings: list[str] = []

    for criterion_code in weights:
        if str(criterion_code).strip().lower() == "semantic_score":
            continue
        resolved_code, calculator_entry = get_calculator_for_criterion(_CALCULATOR_REGISTRY, criterion_code)
        if calculator_entry is None:
            warning = f"Aucun calculateur implemente pour le critere {criterion_code}."
            sub_scores[criterion_code] = None
            details[criterion_code] = {"warning": warning}
            warnings.append(warning)
            _log_missing_resolution(str(criterion_code), _CALCULATOR_REGISTRY)
            continue

        calculator, score_key = calculator_entry
        criterion_params = _get_params_for_criterion(params, criterion_code, resolved_code)
        result = calculator(cv_features, offer_features, criterion_params)
        score_value = result.get(score_key)
        sub_scores[criterion_code] = score_value
        details[criterion_code] = result
        _log_resolution(str(criterion_code), str(resolved_code))

        if score_key == "skills_score":
            hard_filter_context["must_have_skill_rate"] = result.get("must_have_rate")
        elif score_key == "experience_score":
            hard_filter_context["experience_rate"] = result.get("years_fit")
        elif score_key == "education_score":
            hard_filter_context["education_level_fit"] = result.get("degree_level_fit")

    hard_filter_context.setdefault("must_have_skill_rate", None)
    hard_filter_context.setdefault("experience_rate", None)
    hard_filter_context.setdefault("education_level_fit", None)

    return {
        "sub_scores": sub_scores,
        "details": details,
        "hard_filter_context": hard_filter_context,
        "warnings": warnings,
    }
