from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session


def load_model_config(db: Session, model_version_id: UUID) -> dict[str, Any]:
    criteria_rows = db.execute(
        text("""
            SELECT
                mc.code AS criterion_code,
                mc.label AS criterion_label,
                mc.data_type,
                mmc.weight,
                mmc.is_must,
                mmc.min_threshold,
                mmc.logic_operator
            FROM matching.matching_model_criterion mmc
            JOIN matching.matching_criterion mc
                ON mc.id = mmc.criterion_id
            WHERE mmc.model_version_id = :model_version_id
            ORDER BY mc.code
        """),
        {"model_version_id": str(model_version_id)},
    ).mappings().all()

    hard_filter_rows = db.execute(
        text("""
            SELECT
                mc.code AS criterion_code,
                mc.label AS criterion_label,
                mhf.rule_operator,
                mhf.rule_value,
                mhf.rejection_reason
            FROM matching.matching_hard_filter mhf
            JOIN matching.matching_criterion mc
                ON mc.id = mhf.criterion_id
            WHERE mhf.model_version_id = :model_version_id
            ORDER BY mc.code
        """),
        {"model_version_id": str(model_version_id)},
    ).mappings().all()

    criteria = []
    weights = {}

    for row in criteria_rows:
        code = row["criterion_code"]
        criteria.append(dict(row))
        weights[code] = float(row["weight"])

    hard_filters = []
    for row in hard_filter_rows:
        item = dict(row)

        # Important:
        # Son moteur attend souvent attribute_path.
        # On met un mapping simple par convention.
        item["attribute_path"] = _criterion_to_attribute_path(item["criterion_code"])
        hard_filters.append(item)

    return {
        "criteria": criteria,
        "weights": weights,
        "params": _default_params(),
        "hard_filters": hard_filters,
        "formula": {
            "renormalize_missing_components": True,
        },
        "decision_thresholds": [
            {"code": "strong_match", "min_score": 0.75, "max_score": 1.0},
            {"code": "medium_match", "min_score": 0.50, "max_score": 0.749},
            {"code": "weak_match", "min_score": 0.0, "max_score": 0.499},
        ],
    }


def _criterion_to_attribute_path(code: str) -> str:
    mapping = {
        "CANDIDATE_STATUS": "candidate.status",
        "OFFER_STATUS": "offer.status",
        "CONTRACT_TYPE": "offer.contract_type",
        "GOVERNORATE": "offer.location.governorate_code",
        "JOB_SEEKER_STATUS": "candidate.status",

        # Hard filters basés sur les sous-scores
        "SKILLS": "hard_filters.must_have_skill_rate",
        "EXPERIENCE_YEARS": "sub_scores.EXPERIENCE_MATCH",
        "EDUCATION_LEVEL": "sub_scores.EDUCATION_MATCH",

        # RTMC / taxonomy
        "RTMC_OCCUPATION": "offer.occupation_id",
        "OCCUPATION": "offer.occupation_id",
    }
    return mapping.get(str(code).strip().upper(), "")


def _default_params() -> dict[str, Any]:
    return {
        "skills_score": {
            "must_have_rate_if_no_requirement": 1.0,
            "nice_to_have_rate_if_no_requirement": 1.0,
            "must_have_weight": 0.7,
            "nice_to_have_weight": 0.3,
            "coverage_weight": 0.8,
            "level_weight": 0.2,
            "level_beginner": 0.25,
            "level_intermediate": 0.55,
            "level_advanced": 0.8,
            "level_expert": 1.0,
            "skill_coverage_if_no_requirement": 1.0,
        },
        "occupation_score": {
            "no_requirement_score": 1.0,
            "exact_match_score": 1.0,
            "same_family_score": 0.7,
            "mismatch_score": 0.0,
        },
        "metier_rtmc_score": {
            "no_requirement_score": 1.0,
            "exact_match_score": 1.0,
            "same_family_score": 0.7,
            "mismatch_score": 0.0,
        },
        "education_score": {
            "degree_fit_no_requirement": 1.0,
            "degree_fit_missing_cv": 0.0,
            "degree_fit_equal_requirement": 1.0,
            "degree_fit_above_requirement": 1.0,
            "degree_fit_below_requirement": 0.4,
            "field_fit_no_requirement": 1.0,
            "field_fit_match": 1.0,
            "field_fit_mismatch": 0.3,
            "degree_level_weight": 0.7,
            "field_weight": 0.3,
            "degree_rank_map": {
                "PRIMAIRE": 1,
                "SECONDAIRE": 2,
                "BAC": 3,
                "BTP": 4,
                "BTS": 5,
                "LICENCE": 6,
                "MASTER": 7,
                "INGENIEUR": 7,
                "DOCTORAT": 8,
            },
            "degree_keyword_rank_map": {
                "primaire": 1,
                "secondaire": 2,
                "bac": 3,
                "baccalauréat": 3,
                "btp": 4,
                "bts": 5,
                "licence": 6,
                "master": 7,
                "ingénieur": 7,
                "doctorat": 8,
            },
        },
        "speciality_score": {
            "no_requirement_score": 1.0,
            "match_score": 1.0,
            "mismatch_score": 0.0,
        },
        "experience_score": {
            "years_fit_if_no_requirement": 1.0,
            "role_fit_if_no_target": 1.0,
            "role_fit_match": 1.0,
            "role_fit_mismatch": 0.2,
            "tech_coverage_if_no_demand": 1.0,
            "responsibility_fit_if_no_demand": 1.0,
            "years_weight": 0.5,
            "role_weight": 0.3,
            "task_weight": 0.2,
            "task_tech_weight": 0.7,
            "task_responsibility_weight": 0.3,
        },
        "location_score": {
            "no_requirement_score": 1.0,
            "exact_match_score": 1.0,
            "same_family_score": 0.7,
            "remote_or_flexible_score": 0.9,
            "mismatch_score": 0.2,
        },
        "language_score": {
            "no_requirement_score": 1.0,
            "match_score": 1.0,
            "partial_match_score": 0.5,
            "mismatch_score": 0.0,
        },
        "contract_score": {
            "no_requirement_score": 1.0,
            "compatible_score": 1.0,
            "mismatch_score": 0.0,
        },
        "mobility_score": {
            "no_requirement_score": 1.0,
            "match_score": 1.0,
            "mismatch_score": 0.0,
        },
        "project_score": {
            "project_tech_fit_if_no_demand": 1.0,
            "project_domain_fit_if_no_target": 1.0,
            "project_domain_fit_match": 1.0,
            "project_domain_fit_mismatch": 0.3,
            "project_tech_weight": 0.7,
            "project_domain_weight": 0.3,
        },
    }