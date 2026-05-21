from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session


def load_offer_payload(db: Session, offer_id: UUID) -> dict[str, Any]:
    offer = db.execute(
        text("""
            SELECT
                o.id,
                o.employer_id,

                o.occupation_node_id::text AS occupation_node_id,
                COALESCE(occ.preferred_label, o.title) AS occupation_label,

                o.title,
                o.description,
                o.number_of_positions,
                o.status,

                contract_ref.code AS contract_type,
                work_ref.code AS work_mode,

                o.salary_min,
                o.salary_max,
                o.salary_currency_code,

                country.iso2 AS country,

                gov.code AS governorate_code,
                del_unit.code AS delegation_code,

                o.min_experience_months,

                o.diploma_ref_id::text AS diploma_ref_id,
                diploma_ref.code AS diploma_code,
                COALESCE(diploma_ref.label_fr, diploma_ref.label_en, diploma_ref.label, diploma_ref.code) AS diploma_label,

                o.specialty_ref_id::text AS specialty_ref_id,
                specialty_ref.code AS specialty_code,
                COALESCE(specialty_ref.label_fr, specialty_ref.label_en, specialty_ref.label, specialty_ref.code) AS specialty_label,

                o.published_at,
                o.deadline_at

            FROM aneti.job_offer o

            LEFT JOIN taxonomy.taxonomy_node occ
                ON occ.id = o.occupation_node_id

            LEFT JOIN reference.ref_value contract_ref
                ON contract_ref.id = o.contract_type_ref_id

            LEFT JOIN reference.ref_value work_ref
                ON work_ref.id = o.work_mode_ref_id

            LEFT JOIN geo.country country
                ON country.id = o.country_id

            LEFT JOIN geo.admin_unit gov
                ON gov.id = o.governorate_unit_id

            LEFT JOIN geo.admin_unit del_unit
                ON del_unit.id = o.delegation_unit_id

            LEFT JOIN reference.ref_value diploma_ref
                ON diploma_ref.id = o.diploma_ref_id

            LEFT JOIN reference.ref_value specialty_ref
                ON specialty_ref.id = o.specialty_ref_id

            WHERE o.id = CAST(:offer_id AS uuid)
        """),
        {"offer_id": str(offer_id)},
    ).mappings().first()

    if not offer:
        raise ValueError(f"Offer not found: {offer_id}")

    requirements = db.execute(
        text("""
            SELECT
                rv_ct.code AS criterion_type,
                rv_ct.id::text AS criterion_type_ref_id,

                r.taxonomy_node_id::text AS node_id,
                r.taxonomy_node_id::text AS taxonomy_node_id,

                n.preferred_label AS node_label,
                n.node_type AS node_type,

                r.ref_value_id::text AS ref_value_id,
                COALESCE(rv.label_fr, rv.label_en, rv.label, rv.code) AS ref_value_label,

                -- computed raw_value alias from taxonomy/ref_value labels; r.raw_value is not read
                COALESCE(
                    n.preferred_label,
                    rv.label_fr,
                    rv.label_en,
                    rv.label,
                    rv.code
                ) AS raw_value,

                rv_ml.code AS min_level,
                rv_ml.id::text AS min_level_ref_id,

                r.min_years,
                r.is_must,
                COALESCE(r.weight, 1.0) AS weight

            FROM aneti.job_offer_requirement r

            LEFT JOIN reference.ref_value rv_ct
                ON rv_ct.id = r.criterion_type_ref_id

            LEFT JOIN taxonomy.taxonomy_node n
                ON n.id = r.taxonomy_node_id

            LEFT JOIN reference.ref_value rv
                ON rv.id = r.ref_value_id

            LEFT JOIN reference.ref_value rv_ml
                ON rv_ml.id = r.min_level_ref_id

            WHERE r.offer_id = CAST(:offer_id AS uuid)
        """),
        {"offer_id": str(offer_id)},
    ).mappings().all()

    language_requirements = db.execute(
        text("""
            SELECT
                lang.code AS language_code,
                lvl.code AS level_code,
                lr.is_mandatory
            FROM aneti.job_offer_language_requirement lr
            LEFT JOIN reference.ref_value lang
                ON lang.id = lr.language_ref_id
            LEFT JOIN reference.ref_value lvl
                ON lvl.id = lr.level_ref_id
            WHERE lr.offer_id = CAST(:offer_id AS uuid)
        """),
        {"offer_id": str(offer_id)},
    ).mappings().all()

    must_have_skills = [
        row for row in requirements
        if str(row["criterion_type"] or "").upper() == "SKILL" and row["is_must"]
    ]

    nice_to_have_skills = [
        row for row in requirements
        if str(row["criterion_type"] or "").upper() == "SKILL" and not row["is_must"]
    ]

    soft_skills = [
        row for row in requirements
        if str(row["criterion_type"] or "").upper() == "SOFT_SKILL"
        or str(row.get("node_type") or "").upper() == "SOFT_SKILL"
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

    soft_skill_codes = [
        str(row["node_id"]) if row["node_id"] else row["raw_value"]
        for row in soft_skills
        if row["node_id"] or row["raw_value"]
    ]

    required_experience_years = 0.0

    if offer["min_experience_months"] is not None:
        required_experience_years = round(float(offer["min_experience_months"]) / 12, 2)
    else:
        for row in requirements:
            if (
                str(row["criterion_type"] or "").upper() in {"EXPERIENCE_YEARS", "EXPERIENCE"}
                and row["min_years"] is not None
            ):
                required_experience_years = float(row["min_years"])
                break

    required_languages = [
        str(row["language_code"]).strip()
        for row in language_requirements
        if row["language_code"] and str(row["language_code"]).strip()
    ]

    required_language_levels = {
        str(row["language_code"]).strip(): str(row["level_code"]).strip()
        for row in language_requirements
        if row["language_code"]
        and str(row["language_code"]).strip()
        and row["level_code"]
        and str(row["level_code"]).strip()
    }

    required_education_levels = []

    if offer["diploma_code"]:
        required_education_levels.append(str(offer["diploma_code"]))

    for row in requirements:
        if str(row["criterion_type"] or "").upper() == "DIPLOMA":
            if row["min_level"] and str(row["min_level"]).strip():
                required_education_levels.append(str(row["min_level"]).strip())
            elif row["raw_value"] and str(row["raw_value"]).strip():
                required_education_levels.append(str(row["raw_value"]).strip())

    minimum_degree_rank = None
    numeric_education_levels = []

    for level in required_education_levels:
        try:
            numeric_education_levels.append(int(level))
        except ValueError:
            continue

    if numeric_education_levels:
        minimum_degree_rank = min(numeric_education_levels)

    occupation_node_id = offer["occupation_node_id"]

    return {
        "id": str(offer["id"]),
        "offer_id": str(offer["id"]),
        "status": offer["status"],
        "title": offer["title"],
        "description": offer["description"],

        # occupation_id kept as alias for feature compat, sourced from occupation_node_id only
        "occupation_id": str(occupation_node_id) if occupation_node_id else None,
        "occupation_node_id": occupation_node_id,
        "occupation_label": offer["occupation_label"],

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
            "currency": offer["salary_currency_code"],
        },

        "requirements": [dict(row) for row in requirements],

        "skills": [
            {
                "node_id": str(row["node_id"]) if row["node_id"] else None,
                "taxonomy_node_id": str(row["taxonomy_node_id"]) if row["taxonomy_node_id"] else None,
                "label": row["raw_value"] or row["node_label"] or row["ref_value_label"],
                "level": row["min_level"],
                "years": float(row["min_years"]) if row["min_years"] else None,
                "is_must": row["is_must"],
                "weight": float(row["weight"]) if row["weight"] is not None else 1.0,
            }
            for row in requirements
            if str(row["criterion_type"] or "").upper() == "SKILL"
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
                "languages": [
                    {
                        "code": row["language_code"],
                        "min_level": row["level_code"],
                        "evidence": row["language_code"],
                    }
                    for row in language_requirements
                    if row["language_code"]
                ],
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
                    "label": row["raw_value"] or row["node_label"],
                    "usable_for_scoring": True,
                }
                for row in must_have_skills
                if row["node_id"] or row["raw_value"]
            ],
            "optional_skills": [
                {
                    "taxonomy_type": "skill",
                    "rtmc_code": str(row["node_id"]) if row["node_id"] else row["raw_value"],
                    "label": row["raw_value"] or row["node_label"],
                    "usable_for_scoring": True,
                }
                for row in nice_to_have_skills
                if row["node_id"] or row["raw_value"]
            ],
            "soft_skills": [
                {
                    "taxonomy_type": "soft_skill",
                    "rtmc_code": str(row["node_id"]) if row["node_id"] else row["raw_value"],
                    "label": row["raw_value"] or row["node_label"],
                    "usable_for_scoring": True,
                }
                for row in soft_skills
                if row["node_id"] or row["raw_value"]
            ],
            "occupations": [
                {
                    "taxonomy_type": "occupation",
                    "rtmc_code": str(occupation_node_id),
                    "label": offer["occupation_label"] or offer["title"],
                    "usable_for_scoring": True,
                }
            ] if occupation_node_id else [],
        },

        "scoring_features": {
            "must_have_skill_codes": must_have_skill_codes,
            "mandatory_skill_codes": must_have_skill_codes,

            "nice_to_have_skill_codes": nice_to_have_skill_codes,
            "optional_skill_codes": nice_to_have_skill_codes,

            "soft_skill_codes": soft_skill_codes,

            "required_skill_codes": must_have_skill_codes + nice_to_have_skill_codes,

            "required_experience_years": required_experience_years,

            "target_role_codes": [str(occupation_node_id)] if occupation_node_id else [],
            "target_occupation_codes": [str(occupation_node_id)] if occupation_node_id else [],

            "location_codes": [offer["governorate_code"]] if offer["governorate_code"] else [],

            "contract_types": [offer["contract_type"]] if offer["contract_type"] else [],
            "work_mode": offer["work_mode"],
            "location_flexible": str(offer["work_mode"] or "").upper() in {"REMOTE", "HYBRID"},

            "required_languages": required_languages,
            "languages": required_languages,
            "required_language_levels": required_language_levels,

            "required_education_levels": required_education_levels,
            "minimum_degree_rank": minimum_degree_rank,
        },
    }
