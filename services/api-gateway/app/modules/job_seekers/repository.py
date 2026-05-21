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
        SET
            contact_share_consent = COALESCE(:contact_share_consent, contact_share_consent),
            currently_working = COALESCE(:currently_working, currently_working),
            searching_specific_occupation = COALESCE(:searching_specific_occupation, searching_specific_occupation),
            has_driving_license = COALESCE(:has_driving_license, has_driving_license),
            has_personal_vehicle = COALESCE(:has_personal_vehicle, has_personal_vehicle),
            current_occupation_node_id = CASE
                WHEN :current_occupation_node_id IS NOT NULL
                     AND :current_occupation_node_id != ''
                THEN CAST(:current_occupation_node_id AS uuid)
                ELSE current_occupation_node_id
            END,
            updated_at = now()
        WHERE id = CAST(:job_seeker_id AS uuid)
        RETURNING
            id::text AS id,
            user_id::text AS user_id,
            aneti_identifier,
            status,
            registration_date,
            contact_share_consent,
            currently_working,
            current_occupation_node_id::text AS current_occupation_node_id,
            searching_specific_occupation,
            has_driving_license,
            has_personal_vehicle,
            created_at,
            updated_at;
        """,
        {
            "job_seeker_id": job_seeker_id,
            "contact_share_consent": params.get("contact_share_consent"),
            "currently_working": params.get("currently_working"),
            "searching_specific_occupation": params.get("searching_specific_occupation"),
            "has_driving_license": params.get("has_driving_license"),
            "has_personal_vehicle": params.get("has_personal_vehicle"),
            "current_occupation_node_id": str(params.get("current_occupation_node_id") or "") or None,
        },
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
            COALESCE(rv_gender.label_fr, rv_gender.label_en, rv_gender.label, rv_gender.code) AS gender_label,

            rv_htype.code AS code_handicap,
            COALESCE(rv_htype.label_fr, rv_htype.label_en, rv_htype.label, rv_htype.code) AS handicap_label,

            rv_hdeg.code AS code_degre_handicap,
            COALESCE(rv_hdeg.label_fr, rv_hdeg.label_en, rv_hdeg.label, rv_hdeg.code) AS degre_handicap_label,

            nc.iso2 AS nationality,
            i.nationality_country_id::text AS nationality_country_id,
            COALESCE(nc.name_fr, nc.name_en, nc.iso2) AS nationality_country_label

        FROM aneti.job_seeker_identity i

        LEFT JOIN geo.country nc
            ON nc.id = i.nationality_country_id

        LEFT JOIN reference.ref_value rv_gender
            ON rv_gender.id = i.gender_ref_id

        LEFT JOIN LATERAL (
            SELECT d.*
            FROM aneti.job_seeker_disability d
            WHERE d.job_seeker_id = i.job_seeker_id
            ORDER BY d.created_at DESC
            LIMIT 1
        ) d ON true

        LEFT JOIN reference.ref_value rv_htype
            ON rv_htype.id = d.handicap_type_ref_id

        LEFT JOIN reference.ref_value rv_hdeg
            ON rv_hdeg.id = d.handicap_degree_ref_id

        WHERE i.job_seeker_id = CAST(:job_seeker_id AS uuid)
        LIMIT 1;
        """,
        {"job_seeker_id": job_seeker_id},
    )


def upsert_identity(db: Session, job_seeker_id: str, payload: Mapping[str, object]) -> dict:
    params = dict(payload)

    identity = _fetch_one(
        db,
        """
        INSERT INTO aneti.job_seeker_identity (
            job_seeker_id,
            cin,
            passport_number,
            first_name,
            last_name,
            birth_date,
            nationality_country_id,
            gender_ref_id
        )
        VALUES (
            CAST(:job_seeker_id AS uuid),
            NULLIF(:cin, ''),
            NULLIF(:passport_number, ''),
            :first_name,
            :last_name,
            CASE
                WHEN :birth_date IS NULL OR :birth_date = '' THEN NULL::date
                ELSE CAST(:birth_date AS date)
            END,
            COALESCE(
                CASE
                    WHEN :nationality_country_id IS NOT NULL AND :nationality_country_id != ''
                        THEN CAST(:nationality_country_id AS uuid)
                END,
                (
                    SELECT c.id
                    FROM geo.country c
                    WHERE c.iso2 = NULLIF(:nationality, '')
                    LIMIT 1
                )
            ),
            (
                SELECT rv.id
                FROM reference.ref_value rv
                JOIN reference.ref_group rg ON rg.id = rv.group_id
                WHERE rg.code = 'GENDER'
                  AND rv.code = :gender_code
                LIMIT 1
            )
        )
        ON CONFLICT (job_seeker_id)
        DO UPDATE SET
            cin                    = EXCLUDED.cin,
            passport_number        = EXCLUDED.passport_number,
            first_name             = EXCLUDED.first_name,
            last_name              = EXCLUDED.last_name,
            birth_date             = EXCLUDED.birth_date,
            nationality_country_id = EXCLUDED.nationality_country_id,
            gender_ref_id          = EXCLUDED.gender_ref_id
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
        },
    )

    handicap_type_code = params.get("code_handicap")
    handicap_degree_code = params.get("code_degre_handicap")
    handicap_type_ref_id = str(params.get("handicap_type_ref_id") or "") or None
    handicap_degree_ref_id = str(params.get("handicap_degree_ref_id") or "") or None

    if handicap_type_code or handicap_degree_code or handicap_type_ref_id or handicap_degree_ref_id:
        db.execute(
            text("""
                INSERT INTO aneti.job_seeker_disability (
                    job_seeker_id,
                    handicap_type_ref_id,
                    handicap_degree_ref_id
                )
                VALUES (
                    CAST(:job_seeker_id AS uuid),
                    COALESCE(
                        CASE WHEN :handicap_type_ref_id IS NOT NULL AND :handicap_type_ref_id != ''
                             THEN CAST(:handicap_type_ref_id AS uuid) END,
                        (
                            SELECT rv.id
                            FROM reference.ref_value rv
                            JOIN reference.ref_group rg ON rg.id = rv.group_id
                            WHERE rg.code IN ('HANDICAP_TYPE', 'TYPE_HANDICAP')
                              AND rv.code = :code_handicap
                            LIMIT 1
                        )
                    ),
                    COALESCE(
                        CASE WHEN :handicap_degree_ref_id IS NOT NULL AND :handicap_degree_ref_id != ''
                             THEN CAST(:handicap_degree_ref_id AS uuid) END,
                        (
                            SELECT rv.id
                            FROM reference.ref_value rv
                            JOIN reference.ref_group rg ON rg.id = rv.group_id
                            WHERE rg.code IN ('HANDICAP_DEGREE', 'DEGRE_HANDICAP')
                              AND rv.code = :code_degre_handicap
                            LIMIT 1
                        )
                    )
                )
                ON CONFLICT DO NOTHING
            """),
            {
                "job_seeker_id": job_seeker_id,
                "handicap_type_ref_id": handicap_type_ref_id,
                "handicap_degree_ref_id": handicap_degree_ref_id,
                "code_handicap": handicap_type_code,
                "code_degre_handicap": handicap_degree_code,
            },
        )

    return identity or {"id": None}


def get_contact(db: Session, job_seeker_id: str) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            c.id::text AS id,
            c.email,
            ph.phone_number AS phone,
            c.address,
            c.country_id::text AS country_id,
            country.iso2 AS country,
            COALESCE(country.name_fr, country.name_en, country.iso2) AS country_label,

            c.postal_code,
            c.postal_code_id::text AS postal_code_id,
            pc.postal_code AS postal_code_value,

            c.governorate_unit_id::text AS governorate_unit_id,
            gov.code AS governorate_code,
            COALESCE(gov.label_fr, gov.label_en, gov.label, gov.code) AS governorate_label,

            c.delegation_unit_id::text AS delegation_unit_id,
            del.code AS delegation_code,
            COALESCE(del.label_fr, del.label_en, del.label, del.code) AS delegation_label,

            c.imada_unit_id::text AS imada_unit_id,
            ima.code AS imada_code,
            COALESCE(ima.label_fr, ima.label_en, ima.label, ima.code) AS imada_label,

            c.location_unit_id::text AS location_unit_id,
            loc.code AS location_code,
            COALESCE(loc.label_fr, loc.label_en, loc.label, loc.code) AS location_label

        FROM aneti.job_seeker_contact c

        LEFT JOIN LATERAL (
            SELECT p.phone_number
            FROM aneti.job_seeker_phone p
            WHERE p.job_seeker_id = c.job_seeker_id
            ORDER BY p.is_primary DESC, p.created_at ASC
            LIMIT 1
        ) ph ON true

        LEFT JOIN geo.country country
            ON country.id = c.country_id

        LEFT JOIN geo.postal_code pc
            ON pc.id = c.postal_code_id

        LEFT JOIN geo.admin_unit gov
            ON gov.id = c.governorate_unit_id

        LEFT JOIN geo.admin_unit del
            ON del.id = c.delegation_unit_id

        LEFT JOIN geo.admin_unit ima
            ON ima.id = c.imada_unit_id

        LEFT JOIN geo.admin_unit loc
            ON loc.id = c.location_unit_id

        WHERE c.job_seeker_id = CAST(:job_seeker_id AS uuid)
        LIMIT 1;
        """,
        {"job_seeker_id": job_seeker_id},
    )


def upsert_contact(db: Session, job_seeker_id: str, payload: Mapping[str, object]) -> dict:
    params = dict(payload)
    phone = str(params.get("phone") or "").strip()

    contact = _fetch_one(
        db,
        """
        INSERT INTO aneti.job_seeker_contact (
            job_seeker_id,
            email,
            address,
            country_id,
            governorate_unit_id,
            delegation_unit_id,
            imada_unit_id,
            location_unit_id,
            postal_code,
            postal_code_id
        )
        VALUES (
            CAST(:job_seeker_id AS uuid),
            :email,
            :address,
            COALESCE(
                CASE WHEN :country_id IS NOT NULL AND :country_id != ''
                     THEN CAST(:country_id AS uuid) END,
                (SELECT c.id FROM geo.country c WHERE c.iso2 = COALESCE(NULLIF(:country, ''), 'TN') LIMIT 1)
            ),
            COALESCE(
                CASE WHEN :governorate_unit_id IS NOT NULL AND :governorate_unit_id != ''
                     THEN CAST(:governorate_unit_id AS uuid) END,
                (
                    SELECT au.id
                    FROM geo.admin_unit au
                    JOIN geo.country cn ON cn.id = au.country_id
                    WHERE cn.iso2 = COALESCE(NULLIF(:country, ''), 'TN')
                      AND au.admin_level = 1
                      AND (au.code = :governorate_code OR au.metadata_json->>'admin1_code' = :governorate_code)
                    LIMIT 1
                )
            ),
            COALESCE(
                CASE WHEN :delegation_unit_id IS NOT NULL AND :delegation_unit_id != ''
                     THEN CAST(:delegation_unit_id AS uuid) END,
                (
                    SELECT au.id
                    FROM geo.admin_unit au
                    JOIN geo.country cn ON cn.id = au.country_id
                    WHERE cn.iso2 = COALESCE(NULLIF(:country, ''), 'TN')
                      AND au.admin_level = 2
                      AND (au.code = :delegation_code OR au.metadata_json->>'admin2_code' = :delegation_code)
                    LIMIT 1
                )
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
            :postal_code,
            COALESCE(
                CASE WHEN :postal_code_id IS NOT NULL AND :postal_code_id != ''
                     THEN CAST(:postal_code_id AS uuid) END,
                (
                    SELECT pc.id
                    FROM geo.postal_code pc
                    JOIN geo.country cn ON cn.id = pc.country_id
                    WHERE cn.iso2 = COALESCE(NULLIF(:country, ''), 'TN')
                      AND pc.postal_code = NULLIF(:postal_code, '')
                    LIMIT 1
                )
            )
        )
        ON CONFLICT (job_seeker_id)
        DO UPDATE SET
            email = COALESCE(EXCLUDED.email, aneti.job_seeker_contact.email),
            address = COALESCE(EXCLUDED.address, aneti.job_seeker_contact.address),
            country_id          = EXCLUDED.country_id,
            governorate_unit_id = EXCLUDED.governorate_unit_id,
            delegation_unit_id  = EXCLUDED.delegation_unit_id,
            imada_unit_id       = EXCLUDED.imada_unit_id,
            location_unit_id    = COALESCE(EXCLUDED.imada_unit_id, EXCLUDED.location_unit_id, EXCLUDED.delegation_unit_id, EXCLUDED.governorate_unit_id),
            postal_code         = EXCLUDED.postal_code,
            postal_code_id      = EXCLUDED.postal_code_id,
            updated_at          = now()
        RETURNING id::text AS id;
        """,
        {
            "job_seeker_id": job_seeker_id,
            "email": params.get("email"),
            "address": params.get("address"),
            "country": params.get("country") or "TN",
            "country_id": str(params.get("country_id") or "") or None,
            "governorate_code": params.get("governorate_code"),
            "delegation_code": params.get("delegation_code"),
            "governorate_unit_id": str(params.get("governorate_unit_id") or "") or None,
            "delegation_unit_id": str(params.get("delegation_unit_id") or "") or None,
            "imada_unit_id": str(params.get("imada_unit_id") or "") or None,
            "location_unit_id": str(params.get("location_unit_id") or "") or None,
            "postal_code": params.get("postal_code"),
            "postal_code_id": str(params.get("postal_code_id") or "") or None,
        },
    )

    if phone:
        # Un candidat ne peut avoir qu'un seul téléphone primaire.
        # On désactive d'abord l'ancien primaire, puis on insère/met à jour le nouveau.
        db.execute(
            text("""
                UPDATE aneti.job_seeker_phone
                SET
                    is_primary = false,
                    updated_at = now()
                WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)
                AND is_primary = true
                AND phone_number <> :phone;
            """),
            {
                "job_seeker_id": job_seeker_id,
                "phone": phone,
            },
        )

        db.execute(
            text("""
                INSERT INTO aneti.job_seeker_phone (
                    job_seeker_id,
                    phone_number,
                    is_primary,
                    verified
                )
                VALUES (
                    CAST(:job_seeker_id AS uuid),
                    :phone,
                    true,
                    false
                )
                ON CONFLICT (job_seeker_id, phone_number)
                DO UPDATE SET
                    is_primary = true,
                    updated_at = now();
            """),
            {
                "job_seeker_id": job_seeker_id,
                "phone": phone,
            },
        )

    return contact or {"id": None}


def list_education(db: Session, job_seeker_id: str) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            e.id::text AS id,

            NULL::text AS level_ref_id,
            NULL::text AS level_code,
            NULL::text AS level_label,

            e.diploma_ref_id::text AS diploma_ref_id,
            rv_diploma.code AS diploma_code,
            COALESCE(rv_diploma.label_fr, rv_diploma.label_en, rv_diploma.label, rv_diploma.code) AS diploma_label,

            e.specialty_ref_id::text AS specialty_ref_id,
            rv_specialty.code AS specialty_code,
            COALESCE(rv_specialty.label_fr, rv_specialty.label_en, rv_specialty.label, rv_specialty.code) AS specialty,

            e.institution_ref_id::text AS institution_ref_id,
            rv_institution.code AS institution_code,
            COALESCE(rv_institution.label_fr, rv_institution.label_en, rv_institution.label, rv_institution.code) AS institution,

            e.institution_country_id::text AS institution_country_id,
            c.iso2 AS institution_country_code,
            COALESCE(c.name_fr, c.name_en, c.iso2) AS institution_country_label,

            e.graduation_year,
            e.equivalence_required,
            e.equivalence_date,
            e.proof_document_id::text AS proof_document_id,
            e.created_at,
            e.updated_at

        FROM aneti.job_seeker_education e

        LEFT JOIN reference.ref_value rv_diploma
            ON rv_diploma.id = e.diploma_ref_id

        LEFT JOIN reference.ref_value rv_specialty
            ON rv_specialty.id = e.specialty_ref_id

        LEFT JOIN reference.ref_value rv_institution
            ON rv_institution.id = e.institution_ref_id

        LEFT JOIN geo.country c
            ON c.id = e.institution_country_id

        WHERE e.job_seeker_id = CAST(:job_seeker_id AS uuid)
        ORDER BY e.graduation_year DESC NULLS LAST, e.created_at DESC;
        """,
        {"job_seeker_id": job_seeker_id},
    )


def create_education(db: Session, job_seeker_id: str, payload: Mapping[str, object]) -> dict:
    params = dict(payload)

    return _fetch_one(
        db,
        """
        INSERT INTO aneti.job_seeker_education (
            job_seeker_id,
            graduation_year,
            diploma_ref_id,
            specialty_ref_id,
            institution_ref_id,
            institution_country_id,
            equivalence_required,
            equivalence_date,
            proof_document_id
        )
        VALUES (
            CAST(:job_seeker_id AS uuid),
            :graduation_year,
            COALESCE(
                CASE WHEN :diploma_ref_id IS NOT NULL AND :diploma_ref_id != '' THEN CAST(:diploma_ref_id AS uuid) END,
                (SELECT rv.id FROM reference.ref_value rv JOIN reference.ref_group rg ON rg.id = rv.group_id
                 WHERE rg.code = 'DIPLOMA' AND rv.code = :diploma_code LIMIT 1)
            ),
            COALESCE(
                CASE WHEN :specialty_ref_id IS NOT NULL AND :specialty_ref_id != '' THEN CAST(:specialty_ref_id AS uuid) END,
                (SELECT rv.id FROM reference.ref_value rv JOIN reference.ref_group rg ON rg.id = rv.group_id
                 WHERE rg.code = 'SPECIALTY' AND rv.code = :specialty_code LIMIT 1)
            ),
            COALESCE(
                CASE WHEN :institution_ref_id IS NOT NULL AND :institution_ref_id != '' THEN CAST(:institution_ref_id AS uuid) END,
                (SELECT rv.id FROM reference.ref_value rv JOIN reference.ref_group rg ON rg.id = rv.group_id
                 WHERE rg.code IN ('INSTITUTION', 'EDUCATION_INSTITUTION')
                   AND (rv.code = :institution OR lower(COALESCE(rv.label_fr, rv.label_en, rv.label, rv.code)) = lower(:institution))
                 LIMIT 1)
            ),
            COALESCE(
                CASE WHEN :institution_country_id IS NOT NULL AND :institution_country_id != '' THEN CAST(:institution_country_id AS uuid) END,
                (SELECT c.id FROM geo.country c WHERE c.iso2 = COALESCE(NULLIF(:institution_country_code, ''), 'TN') LIMIT 1)
            ),
            COALESCE(:equivalence_required, false),
            CASE WHEN :equivalence_date IS NULL OR :equivalence_date = '' THEN NULL::date ELSE CAST(:equivalence_date AS date) END,
            CASE WHEN :proof_document_id IS NOT NULL AND :proof_document_id != '' THEN CAST(:proof_document_id AS uuid) END
        )
        RETURNING id::text AS id;
        """,
        {
            "job_seeker_id": job_seeker_id,
            "diploma_code": params.get("diploma_code"),
            "diploma_ref_id": str(params.get("diploma_ref_id") or "") or None,
            "specialty_code": params.get("specialty_code"),
            "specialty_ref_id": str(params.get("specialty_ref_id") or "") or None,
            "institution": params.get("institution"),
            "institution_ref_id": str(params.get("institution_ref_id") or "") or None,
            "institution_country_id": str(params.get("institution_country_id") or "") or None,
            "institution_country_code": params.get("institution_country_code") or params.get("country") or "TN",
            "graduation_year": params.get("graduation_year"),
            "equivalence_required": params.get("equivalence_required"),
            "equivalence_date": params.get("equivalence_date"),
            "proof_document_id": str(params.get("proof_document_id") or "") or None,
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
            graduation_year = :graduation_year,
            diploma_ref_id = COALESCE(
                CASE WHEN :diploma_ref_id IS NOT NULL AND :diploma_ref_id != '' THEN CAST(:diploma_ref_id AS uuid) END,
                (SELECT rv.id FROM reference.ref_value rv JOIN reference.ref_group rg ON rg.id = rv.group_id
                 WHERE rg.code = 'DIPLOMA' AND rv.code = :diploma_code LIMIT 1),
                diploma_ref_id
            ),
            specialty_ref_id = COALESCE(
                CASE WHEN :specialty_ref_id IS NOT NULL AND :specialty_ref_id != '' THEN CAST(:specialty_ref_id AS uuid) END,
                (SELECT rv.id FROM reference.ref_value rv JOIN reference.ref_group rg ON rg.id = rv.group_id
                 WHERE rg.code = 'SPECIALTY' AND rv.code = :specialty_code LIMIT 1),
                specialty_ref_id
            ),
            institution_ref_id = COALESCE(
                CASE WHEN :institution_ref_id IS NOT NULL AND :institution_ref_id != '' THEN CAST(:institution_ref_id AS uuid) END,
                (SELECT rv.id FROM reference.ref_value rv JOIN reference.ref_group rg ON rg.id = rv.group_id
                 WHERE rg.code IN ('INSTITUTION', 'EDUCATION_INSTITUTION')
                   AND (rv.code = :institution OR lower(COALESCE(rv.label_fr, rv.label_en, rv.label, rv.code)) = lower(:institution))
                 LIMIT 1),
                institution_ref_id
            ),
            institution_country_id = COALESCE(
                CASE WHEN :institution_country_id IS NOT NULL AND :institution_country_id != '' THEN CAST(:institution_country_id AS uuid) END,
                (SELECT c.id FROM geo.country c WHERE c.iso2 = COALESCE(NULLIF(:institution_country_code, ''), 'TN') LIMIT 1),
                institution_country_id
            ),
            equivalence_required = COALESCE(:equivalence_required, equivalence_required),
            equivalence_date = CASE WHEN :equivalence_date IS NULL OR :equivalence_date = '' THEN equivalence_date ELSE CAST(:equivalence_date AS date) END,
            proof_document_id = COALESCE(
                CASE WHEN :proof_document_id IS NOT NULL AND :proof_document_id != '' THEN CAST(:proof_document_id AS uuid) END,
                proof_document_id
            ),
            updated_at = now()
        WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)
          AND id = CAST(:education_id AS uuid)
        RETURNING id::text AS id;
        """,
        {
            "job_seeker_id": job_seeker_id,
            "education_id": education_id,
            "diploma_code": params.get("diploma_code"),
            "diploma_ref_id": str(params.get("diploma_ref_id") or "") or None,
            "specialty_code": params.get("specialty_code"),
            "specialty_ref_id": str(params.get("specialty_ref_id") or "") or None,
            "institution": params.get("institution"),
            "institution_ref_id": str(params.get("institution_ref_id") or "") or None,
            "institution_country_id": str(params.get("institution_country_id") or "") or None,
            "institution_country_code": params.get("institution_country_code") or params.get("country") or "TN",
            "graduation_year": params.get("graduation_year"),
            "equivalence_required": params.get("equivalence_required"),
            "equivalence_date": params.get("equivalence_date"),
            "proof_document_id": str(params.get("proof_document_id") or "") or None,
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
            e.id::text AS id,

            e.occupation_node_id::text AS occupation_node_id,
            e.occupation_node_id::text AS occupation_id,
            occ.preferred_label AS occupation_label,

            e.job_title_raw,
            e.organization_name AS company_name,
            e.organization_name,

            e.sector_ref_id::text AS sector_ref_id,
            rv_sector.code AS sector_code,
            COALESCE(rv_sector.label_fr, rv_sector.label_en, rv_sector.label, rv_sector.code) AS sector_label,
            COALESCE(rv_sector.label_fr, rv_sector.label_en, rv_sector.label, rv_sector.code) AS sector,

            e.country_id::text AS country_id,
            exp_country.iso2 AS country_code,
            COALESCE(exp_country.name_fr, exp_country.name_en, exp_country.iso2) AS country_label,

            e.location_unit_id::text AS location_unit_id,
            loc_unit.code AS location_code,
            COALESCE(loc_unit.label_fr, loc_unit.label_en, loc_unit.label, loc_unit.code) AS location_label,

            e.start_date,
            e.end_date,
            e.duration_months,
            (e.end_date IS NULL AND e.start_date IS NOT NULL) AS is_current,
            e.description,
            e.created_at,
            e.updated_at

        FROM aneti.job_seeker_experience e

        LEFT JOIN taxonomy.taxonomy_node occ
            ON occ.id = e.occupation_node_id

        LEFT JOIN reference.ref_value rv_sector
            ON rv_sector.id = e.sector_ref_id

        LEFT JOIN geo.country exp_country
            ON exp_country.id = e.country_id

        LEFT JOIN geo.admin_unit loc_unit
            ON loc_unit.id = e.location_unit_id

        WHERE e.job_seeker_id = CAST(:job_seeker_id AS uuid)
        ORDER BY e.start_date DESC NULLS LAST, e.created_at DESC;
        """,
        {"job_seeker_id": job_seeker_id},
    )


def create_experience(db: Session, job_seeker_id: str, payload: Mapping[str, object]) -> dict:
    params = dict(payload)
    return _fetch_one(
        db,
        """
        INSERT INTO aneti.job_seeker_experience (
            job_seeker_id,
            occupation_node_id,
            job_title_raw,
            organization_name,
            sector_ref_id,
            country_id,
            location_unit_id,
            start_date,
            end_date,
            duration_months,
            description
        )
        VALUES (
            CAST(:job_seeker_id AS uuid),
            CASE WHEN :occupation_node_id IS NOT NULL AND :occupation_node_id != '' THEN CAST(:occupation_node_id AS uuid) END,
            :job_title_raw,
            :organization_name,
            COALESCE(
                CASE WHEN :sector_ref_id IS NOT NULL AND :sector_ref_id != '' THEN CAST(:sector_ref_id AS uuid) END,
                (SELECT rv.id FROM reference.ref_value rv JOIN reference.ref_group rg ON rg.id = rv.group_id
                 WHERE rg.code = 'ACTIVITY_SECTOR' AND rv.code = :sector_code LIMIT 1)
            ),
            COALESCE(
                CASE WHEN :country_id IS NOT NULL AND :country_id != '' THEN CAST(:country_id AS uuid) END,
                (SELECT c.id FROM geo.country c WHERE c.iso2 = COALESCE(NULLIF(:country_code, ''), 'TN') LIMIT 1)
            ),
            CASE WHEN :location_unit_id IS NOT NULL AND :location_unit_id != '' THEN CAST(:location_unit_id AS uuid) END,
            CASE WHEN :start_date IS NULL OR :start_date = '' THEN NULL::date ELSE CAST(:start_date AS date) END,
            CASE WHEN :is_current THEN NULL::date WHEN :end_date IS NULL OR :end_date = '' THEN NULL::date ELSE CAST(:end_date AS date) END,
            COALESCE(
                :duration_months,
                CASE
                    WHEN NULLIF(:start_date, '') IS NOT NULL THEN GREATEST(
                        0,
                        (
                            DATE_PART(
                                'year',
                                AGE(
                                    CASE
                                        WHEN :is_current THEN CURRENT_DATE
                                        WHEN NULLIF(:end_date, '') IS NULL THEN CURRENT_DATE
                                        ELSE CAST(:end_date AS date)
                                    END,
                                    CAST(:start_date AS date)
                                )
                            ) * 12
                            +
                            DATE_PART(
                                'month',
                                AGE(
                                    CASE
                                        WHEN :is_current THEN CURRENT_DATE
                                        WHEN NULLIF(:end_date, '') IS NULL THEN CURRENT_DATE
                                        ELSE CAST(:end_date AS date)
                                    END,
                                    CAST(:start_date AS date)
                                )
                            )
                        )::int
                    )
                END
            ),
            :description
        )
        RETURNING id::text AS id;
        """,
        {
            "job_seeker_id": job_seeker_id,
            "occupation_node_id": str(params.get("occupation_node_id") or "") or None,
            "job_title_raw": params.get("job_title_raw"),
            "organization_name": params.get("organization_name") or params.get("company_name"),
            "sector_code": params.get("sector_code"),
            "sector_ref_id": str(params.get("sector_ref_id") or "") or None,
            "country_id": str(params.get("country_id") or "") or None,
            "country_code": params.get("country_code") or params.get("country") or "TN",
            "location_unit_id": str(params.get("location_unit_id") or "") or None,
            "start_date": params.get("start_date"),
            "end_date": params.get("end_date"),
            "is_current": bool(params.get("is_current", False)),
            "duration_months": params.get("duration_months"),
            "description": params.get("description"),
        },
    )


def update_experience(
    db: Session,
    job_seeker_id: str,
    experience_id: str,
    payload: Mapping[str, object],
) -> dict | None:
    params = dict(payload)
    return _fetch_one(
        db,
        """
        UPDATE aneti.job_seeker_experience
        SET
            occupation_node_id = COALESCE(
                CASE WHEN :occupation_node_id IS NOT NULL AND :occupation_node_id != '' THEN CAST(:occupation_node_id AS uuid) END,
                occupation_node_id
            ),
            job_title_raw = :job_title_raw,
            organization_name = :organization_name,
            sector_ref_id = COALESCE(
                CASE WHEN :sector_ref_id IS NOT NULL AND :sector_ref_id != '' THEN CAST(:sector_ref_id AS uuid) END,
                (SELECT rv.id FROM reference.ref_value rv JOIN reference.ref_group rg ON rg.id = rv.group_id
                 WHERE rg.code = 'ACTIVITY_SECTOR' AND rv.code = :sector_code LIMIT 1),
                sector_ref_id
            ),
            country_id = COALESCE(
                CASE WHEN :country_id IS NOT NULL AND :country_id != '' THEN CAST(:country_id AS uuid) END,
                (SELECT c.id FROM geo.country c WHERE c.iso2 = COALESCE(NULLIF(:country_code, ''), 'TN') LIMIT 1),
                country_id
            ),
            location_unit_id = COALESCE(
                CASE WHEN :location_unit_id IS NOT NULL AND :location_unit_id != '' THEN CAST(:location_unit_id AS uuid) END,
                location_unit_id
            ),
            start_date = CASE WHEN :start_date IS NULL OR :start_date = '' THEN NULL::date ELSE CAST(:start_date AS date) END,
            end_date = CASE WHEN :is_current THEN NULL::date WHEN :end_date IS NULL OR :end_date = '' THEN NULL::date ELSE CAST(:end_date AS date) END,
            duration_months = COALESCE(:duration_months, duration_months),
            description = :description,
            updated_at = now()
        WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)
          AND id = CAST(:experience_id AS uuid)
        RETURNING id::text AS id;
        """,
        {
            "job_seeker_id": job_seeker_id,
            "experience_id": experience_id,
            "occupation_node_id": str(params.get("occupation_node_id") or "") or None,
            "job_title_raw": params.get("job_title_raw"),
            "organization_name": params.get("organization_name") or params.get("company_name"),
            "sector_code": params.get("sector_code"),
            "sector_ref_id": str(params.get("sector_ref_id") or "") or None,
            "country_id": str(params.get("country_id") or "") or None,
            "country_code": params.get("country_code") or params.get("country") or "TN",
            "location_unit_id": str(params.get("location_unit_id") or "") or None,
            "start_date": params.get("start_date"),
            "end_date": params.get("end_date"),
            "is_current": bool(params.get("is_current", False)),
            "duration_months": params.get("duration_months"),
            "description": params.get("description"),
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
    return _fetch_all(
        db,
        """
        SELECT
            s.id::text AS id,

            s.skill_node_id::text AS skill_node_id,
            s.skill_node_id::text AS skill_id,
            n.preferred_label AS skill_node_label,
            n.preferred_label AS skill_label_raw,
            n.node_type AS skill_node_type,

            s.level_ref_id::text AS level_ref_id,
            rv_level.code AS level_code,
            COALESCE(rv_level.label_fr, rv_level.label_en, rv_level.label, rv_level.code) AS level_label,

            s.years,
            NULL::text AS evidence,
            NULL::text AS source,
            s.created_at,
            s.updated_at

        FROM aneti.job_seeker_skill s

        LEFT JOIN taxonomy.taxonomy_node n
            ON n.id = s.skill_node_id

        LEFT JOIN reference.ref_value rv_level
            ON rv_level.id = s.level_ref_id

        WHERE s.job_seeker_id = CAST(:job_seeker_id AS uuid)
        ORDER BY s.created_at DESC;
        """,
        {"job_seeker_id": job_seeker_id},
    )


def create_skill(db: Session, job_seeker_id: str, payload: Mapping[str, object]) -> dict:
    params = dict(payload)
    return _fetch_one(
        db,
        """
        INSERT INTO aneti.job_seeker_skill (
            job_seeker_id,
            skill_node_id,
            level_ref_id,
            years
        )
        VALUES (
            CAST(:job_seeker_id AS uuid),
            COALESCE(
                CASE WHEN :skill_node_id IS NOT NULL AND :skill_node_id != '' THEN CAST(:skill_node_id AS uuid) END,
                (SELECT n.id FROM taxonomy.taxonomy_node n
                 WHERE n.normalized_label = taxonomy.normalize_text_basic(:skill_label)
                    OR lower(n.preferred_label) = lower(:skill_label)
                 LIMIT 1)
            ),
            COALESCE(
                CASE WHEN :level_ref_id IS NOT NULL AND :level_ref_id != '' THEN CAST(:level_ref_id AS uuid) END,
                (SELECT rv.id FROM reference.ref_value rv JOIN reference.ref_group rg ON rg.id = rv.group_id
                 WHERE rg.code IN ('SKILL_LEVEL', 'PROFICIENCY_LEVEL') AND rv.code = :level_code LIMIT 1)
            ),
            :years
        )
        RETURNING id::text AS id;
        """,
        {
            "job_seeker_id": job_seeker_id,
            "skill_node_id": str(params.get("skill_node_id") or "") or None,
            "skill_label": params.get("skill_label") or params.get("skill_node_label") or params.get("label") or "",
            "level_ref_id": str(params.get("level_ref_id") or "") or None,
            "level_code": params.get("level_code"),
            "years": params.get("years"),
        },
    )


def update_skill(
    db: Session,
    job_seeker_id: str,
    skill_row_id: str,
    payload: Mapping[str, object],
) -> dict | None:
    params = dict(payload)
    return _fetch_one(
        db,
        """
        UPDATE aneti.job_seeker_skill
        SET
            skill_node_id = COALESCE(
                CASE WHEN :skill_node_id IS NOT NULL AND :skill_node_id != '' THEN CAST(:skill_node_id AS uuid) END,
                (SELECT n.id FROM taxonomy.taxonomy_node n
                 WHERE n.normalized_label = taxonomy.normalize_text_basic(:skill_label)
                    OR lower(n.preferred_label) = lower(:skill_label)
                 LIMIT 1),
                skill_node_id
            ),
            level_ref_id = COALESCE(
                CASE WHEN :level_ref_id IS NOT NULL AND :level_ref_id != '' THEN CAST(:level_ref_id AS uuid) END,
                (SELECT rv.id FROM reference.ref_value rv JOIN reference.ref_group rg ON rg.id = rv.group_id
                 WHERE rg.code IN ('SKILL_LEVEL', 'PROFICIENCY_LEVEL') AND rv.code = :level_code LIMIT 1),
                level_ref_id
            ),
            years = :years,
            updated_at = now()
        WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)
          AND id = CAST(:skill_row_id AS uuid)
        RETURNING id::text AS id;
        """,
        {
            "job_seeker_id": job_seeker_id,
            "skill_row_id": skill_row_id,
            "skill_node_id": str(params.get("skill_node_id") or "") or None,
            "skill_label": params.get("skill_label") or params.get("skill_node_label") or params.get("label") or "",
            "level_ref_id": str(params.get("level_ref_id") or "") or None,
            "level_code": params.get("level_code"),
            "years": params.get("years"),
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
            rv_level.code AS level_code,
            COALESCE(rv_level.label_fr, rv_level.label, rv_level.code) AS level_label_fr,
            COALESCE(rv_level.label_en, rv_level.label, rv_level.code) AS level_label_en,

            l.is_primary,
            NULL::text AS evidence,
            l.created_at,
            l.updated_at

        FROM aneti.job_seeker_language l

        LEFT JOIN reference.ref_value rv_lang
            ON rv_lang.id = l.language_ref_id

        LEFT JOIN reference.ref_value rv_level
            ON rv_level.id = l.level_ref_id

        WHERE l.job_seeker_id = CAST(:job_seeker_id AS uuid)
        ORDER BY l.is_primary DESC, l.created_at DESC;
        """,
        {"job_seeker_id": job_seeker_id},
    )


def create_language(db: Session, job_seeker_id: str, payload: Mapping[str, object]) -> dict:
    params = dict(payload)

    return _fetch_one(
        db,
        """
        INSERT INTO aneti.job_seeker_language (
            job_seeker_id,
            language_ref_id,
            level_ref_id,
            is_primary
        )
        VALUES (
            CAST(:job_seeker_id AS uuid),
            COALESCE(
                CASE WHEN :language_ref_id IS NOT NULL AND :language_ref_id != '' THEN CAST(:language_ref_id AS uuid) END,
                (SELECT rv.id FROM reference.ref_value rv JOIN reference.ref_group rg ON rg.id = rv.group_id
                 WHERE rg.code = 'LANGUAGE' AND lower(rv.code) = lower(:language_code) LIMIT 1)
            ),
            COALESCE(
                CASE WHEN :level_ref_id IS NOT NULL AND :level_ref_id != '' THEN CAST(:level_ref_id AS uuid) END,
                (SELECT rv.id FROM reference.ref_value rv JOIN reference.ref_group rg ON rg.id = rv.group_id
                 WHERE rg.code = 'LANGUAGE_LEVEL' AND lower(rv.code) = lower(:level) LIMIT 1)
            ),
            COALESCE(:is_primary, false)
        )
        RETURNING id::text AS id;
        """,
        {
            "job_seeker_id": job_seeker_id,
            "language_ref_id": str(params.get("language_ref_id") or "") or None,
            "language_code": params.get("language_code"),
            "level_ref_id": str(params.get("level_ref_id") or "") or None,
            "level": params.get("level") or params.get("level_code"),
            "is_primary": params.get("is_primary"),
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
            language_ref_id = COALESCE(
                CASE WHEN :language_ref_id IS NOT NULL AND :language_ref_id != '' THEN CAST(:language_ref_id AS uuid) END,
                (SELECT rv.id FROM reference.ref_value rv JOIN reference.ref_group rg ON rg.id = rv.group_id
                 WHERE rg.code = 'LANGUAGE' AND lower(rv.code) = lower(:language_code) LIMIT 1),
                language_ref_id
            ),
            level_ref_id = COALESCE(
                CASE WHEN :level_ref_id IS NOT NULL AND :level_ref_id != '' THEN CAST(:level_ref_id AS uuid) END,
                (SELECT rv.id FROM reference.ref_value rv JOIN reference.ref_group rg ON rg.id = rv.group_id
                 WHERE rg.code = 'LANGUAGE_LEVEL' AND lower(rv.code) = lower(:level) LIMIT 1),
                level_ref_id
            ),
            is_primary = COALESCE(:is_primary, is_primary),
            updated_at = now()
        WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)
          AND id = CAST(:language_id AS uuid)
        RETURNING id::text AS id;
        """,
        {
            "job_seeker_id": job_seeker_id,
            "language_id": language_id,
            "language_ref_id": str(params.get("language_ref_id") or "") or None,
            "language_code": params.get("language_code"),
            "level_ref_id": str(params.get("level_ref_id") or "") or None,
            "level": params.get("level") or params.get("level_code"),
            "is_primary": params.get("is_primary"),
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

            mob_unit.code AS preferred_governorate,
            COALESCE(mob_unit.label_fr, mob_unit.label_en, mob_unit.label, mob_unit.code) AS preferred_governorate_label,

            p.mobility_radius_km,
            COALESCE(p.accepts_relocation, false) AS accepts_relocation,

            p.desired_salary_min,
            p.desired_salary_max

        FROM aneti.job_seeker_preference p

        LEFT JOIN reference.ref_value rv_contract
            ON rv_contract.id = p.preferred_contract_type_ref_id

        LEFT JOIN LATERAL (
            SELECT au.*
            FROM aneti.job_seeker_mobility_unit mu
            JOIN geo.admin_unit au
                ON au.id = mu.admin_unit_id
            WHERE mu.job_seeker_id = p.job_seeker_id
              AND au.admin_level = 1
            ORDER BY au.label_fr ASC NULLS LAST, au.code ASC
            LIMIT 1
        ) mob_unit ON true

        WHERE p.job_seeker_id = CAST(:job_seeker_id AS uuid)
        LIMIT 1;
        """,
        {"job_seeker_id": job_seeker_id},
    )


def upsert_preference(db: Session, job_seeker_id: str, payload: Mapping[str, object]) -> dict:
    params = dict(payload)

    pref = _fetch_one(
        db,
        """
        INSERT INTO aneti.job_seeker_preference (
            job_seeker_id,
            desired_salary_min,
            desired_salary_max,
            mobility_radius_km,
            accepts_relocation,
            preferred_contract_type_ref_id
        )
        VALUES (
            CAST(:job_seeker_id AS uuid),
            :desired_salary_min,
            :desired_salary_max,
            :mobility_radius_km,
            COALESCE(:accepts_relocation, FALSE),
            COALESCE(
                CASE
                    WHEN :preferred_contract_type_ref_id IS NOT NULL
                         AND :preferred_contract_type_ref_id != ''
                    THEN CAST(:preferred_contract_type_ref_id AS uuid)
                END,
                (
                    SELECT rv.id
                    FROM reference.ref_value rv
                    JOIN reference.ref_group rg
                        ON rg.id = rv.group_id
                    WHERE rg.code = 'CONTRACT_TYPE'
                      AND rv.code = :preferred_contract_type
                      AND rv.active = true
                    LIMIT 1
                )
            )
        )
        ON CONFLICT (job_seeker_id)
        DO UPDATE SET
            desired_salary_min = COALESCE(
                EXCLUDED.desired_salary_min,
                aneti.job_seeker_preference.desired_salary_min
            ),
            desired_salary_max = COALESCE(
                EXCLUDED.desired_salary_max,
                aneti.job_seeker_preference.desired_salary_max
            ),
            mobility_radius_km = COALESCE(
                EXCLUDED.mobility_radius_km,
                aneti.job_seeker_preference.mobility_radius_km
            ),
            accepts_relocation = COALESCE(
                EXCLUDED.accepts_relocation,
                aneti.job_seeker_preference.accepts_relocation
            ),
            preferred_contract_type_ref_id = COALESCE(
                EXCLUDED.preferred_contract_type_ref_id,
                aneti.job_seeker_preference.preferred_contract_type_ref_id
            ),
            updated_at = now()
        RETURNING id::text AS id;
        """,
        {
            "job_seeker_id": job_seeker_id,
            "preferred_contract_type": params.get("preferred_contract_type"),
            "preferred_contract_type_ref_id": str(params.get("preferred_contract_type_ref_id") or "") or None,
            "desired_salary_min": params.get("desired_salary_min"),
            "desired_salary_max": params.get("desired_salary_max"),
            "mobility_radius_km": params.get("mobility_radius_km"),
            "accepts_relocation": params.get("accepts_relocation"),
        },
    )

    preferred_governorate = params.get("preferred_governorate") or params.get("governorate_code")

    db.execute(
        text("""
            DELETE FROM aneti.job_seeker_mobility_unit mu
            USING geo.admin_unit au
            WHERE mu.admin_unit_id = au.id
              AND mu.job_seeker_id = CAST(:job_seeker_id AS uuid)
              AND au.admin_level = 1
        """),
        {"job_seeker_id": job_seeker_id},
    )

    if preferred_governorate:
        db.execute(
            text("""
                INSERT INTO aneti.job_seeker_mobility_unit (
                    job_seeker_id,
                    admin_unit_id
                )
                SELECT
                    CAST(:job_seeker_id AS uuid),
                    au.id
                FROM geo.admin_unit au
                JOIN geo.country cn
                    ON cn.id = au.country_id
                WHERE cn.iso2 = 'TN'
                  AND au.admin_level = 1
                  AND (
                        au.code = :preferred_governorate
                        OR au.metadata_json->>'admin1_code' = :preferred_governorate
                      )
                LIMIT 1
                ON CONFLICT (job_seeker_id, admin_unit_id)
                DO NOTHING
            """),
            {
                "job_seeker_id": job_seeker_id,
                "preferred_governorate": preferred_governorate,
            },
        )

    return pref or {"id": None}

def get_current_cv(db: Session, job_seeker_id: str) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            cv.id::text AS id,

            -- Compatibilité avec CvMetadataResponse
            cv.id::text AS cv_id,

            cv.document_file_id::text AS document_file_id,

            df.storage_provider,
            df.container_name,
            df.blob_name,
            df.storage_key,
            NULL::text AS blob_url,
            df.original_filename,
            df.mime_type,
            df.file_size_bytes,

            cv.status,
            cv.is_current,
            cv.parsing_status,

            df.uploaded_by_user_id::text AS uploaded_by_user_id,
            df.uploaded_at,

            cv.created_at,
            cv.updated_at

        FROM aneti.job_seeker_cv cv

        LEFT JOIN aneti.document_file df
            ON df.id = cv.document_file_id

        WHERE cv.job_seeker_id = CAST(:job_seeker_id AS uuid)
          AND cv.is_current = TRUE
          AND cv.status <> 'ARCHIVED'

        ORDER BY COALESCE(df.uploaded_at, cv.created_at) DESC
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
    job_seeker_id: str,
    run_id: str,
    min_score: float = 0.0,
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

            -- Compatibilité réponse : valeurs calculées depuis les référentiels
            rv_ct.code AS contract_type,
            rv_wm.code AS work_mode,

            offer_country.iso2 AS country,

            gov.code AS governorate_code,
            COALESCE(gov.label_fr, gov.label_en, gov.label, gov.code) AS governorate_label,

            del_unit.code AS delegation_code,
            COALESCE(del_unit.label_fr, del_unit.label_en, del_unit.label, del_unit.code) AS delegation_label,

            jo.location_unit_id::text AS location_unit_id,
            loc_unit.code AS location_code,
            COALESCE(loc_unit.label_fr, loc_unit.label_en, loc_unit.label, loc_unit.code) AS location_label,

            jo.salary_min,
            jo.salary_max,
            jo.salary_currency_code,

            jo.published_at,
            jo.deadline_at,

            COALESCE(e.commercial_name, e.legal_name, '') AS employer_name,

            (ja.id IS NOT NULL) AS already_applied,
            ja.id::text AS application_id,
            ja.status AS application_status,

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

        LEFT JOIN reference.ref_value rv_ct
            ON rv_ct.id = jo.contract_type_ref_id

        LEFT JOIN reference.ref_value rv_wm
            ON rv_wm.id = jo.work_mode_ref_id

        LEFT JOIN geo.country offer_country
            ON offer_country.id = jo.country_id

        LEFT JOIN geo.admin_unit gov
            ON gov.id = jo.governorate_unit_id

        LEFT JOIN geo.admin_unit del_unit
            ON del_unit.id = jo.delegation_unit_id

        LEFT JOIN geo.admin_unit loc_unit
            ON loc_unit.id = jo.location_unit_id

        LEFT JOIN aneti.job_application ja
            ON ja.offer_id = jo.id
           AND ja.job_seeker_id = CAST(:job_seeker_id AS uuid)

        WHERE mr.run_id = CAST(:run_id AS uuid)
          AND (
                CASE
                    WHEN mr.score_global <= 1
                        THEN mr.score_global * 100
                    ELSE mr.score_global
                END
              ) >= :min_score
          AND jo.status IN ('PUBLISHED', 'ACTIVE')

        ORDER BY
            score_percent DESC,
            mr.rank ASC NULLS LAST;
        """,
        {
            "job_seeker_id": job_seeker_id,
            "run_id": run_id,
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
            i.id::text AS id,
            n.preferred_label AS keyword,
            rv_type.code AS keyword_type,
            NULL::text AS source,
            COALESCE(i.weight, 1.0)::float8 AS weight,
            i.taxonomy_node_id::text AS taxonomy_node_id,
            n.preferred_label AS taxonomy_node_label,
            n.node_type AS taxonomy_node_type,
            rv_type.code AS interest_type_code,
            COALESCE(rv_type.label_fr, rv_type.label_en, rv_type.label, rv_type.code) AS interest_type_label,
            i.created_at,
            i.updated_at
        FROM aneti.job_seeker_interest i
        JOIN taxonomy.taxonomy_node n
            ON n.id = i.taxonomy_node_id
        LEFT JOIN reference.ref_value rv_type
            ON rv_type.id = i.interest_type_ref_id
        WHERE i.job_seeker_id = CAST(:job_seeker_id AS uuid)
        ORDER BY COALESCE(i.weight, 1.0) DESC, n.preferred_label ASC;
        """,
        {"job_seeker_id": job_seeker_id},
    )


def replace_job_seeker_keywords(
    db: Session,
    *,
    job_seeker_id: str,
    keywords: list[str],
) -> list[dict]:
    db.execute(
        text("""
            DELETE FROM aneti.job_seeker_interest
            WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)
        """),
        {"job_seeker_id": job_seeker_id},
    )

    seen = set()
    for keyword in keywords or []:
        value = str(keyword or "").strip()
        if not value or value.lower() in seen:
            continue
        seen.add(value.lower())

        db.execute(
            text("""
                INSERT INTO aneti.job_seeker_interest (
                    job_seeker_id,
                    taxonomy_node_id,
                    interest_type_ref_id,
                    weight
                )
                SELECT
                    CAST(:job_seeker_id AS uuid),
                    n.id,
                    (
                        SELECT rv.id
                        FROM reference.ref_value rv
                        JOIN reference.ref_group rg ON rg.id = rv.group_id
                        WHERE rg.code IN ('INTEREST_TYPE', 'JOB_SEEKER_INTEREST_TYPE')
                          AND rv.code IN ('INTEREST', 'OCCUPATION', 'SKILL')
                        ORDER BY rv.sort_order NULLS LAST, rv.code
                        LIMIT 1
                    ),
                    1.00
                FROM taxonomy.taxonomy_node n
                WHERE n.normalized_label = taxonomy.normalize_text_basic(:keyword)
                   OR lower(n.preferred_label) = lower(:keyword)
                ORDER BY CASE WHEN n.node_type = 'OCCUPATION' THEN 0 ELSE 1 END
                LIMIT 1
                ON CONFLICT DO NOTHING
            """),
            {"job_seeker_id": job_seeker_id, "keyword": value},
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
    row = _fetch_one(
        db,
        """
        UPDATE aneti.job_seeker
        SET
            profile_version = COALESCE(profile_version, 0) + 1,
            updated_at = now()
        WHERE id = CAST(:job_seeker_id AS uuid)
        RETURNING profile_version::int AS profile_version;
        """,
        {"job_seeker_id": job_seeker_id},
    )

    return int(row["profile_version"]) if row else 1

# ─── Interests / legacy keywords compatibility ───────────────────────────────

def list_job_seeker_interests(db: Session, job_seeker_id: str) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            i.id::text AS id,
            i.taxonomy_node_id::text AS taxonomy_node_id,
            n.preferred_label AS taxonomy_node_label,
            n.node_type AS taxonomy_node_type,

            rv_type.code AS interest_type_code,
            COALESCE(rv_type.label_fr, rv_type.label_en, rv_type.label, rv_type.code) AS interest_type_label,

            NULL::text AS source,
            COALESCE(i.weight, 1.0)::float8 AS weight,
            i.created_at,
            i.updated_at
        FROM aneti.job_seeker_interest i
        LEFT JOIN taxonomy.taxonomy_node n
            ON n.id = i.taxonomy_node_id
        LEFT JOIN reference.ref_value rv_type
            ON rv_type.id = i.interest_type_ref_id
        WHERE i.job_seeker_id = CAST(:job_seeker_id AS uuid)
        ORDER BY COALESCE(i.weight, 1.0) DESC, n.preferred_label ASC;
        """,
        {"job_seeker_id": job_seeker_id},
    )


def list_job_seeker_keywords(db: Session, job_seeker_id: str) -> list[dict]:
    # Legacy route name kept for frontend compatibility.
    return list_job_seeker_interests(db, job_seeker_id)


def replace_job_seeker_interests(
    db: Session,
    *,
    job_seeker_id: str,
    interests: list[dict],
) -> list[dict]:
    db.execute(
        text("""
            DELETE FROM aneti.job_seeker_interest
            WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)
        """),
        {"job_seeker_id": job_seeker_id},
    )

    seen_nodes: set[str] = set()

    for item in interests or []:
        node_id = str(item.get("taxonomy_node_id") or "").strip()
        if not node_id or node_id in seen_nodes:
            continue

        seen_nodes.add(node_id)

        db.execute(
            text("""
                INSERT INTO aneti.job_seeker_interest (
                    job_seeker_id,
                    taxonomy_node_id,
                    interest_type_ref_id,
                    weight
                )
                VALUES (
                    CAST(:job_seeker_id AS uuid),
                    CAST(:taxonomy_node_id AS uuid),
                    (
                        SELECT rv.id
                        FROM reference.ref_value rv
                        JOIN reference.ref_group rg
                            ON rg.id = rv.group_id
                        WHERE rg.code IN ('INTEREST_TYPE', 'JOB_SEEKER_INTEREST_TYPE')
                          AND rv.code = :interest_type_code
                        LIMIT 1
                    ),
                    :weight
                )
            """),
            {
                "job_seeker_id": job_seeker_id,
                "taxonomy_node_id": node_id,
                "interest_type_code": item.get("interest_type_code") or "INTEREST",
                "weight": float(item.get("weight") or 1.0),
            },
        )

    return list_job_seeker_interests(db, job_seeker_id)


def replace_job_seeker_keywords(
    db: Session,
    *,
    job_seeker_id: str,
    interests: list[dict] | None = None,
    keywords: list[dict] | None = None,
) -> list[dict]:
    # Legacy function name kept for old service/router calls.
    return replace_job_seeker_interests(
        db,
        job_seeker_id=job_seeker_id,
        interests=interests if interests is not None else (keywords or []),
    )