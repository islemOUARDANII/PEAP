from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session


def load_offer_payload(db: Session, offer_id: UUID) -> dict[str, Any]:
    offer = db.execute(
        text("""
            SELECT
                id,
                employer_id,
                rtmc_occupation_id,
                title,
                description,
                number_of_positions,
                status,
                contract_type,
                work_mode,
                salary_min,
                salary_max,
                country,
                governorate_code,
                delegation_code,
                published_at,
                deadline_at
            FROM aneti.job_offer
            WHERE id = :offer_id
        """),
        {"offer_id": str(offer_id)},
    ).mappings().first()

    if not offer:
        raise ValueError(f"Offer not found: {offer_id}")

    requirements = db.execute(
            text("""
                SELECT
                    criterion_type,
                    node_id,
                    raw_value,
                    min_level,
                    min_years,
                    is_must,
                    weight
                FROM aneti.job_offer_requirement
                WHERE offer_id = :offer_id
            """),
            {"offer_id": str(offer_id)},
        ).mappings().all()
    must_have_skills = [
        row for row in requirements
        if row["criterion_type"] == "SKILL" and row["is_must"]
    ]

    nice_to_have_skills = [
        row for row in requirements
        if row["criterion_type"] == "SKILL" and not row["is_must"]
    ]

    must_have_skill_codes = [
        str(row["node_id"]) if row["node_id"] else row["raw_value"]
        for row in must_have_skills
        if row["node_id"] or row["raw_value"]
    ]

    nice_to_have_skill_codes = [
        str(row["node_id"]) if row["node_id"] else row["raw_value"]
        for row in nice_to_have_skills
        if row["node_id"] or row["raw_value"]
    ]

    required_experience_years = 0.0
    for row in requirements:
        if row["criterion_type"] == "EXPERIENCE_YEARS" and row["min_years"] is not None:
            required_experience_years = float(row["min_years"])
            break
    return {
        "id": str(offer["id"]),
        "offer_id": str(offer["id"]),
        "status": offer["status"],
        "title": offer["title"],
        "description": offer["description"],
        "occupation_id": str(offer["rtmc_occupation_id"]) if offer["rtmc_occupation_id"] else None,
        "contract_type": offer["contract_type"],
        "work_mode": offer["work_mode"],
        "location": {
            "country": offer["country"],
            "governorate_code": offer["governorate_code"],
            "delegation_code": offer["delegation_code"],
        },
        "salary": {
            "min": float(offer["salary_min"]) if offer["salary_min"] is not None else None,
            "max": float(offer["salary_max"]) if offer["salary_max"] is not None else None,
        },
        "requirements": [dict(row) for row in requirements],
        "skills": [
            {
                "node_id": str(row["node_id"]) if row["node_id"] else None,
                "label": row["raw_value"],
                "level": row["min_level"],
                "years": float(row["min_years"]) if row["min_years"] else None,
                "is_must": row["is_must"],
                "weight": row["weight"],
            }
            for row in requirements
            if row["criterion_type"] == "SKILL"
        ],
        "parsed_offer": {
            "offer": {
                "title": offer["title"],
                "description": offer["description"],
                "employment_type": offer["contract_type"],
                "work_mode": offer["work_mode"],
                "location": offer["governorate_code"],
            },
            "requirements": {
                "required_experience_years": required_experience_years,
                "languages": [],
            },
            "contract_type": offer["contract_type"],
            "location": offer["governorate_code"],
            "work_mode": offer["work_mode"],
        },
        "mapped_entities": {
            "mandatory_skills": [
                {
                    "taxonomy_type": "skill",
                    "rtmc_code": str(row["node_id"]) if row["node_id"] else row["raw_value"],
                    "label": row["raw_value"],
                    "usable_for_scoring": True,
                }
                for row in must_have_skills
                if row["node_id"] or row["raw_value"]
            ],
            "optional_skills": [
                {
                    "taxonomy_type": "skill",
                    "rtmc_code": str(row["node_id"]) if row["node_id"] else row["raw_value"],
                    "label": row["raw_value"],
                    "usable_for_scoring": True,
                }
                for row in nice_to_have_skills
                if row["node_id"] or row["raw_value"]
            ],
            "occupations": [
                {
                    "taxonomy_type": "occupation",
                    "rtmc_code": str(offer["rtmc_occupation_id"]),
                    "label": offer["title"],
                    "usable_for_scoring": True,
                }
            ] if offer["rtmc_occupation_id"] else [],
        },
        "scoring_features": {
            "must_have_skill_codes": must_have_skill_codes,
            "mandatory_skill_codes": must_have_skill_codes,
            "nice_to_have_skill_codes": nice_to_have_skill_codes,
            "optional_skill_codes": nice_to_have_skill_codes,
            "required_skill_codes": must_have_skill_codes + nice_to_have_skill_codes,
            "required_experience_years": required_experience_years,
            "target_role_codes": [str(offer["rtmc_occupation_id"])] if offer["rtmc_occupation_id"] else [],
            "target_occupation_codes": [str(offer["rtmc_occupation_id"])] if offer["rtmc_occupation_id"] else [],
            "location_codes": [offer["governorate_code"]] if offer["governorate_code"] else [],
            "contract_types": [offer["contract_type"]] if offer["contract_type"] else [],
            "work_mode": offer["work_mode"],
            "location_flexible": str(offer["work_mode"] or "").upper() in {"REMOTE", "HYBRID"},
        },
    }