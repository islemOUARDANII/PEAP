from collections.abc import Mapping
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.orm import Session


def _fetch_one(db: Session, query: str, params: dict | None = None) -> dict | None:
    row = db.execute(text(query), params or {}).mappings().first()
    return dict(row) if row else None


def _fetch_all(db: Session, query: str, params: dict | None = None) -> list[dict]:
    rows = db.execute(text(query), params or {}).mappings().all()
    return [dict(row) for row in rows]


def taxonomy_node_exists(db: Session) -> bool:
    row = _fetch_one(
        db,
        """
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'taxonomy'
              AND table_name = 'taxonomy_node'
        ) AS exists_flag;
        """,
    )
    return bool(row["exists_flag"])


def get_job_seeker_by_id(db: Session, job_seeker_id: str) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            js.id::text AS id,
            js.user_id::text AS user_id,
            js.aneti_identifier,
            js.status,
            js.registration_date,
            js.primary_language,
            js.created_at,
            js.updated_at
        FROM aneti.job_seeker js
        WHERE js.id = CAST(:job_seeker_id AS uuid)
        LIMIT 1;
        """,
        {"job_seeker_id": job_seeker_id},
    )


def get_job_seeker_by_user_id(db: Session, user_id: str) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            js.id::text AS id,
            js.user_id::text AS user_id,
            js.aneti_identifier,
            js.status,
            js.registration_date,
            js.primary_language,
            js.created_at,
            js.updated_at
        FROM aneti.job_seeker js
        WHERE js.user_id = CAST(:user_id AS uuid)
        LIMIT 1;
        """,
        {"user_id": user_id},
    )


def update_job_seeker(db: Session, job_seeker_id: str, payload: Mapping[str, object]) -> dict | None:
    params = dict(payload)
    params["job_seeker_id"] = job_seeker_id
    return _fetch_one(
        db,
        """
        UPDATE aneti.job_seeker
        SET primary_language = :primary_language
        WHERE id = CAST(:job_seeker_id AS uuid)
        RETURNING
            id::text AS id,
            user_id::text AS user_id,
            aneti_identifier,
            status,
            registration_date,
            primary_language,
            created_at,
            updated_at;
        """,
        params,
    )


def update_job_seeker_status(db: Session, job_seeker_id: str, status_value: str) -> dict | None:
    return _fetch_one(
        db,
        """
        UPDATE aneti.job_seeker
        SET status = :status_value
        WHERE id = CAST(:job_seeker_id AS uuid)
        RETURNING id::text AS id, status;
        """,
        {
            "job_seeker_id": job_seeker_id,
            "status_value": status_value,
        },
    )


def get_identity(db: Session, job_seeker_id: str) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            i.id::text AS id,
            i.cin,
            i.passport_number,
            i.first_name,
            i.last_name,
            i.birth_date,
            i.gender_code,
            g.libelle_genre AS gender_label,
            i.nationality,
            i.code_handicap AS code_handicap,
            th.libelle_handicap AS handicap_label,
            i.code_degre_handicap AS code_degre_handicap,
            dh.libelle_degre_handicap AS degre_handicap_label
        FROM aneti.job_seeker_identity i
        LEFT JOIN taxonomy.ref_genre g
            ON g.code_genre = i.gender_code
        LEFT JOIN taxonomy.ref_type_handicap th
            ON th.code_handicap = i.code_handicap
        LEFT JOIN taxonomy.ref_degre_handicap dh
            ON dh.code_degre_handicap = i.code_degre_handicap
        WHERE i.job_seeker_id = CAST(:job_seeker_id AS uuid)
        LIMIT 1;
        """,
        {"job_seeker_id": job_seeker_id},
    )


def upsert_identity(db: Session, job_seeker_id: str, payload: Mapping[str, object]) -> dict:
    params = dict(payload)
    params["job_seeker_id"] = job_seeker_id
    return _fetch_one(
        db,
        """
        INSERT INTO aneti.job_seeker_identity (
            job_seeker_id,
            cin,
            passport_number,
            first_name,
            last_name,
            birth_date,
            gender_code,
            nationality,
            code_handicap,
            code_degre_handicap
        )
        VALUES (
            CAST(:job_seeker_id AS uuid),
            :cin,
            :passport_number,
            :first_name,
            :last_name,
            :birth_date,
            :gender_code,
            :nationality,
            :code_handicap,
            :code_degre_handicap
        )
        ON CONFLICT (job_seeker_id)
        DO UPDATE SET
            cin = EXCLUDED.cin,
            passport_number = EXCLUDED.passport_number,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            birth_date = EXCLUDED.birth_date,
            gender_code = EXCLUDED.gender_code,
            nationality = EXCLUDED.nationality,
            code_handicap = EXCLUDED.code_handicap,
            code_degre_handicap = EXCLUDED.code_degre_handicap
        RETURNING id::text AS id;
        """,
        params,
    )


def get_contact(db: Session, job_seeker_id: str) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            c.id::text AS id,
            c.email,
            c.phone,
            c.address,
            c.country,
            c.governorate_code,
            g.libelle_gouvernorat AS governorate_label,
            c.delegation_code,
            d.libelle_delegation AS delegation_label
        FROM aneti.job_seeker_contact c
        LEFT JOIN taxonomy.ref_n_gouvern g
            ON g.code_gouvernorat = c.governorate_code
        LEFT JOIN taxonomy.ref_n_delegat d
            ON d.code_delegation = c.delegation_code
        WHERE c.job_seeker_id = CAST(:job_seeker_id AS uuid)
        LIMIT 1;
        """,
        {"job_seeker_id": job_seeker_id},
    )


def upsert_contact(db: Session, job_seeker_id: str, payload: Mapping[str, object]) -> dict:
    params = dict(payload)
    params["job_seeker_id"] = job_seeker_id
    return _fetch_one(
        db,
        """
        INSERT INTO aneti.job_seeker_contact (
            job_seeker_id,
            email,
            phone,
            address,
            governorate_code,
            delegation_code,
            country
        )
        VALUES (
            CAST(:job_seeker_id AS uuid),
            :email,
            :phone,
            :address,
            :governorate_code,
            :delegation_code,
            :country
        )
        ON CONFLICT (job_seeker_id)
        DO UPDATE SET
            email = EXCLUDED.email,
            phone = EXCLUDED.phone,
            address = EXCLUDED.address,
            governorate_code = EXCLUDED.governorate_code,
            delegation_code = EXCLUDED.delegation_code,
            country = EXCLUDED.country
        RETURNING id::text AS id;
        """,
        params,
    )


def list_education(db: Session, job_seeker_id: str) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            e.id::text AS id,
            e.level_code,
            ni.libelle_niveau_instruction AS level_label,
            e.diploma_label,
            e.specialty,
            e.institution,
            e.graduation_year,
            e.rtmc_education_node_id::text AS rtmc_education_node_id,
            e.created_at,
            e.updated_at
        FROM aneti.job_seeker_education e
        LEFT JOIN taxonomy.ref_niveau_instruction ni
            ON ni.code_niveau_instruction = e.level_code
        WHERE e.job_seeker_id = CAST(:job_seeker_id AS uuid)
        ORDER BY e.graduation_year DESC NULLS LAST, e.created_at DESC;
        """,
        {"job_seeker_id": job_seeker_id},
    )


def create_education(db: Session, job_seeker_id: str, payload: Mapping[str, object]) -> dict:
    params = dict(payload)
    params["job_seeker_id"] = job_seeker_id
    return _fetch_one(
        db,
        """
        INSERT INTO aneti.job_seeker_education (
            job_seeker_id,
            level_code,
            diploma_label,
            specialty,
            institution,
            graduation_year,
            rtmc_education_node_id
        )
        VALUES (
            CAST(:job_seeker_id AS uuid),
            :level_code,
            :diploma_label,
            :specialty,
            :institution,
            :graduation_year,
            CAST(:rtmc_education_node_id AS uuid)
        )
        RETURNING id::text AS id;
        """,
        params,
    )


def update_education(
    db: Session,
    job_seeker_id: str,
    education_id: str,
    payload: Mapping[str, object],
) -> dict | None:
    params = dict(payload)
    params["job_seeker_id"] = job_seeker_id
    params["education_id"] = education_id
    return _fetch_one(
        db,
        """
        UPDATE aneti.job_seeker_education
        SET
            level_code = :level_code,
            diploma_label = :diploma_label,
            specialty = :specialty,
            institution = :institution,
            graduation_year = :graduation_year,
            rtmc_education_node_id = CAST(:rtmc_education_node_id AS uuid)
        WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)
          AND id = CAST(:education_id AS uuid)
        RETURNING id::text AS id;
        """,
        params,
    )


def delete_education(db: Session, job_seeker_id: str, education_id: str) -> bool:
    result = db.execute(
        text("""
        DELETE FROM aneti.job_seeker_education
        WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)
          AND id = CAST(:education_id AS uuid);
        """),
        {
            "job_seeker_id": job_seeker_id,
            "education_id": education_id,
        },
    )
    return result.rowcount > 0


def list_experience(db: Session, job_seeker_id: str) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            e.id::text AS id,
            e.occupation_id::text AS occupation_id,
            e.job_title_raw,
            e.company_name,
            e.sector,
            e.start_date,
            e.end_date,
            e.duration_months,
            e.description,
            e.created_at,
            e.updated_at
        FROM aneti.job_seeker_experience e
        WHERE e.job_seeker_id = CAST(:job_seeker_id AS uuid)
        ORDER BY e.start_date DESC NULLS LAST, e.created_at DESC;
        """,
        {"job_seeker_id": job_seeker_id},
    )


def create_experience(db: Session, job_seeker_id: str, payload: Mapping[str, object]) -> dict:
    params = dict(payload)
    params["job_seeker_id"] = job_seeker_id
    return _fetch_one(
        db,
        """
        INSERT INTO aneti.job_seeker_experience (
            job_seeker_id,
            occupation_id,
            job_title_raw,
            company_name,
            sector,
            start_date,
            end_date,
            duration_months,
            description
        )
        VALUES (
            CAST(:job_seeker_id AS uuid),
            CAST(:occupation_id AS uuid),
            :job_title_raw,
            :company_name,
            :sector,
            :start_date,
            :end_date,
            :duration_months,
            :description
        )
        RETURNING id::text AS id;
        """,
        params,
    )


def update_experience(
    db: Session,
    job_seeker_id: str,
    experience_id: str,
    payload: Mapping[str, object],
) -> dict | None:
    params = dict(payload)
    params["job_seeker_id"] = job_seeker_id
    params["experience_id"] = experience_id
    return _fetch_one(
        db,
        """
        UPDATE aneti.job_seeker_experience
        SET
            occupation_id = CAST(:occupation_id AS uuid),
            job_title_raw = :job_title_raw,
            company_name = :company_name,
            sector = :sector,
            start_date = :start_date,
            end_date = :end_date,
            duration_months = :duration_months,
            description = :description
        WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)
          AND id = CAST(:experience_id AS uuid)
        RETURNING id::text AS id;
        """,
        params,
    )


def delete_experience(db: Session, job_seeker_id: str, experience_id: str) -> bool:
    result = db.execute(
        text("""
        DELETE FROM aneti.job_seeker_experience
        WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)
          AND id = CAST(:experience_id AS uuid);
        """),
        {
            "job_seeker_id": job_seeker_id,
            "experience_id": experience_id,
        },
    )
    return result.rowcount > 0


def list_skills(db: Session, job_seeker_id: str) -> list[dict]:
    if taxonomy_node_exists(db):
        return _fetch_all(
            db,
            """
            SELECT
                s.id::text AS id,
                s.skill_id::text AS skill_id,
                s.skill_label_raw,
                n.preferred_label AS skill_node_label,
                n.node_type AS skill_node_type,
                s.level,
                s.years,
                s.evidence,
                s.source,
                s.created_at,
                s.updated_at
            FROM aneti.job_seeker_skill s
            LEFT JOIN taxonomy.taxonomy_node n
                ON n.id = s.skill_id
            WHERE s.job_seeker_id = CAST(:job_seeker_id AS uuid)
            ORDER BY s.created_at DESC;
            """,
            {"job_seeker_id": job_seeker_id},
        )

    return _fetch_all(
        db,
        """
        SELECT
            s.id::text AS id,
            s.skill_id::text AS skill_id,
            s.skill_label_raw,
            NULL::text AS skill_node_label,
            NULL::text AS skill_node_type,
            s.level,
            s.years,
            s.evidence,
            s.source,
            s.created_at,
            s.updated_at
        FROM aneti.job_seeker_skill s
        WHERE s.job_seeker_id = CAST(:job_seeker_id AS uuid)
        ORDER BY s.created_at DESC;
        """,
        {"job_seeker_id": job_seeker_id},
    )


def create_skill(db: Session, job_seeker_id: str, payload: Mapping[str, object]) -> dict:
    params = dict(payload)
    params["job_seeker_id"] = job_seeker_id
    return _fetch_one(
        db,
        """
        INSERT INTO aneti.job_seeker_skill (
            job_seeker_id,
            skill_id,
            skill_label_raw,
            level,
            years,
            evidence,
            source
        )
        VALUES (
            CAST(:job_seeker_id AS uuid),
            CAST(:skill_id AS uuid),
            :skill_label_raw,
            :level,
            :years,
            :evidence,
            :source
        )
        RETURNING id::text AS id;
        """,
        params,
    )


def update_skill(
    db: Session,
    job_seeker_id: str,
    skill_row_id: str,
    payload: Mapping[str, object],
) -> dict | None:
    params = dict(payload)
    params["job_seeker_id"] = job_seeker_id
    params["skill_row_id"] = skill_row_id
    return _fetch_one(
        db,
        """
        UPDATE aneti.job_seeker_skill
        SET
            skill_id = CAST(:skill_id AS uuid),
            skill_label_raw = :skill_label_raw,
            level = :level,
            years = :years,
            evidence = :evidence,
            source = :source
        WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)
          AND id = CAST(:skill_row_id AS uuid)
        RETURNING id::text AS id;
        """,
        params,
    )


def delete_skill(db: Session, job_seeker_id: str, skill_row_id: str) -> bool:
    result = db.execute(
        text("""
        DELETE FROM aneti.job_seeker_skill
        WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)
          AND id = CAST(:skill_row_id AS uuid);
        """),
        {
            "job_seeker_id": job_seeker_id,
            "skill_row_id": skill_row_id,
        },
    )
    return result.rowcount > 0


def list_languages(db: Session, job_seeker_id: str) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            l.id::text AS id,
            l.language_code,
            rl.label_fr AS language_label_fr,
            rl.label_en AS language_label_en,
            l.level,
            rll.label_fr AS level_label_fr,
            rll.label_en AS level_label_en,
            l.evidence,
            l.created_at,
            l.updated_at
        FROM aneti.job_seeker_language l
        LEFT JOIN taxonomy.ref_language rl
            ON rl.code = l.language_code
        LEFT JOIN taxonomy.ref_language_level rll
            ON rll.code = l.level
        WHERE l.job_seeker_id = CAST(:job_seeker_id AS uuid)
        ORDER BY l.created_at DESC;
        """,
        {"job_seeker_id": job_seeker_id},
    )


def create_language(db: Session, job_seeker_id: str, payload: Mapping[str, object]) -> dict:
    params = dict(payload)
    params["job_seeker_id"] = job_seeker_id
    return _fetch_one(
        db,
        """
        INSERT INTO aneti.job_seeker_language (
            job_seeker_id,
            language_code,
            level,
            evidence
        )
        VALUES (
            CAST(:job_seeker_id AS uuid),
            :language_code,
            :level,
            :evidence
        )
        RETURNING id::text AS id;
        """,
        params,
    )


def update_language(
    db: Session,
    job_seeker_id: str,
    language_id: str,
    payload: Mapping[str, object],
) -> dict | None:
    params = dict(payload)
    params["job_seeker_id"] = job_seeker_id
    params["language_id"] = language_id
    return _fetch_one(
        db,
        """
        UPDATE aneti.job_seeker_language
        SET
            language_code = :language_code,
            level = :level,
            evidence = :evidence
        WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)
          AND id = CAST(:language_id AS uuid)
        RETURNING id::text AS id;
        """,
        params,
    )


def delete_language(db: Session, job_seeker_id: str, language_id: str) -> bool:
    result = db.execute(
        text("""
        DELETE FROM aneti.job_seeker_language
        WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)
          AND id = CAST(:language_id AS uuid);
        """),
        {
            "job_seeker_id": job_seeker_id,
            "language_id": language_id,
        },
    )
    return result.rowcount > 0


def get_preference(db: Session, job_seeker_id: str) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            p.id::text AS id,
            p.preferred_contract_type,
            p.preferred_governorate,
            g.libelle_gouvernorat AS preferred_governorate_label,
            p.mobility_radius_km,
            p.accepts_relocation,
            p.desired_salary_min,
            p.desired_salary_max
        FROM aneti.job_seeker_preference p
        LEFT JOIN taxonomy.ref_n_gouvern g
            ON g.code_gouvernorat = p.preferred_governorate
        WHERE p.job_seeker_id = CAST(:job_seeker_id AS uuid)
        LIMIT 1;
        """,
        {"job_seeker_id": job_seeker_id},
    )


def upsert_preference(db: Session, job_seeker_id: str, payload: Mapping[str, object]) -> dict:
    params = dict(payload)
    params["job_seeker_id"] = job_seeker_id
    return _fetch_one(
        db,
        """
        INSERT INTO aneti.job_seeker_preference (
            job_seeker_id,
            preferred_contract_type,
            preferred_governorate,
            mobility_radius_km,
            accepts_relocation,
            desired_salary_min,
            desired_salary_max
        )
        VALUES (
            CAST(:job_seeker_id AS uuid),
            :preferred_contract_type,
            :preferred_governorate,
            :mobility_radius_km,
            :accepts_relocation,
            :desired_salary_min,
            :desired_salary_max
        )
        ON CONFLICT (job_seeker_id)
        DO UPDATE SET
            preferred_contract_type = EXCLUDED.preferred_contract_type,
            preferred_governorate = EXCLUDED.preferred_governorate,
            mobility_radius_km = EXCLUDED.mobility_radius_km,
            accepts_relocation = EXCLUDED.accepts_relocation,
            desired_salary_min = EXCLUDED.desired_salary_min,
            desired_salary_max = EXCLUDED.desired_salary_max
        RETURNING id::text AS id;
        """,
        params,
    )


def get_current_cv(db: Session, job_seeker_id: str) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            cv.id::text AS id,
            cv.cv_id,
            cv.storage_provider,
            cv.container_name,
            cv.blob_name,
            cv.storage_key,
            cv.blob_url,
            cv.original_filename,
            cv.mime_type,
            cv.file_size_bytes,
            cv.status,
            cv.is_current,
            cv.parsing_status,
            cv.uploaded_by_user_id::text AS uploaded_by_user_id,
            cv.uploaded_at,
            cv.created_at,
            cv.updated_at
        FROM aneti.job_seeker_cv cv
        WHERE cv.job_seeker_id = CAST(:job_seeker_id AS uuid)
          AND cv.is_current = TRUE
          AND cv.status <> 'ARCHIVED'
        ORDER BY cv.uploaded_at DESC
        LIMIT 1;
        """,
        {"job_seeker_id": job_seeker_id},
    )


def list_candidate_summaries(
    db: Session,
    *,
    q: str | None,
    status_value: str | None,
    governorate_code: str | None,
    delegation_code: str | None,
    has_cv: bool | None,
    limit: int,
    offset: int,
) -> list[dict]:
    filters: list[str] = []
    params: dict[str, object] = {"limit": limit, "offset": offset}

    if q:
        filters.append(
            "(js.aneti_identifier ILIKE :search OR i.first_name ILIKE :search OR i.last_name ILIKE :search)"
        )
        params["search"] = f"%{q}%"

    if status_value:
        filters.append("js.status = :status_value")
        params["status_value"] = status_value

    if governorate_code:
        filters.append("c.governorate_code = :governorate_code")
        params["governorate_code"] = governorate_code

    if delegation_code:
        filters.append("c.delegation_code = :delegation_code")
        params["delegation_code"] = delegation_code

    if has_cv is not None:
        filters.append(
            """
            EXISTS (
                SELECT 1
                FROM aneti.job_seeker_cv cv
                WHERE cv.job_seeker_id = js.id
                  AND cv.is_current = TRUE
                  AND cv.status <> 'ARCHIVED'
            ) = :has_cv
            """
        )
        params["has_cv"] = has_cv

    where_clause = ""
    if filters:
        where_clause = "WHERE " + " AND ".join(filters)

    return _fetch_all(
        db,
        f"""
        SELECT
            js.id::text AS id,
            js.aneti_identifier,
            NULLIF(trim(COALESCE(i.first_name, '') || ' ' || COALESCE(i.last_name, '')), '') AS full_name,
            js.status,
            c.governorate_code,
            g.libelle_gouvernorat AS governorate_label,
            c.delegation_code,
            d.libelle_delegation AS delegation_label,
            EXISTS (
                SELECT 1
                FROM aneti.job_seeker_cv cv
                WHERE cv.job_seeker_id = js.id
                  AND cv.is_current = TRUE
                  AND cv.status <> 'ARCHIVED'
            ) AS current_cv_exists,
            js.updated_at
        FROM aneti.job_seeker js
        LEFT JOIN aneti.job_seeker_identity i
            ON i.job_seeker_id = js.id
        LEFT JOIN aneti.job_seeker_contact c
            ON c.job_seeker_id = js.id
        LEFT JOIN taxonomy.ref_n_gouvern g
            ON g.code_gouvernorat = c.governorate_code
        LEFT JOIN taxonomy.ref_n_delegat d
            ON d.code_delegation = c.delegation_code
        {where_clause}
        ORDER BY js.updated_at DESC
        LIMIT :limit OFFSET :offset;
        """,
        params,
    )


def count_job_seekers(db: Session) -> dict:
    return _fetch_one(
        db,
        """
        SELECT
            COUNT(*)::int AS candidates_count,
            COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active_candidates_count
        FROM aneti.job_seeker;
        """,
    )

def count_active_offers(db: Session) -> int:
    row = _fetch_one(
        db,
        """
        SELECT COUNT(*)::int AS count
        FROM aneti.job_offer
        WHERE status IN ('PUBLISHED', 'ACTIVE');
        """,
    )
    return int(row["count"] if row else 0)


def get_default_candidate_to_offer_model_version(db: Session) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            mv.id::text AS id,
            m.code AS model_code,
            m.label AS model_label,
            mv.version_number,
            mv.status
        FROM matching.matching_model_version mv
        JOIN matching.matching_model m
            ON m.id = mv.model_id
        WHERE m.code = 'STANDARD_CANDIDATE_TO_OFFER'
          AND m.active = true
          AND mv.status = 'ACTIVE'
        ORDER BY mv.version_number DESC, mv.created_at DESC
        LIMIT 1;
        """,
    )


def list_candidate_matching_results_with_offers(
    db: Session,
    *,
    run_id: str,
    job_seeker_id: str,
    min_score: float,
) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            mr.id::text AS result_id,
            mr.run_id::text AS run_id,
            mr.offer_id::text AS offer_id,
            jo.title,
            jo.description,
            jo.status,
            jo.contract_type,
            jo.work_mode,
            jo.country,
            jo.governorate_code,
            (ja.id IS NOT NULL) AS already_applied,
            ja.id::text AS application_id,
            ja.status AS application_status,
            g.libelle_gouvernorat AS governorate_label,
            jo.delegation_code,
            d.libelle_delegation AS delegation_label,
            jo.published_at,
            jo.deadline_at,
            COALESCE(e.commercial_name, e.legal_name) AS employer_name,
            mr.score_global::float8 AS score_global,
            CASE
            WHEN mr.score_global <= 1
                THEN ROUND((mr.score_global::numeric * 100), 2)::float8
                    ELSE ROUND(mr.score_global::numeric, 2)::float8
                END AS score_percent,
            mr.rank,
            mr.explanation_short,
            COALESCE(mr.explanation_json, '{}'::jsonb) AS explanation_json,
            EXISTS (
                SELECT 1
                FROM matching.matching_result_detail mrd
                WHERE mrd.result_id = mr.id
                  AND COALESCE(mrd.is_gap, FALSE) = TRUE
            ) AS has_gaps
        FROM matching.matching_result mr
        JOIN aneti.job_offer jo
            ON jo.id = mr.offer_id
        LEFT JOIN aneti.employer e
            ON e.id = jo.employer_id
        LEFT JOIN taxonomy.ref_n_gouvern g
            ON g.code_gouvernorat = jo.governorate_code
        LEFT JOIN taxonomy.ref_n_delegat d
            ON d.code_delegation = jo.delegation_code
        LEFT JOIN aneti.job_application ja
            ON ja.offer_id = jo.id
        AND ja.job_seeker_id = CAST(:job_seeker_id AS uuid)    
        WHERE mr.run_id = CAST(:run_id AS uuid)
          AND mr.score_global >= :min_score
          AND jo.status IN ('PUBLISHED', 'ACTIVE')
        ORDER BY mr.score_global DESC, mr.rank ASC;
        """,
        {
            "run_id": run_id,
            "job_seeker_id": job_seeker_id,
            "min_score": min_score,
        },
    )

def get_candidate_profile_last_updated(db: Session, job_seeker_id: str) -> datetime | None:
    row = _fetch_one(
        db,
        """
        SELECT MAX(updated_at) AS last_updated
        FROM (
            SELECT updated_at
            FROM aneti.job_seeker
            WHERE id = CAST(:job_seeker_id AS uuid)

            UNION ALL

            SELECT updated_at
            FROM aneti.job_seeker_skill
            WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)

            UNION ALL

            SELECT updated_at
            FROM aneti.job_seeker_language
            WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)

            UNION ALL

            SELECT updated_at
            FROM aneti.job_seeker_education
            WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)

            UNION ALL

            SELECT updated_at
            FROM aneti.job_seeker_experience
            WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)

            UNION ALL

            SELECT updated_at
            FROM aneti.job_seeker_preference
            WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)
        ) profile_updates;
        """,
        {"job_seeker_id": job_seeker_id},
    )

    return row["last_updated"] if row else None

def get_active_offers_last_updated(db: Session) -> datetime | None:
    row = _fetch_one(
        db,
        """
        SELECT MAX(last_updated) AS last_updated
        FROM (
            SELECT updated_at AS last_updated
            FROM aneti.job_offer
            WHERE status IN ('PUBLISHED', 'ACTIVE')

            UNION ALL

            SELECT r.updated_at AS last_updated
            FROM aneti.job_offer_requirement r
            JOIN aneti.job_offer o
                ON o.id = r.offer_id
            WHERE o.status IN ('PUBLISHED', 'ACTIVE')
        ) offer_updates;
        """,
    )

    return row["last_updated"] if row else None

def find_reusable_candidate_to_offer_run(
    db: Session,
    *,
    job_seeker_id: str,
    model_version_id: str,
    min_created_at: datetime | None,
) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            id::text AS id,
            status,
            started_at,
            finished_at
        FROM matching.matching_run
        WHERE direction = 'CANDIDATE_TO_OFFER'
          AND model_version_id = CAST(:model_version_id AS uuid)
          AND source_entity_type = 'JOB_SEEKER'
          AND source_entity_id = :job_seeker_id
          AND status IN ('COMPLETED')
          AND (
                :min_created_at IS NULL
                OR started_at >= :min_created_at
          )
        ORDER BY started_at DESC
        LIMIT 1;
        """,
        {
            "job_seeker_id": job_seeker_id,
            "model_version_id": model_version_id,
            "min_created_at": min_created_at,
        },
    )


def list_job_seeker_keywords(db: Session, job_seeker_id: str) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            id::text AS id,
            keyword,
            keyword_type,
            source,
            weight::float8 AS weight,
            created_at,
            updated_at
        FROM aneti.job_seeker_keyword
        WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)
        ORDER BY weight DESC, keyword ASC;
        """,
        {"job_seeker_id": job_seeker_id},
    )


def replace_job_seeker_keywords(
    db: Session,
    *,
    job_seeker_id: str,
    keywords: list[str],
) -> list[dict]:
    cleaned_keywords = []
    seen = set()

    for keyword in keywords or []:
        value = str(keyword or "").strip()
        if not value:
            continue

        key = value.lower()
        if key in seen:
            continue

        seen.add(key)
        cleaned_keywords.append(value)

    db.execute(
        text("""
            DELETE FROM aneti.job_seeker_keyword
            WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)
        """),
        {"job_seeker_id": job_seeker_id},
    )

    for keyword in cleaned_keywords:
        db.execute(
            text("""
                INSERT INTO aneti.job_seeker_keyword (
                    job_seeker_id,
                    keyword,
                    keyword_type,
                    source,
                    weight
                )
                VALUES (
                    CAST(:job_seeker_id AS uuid),
                    :keyword,
                    'INTEREST',
                    'MANUAL',
                    1.00
                )
            """),
            {
                "job_seeker_id": job_seeker_id,
                "keyword": keyword,
            },
        )

    return list_job_seeker_keywords(db, job_seeker_id)


def get_offer_score_threshold(db: Session, job_seeker_id: str) -> float:
    row = _fetch_one(
        db,
        """
        SELECT min_offer_score_threshold::float8 AS threshold
        FROM aneti.job_seeker_preference
        WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)
        LIMIT 1;
        """,
        {"job_seeker_id": job_seeker_id},
    )

    if not row:
        return 50.0

    return float(row["threshold"] or 50.0)


def update_offer_score_threshold(
    db: Session,
    *,
    job_seeker_id: str,
    min_offer_score_threshold: float,
) -> dict:
    db.execute(
        text("""
            INSERT INTO aneti.job_seeker_preference (
                job_seeker_id,
                min_offer_score_threshold
            )
            VALUES (
                CAST(:job_seeker_id AS uuid),
                :threshold
            )
            ON CONFLICT (job_seeker_id)
            DO UPDATE SET
                min_offer_score_threshold = EXCLUDED.min_offer_score_threshold,
                updated_at = now()
        """),
        {
            "job_seeker_id": job_seeker_id,
            "threshold": min_offer_score_threshold,
        },
    )

    return {
        "min_offer_score_threshold": min_offer_score_threshold,
    }


def create_job_application(
    db: Session,
    *,
    job_seeker_id: str,
    offer_id: str,
    matching_result_id: str | None = None,
    cover_message: str | None = None,
) -> dict:
    return _fetch_one(
        db,
        """
        INSERT INTO aneti.job_application (
            job_seeker_id,
            offer_id,
            matching_result_id,
            cover_message,
            status
        )
        VALUES (
            CAST(:job_seeker_id AS uuid),
            CAST(:offer_id AS uuid),
            CASE
                WHEN :matching_result_id IS NULL OR :matching_result_id = ''
                    THEN NULL
                ELSE CAST(:matching_result_id AS uuid)
            END,
            :cover_message,
            'APPLIED'
        )
        ON CONFLICT (job_seeker_id, offer_id)
        DO UPDATE SET
            matching_result_id = COALESCE(EXCLUDED.matching_result_id, aneti.job_application.matching_result_id),
            cover_message = COALESCE(EXCLUDED.cover_message, aneti.job_application.cover_message),
            status = 'APPLIED',
            updated_at = now()
        RETURNING
            id::text AS id,
            job_seeker_id::text AS job_seeker_id,
            offer_id::text AS offer_id,
            matching_result_id::text AS matching_result_id,
            status,
            cover_message,
            applied_at,
            updated_at;
        """,
        {
            "job_seeker_id": job_seeker_id,
            "offer_id": offer_id,
            "matching_result_id": matching_result_id,
            "cover_message": cover_message,
        },
    )


def list_job_applications(db: Session, job_seeker_id: str) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            id::text AS id,
            job_seeker_id::text AS job_seeker_id,
            offer_id::text AS offer_id,
            matching_result_id::text AS matching_result_id,
            status,
            cover_message,
            applied_at,
            updated_at
        FROM aneti.job_application
        WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)
        ORDER BY applied_at DESC;
        """,
        {"job_seeker_id": job_seeker_id},
    )