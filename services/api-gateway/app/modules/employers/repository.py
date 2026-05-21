from collections.abc import Mapping

from sqlalchemy import text
from sqlalchemy.orm import Session


def _fetch_one(db: Session, query: str, params: dict | None = None) -> dict | None:
    row = db.execute(text(query), params or {}).mappings().first()
    return dict(row) if row else None


def _fetch_all(db: Session, query: str, params: dict | None = None) -> list[dict]:
    rows = db.execute(text(query), params or {}).mappings().all()
    return [dict(row) for row in rows]


def get_employer_by_id(db: Session, employer_id: str) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            e.id::text AS id,
            e.user_id::text AS user_id,
            e.legal_name,
            e.commercial_name,
            e.tax_identifier,

            e.sector_ref_id::text AS sector_ref_id,
            rv_sector.code AS sector_code,
            COALESCE(
                rv_sector.label_fr,
                rv_sector.label_en,
                rv_sector.label,
                rv_sector.code
            ) AS sector_label,

            e.size_category_ref_id::text AS size_category_ref_id,
            rv_size.code AS size_category_code,

            -- Alias de compatibilité pour service.py
            rv_size.code AS size_category,

            COALESCE(
                rv_size.label_fr,
                rv_size.label_en,
                rv_size.label,
                rv_size.code
            ) AS size_category_label,

            e.website_url,
            e.status,
            e.created_at,
            e.updated_at

        FROM aneti.employer e

        LEFT JOIN reference.ref_value rv_sector
            ON rv_sector.id = e.sector_ref_id

        LEFT JOIN reference.ref_value rv_size
            ON rv_size.id = e.size_category_ref_id

        WHERE e.id = CAST(:employer_id AS uuid)
        LIMIT 1;
        """,
        {"employer_id": employer_id},
    )


def update_employer(db: Session, employer_id: str, payload: Mapping[str, object]) -> dict | None:
    params = dict(payload)
    params["employer_id"] = employer_id
    return _fetch_one(
        db,
        """
        UPDATE aneti.employer
        SET
            legal_name      = :legal_name,
            commercial_name = :commercial_name,
            tax_identifier  = :tax_identifier,
            sector_code     = :sector_code,
            size_category   = :size_category,
            website_url     = :website_url
        WHERE id = CAST(:employer_id AS uuid)
        RETURNING id::text AS id;
        """,
        params,
    )


def get_employer_contact(db: Session, employer_id: str) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            c.id::text AS id,

            COALESCE(
                NULLIF(
                    trim(
                        COALESCE(c.contact_first_name, '') || ' ' || COALESCE(c.contact_last_name, '')
                    ),
                    ''
                ),
                ''
            ) AS contact_name,

            COALESCE(c.contact_first_name, '') AS contact_first_name,
            COALESCE(c.contact_last_name, '') AS contact_last_name,

            c.contact_position_ref_id::text AS contact_position_ref_id,

            COALESCE(rv_position.code, '') AS contact_position_code,

            COALESCE(
                rv_position.label_fr,
                rv_position.label_en,
                rv_position.label,
                rv_position.code,
                ''
            ) AS job_title,

            COALESCE(c.email, '') AS email,

            COALESCE(c.mobile_phone, '') AS phone,
            COALESCE(c.mobile_phone, '') AS mobile_phone,

            COALESCE(c.is_account_creator, false) AS is_account_creator,

            c.created_at,
            c.updated_at

        FROM aneti.employer_contact c

        LEFT JOIN reference.ref_value rv_position
            ON rv_position.id = c.contact_position_ref_id

        WHERE c.employer_id = CAST(:employer_id AS uuid)
        ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC
        LIMIT 1;
        """,
        {"employer_id": employer_id},
    )


def upsert_employer_contact(db: Session, employer_id: str, payload: Mapping[str, object]) -> dict:
    params = dict(payload)
    params["employer_id"] = employer_id

    contact_name = str(params.get("contact_name") or "").strip()
    first_name = params.get("contact_first_name")
    last_name = params.get("contact_last_name")

    if (not first_name or not last_name) and contact_name:
        parts = contact_name.split(" ", 1)
        first_name = first_name or parts[0]
        last_name = last_name or (parts[1] if len(parts) > 1 else "")

    return _fetch_one(
        db,
        """
        INSERT INTO aneti.employer_contact (
            employer_id,
            contact_first_name,
            contact_last_name,
            contact_position_ref_id,
            email,
            mobile_phone,
            is_account_creator
        )
        VALUES (
            CAST(:employer_id AS uuid),
            :contact_first_name,
            :contact_last_name,
            COALESCE(
                CASE
                    WHEN :contact_position_ref_id IS NOT NULL
                     AND :contact_position_ref_id != ''
                    THEN CAST(:contact_position_ref_id AS uuid)
                END,
                (
                    SELECT rv.id
                    FROM reference.ref_value rv
                    JOIN reference.ref_group rg
                        ON rg.id = rv.group_id
                    WHERE rg.code IN ('CONTACT_POSITION', 'LEGAL_REPRESENTATIVE_QUALITY', 'POSITION')
                      AND rv.code = :job_title
                    LIMIT 1
                )
            ),
            :email,
            :mobile_phone,
            COALESCE(:is_account_creator, false)
        )
        ON CONFLICT (employer_id)
        DO UPDATE SET
            contact_first_name = EXCLUDED.contact_first_name,
            contact_last_name = EXCLUDED.contact_last_name,
            contact_position_ref_id = EXCLUDED.contact_position_ref_id,
            email = EXCLUDED.email,
            mobile_phone = EXCLUDED.mobile_phone,
            is_account_creator = EXCLUDED.is_account_creator,
            updated_at = now()
        RETURNING id::text AS id;
        """,
        {
            "employer_id": employer_id,
            "contact_first_name": first_name,
            "contact_last_name": last_name,
            "contact_position_ref_id": str(params.get("contact_position_ref_id") or "") or None,
            "job_title": params.get("job_title") or params.get("contact_position_code"),
            "email": params.get("email"),
            "mobile_phone": params.get("mobile_phone") or params.get("phone"),
            "is_account_creator": params.get("is_account_creator"),
        },
    )


def get_employer_location(db: Session, employer_id: str) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            l.id::text AS id,
            l.address,
            l.country_id::text AS country_id,
            COALESCE(c.iso2, 'TN') AS country,
            l.governorate_unit_id::text AS governorate_unit_id,
            gov.code AS governorate_code,
            COALESCE(gov.label_fr, gov.label_en, gov.label, gov.code) AS governorate_label,
            l.delegation_unit_id::text AS delegation_unit_id,
            del.code AS delegation_code,
            COALESCE(del.label_fr, del.label_en, del.label, del.code) AS delegation_label,
            l.imada_unit_id::text AS imada_unit_id,
            ima.code AS imada_code,
            COALESCE(ima.label_fr, ima.label_en, ima.label, ima.code) AS imada_label,
            l.location_unit_id::text AS location_unit_id,
            loc.code AS location_code,
            COALESCE(loc.label_fr, loc.label_en, loc.label, loc.code) AS location_label,
            l.postal_code_id::text AS postal_code_id,
            l.postal_code,
            l.created_at,
            l.updated_at
        FROM aneti.employer_location l
        LEFT JOIN geo.country c
            ON c.id = l.country_id
        LEFT JOIN geo.admin_unit gov
            ON gov.id = l.governorate_unit_id
        LEFT JOIN geo.admin_unit del
            ON del.id = l.delegation_unit_id
        LEFT JOIN geo.admin_unit ima
            ON ima.id = l.imada_unit_id
        LEFT JOIN geo.admin_unit loc
            ON loc.id = l.location_unit_id
        WHERE l.employer_id = CAST(:employer_id AS uuid)
        ORDER BY l.updated_at DESC
        LIMIT 1;
        """,
        {"employer_id": employer_id},
    )


def upsert_employer_location(db: Session, employer_id: str, payload: Mapping[str, object]) -> dict:
    existing = get_employer_location(db, employer_id)
    params = dict(payload)
    params["employer_id"] = employer_id

    # Normalisation des IDs (str ou None)
    gov_id   = str(params.get("governorate_unit_id") or "") or None
    del_id   = str(params.get("delegation_unit_id")  or "") or None
    ima_id   = str(params.get("imada_unit_id")        or "") or None
    loc_id   = str(params.get("location_unit_id")    or "") or None
    pc_id    = str(params.get("postal_code_id")       or "") or None
    cnt_id   = str(params.get("country_id")           or "") or None

    if existing:
        params["location_id"] = existing["id"]
        return _fetch_one(
            db,
            """
            UPDATE aneti.employer_location
            SET
                address             = :address,
                country_id          = COALESCE(
                    CASE WHEN :country_id IS NOT NULL AND :country_id != ''
                         THEN CAST(:country_id AS uuid) END,
                    (SELECT c.id FROM geo.country c
                     WHERE c.iso2 = COALESCE(NULLIF(:country, ''), 'TN') LIMIT 1)
                ),
                governorate_unit_id = COALESCE(
                    CASE WHEN :governorate_unit_id IS NOT NULL AND :governorate_unit_id != ''
                         THEN CAST(:governorate_unit_id AS uuid) END,
                    (SELECT au.id FROM geo.admin_unit au
                     JOIN geo.country cn ON cn.id = au.country_id
                     WHERE cn.iso2 = COALESCE(NULLIF(:country, ''), 'TN')
                       AND au.admin_level = 1 AND au.code = :governorate_code
                     LIMIT 1)
                ),
                delegation_unit_id  = COALESCE(
                    CASE WHEN :delegation_unit_id IS NOT NULL AND :delegation_unit_id != ''
                         THEN CAST(:delegation_unit_id AS uuid) END,
                    (SELECT au.id FROM geo.admin_unit au
                     JOIN geo.country cn ON cn.id = au.country_id
                     WHERE cn.iso2 = COALESCE(NULLIF(:country, ''), 'TN')
                       AND au.admin_level = 2 AND au.code = :delegation_code
                     LIMIT 1)
                ),
                imada_unit_id       = CASE WHEN :imada_unit_id IS NOT NULL AND :imada_unit_id != ''
                                          THEN CAST(:imada_unit_id AS uuid) END,
                location_unit_id    = COALESCE(
                    CASE WHEN :imada_unit_id IS NOT NULL AND :imada_unit_id != ''
                         THEN CAST(:imada_unit_id AS uuid) END,
                    CASE WHEN :location_unit_id IS NOT NULL AND :location_unit_id != ''
                         THEN CAST(:location_unit_id AS uuid) END,
                    CASE WHEN :delegation_unit_id IS NOT NULL AND :delegation_unit_id != ''
                         THEN CAST(:delegation_unit_id AS uuid) END,
                    CASE WHEN :governorate_unit_id IS NOT NULL AND :governorate_unit_id != ''
                         THEN CAST(:governorate_unit_id AS uuid) END
                ),
                postal_code_id      = CASE WHEN :postal_code_id IS NOT NULL AND :postal_code_id != ''
                                          THEN CAST(:postal_code_id AS uuid) END,
                postal_code         = :postal_code,
                updated_at          = now()
            WHERE id = CAST(:location_id AS uuid)
            RETURNING id::text AS id;
            """,
            {
                "location_id":          params["location_id"],
                "address":              params.get("address"),
                "country":              params.get("country") or "TN",
                "country_id":           cnt_id,
                "governorate_unit_id":  gov_id,
                "delegation_unit_id":   del_id,
                "imada_unit_id":        ima_id,
                "location_unit_id":     loc_id,
                "postal_code_id":       pc_id,
                "postal_code":          params.get("postal_code"),
                "governorate_code":     params.get("governorate_code"),
                "delegation_code":      params.get("delegation_code"),
            },
        )

    return _fetch_one(
        db,
        """
        INSERT INTO aneti.employer_location (
            employer_id,
            address,
            country_id,
            governorate_unit_id,
            delegation_unit_id,
            imada_unit_id,
            location_unit_id,
            postal_code_id,
            postal_code
        )
        VALUES (
            CAST(:employer_id AS uuid),
            :address,
            COALESCE(
                CASE WHEN :country_id IS NOT NULL AND :country_id != ''
                     THEN CAST(:country_id AS uuid) END,
                (SELECT c.id FROM geo.country c
                 WHERE c.iso2 = COALESCE(NULLIF(:country, ''), 'TN') LIMIT 1)
            ),
            COALESCE(
                CASE WHEN :governorate_unit_id IS NOT NULL AND :governorate_unit_id != ''
                     THEN CAST(:governorate_unit_id AS uuid) END,
                (SELECT au.id FROM geo.admin_unit au
                 JOIN geo.country cn ON cn.id = au.country_id
                 WHERE cn.iso2 = COALESCE(NULLIF(:country, ''), 'TN')
                   AND au.admin_level = 1 AND au.code = :governorate_code
                 LIMIT 1)
            ),
            COALESCE(
                CASE WHEN :delegation_unit_id IS NOT NULL AND :delegation_unit_id != ''
                     THEN CAST(:delegation_unit_id AS uuid) END,
                (SELECT au.id FROM geo.admin_unit au
                 JOIN geo.country cn ON cn.id = au.country_id
                 WHERE cn.iso2 = COALESCE(NULLIF(:country, ''), 'TN')
                   AND au.admin_level = 2 AND au.code = :delegation_code
                 LIMIT 1)
            ),
            CASE WHEN :imada_unit_id IS NOT NULL AND :imada_unit_id != ''
                 THEN CAST(:imada_unit_id AS uuid) END,
            COALESCE(
                CASE WHEN :imada_unit_id IS NOT NULL AND :imada_unit_id != ''
                     THEN CAST(:imada_unit_id AS uuid) END,
                CASE WHEN :location_unit_id IS NOT NULL AND :location_unit_id != ''
                     THEN CAST(:location_unit_id AS uuid) END,
                CASE WHEN :delegation_unit_id IS NOT NULL AND :delegation_unit_id != ''
                     THEN CAST(:delegation_unit_id AS uuid) END,
                CASE WHEN :governorate_unit_id IS NOT NULL AND :governorate_unit_id != ''
                     THEN CAST(:governorate_unit_id AS uuid) END
            ),
            CASE WHEN :postal_code_id IS NOT NULL AND :postal_code_id != ''
                 THEN CAST(:postal_code_id AS uuid) END,
            :postal_code
        )
        RETURNING id::text AS id;
        """,
        {
            "employer_id":         employer_id,
            "address":             params.get("address"),
            "country":             params.get("country") or "TN",
            "country_id":          cnt_id,
            "governorate_unit_id": gov_id,
            "delegation_unit_id":  del_id,
            "imada_unit_id":       ima_id,
            "location_unit_id":    loc_id,
            "postal_code_id":      pc_id,
            "postal_code":         params.get("postal_code"),
            "governorate_code":    params.get("governorate_code"),
            "delegation_code":     params.get("delegation_code"),
        },
    )


def list_employers(db: Session) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            e.id::text AS id,
            e.legal_name,
            e.commercial_name,
            e.tax_identifier,
            e.sector_code,
            e.size_category,
            e.status,
            gov.code AS governorate_code,
            COALESCE(gov.label_fr, gov.label_en, gov.label, gov.code) AS governorate_label,
            del.code AS delegation_code,
            COALESCE(del.label_fr, del.label_en, del.label, del.code) AS delegation_label,
            e.updated_at
        FROM aneti.employer e
        LEFT JOIN aneti.employer_location l
            ON l.employer_id = e.id
        LEFT JOIN geo.admin_unit gov
            ON gov.id = l.governorate_unit_id
        LEFT JOIN geo.admin_unit del
            ON del.id = l.delegation_unit_id
        ORDER BY e.updated_at DESC;
        """,
    )


def count_employers(db: Session) -> dict:
    return _fetch_one(
        db,
        """
        SELECT COUNT(*)::int AS employers_count
        FROM aneti.employer;
        """,
    )


def list_employer_applications(
    db: Session,
    employer_id: str,
    offer_id: str | None = None,
) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            ja.id::text AS id,
            ja.job_seeker_id::text AS job_seeker_id,
            ja.offer_id::text AS offer_id,
            jo.title AS offer_title,
            jo.aneti_identifier AS offer_aneti_identifier,

            NULLIF(
                TRIM(
                    COALESCE(jsi.first_name, '') || ' ' || COALESCE(jsi.last_name, '')
                ),
                ''
            ) AS candidate_name,

            jsc.email AS candidate_email,
            phone.phone_number AS candidate_phone,

            ja.matching_result_id::text AS matching_result_id,
            ja.status,
            ja.cover_message,
            ja.applied_at,
            ja.updated_at

        FROM aneti.job_application ja

        JOIN aneti.job_offer jo
            ON jo.id = ja.offer_id

        LEFT JOIN aneti.job_seeker_identity jsi
            ON jsi.job_seeker_id = ja.job_seeker_id

        LEFT JOIN aneti.job_seeker_contact jsc
            ON jsc.job_seeker_id = ja.job_seeker_id

        LEFT JOIN LATERAL (
            SELECT p.phone_number
            FROM aneti.job_seeker_phone p
            WHERE p.job_seeker_id = ja.job_seeker_id
              AND p.is_primary = true
            ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC
            LIMIT 1
        ) phone ON true

        WHERE jo.employer_id = CAST(:employer_id AS uuid)
          AND (
                :offer_id IS NULL
                OR ja.offer_id = CAST(:offer_id AS uuid)
              )

        ORDER BY ja.applied_at DESC;
        """,
        {
            "employer_id": employer_id,
            "offer_id": offer_id,
        },
    )

def get_offer_for_employer(db: Session, employer_id: str, offer_id: str) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            id::text AS id,
            employer_id::text AS employer_id,
            status,
            updated_at
        FROM aneti.job_offer
        WHERE id = CAST(:offer_id AS uuid)
          AND employer_id = CAST(:employer_id AS uuid)
        LIMIT 1;
        """,
        {
            "offer_id": offer_id,
            "employer_id": employer_id,
        },
    )


def get_default_offer_to_candidate_model_version(db: Session) -> dict | None:
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
        WHERE m.code IN ('STANDARD_OFFER_TO_CANDIDATE', 'STANDARD_OFFER_TO_CANDIDATES')
          AND m.active = true
          AND mv.status = 'ACTIVE'
        ORDER BY
            CASE
                WHEN m.code = 'STANDARD_OFFER_TO_CANDIDATE' THEN 0
                ELSE 1
            END,
            mv.version_number DESC,
            mv.created_at DESC
        LIMIT 1;
        """,
    )


def count_active_candidates(db: Session) -> int:
    row = _fetch_one(
        db,
        """
        SELECT COUNT(*)::int AS count
        FROM aneti.job_seeker
        WHERE status = 'ACTIVE';
        """,
    )
    return int(row["count"] if row else 0)


def get_offer_matching_source_last_updated(db: Session, offer_id: str):
    row = _fetch_one(
        db,
        """
        SELECT MAX(last_updated) AS last_updated
        FROM (
            SELECT updated_at AS last_updated
            FROM aneti.job_offer
            WHERE id = CAST(:offer_id AS uuid)

            UNION ALL

            SELECT updated_at AS last_updated
            FROM aneti.job_offer_requirement
            WHERE offer_id = CAST(:offer_id AS uuid)

            UNION ALL

            SELECT updated_at AS last_updated
            FROM aneti.job_offer_language_requirement
            WHERE offer_id = CAST(:offer_id AS uuid)
        ) x;
        """,
        {"offer_id": offer_id},
    )
    return row["last_updated"] if row else None


def get_candidates_last_updated(db: Session):
    row = _fetch_one(
        db,
        """
        SELECT MAX(last_updated) AS last_updated
        FROM (
            SELECT updated_at AS last_updated FROM aneti.job_seeker
            UNION ALL
            SELECT updated_at FROM aneti.job_seeker_identity
            UNION ALL
            SELECT updated_at FROM aneti.job_seeker_contact
            UNION ALL
            SELECT updated_at FROM aneti.job_seeker_skill
            UNION ALL
            SELECT updated_at FROM aneti.job_seeker_language
            UNION ALL
            SELECT updated_at FROM aneti.job_seeker_education
            UNION ALL
            SELECT updated_at FROM aneti.job_seeker_experience
            UNION ALL
            SELECT updated_at FROM aneti.job_seeker_preference
        ) x;
        """,
    )
    return row["last_updated"] if row else None


def find_reusable_offer_to_candidate_run(
    db: Session,
    *,
    offer_id: str,
    model_version_id: str,
    min_created_at,
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
        WHERE direction = 'OFFER_TO_CANDIDATE'
          AND model_version_id = CAST(:model_version_id AS uuid)
          AND source_entity_type = 'JOB_OFFER'
          AND source_entity_id = :offer_id
          AND status = 'COMPLETED'
          AND (
                :min_created_at IS NULL
                OR started_at >= :min_created_at
          )
        ORDER BY started_at DESC
        LIMIT 1;
        """,
        {
            "offer_id": offer_id,
            "model_version_id": model_version_id,
            "min_created_at": min_created_at,
        },
    )


def list_offer_matching_results_with_candidates(
    db: Session,
    *,
    run_id: str,
    offer_id: str,
    min_score: float = 0.0,
) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            mr.id::text AS result_id,
            mr.run_id::text AS run_id,
            mr.candidate_id::text AS candidate_id,

            NULLIF(
                TRIM(
                    COALESCE(jsi.first_name, '') || ' ' || COALESCE(jsi.last_name, '')
                ),
                ''
            ) AS candidate_name,

            jsc.email AS candidate_email,
            phone.phone_number AS candidate_phone,
            js.status AS candidate_status,

            cv.id::text AS current_cv_id,
            cv.parsing_status AS cv_parsing_status,

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
            ) AS has_gaps,

            (app.id IS NOT NULL) AS already_applied,
            app.id::text AS application_id,
            app.status AS application_status,
            app.applied_at,

            mr.created_at

        FROM matching.matching_result mr

        JOIN aneti.job_seeker js
            ON js.id = mr.candidate_id

        LEFT JOIN aneti.job_seeker_identity jsi
            ON jsi.job_seeker_id = js.id

        LEFT JOIN aneti.job_seeker_contact jsc
            ON jsc.job_seeker_id = js.id

        LEFT JOIN LATERAL (
            SELECT p.phone_number
            FROM aneti.job_seeker_phone p
            WHERE p.job_seeker_id = js.id
              AND p.is_primary = true
            ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC
            LIMIT 1
        ) phone ON true

        LEFT JOIN aneti.job_seeker_cv cv
            ON cv.job_seeker_id = js.id
           AND cv.is_current = true

        LEFT JOIN LATERAL (
            SELECT ja.*
            FROM aneti.job_application ja
            WHERE ja.offer_id = CAST(:offer_id AS uuid)
              AND ja.job_seeker_id = js.id
            ORDER BY ja.applied_at DESC
            LIMIT 1
        ) app ON true

        WHERE mr.run_id = CAST(:run_id AS uuid)
          AND mr.offer_id = CAST(:offer_id AS uuid)
          AND (
                CASE
                    WHEN mr.score_global <= 1
                        THEN mr.score_global * 100
                    ELSE mr.score_global
                END
              ) >= :min_score

        ORDER BY
            score_percent DESC,
            mr.rank ASC NULLS LAST,
            mr.created_at ASC;
        """,
        {
            "run_id": run_id,
            "offer_id": offer_id,
            "min_score": min_score,
        },
    )