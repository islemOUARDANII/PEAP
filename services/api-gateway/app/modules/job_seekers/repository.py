from collections.abc import Mapping

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
            i.nationality
        FROM aneti.job_seeker_identity i
        LEFT JOIN taxonomy.ref_genre g
            ON g.code_genre = i.gender_code
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
            nationality
        )
        VALUES (
            CAST(:job_seeker_id AS uuid),
            :cin,
            :passport_number,
            :first_name,
            :last_name,
            :birth_date,
            :gender_code,
            :nationality
        )
        ON CONFLICT (job_seeker_id)
        DO UPDATE SET
            cin = EXCLUDED.cin,
            passport_number = EXCLUDED.passport_number,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            birth_date = EXCLUDED.birth_date,
            gender_code = EXCLUDED.gender_code,
            nationality = EXCLUDED.nationality
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
                n.label AS skill_node_label,
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
            l.level,
            l.evidence,
            l.created_at,
            l.updated_at
        FROM aneti.job_seeker_language l
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
