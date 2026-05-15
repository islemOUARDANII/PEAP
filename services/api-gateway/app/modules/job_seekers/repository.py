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

            rv_gender.code AS gender_code,
            COALESCE(rv_gender.label_fr, rv_gender.label, rv_gender.code) AS gender_label,

            rv_htype.code AS code_handicap,
            COALESCE(rv_htype.label_fr, rv_htype.label, rv_htype.code) AS handicap_label,

            rv_hdeg.code AS code_degre_handicap,
            COALESCE(rv_hdeg.label_fr, rv_hdeg.label, rv_hdeg.code) AS degre_handicap_label,

            i.nationality,
            i.nationality_country_id::text                   AS nationality_country_id,
            COALESCE(nc.name_fr, nc.name_en, nc.iso2)        AS nationality_country_label
        FROM aneti.job_seeker_identity i

        LEFT JOIN geo.country nc
            ON nc.id = i.nationality_country_id

        LEFT JOIN reference.ref_value rv_gender
            ON rv_gender.id = i.gender_ref_id
        LEFT JOIN reference.ref_group rg_gender
            ON rg_gender.id = rv_gender.group_id
        AND rg_gender.code = 'GENDER'

        LEFT JOIN reference.ref_value rv_htype
            ON rv_htype.id = i.handicap_type_ref_id
        LEFT JOIN reference.ref_group rg_htype
            ON rg_htype.id = rv_htype.group_id
        AND rg_htype.code = 'HANDICAP_TYPE'

        LEFT JOIN reference.ref_value rv_hdeg
            ON rv_hdeg.id = i.handicap_degree_ref_id
        LEFT JOIN reference.ref_group rg_hdeg
            ON rg_hdeg.id = rv_hdeg.group_id
        AND rg_hdeg.code = 'HANDICAP_DEGREE'

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
            nationality,
            nationality_country_id,
            gender_ref_id,
            handicap_type_ref_id,
            handicap_degree_ref_id
        )
        VALUES (
            CAST(:job_seeker_id AS uuid),
            :cin,
            :passport_number,
            :first_name,
            :last_name,
            :birth_date,
            :nationality,
            CASE
                WHEN :nationality_country_id IS NOT NULL AND :nationality_country_id != ''
                    THEN CAST(:nationality_country_id AS uuid)
                ELSE (
                    SELECT c.id FROM geo.country c
                    WHERE c.iso2 = :nationality
                    LIMIT 1
                )
            END,
            (
                SELECT rv.id
                FROM reference.ref_value rv
                JOIN reference.ref_group rg ON rg.id = rv.group_id
                WHERE rg.code = 'GENDER'
                AND rv.code = :gender_code
                LIMIT 1
            ),
            (
                SELECT rv.id
                FROM reference.ref_value rv
                JOIN reference.ref_group rg ON rg.id = rv.group_id
                WHERE rg.code IN ('HANDICAP_TYPE', 'TYPE_HANDICAP')
                AND rv.code = :code_handicap
                LIMIT 1
            ),
            (
                SELECT rv.id
                FROM reference.ref_value rv
                JOIN reference.ref_group rg ON rg.id = rv.group_id
                WHERE rg.code IN ('HANDICAP_DEGREE', 'DEGRE_HANDICAP')
                AND rv.code = :code_degre_handicap
                LIMIT 1
            )
        )
        ON CONFLICT (job_seeker_id)
        DO UPDATE SET
            cin                     = EXCLUDED.cin,
            passport_number         = EXCLUDED.passport_number,
            first_name              = EXCLUDED.first_name,
            last_name               = EXCLUDED.last_name,
            birth_date              = EXCLUDED.birth_date,
            nationality             = EXCLUDED.nationality,
            nationality_country_id  = EXCLUDED.nationality_country_id,
            gender_ref_id           = EXCLUDED.gender_ref_id,
            handicap_type_ref_id    = EXCLUDED.handicap_type_ref_id,
            handicap_degree_ref_id  = EXCLUDED.handicap_degree_ref_id
        RETURNING id::text AS id;
        """,
        {
            "job_seeker_id": job_seeker_id,
            "cin": params.get("cin"),
            "passport_number": params.get("passport_number"),
            "first_name": params.get("first_name"),
            "last_name": params.get("last_name"),
            "birth_date": params.get("birth_date"),
            "nationality": params.get("nationality"),
            "nationality_country_id": str(params.get("nationality_country_id") or "") or None,
            "gender_code": params.get("gender_code"),
            "code_handicap": params.get("code_handicap"),
            "code_degre_handicap": params.get("code_degre_handicap"),
        },
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

            gov.code AS governorate_code,
            COALESCE(gov.label_fr, gov.label_en, gov.label, gov.code) AS governorate_label,

            del.code AS delegation_code,
            COALESCE(del.label_fr, del.label_en, del.label, del.code) AS delegation_label

        FROM aneti.job_seeker_contact c

        LEFT JOIN geo.admin_unit gov
            ON gov.id = c.governorate_unit_id

        LEFT JOIN geo.country gov_country
            ON gov_country.id = gov.country_id
        AND gov_country.iso2 = 'TN'

        LEFT JOIN geo.admin_unit del
            ON del.id = c.delegation_unit_id

        LEFT JOIN geo.country del_country
            ON del_country.id = del.country_id
        AND del_country.iso2 = 'TN'

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
            country,
            governorate_unit_id,
            delegation_unit_id
        )
        VALUES (
            CAST(:job_seeker_id AS uuid),
            :email,
            :phone,
            :address,
            :country,
            (
                SELECT au.id
                FROM geo.admin_unit au
                JOIN geo.country cn ON cn.id = au.country_id
                WHERE cn.iso2 = COALESCE(NULLIF(:country, ''), 'TN')
                  AND au.admin_level = 1
                  AND (
                        au.code = :governorate_code
                        OR au.metadata_json->>'admin1_code' = :governorate_code
                  )
                LIMIT 1
            ),
            (
                SELECT au.id
                FROM geo.admin_unit au
                JOIN geo.country cn ON cn.id = au.country_id
                WHERE cn.iso2 = COALESCE(NULLIF(:country, ''), 'TN')
                  AND au.admin_level = 2
                  AND (
                        au.code = :delegation_code
                        OR au.metadata_json->>'admin2_code' = :delegation_code
                  )
                LIMIT 1
            )
        )
        ON CONFLICT (job_seeker_id)
        DO UPDATE SET
            email               = EXCLUDED.email,
            phone               = EXCLUDED.phone,
            address             = EXCLUDED.address,
            country             = EXCLUDED.country,
            governorate_unit_id = EXCLUDED.governorate_unit_id,
            delegation_unit_id  = EXCLUDED.delegation_unit_id
        RETURNING id::text AS id;
        """,
        {
            "job_seeker_id": job_seeker_id,
            "email": params.get("email"),
            "phone": params.get("phone"),
            "address": params.get("address"),
            "country": params.get("country") or "TN",
            "governorate_code": params.get("governorate_code"),
            "delegation_code": params.get("delegation_code"),
        },
    )


def list_education(db: Session, job_seeker_id: str) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            e.id::text AS id,

            e.level_ref_id::text                                                            AS level_ref_id,
            rv_level.code                                                                   AS level_code,
            COALESCE(rv_level.label_fr, rv_level.label_en, rv_level.label, rv_level.code)  AS level_label,

            e.diploma_ref_id::text                                                          AS diploma_ref_id,
            rv_diploma.code                                                                 AS diploma_code,
            COALESCE(rv_diploma.label_fr, rv_diploma.label_en, rv_diploma.label,
                     rv_diploma.code, e.diploma_label)                                      AS diploma_label,

            e.specialty_ref_id::text                                                        AS specialty_ref_id,
            rv_specialty.code                                                               AS specialty_code,
            COALESCE(rv_specialty.label_fr, rv_specialty.label_en, rv_specialty.label,
                     rv_specialty.code, e.specialty)                                        AS specialty,

            e.institution,
            e.graduation_year,
            e.rtmc_education_node_id::text AS rtmc_education_node_id,
            e.created_at,
            e.updated_at

        FROM aneti.job_seeker_education e

        LEFT JOIN reference.ref_value rv_level
            ON rv_level.id = e.level_ref_id

        LEFT JOIN reference.ref_value rv_diploma
            ON rv_diploma.id = e.diploma_ref_id

        LEFT JOIN reference.ref_value rv_specialty
            ON rv_specialty.id = e.specialty_ref_id

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
            institution,
            graduation_year,
            rtmc_education_node_id,
            level_ref_id,
            diploma_ref_id,
            specialty_ref_id
        )
        VALUES (
            CAST(:job_seeker_id AS uuid),
            :institution,
            :graduation_year,
            CASE
                WHEN :rtmc_education_node_id IS NULL OR :rtmc_education_node_id = ''
                    THEN NULL
                ELSE CAST(:rtmc_education_node_id AS uuid)
            END,
            COALESCE(
                CASE WHEN :level_ref_id IS NOT NULL AND :level_ref_id != ''
                     THEN CAST(:level_ref_id AS uuid) END,
                (SELECT rv.id FROM reference.ref_value rv
                 JOIN reference.ref_group rg ON rg.id = rv.group_id
                 WHERE rg.code IN ('EDUCATION_LEVEL','NIVEAU_INSTRUCTION','DIPLOMA_LEVEL')
                   AND rv.code = :level_code LIMIT 1)
            ),
            COALESCE(
                CASE WHEN :diploma_ref_id IS NOT NULL AND :diploma_ref_id != ''
                     THEN CAST(:diploma_ref_id AS uuid) END,
                (SELECT rv.id FROM reference.ref_value rv
                 JOIN reference.ref_group rg ON rg.id = rv.group_id
                 WHERE rg.code = 'DIPLOMA' AND rv.code = :diploma_code LIMIT 1)
            ),
            COALESCE(
                CASE WHEN :specialty_ref_id IS NOT NULL AND :specialty_ref_id != ''
                     THEN CAST(:specialty_ref_id AS uuid) END,
                (SELECT rv.id FROM reference.ref_value rv
                 JOIN reference.ref_group rg ON rg.id = rv.group_id
                 WHERE rg.code = 'SPECIALTY' AND rv.code = :specialty_code LIMIT 1)
            )
        )
        RETURNING id::text AS id;
        """,
        {
            "job_seeker_id": job_seeker_id,
            "level_code":      params.get("level_code"),
            "level_ref_id":    str(params.get("level_ref_id") or "") or None,
            "diploma_code":    params.get("diploma_code"),
            "diploma_ref_id":  str(params.get("diploma_ref_id") or "") or None,
            "specialty_code":  params.get("specialty_code"),
            "specialty_ref_id": str(params.get("specialty_ref_id") or "") or None,
            "institution":     params.get("institution"),
            "graduation_year": params.get("graduation_year"),
            "rtmc_education_node_id": params.get("rtmc_education_node_id"),
        },
    )


def update_education(
    db: Session,
    job_seeker_id: str,
    education_id: str,
    payload: Mapping[str, object],
) -> dict | None:
    params = dict(payload)

    return _fetch_one(
        db,
        """
        UPDATE aneti.job_seeker_education
        SET
            institution            = :institution,
            graduation_year        = :graduation_year,
            rtmc_education_node_id = CASE
                WHEN :rtmc_education_node_id IS NULL OR :rtmc_education_node_id = ''
                    THEN NULL
                ELSE CAST(:rtmc_education_node_id AS uuid)
            END,
            level_ref_id = COALESCE(
                CASE WHEN :level_ref_id IS NOT NULL AND :level_ref_id != ''
                     THEN CAST(:level_ref_id AS uuid) END,
                (SELECT rv.id FROM reference.ref_value rv
                 JOIN reference.ref_group rg ON rg.id = rv.group_id
                 WHERE rg.code IN ('EDUCATION_LEVEL','NIVEAU_INSTRUCTION','DIPLOMA_LEVEL')
                   AND rv.code = :level_code LIMIT 1)
            ),
            diploma_ref_id = COALESCE(
                CASE WHEN :diploma_ref_id IS NOT NULL AND :diploma_ref_id != ''
                     THEN CAST(:diploma_ref_id AS uuid) END,
                (SELECT rv.id FROM reference.ref_value rv
                 JOIN reference.ref_group rg ON rg.id = rv.group_id
                 WHERE rg.code = 'DIPLOMA' AND rv.code = :diploma_code LIMIT 1)
            ),
            specialty_ref_id = COALESCE(
                CASE WHEN :specialty_ref_id IS NOT NULL AND :specialty_ref_id != ''
                     THEN CAST(:specialty_ref_id AS uuid) END,
                (SELECT rv.id FROM reference.ref_value rv
                 JOIN reference.ref_group rg ON rg.id = rv.group_id
                 WHERE rg.code = 'SPECIALTY' AND rv.code = :specialty_code LIMIT 1)
            )
        WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)
          AND id = CAST(:education_id AS uuid)
        RETURNING id::text AS id;
        """,
        {
            "job_seeker_id":    job_seeker_id,
            "education_id":     education_id,
            "level_code":       params.get("level_code"),
            "level_ref_id":     str(params.get("level_ref_id") or "") or None,
            "diploma_code":     params.get("diploma_code"),
            "diploma_ref_id":   str(params.get("diploma_ref_id") or "") or None,
            "specialty_code":   params.get("specialty_code"),
            "specialty_ref_id": str(params.get("specialty_ref_id") or "") or None,
            "institution":      params.get("institution"),
            "graduation_year":  params.get("graduation_year"),
            "rtmc_education_node_id": params.get("rtmc_education_node_id"),
        },
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
            e.id::text                  AS id,
            e.occupation_id::text       AS occupation_id,
            e.occupation_node_id::text  AS occupation_node_id,
            occ.preferred_label         AS occupation_label,

            e.job_title_raw,
            e.company_name,

            e.sector,
            e.sector_ref_id::text       AS sector_ref_id,
            COALESCE(rv_sector.label_fr, rv_sector.label, rv_sector.code, e.sector) AS sector_label,

            e.start_date,
            e.end_date,
            e.duration_months,
            -- is_current: true when end_date is null and start_date is set
            (e.end_date IS NULL AND e.start_date IS NOT NULL) AS is_current,
            e.description,
            e.created_at,
            e.updated_at
        FROM aneti.job_seeker_experience e
        LEFT JOIN reference.ref_value rv_sector
            ON rv_sector.id = e.sector_ref_id
        LEFT JOIN taxonomy.taxonomy_node occ
            ON occ.id = e.occupation_node_id
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
            occupation_node_id,
            job_title_raw,
            company_name,
            sector,
            sector_ref_id,
            start_date,
            end_date,
            duration_months,
            description
        )
        VALUES (
            CAST(:job_seeker_id AS uuid),
            CASE WHEN :occupation_id IS NOT NULL AND :occupation_id != ''
                 THEN CAST(:occupation_id AS uuid) END,
            COALESCE(
                CASE WHEN :occupation_node_id IS NOT NULL AND :occupation_node_id != ''
                     THEN CAST(:occupation_node_id AS uuid) END,
                (SELECT tn.id FROM taxonomy.taxonomy_node tn
                 JOIN taxonomy.taxonomy_model tm ON tm.id = tn.model_id
                 WHERE tm.code = 'RTMC' AND tn.node_type = 'OCCUPATION'
                   AND tn.id = CAST(:occupation_id AS uuid) LIMIT 1)
            ),
            :job_title_raw,
            :company_name,
            :sector,
            COALESCE(
                CASE WHEN :sector_ref_id IS NOT NULL AND :sector_ref_id != ''
                     THEN CAST(:sector_ref_id AS uuid) END,
                (SELECT rv.id FROM reference.ref_value rv
                 JOIN reference.ref_group rg ON rg.id = rv.group_id
                 WHERE rg.code = 'ACTIVITY_SECTOR' AND rv.code = :sector LIMIT 1)
            ),
            :start_date,
            CASE WHEN :is_current THEN NULL ELSE :end_date END,
            COALESCE(
                :duration_months,
                CASE
                    WHEN :start_date IS NOT NULL
                    THEN GREATEST(0,
                        (DATE_PART('year', COALESCE(CASE WHEN :is_current THEN NULL END, :end_date::date, now()::date))
                        - DATE_PART('year', :start_date::date)) * 12
                        + DATE_PART('month', COALESCE(CASE WHEN :is_current THEN NULL END, :end_date::date, now()::date))
                        - DATE_PART('month', :start_date::date))::int
                END
            ),
            :description
        )
        RETURNING id::text AS id;
        """,
        {
            "job_seeker_id":      params.get("job_seeker_id"),
            "occupation_id":      str(params.get("occupation_id") or "") or None,
            "occupation_node_id": str(params.get("occupation_node_id") or "") or None,
            "job_title_raw":      params.get("job_title_raw"),
            "company_name":       params.get("company_name"),
            "sector":             params.get("sector"),
            "sector_ref_id":      str(params.get("sector_ref_id") or "") or None,
            "start_date":         params.get("start_date"),
            "end_date":           params.get("end_date"),
            "is_current":         bool(params.get("is_current", False)),
            "duration_months":    params.get("duration_months"),
            "description":        params.get("description"),
        },
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
            occupation_id      = CASE WHEN :occupation_id IS NOT NULL AND :occupation_id != ''
                                      THEN CAST(:occupation_id AS uuid) END,
            occupation_node_id = COALESCE(
                CASE WHEN :occupation_node_id IS NOT NULL AND :occupation_node_id != ''
                     THEN CAST(:occupation_node_id AS uuid) END,
                occupation_node_id
            ),
            job_title_raw      = :job_title_raw,
            company_name       = :company_name,
            sector             = :sector,
            sector_ref_id      = COALESCE(
                CASE WHEN :sector_ref_id IS NOT NULL AND :sector_ref_id != ''
                     THEN CAST(:sector_ref_id AS uuid) END,
                (SELECT rv.id FROM reference.ref_value rv
                 JOIN reference.ref_group rg ON rg.id = rv.group_id
                 WHERE rg.code = 'ACTIVITY_SECTOR' AND rv.code = :sector LIMIT 1),
                sector_ref_id
            ),
            start_date = CASE
                WHEN :start_date IS NULL THEN NULL::date
                WHEN :start_date = '' THEN NULL::date
                ELSE CAST(:start_date AS date)
            END,
            end_date = CASE
                WHEN :is_current THEN NULL::date
                WHEN :end_date IS NULL THEN NULL::date
                WHEN :end_date = '' THEN NULL::date
                ELSE CAST(:end_date AS date)
            END,
            duration_months = COALESCE(
                :duration_months,
                CASE
                    WHEN :start_date IS NOT NULL AND :start_date <> '' THEN
                        GREATEST(
                            0,
                            (
                                DATE_PART(
                                    'year',
                                    CASE
                                        WHEN :is_current THEN CURRENT_DATE
                                        WHEN :end_date IS NULL OR :end_date = '' THEN CURRENT_DATE
                                        ELSE CAST(:end_date AS date)
                                    END
                                )
                                - DATE_PART('year', CAST(:start_date AS date))
                            ) * 12
                            +
                            (
                                DATE_PART(
                                    'month',
                                    CASE
                                        WHEN :is_current THEN CURRENT_DATE
                                        WHEN :end_date IS NULL OR :end_date = '' THEN CURRENT_DATE
                                        ELSE CAST(:end_date AS date)
                                    END
                                )
                                - DATE_PART('month', CAST(:start_date AS date))
                            )
                        )::int
                    ELSE NULL
                END
            ),
            description        = :description
        WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)
          AND id = CAST(:experience_id AS uuid)
        RETURNING id::text AS id;
        """,
        {
            "job_seeker_id":      params.get("job_seeker_id"),
            "experience_id":      params.get("experience_id"),
            "occupation_id":      str(params.get("occupation_id") or "") or None,
            "occupation_node_id": str(params.get("occupation_node_id") or "") or None,
            "job_title_raw":      params.get("job_title_raw"),
            "company_name":       params.get("company_name"),
            "sector":             params.get("sector"),
            "sector_ref_id":      str(params.get("sector_ref_id") or "") or None,
            "start_date":         params.get("start_date"),
            "end_date":           params.get("end_date"),
            "is_current":         bool(params.get("is_current", False)),
            "duration_months":    params.get("duration_months"),
            "description":        params.get("description"),
        },
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
                s.id::text                 AS id,
                s.skill_id::text           AS skill_id,
                COALESCE(s.skill_node_id, s.skill_id)::text AS skill_node_id,
                s.skill_label_raw,
                n.preferred_label          AS skill_node_label,
                n.node_type                AS skill_node_type,
                s.level,
                s.years,
                s.evidence,
                s.source,
                s.created_at,
                s.updated_at
            FROM aneti.job_seeker_skill s
            LEFT JOIN taxonomy.taxonomy_node n
                ON n.id = COALESCE(s.skill_node_id, s.skill_id)
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
            skill_node_id,
            skill_label_raw,
            level,
            years,
            evidence,
            source
        )
        VALUES (
            CAST(:job_seeker_id AS uuid),
            CASE WHEN :skill_id IS NOT NULL AND :skill_id != ''
                 THEN CAST(:skill_id AS uuid) END,
            CASE WHEN :skill_node_id IS NOT NULL AND :skill_node_id != ''
                 THEN CAST(:skill_node_id AS uuid)
                 WHEN :skill_id IS NOT NULL AND :skill_id != ''
                 THEN CAST(:skill_id AS uuid) END,
            :skill_label_raw,
            :level,
            :years,
            :evidence,
            :source
        )
        RETURNING id::text AS id;
        """,
        {
            "job_seeker_id":  params.get("job_seeker_id"),
            "skill_id":       str(params.get("skill_id") or "") or None,
            "skill_node_id":  str(params.get("skill_node_id") or "") or None,
            "skill_label_raw": params.get("skill_label_raw"),
            "level":          params.get("level"),
            "years":          params.get("years"),
            "evidence":       params.get("evidence"),
            "source":         params.get("source"),
        },
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
            skill_id        = CASE WHEN :skill_id IS NOT NULL AND :skill_id != ''
                                   THEN CAST(:skill_id AS uuid) END,
            skill_node_id   = COALESCE(
                CASE WHEN :skill_node_id IS NOT NULL AND :skill_node_id != ''
                     THEN CAST(:skill_node_id AS uuid) END,
                CASE WHEN :skill_id IS NOT NULL AND :skill_id != ''
                     THEN CAST(:skill_id AS uuid) END,
                skill_node_id
            ),
            skill_label_raw = :skill_label_raw,
            level           = :level,
            years           = :years,
            evidence        = :evidence,
            source          = :source
        WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)
          AND id = CAST(:skill_row_id AS uuid)
        RETURNING id::text AS id;
        """,
        {
            "job_seeker_id":  params.get("job_seeker_id"),
            "skill_row_id":   params.get("skill_row_id"),
            "skill_id":       str(params.get("skill_id") or "") or None,
            "skill_node_id":  str(params.get("skill_node_id") or "") or None,
            "skill_label_raw": params.get("skill_label_raw"),
            "level":          params.get("level"),
            "years":          params.get("years"),
            "evidence":       params.get("evidence"),
            "source":         params.get("source"),
        },
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

            rv_lang.code AS language_code,
            COALESCE(rv_lang.label_fr, rv_lang.label, rv_lang.code) AS language_label_fr,
            COALESCE(rv_lang.label_en, rv_lang.label, rv_lang.code) AS language_label_en,

            rv_level.code AS level,
            COALESCE(rv_level.label_fr, rv_level.label, rv_level.code) AS level_label_fr,
            COALESCE(rv_level.label_en, rv_level.label, rv_level.code) AS level_label_en,

            l.evidence,
            l.created_at,
            l.updated_at
        FROM aneti.job_seeker_language l

        LEFT JOIN reference.ref_value rv_lang
            ON rv_lang.id = l.language_ref_id
        LEFT JOIN reference.ref_group rg_lang
            ON rg_lang.id = rv_lang.group_id
        AND rg_lang.code = 'LANGUAGE'

        LEFT JOIN reference.ref_value rv_level
            ON rv_level.id = l.level_ref_id
        LEFT JOIN reference.ref_group rg_level
            ON rg_level.id = rv_level.group_id
        AND rg_level.code = 'LANGUAGE_LEVEL'

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
            evidence,
            language_ref_id,
            level_ref_id
        )
        VALUES (
            CAST(:job_seeker_id AS uuid),
            :evidence,
            (
                SELECT rv.id
                FROM reference.ref_value rv
                JOIN reference.ref_group rg ON rg.id = rv.group_id
                WHERE rg.code = 'LANGUAGE'
                  AND rv.code = :language_code
                LIMIT 1
            ),
            (
                SELECT rv.id
                FROM reference.ref_value rv
                JOIN reference.ref_group rg ON rg.id = rv.group_id
                WHERE rg.code = 'LANGUAGE_LEVEL'
                  AND rv.code = :level
                LIMIT 1
            )
        )
        RETURNING id::text AS id;
        """,
        {
            "job_seeker_id": job_seeker_id,
            "language_code": params.get("language_code"),
            "level": params.get("level"),
            "evidence": params.get("evidence"),
        },
    )


def update_language(
    db: Session,
    job_seeker_id: str,
    language_id: str,
    payload: Mapping[str, object],
) -> dict | None:
    params = dict(payload)

    return _fetch_one(
        db,
        """
        UPDATE aneti.job_seeker_language
        SET
            evidence = :evidence,
            language_ref_id = (
                SELECT rv.id
                FROM reference.ref_value rv
                JOIN reference.ref_group rg ON rg.id = rv.group_id
                WHERE rg.code = 'LANGUAGE'
                  AND rv.code = :language_code
                LIMIT 1
            ),
            level_ref_id = (
                SELECT rv.id
                FROM reference.ref_value rv
                JOIN reference.ref_group rg ON rg.id = rv.group_id
                WHERE rg.code = 'LANGUAGE_LEVEL'
                  AND rv.code = :level
                LIMIT 1
            )
        WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)
          AND id = CAST(:language_id AS uuid)
        RETURNING id::text AS id;
        """,
        {
            "job_seeker_id": job_seeker_id,
            "language_id": language_id,
            "language_code": params.get("language_code"),
            "level": params.get("level"),
            "evidence": params.get("evidence"),
        },
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

            rv_contract.code AS preferred_contract_type,

            gov.code AS preferred_governorate,
            COALESCE(gov.label_fr, gov.label, gov.code) AS preferred_governorate_label,

            p.mobility_radius_km,
            p.accepts_relocation,
            p.desired_salary_min,
            p.desired_salary_max
        FROM aneti.job_seeker_preference p

        LEFT JOIN reference.ref_value rv_contract
            ON rv_contract.id = p.preferred_contract_type_ref_id
        LEFT JOIN reference.ref_group rg_contract
            ON rg_contract.id = rv_contract.group_id
        AND rg_contract.code = 'CONTRACT_TYPE'

        LEFT JOIN geo.admin_unit gov
            ON gov.id = p.preferred_governorate_unit_id
        LEFT JOIN geo.country c
            ON c.id = gov.country_id
        AND c.iso2 = 'TN'

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
            mobility_radius_km,
            accepts_relocation,
            desired_salary_min,
            desired_salary_max,
            preferred_governorate_unit_id,
            preferred_contract_type_ref_id
        )
        VALUES (
            CAST(:job_seeker_id AS uuid),
            :mobility_radius_km,
            :accepts_relocation,
            :desired_salary_min,
            :desired_salary_max,
            (
                SELECT au.id
                FROM geo.admin_unit au
                JOIN geo.country cn ON cn.id = au.country_id
                WHERE cn.iso2 = 'TN'
                  AND au.admin_level = 1
                  AND (
                        au.code = :preferred_governorate
                        OR au.metadata_json->>'admin1_code' = :preferred_governorate
                  )
                LIMIT 1
            ),
            (
                SELECT rv.id
                FROM reference.ref_value rv
                JOIN reference.ref_group rg ON rg.id = rv.group_id
                WHERE rg.code = 'CONTRACT_TYPE'
                  AND rv.code = :preferred_contract_type
                LIMIT 1
            )
        )
        ON CONFLICT (job_seeker_id)
        DO UPDATE SET
            mobility_radius_km             = EXCLUDED.mobility_radius_km,
            accepts_relocation             = EXCLUDED.accepts_relocation,
            desired_salary_min             = EXCLUDED.desired_salary_min,
            desired_salary_max             = EXCLUDED.desired_salary_max,
            preferred_governorate_unit_id  = EXCLUDED.preferred_governorate_unit_id,
            preferred_contract_type_ref_id = EXCLUDED.preferred_contract_type_ref_id
        RETURNING id::text AS id;
        """,
        {
            "job_seeker_id": job_seeker_id,
            "preferred_contract_type": params.get("preferred_contract_type"),
            "preferred_governorate": params.get("preferred_governorate"),
            "mobility_radius_km": params.get("mobility_radius_km"),
            "accepts_relocation": params.get("accepts_relocation"),
            "desired_salary_min": params.get("desired_salary_min"),
            "desired_salary_max": params.get("desired_salary_max"),
        },
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
        filters.append("gov.code = :governorate_code")
        params["governorate_code"] = governorate_code

    if delegation_code:
        filters.append("del_unit.code = :delegation_code")
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

            gov.code AS governorate_code,
            COALESCE(gov.label_fr, gov.label_en, gov.label, gov.code) AS governorate_label,

            del_unit.code AS delegation_code,
            COALESCE(del_unit.label_fr, del_unit.label_en, del_unit.label, del_unit.code) AS delegation_label,

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
        LEFT JOIN geo.admin_unit gov
            ON gov.id = c.governorate_unit_id
        LEFT JOIN geo.admin_unit del_unit
            ON del_unit.id = c.delegation_unit_id
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
            jo_gov.label AS governorate_label,
            jo.delegation_code,
            jo_del.label AS delegation_label,
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
        LEFT JOIN LATERAL (
            SELECT au.label
            FROM geo.admin_unit au
            JOIN geo.country cn ON cn.id = au.country_id
            WHERE cn.iso2 = 'TN'
              AND au.admin_level = 1
              AND au.code = jo.governorate_code
            LIMIT 1
        ) jo_gov ON TRUE
        LEFT JOIN LATERAL (
            SELECT au.label
            FROM geo.admin_unit au
            JOIN geo.country cn ON cn.id = au.country_id
            WHERE cn.iso2 = 'TN'
              AND au.admin_level = 2
              AND au.code = jo.delegation_code
            LIMIT 1
        ) jo_del ON TRUE
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
            SELECT updated_at FROM aneti.job_seeker
            WHERE id = CAST(:job_seeker_id AS uuid)
            UNION ALL
            SELECT updated_at FROM aneti.job_seeker_skill
            WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)
            UNION ALL
            SELECT updated_at FROM aneti.job_seeker_language
            WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)
            UNION ALL
            SELECT updated_at FROM aneti.job_seeker_education
            WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)
            UNION ALL
            SELECT updated_at FROM aneti.job_seeker_experience
            WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)
            UNION ALL
            SELECT updated_at FROM aneti.job_seeker_preference
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
            JOIN aneti.job_offer o ON o.id = r.offer_id
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
    return {"min_offer_score_threshold": min_offer_score_threshold}


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
            cover_message      = COALESCE(EXCLUDED.cover_message, aneti.job_application.cover_message),
            status             = 'APPLIED',
            updated_at         = now()
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


# ─── Aggregate profile version ────────────────────────────────────────────────
#
# MIGRATION REQUIRED (run once before using the aggregate profile endpoints):
#   ALTER TABLE aneti.job_seeker
#       ADD COLUMN IF NOT EXISTS profile_version INTEGER NOT NULL DEFAULT 1;
#

def get_profile_version(db: Session, job_seeker_id: str) -> int:
    row = _fetch_one(
        db,
        """
        SELECT COALESCE(profile_version, 1)::int AS profile_version
        FROM aneti.job_seeker
        WHERE id = CAST(:job_seeker_id AS uuid)
        LIMIT 1;
        """,
        {"job_seeker_id": job_seeker_id},
    )
    return int(row["profile_version"]) if row else 1


def increment_profile_version(db: Session, job_seeker_id: str) -> int:
    """Atomically increment profile_version and return the new value.
    Must be called inside the same transaction as the profile writes."""
    row = _fetch_one(
        db,
        """
        UPDATE aneti.job_seeker
        SET profile_version = COALESCE(profile_version, 0) + 1
        WHERE id = CAST(:job_seeker_id AS uuid)
        RETURNING profile_version::int AS profile_version;
        """,
        {"job_seeker_id": job_seeker_id},
    )
    return int(row["profile_version"]) if row else 1
