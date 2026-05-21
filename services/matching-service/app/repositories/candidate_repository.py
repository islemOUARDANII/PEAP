from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session


def load_candidate_payload(db: Session, candidate_id: UUID) -> dict[str, Any]:
    candidate = db.execute(
        text("""
            SELECT
                js.id,
                js.status,
                js.aneti_identifier,

                ji.first_name,
                ji.last_name,
                ji.birth_date,

                gender_ref.code AS gender_code,

                country.iso2 AS country,
                country.id::text AS country_id,
                COALESCE(country.name_fr, country.name_en, country.iso2) AS country_label,

                gov.code AS governorate_code,
                del_unit.code AS delegation_code,

                contract_ref.code AS preferred_contract_type,
                mobility_scope_ref.code AS mobility_scope

            FROM aneti.job_seeker js

            LEFT JOIN aneti.job_seeker_identity ji
                ON ji.job_seeker_id = js.id

            LEFT JOIN reference.ref_value gender_ref
                ON gender_ref.id = ji.gender_ref_id

            LEFT JOIN aneti.job_seeker_contact jc
                ON jc.job_seeker_id = js.id

            LEFT JOIN geo.country country
                ON country.id = jc.country_id

            LEFT JOIN geo.admin_unit gov
                ON gov.id = jc.governorate_unit_id

            LEFT JOIN geo.admin_unit del_unit
                ON del_unit.id = jc.delegation_unit_id

            LEFT JOIN aneti.job_seeker_preference jp
                ON jp.job_seeker_id = js.id

            LEFT JOIN reference.ref_value contract_ref
                ON contract_ref.id = jp.preferred_contract_type_ref_id

            LEFT JOIN reference.ref_value mobility_scope_ref
                ON mobility_scope_ref.id = jp.mobility_scope_ref_id

            WHERE js.id = CAST(:candidate_id AS uuid)
            LIMIT 1
        """),
        {"candidate_id": str(candidate_id)},
    ).mappings().first()

    if not candidate:
        raise ValueError(f"Candidate not found: {candidate_id}")

    # ─────────────────────────────────────────────────────────
    # Mobility: canonical table = job_seeker_mobility_unit.admin_unit_id
    # ─────────────────────────────────────────────────────────
    mobility_units = db.execute(
        text("""
            SELECT
                mob_unit.id::text AS admin_unit_id,
                mob_unit.code AS location_code,
                COALESCE(
                    mob_unit.label_fr,
                    mob_unit.label_en,
                    mob_unit.label,
                    mob_unit.code
                ) AS location_label,
                mob_unit.admin_level
            FROM aneti.job_seeker_mobility_unit mu
            JOIN geo.admin_unit mob_unit
                ON mob_unit.id = mu.admin_unit_id
            WHERE mu.job_seeker_id = CAST(:candidate_id AS uuid)
            ORDER BY mob_unit.admin_level ASC,
                     mob_unit.label_fr ASC NULLS LAST,
                     mob_unit.code ASC
        """),
        {"candidate_id": str(candidate_id)},
    ).mappings().all()

    # ─────────────────────────────────────────────────────────
    # Skills: no skill_label_raw / source / level text anymore.
    # Use skill_node_id + level_ref_id.
    # ─────────────────────────────────────────────────────────
    skills = db.execute(
        text("""
            SELECT
                jss.skill_node_id::text AS skill_node_id,

                -- Legacy aliases kept for feature compatibility only.
                jss.skill_node_id::text AS skill_id,
                NULL::text AS skill_label_raw,

                COALESCE(n.preferred_label, jss.skill_node_id::text) AS skill_label,
                n.node_type AS skill_node_type,

                rv_level.code AS level,
                rv_level.code AS level_code,
                COALESCE(
                    rv_level.label_fr,
                    rv_level.label_en,
                    rv_level.label,
                    rv_level.code
                ) AS level_label,

                jss.years,

                -- Old column removed from DB.
                NULL::text AS source

            FROM aneti.job_seeker_skill jss

            LEFT JOIN taxonomy.taxonomy_node n
                ON n.id = jss.skill_node_id

            LEFT JOIN reference.ref_value rv_level
                ON rv_level.id = jss.level_ref_id

            WHERE jss.job_seeker_id = CAST(:candidate_id AS uuid)
            ORDER BY jss.created_at ASC
        """),
        {"candidate_id": str(candidate_id)},
    ).mappings().all()

    # ─────────────────────────────────────────────────────────
    # Instruction profile: level is not in job_seeker_education anymore.
    # It is stored in job_seeker_instruction_profile.
    # ─────────────────────────────────────────────────────────
    instruction = db.execute(
        text("""
            SELECT
                rv_level.code AS level_code,
                COALESCE(
                    rv_level.label_fr,
                    rv_level.label_en,
                    rv_level.label,
                    rv_level.code
                ) AS level_label,

                rv_last_class.code AS last_class_code,
                COALESCE(
                    rv_last_class.label_fr,
                    rv_last_class.label_en,
                    rv_last_class.label,
                    rv_last_class.code
                ) AS last_class_label,

                ip.success,
                ip.study_end_year,

                rv_bac.code AS bac_specialty_code,
                COALESCE(
                    rv_bac.label_fr,
                    rv_bac.label_en,
                    rv_bac.label,
                    rv_bac.code
                ) AS bac_specialty_label,

                rv_specialty.code AS instruction_specialty_code,
                COALESCE(
                    rv_specialty.label_fr,
                    rv_specialty.label_en,
                    rv_specialty.label,
                    rv_specialty.code
                ) AS instruction_specialty_label

            FROM aneti.job_seeker_instruction_profile ip

            LEFT JOIN reference.ref_value rv_level
                ON rv_level.id = ip.instruction_level_ref_id

            LEFT JOIN reference.ref_value rv_last_class
                ON rv_last_class.id = ip.last_class_ref_id

            LEFT JOIN reference.ref_value rv_bac
                ON rv_bac.id = ip.bac_specialty_ref_id

            LEFT JOIN reference.ref_value rv_specialty
                ON rv_specialty.id = ip.specialty_ref_id

            WHERE ip.job_seeker_id = CAST(:candidate_id AS uuid)
            LIMIT 1
        """),
        {"candidate_id": str(candidate_id)},
    ).mappings().first()

    # ─────────────────────────────────────────────────────────
    # Education: no edu.level_ref_id and no edu.institution text.
    # Use diploma_ref_id / specialty_ref_id / institution_ref_id.
    # ─────────────────────────────────────────────────────────
    education_rows = db.execute(
        text("""
            SELECT
                NULL::text AS level_code,
                NULL::text AS level_label,

                rv_diploma.code AS diploma_code,
                COALESCE(
                    rv_diploma.label_fr,
                    rv_diploma.label_en,
                    rv_diploma.label,
                    rv_diploma.code
                ) AS diploma_label,

                rv_specialty.code AS specialty_code,
                COALESCE(
                    rv_specialty.label_fr,
                    rv_specialty.label_en,
                    rv_specialty.label,
                    rv_specialty.code
                ) AS specialty,

                rv_institution.code AS institution_code,
                COALESCE(
                    rv_institution.label_fr,
                    rv_institution.label_en,
                    rv_institution.label,
                    rv_institution.code
                ) AS institution,

                institution_country.iso2 AS institution_country_code,
                COALESCE(
                    institution_country.name_fr,
                    institution_country.name_en,
                    institution_country.iso2
                ) AS institution_country_label,

                edu.graduation_year,
                edu.equivalence_required,
                edu.equivalence_date

            FROM aneti.job_seeker_education edu

            LEFT JOIN reference.ref_value rv_diploma
                ON rv_diploma.id = edu.diploma_ref_id

            LEFT JOIN reference.ref_value rv_specialty
                ON rv_specialty.id = edu.specialty_ref_id

            LEFT JOIN reference.ref_value rv_institution
                ON rv_institution.id = edu.institution_ref_id

            LEFT JOIN geo.country institution_country
                ON institution_country.id = edu.institution_country_id

            WHERE edu.job_seeker_id = CAST(:candidate_id AS uuid)
            ORDER BY edu.graduation_year DESC NULLS LAST,
                     edu.created_at DESC
        """),
        {"candidate_id": str(candidate_id)},
    ).mappings().all()

    education: list[dict[str, Any]] = [dict(row) for row in education_rows]

    # Add instruction profile as a synthetic education row for scoring compatibility.
    if instruction and (instruction.get("level_code") or instruction.get("level_label")):
        education.insert(
            0,
            {
                "level_code": instruction.get("level_code"),
                "level_label": instruction.get("level_label"),
                "diploma_code": None,
                "diploma_label": instruction.get("level_label"),
                "specialty_code": instruction.get("instruction_specialty_code"),
                "specialty": instruction.get("instruction_specialty_label"),
                "institution_code": None,
                "institution": None,
                "institution_country_code": None,
                "institution_country_label": None,
                "graduation_year": instruction.get("study_end_year"),
                "equivalence_required": False,
                "equivalence_date": None,
            },
        )

    # ─────────────────────────────────────────────────────────
    # Experience: no exp.company_name. Use organization_name.
    # ─────────────────────────────────────────────────────────
    experience = db.execute(
        text("""
            SELECT
                exp.occupation_node_id::text AS occupation_node_id,

                -- Legacy alias for feature compatibility.
                exp.occupation_node_id::text AS occupation_id,

                COALESCE(occ.preferred_label, exp.job_title_raw) AS occupation_label,

                exp.job_title_raw,
                exp.organization_name AS company_name,
                exp.organization_name,

                exp.sector_ref_id::text AS sector_ref_id,
                sector_ref.code AS sector_code,
                COALESCE(
                    sector_ref.label_fr,
                    sector_ref.label_en,
                    sector_ref.label,
                    sector_ref.code
                ) AS sector,

                exp.country_id::text AS country_id,
                exp_country.iso2 AS country_code,

                exp.location_unit_id::text AS location_unit_id,
                loc_unit.code AS location_code,

                exp.start_date,
                exp.end_date,
                exp.duration_months,
                exp.description

            FROM aneti.job_seeker_experience exp

            LEFT JOIN taxonomy.taxonomy_node occ
                ON occ.id = exp.occupation_node_id

            LEFT JOIN reference.ref_value sector_ref
                ON sector_ref.id = exp.sector_ref_id

            LEFT JOIN geo.country exp_country
                ON exp_country.id = exp.country_id

            LEFT JOIN geo.admin_unit loc_unit
                ON loc_unit.id = exp.location_unit_id

            WHERE exp.job_seeker_id = CAST(:candidate_id AS uuid)
            ORDER BY exp.start_date DESC NULLS LAST,
                     exp.created_at DESC
        """),
        {"candidate_id": str(candidate_id)},
    ).mappings().all()

    # ─────────────────────────────────────────────────────────
    # Languages: canonical language_ref_id / level_ref_id.
    # ─────────────────────────────────────────────────────────
    languages = db.execute(
        text("""
            SELECT
                lang.code AS language_code,
                lvl.code AS level,
                NULL::text AS evidence
            FROM aneti.job_seeker_language jsl

            LEFT JOIN reference.ref_value lang
                ON lang.id = jsl.language_ref_id

            LEFT JOIN reference.ref_value lvl
                ON lvl.id = jsl.level_ref_id

            WHERE jsl.job_seeker_id = CAST(:candidate_id AS uuid)
            ORDER BY jsl.is_primary DESC,
                     jsl.created_at DESC
        """),
        {"candidate_id": str(candidate_id)},
    ).mappings().all()

    skill_codes = [
        str(row["skill_node_id"])
        for row in skills
        if row.get("skill_node_id")
    ]

    experience_months = [
        int(row["duration_months"] or 0)
        for row in experience
        if row.get("duration_months") is not None
    ]

    experience_years = round(sum(experience_months) / 12, 2) if experience_months else 0.0

    education_degrees = [
        row.get("level_code") or row.get("diploma_code") or row.get("diploma_label")
        for row in education
        if row.get("level_code") or row.get("diploma_code") or row.get("diploma_label")
    ]

    language_codes = [
        str(row["language_code"]).strip()
        for row in languages
        if row.get("language_code") and str(row["language_code"]).strip()
    ]

    language_levels = {
        str(row["language_code"]).strip(): str(row["level"]).strip()
        for row in languages
        if row.get("language_code")
        and str(row["language_code"]).strip()
        and row.get("level")
        and str(row["level"]).strip()
    }

    mobility_scope = str(candidate.get("mobility_scope") or "")
    accepts_relocation = mobility_scope.upper() in {
        "NATIONAL",
        "INTERNATIONAL",
        "UNLIMITED",
        "FLEXIBLE",
    }

    mobility_codes = [
        row["location_code"]
        for row in mobility_units
        if row.get("location_code")
    ]

    preferred_governorate = mobility_codes[0] if mobility_codes else None

    location_codes = []
    if candidate.get("governorate_code"):
        location_codes.append(candidate["governorate_code"])
    if candidate.get("delegation_code"):
        location_codes.append(candidate["delegation_code"])

    return {
        "id": str(candidate["id"]),
        "candidate_id": str(candidate["id"]),
        "status": candidate["status"],

        "identity": {
            "first_name": candidate["first_name"],
            "last_name": candidate["last_name"],
            "birth_date": str(candidate["birth_date"]) if candidate["birth_date"] else None,
            "gender_code": candidate["gender_code"],
        },

        "location": {
            "country": candidate["country"],
            "country_id": candidate["country_id"],
            "country_label": candidate["country_label"],
            "governorate_code": candidate["governorate_code"],
            "delegation_code": candidate["delegation_code"],
        },

        "preferences": {
            "preferred_contract_type": candidate["preferred_contract_type"],
            "preferred_governorate": preferred_governorate,
            "mobility_scope": mobility_scope,
            "mobility_radius_km": 0.0,
            "accepts_relocation": accepts_relocation,
        },

        "skills": [dict(row) for row in skills],
        "education": education,
        "experience": [dict(row) for row in experience],

        "cv_id": str(candidate["id"]),

        "parsed_cv": {
            "personal_info": {
                "first_name": candidate["first_name"],
                "last_name": candidate["last_name"],
                "location": candidate["governorate_code"],
            },
            "education": education,
            "experience": [dict(row) for row in experience],
            "languages": [
                {
                    "code": row["language_code"],
                    "level": row["level"],
                    "evidence": row["evidence"],
                }
                for row in languages
                if row.get("language_code")
            ],
        },

        "mapped_entities": {
            "skills": [
                {
                    "taxonomy_type": "skill",
                    "rtmc_code": str(row["skill_node_id"]) if row.get("skill_node_id") else row.get("skill_label"),
                    "label": row["skill_label"],
                    "usable_for_scoring": True,
                }
                for row in skills
                if row.get("skill_node_id") or row.get("skill_label")
            ],
            "occupations": [
                {
                    "taxonomy_type": "occupation",
                    "rtmc_code": str(row["occupation_node_id"]) if row.get("occupation_node_id") else row.get("job_title_raw"),
                    "label": row["occupation_label"] or row.get("job_title_raw"),
                    "usable_for_scoring": True,
                }
                for row in experience
                if row.get("occupation_node_id") or row.get("job_title_raw")
            ],
            "projects": [],
        },

        "scoring_features": {
            "skill_codes": skill_codes,
            "accepted_skill_codes": skill_codes,
            "experience_years": experience_years,
            "education_degrees": education_degrees,
            "location_codes": location_codes,
            "contract_types": [candidate["preferred_contract_type"]] if candidate["preferred_contract_type"] else [],
            "mobility_codes": mobility_codes,
            "accepts_relocation": accepts_relocation,
            "languages": language_codes,
            "language_levels": language_levels,
        },
    }