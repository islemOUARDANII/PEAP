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

                gov.code AS governorate_code,
                del.code AS delegation_code,
                jc.country,

                contract_ref.code AS preferred_contract_type,
                pref_gov.code AS preferred_governorate,

                jp.mobility_radius_km,
                jp.accepts_relocation

            FROM aneti.job_seeker js

            LEFT JOIN aneti.job_seeker_identity ji
                ON ji.job_seeker_id = js.id

            LEFT JOIN reference.ref_value gender_ref
                ON gender_ref.id = ji.gender_ref_id

            LEFT JOIN reference.ref_group gender_group
                ON gender_group.id = gender_ref.group_id
            AND gender_group.code = 'GENDER'

            LEFT JOIN aneti.job_seeker_contact jc
                ON jc.job_seeker_id = js.id

            LEFT JOIN geo.admin_unit gov
                ON gov.id = jc.governorate_unit_id

            LEFT JOIN geo.admin_unit del
                ON del.id = jc.delegation_unit_id

            LEFT JOIN aneti.job_seeker_preference jp
                ON jp.job_seeker_id = js.id

            LEFT JOIN reference.ref_value contract_ref
                ON contract_ref.id = jp.preferred_contract_type_ref_id

            LEFT JOIN reference.ref_group contract_group
                ON contract_group.id = contract_ref.group_id
            AND contract_group.code = 'CONTRACT_TYPE'

            LEFT JOIN geo.admin_unit pref_gov
                ON pref_gov.id = jp.preferred_governorate_unit_id

            WHERE js.id = CAST(:candidate_id AS uuid)
        """),
        {"candidate_id": str(candidate_id)},
    ).mappings().first()

    if not candidate:
        raise ValueError(f"Candidate not found: {candidate_id}")

    skills = db.execute(
        text("""
            SELECT
                jss.skill_id,
                jss.skill_label_raw,
                jss.level,
                jss.years,
                jss.source
            FROM aneti.job_seeker_skill jss
            WHERE jss.job_seeker_id = CAST(:candidate_id AS uuid)
        """),
        {"candidate_id": str(candidate_id)},
    ).mappings().all()

    education = db.execute(
        text("""
            SELECT
                level_code,
                diploma_label,
                specialty,
                institution,
                graduation_year
            FROM aneti.job_seeker_education
            WHERE job_seeker_id = CAST(:candidate_id AS uuid)
        """),
        {"candidate_id": str(candidate_id)},
    ).mappings().all()

    experience = db.execute(
        text("""
            SELECT
                occupation_id,
                job_title_raw,
                company_name,
                sector,
                start_date,
                end_date,
                duration_months,
                description
            FROM aneti.job_seeker_experience
            WHERE job_seeker_id = CAST(:candidate_id AS uuid)
        """),
        {"candidate_id": str(candidate_id)},
    ).mappings().all()

    languages = db.execute(
        text("""
            SELECT
                language_code,
                level,
                evidence
            FROM aneti.job_seeker_language
            WHERE job_seeker_id = CAST(:candidate_id AS uuid)
            ORDER BY created_at DESC
        """),
        {"candidate_id": str(candidate_id)},
    ).mappings().all()
    
    skill_codes = [
        str(row["skill_id"]) if row["skill_id"] else str(row["skill_label_raw"])
        for row in skills
        if row["skill_id"] or row["skill_label_raw"]
    ]

    experience_months = [
        int(row["duration_months"] or 0)
        for row in experience
        if row["duration_months"] is not None
    ]

    experience_years = round(sum(experience_months) / 12, 2) if experience_months else 0.0

    education_degrees = [
        row["level_code"] or row["diploma_label"]
        for row in education
        if row["level_code"] or row["diploma_label"]
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
            "governorate_code": candidate["governorate_code"],
            "delegation_code": candidate["delegation_code"],
        },
        "preferences": {
            "preferred_contract_type": candidate["preferred_contract_type"],
            "preferred_governorate": candidate["preferred_governorate"],
            "mobility_radius_km": float(candidate["mobility_radius_km"] or 0),
            "accepts_relocation": candidate["accepts_relocation"],
        },
        "skills": [dict(row) for row in skills],
        "education": [dict(row) for row in education],
        "experience": [dict(row) for row in experience],
        "cv_id": str(candidate["id"]),
        "parsed_cv": {
            "personal_info": {
                "first_name": candidate["first_name"],
                "last_name": candidate["last_name"],
                "location": candidate["governorate_code"],
            },
            "education": [dict(row) for row in education],
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
                    "rtmc_code": str(row["skill_id"]) if row["skill_id"] else row["skill_label_raw"],
                    "label": row["skill_label_raw"],
                    "usable_for_scoring": True,
                }
                for row in skills
                if row["skill_id"] or row["skill_label_raw"]
            ],
            "occupations": [
                {
                    "taxonomy_type": "occupation",
                    "rtmc_code": str(row["occupation_id"]) if row["occupation_id"] else row["job_title_raw"],
                    "label": row["job_title_raw"],
                    "usable_for_scoring": True,
                }
                for row in experience
                if row["occupation_id"] or row["job_title_raw"]
            ],
            "projects": [],
        },
        "scoring_features": {
            "skill_codes": skill_codes,
            "accepted_skill_codes": skill_codes,
            "experience_years": experience_years,
            "education_degrees": education_degrees,
            "location_codes": [candidate["governorate_code"]] if candidate["governorate_code"] else [],
            "contract_types": [candidate["preferred_contract_type"]] if candidate["preferred_contract_type"] else [],
            "mobility_codes": [candidate["preferred_governorate"]] if candidate["preferred_governorate"] else [],
            "languages": language_codes,
            "language_levels": language_levels,
        },
    }
