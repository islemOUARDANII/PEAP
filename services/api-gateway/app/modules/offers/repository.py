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


def get_offer_status_values(db: Session) -> list[str]:
    row = _fetch_one(
        db,
        """
        SELECT pg_get_constraintdef(oid) AS definition
        FROM pg_constraint
        WHERE conrelid = 'aneti.job_offer'::regclass
          AND conname = 'ck_job_offer_status'
        LIMIT 1;
        """,
    )
    if not row:
        return []

    definition = row["definition"]
    return [
        value.replace("::text", "").replace("'", "").strip()
        for value in definition.split("ARRAY[", 1)[1].split("]", 1)[0].split(",")
    ]


_OFFER_SELECT = """
        SELECT
            o.id::text AS id,
            o.aneti_identifier AS aneti_identifier,
            o.employer_id::text AS employer_id,
            o.company_name,
            o.title,
            o.description,
            o.number_of_positions,
            o.status,

            -- Contract type / work mode from canonical ref_value
            rv_ct.code AS contract_type,
            rv_wm.code AS work_mode,

            o.salary_min,
            o.salary_max,
            COALESCE(o.salary_currency_code, 'TND') AS salary_currency_code,

            -- Canonical geo ids
            o.country_id::text AS country_id,
            o.governorate_unit_id::text AS governorate_unit_id,
            o.delegation_unit_id::text AS delegation_unit_id,

            -- Resolved country iso2
            COALESCE(offer_country.iso2, 'TN') AS country,

            -- Resolved governorate
            gov.code AS governorate_code,
            COALESCE(gov.label_fr, gov.label_en, gov.label, gov.code) AS governorate_label,

            -- Resolved delegation
            del_unit.code AS delegation_code,
            COALESCE(del_unit.label_fr, del_unit.label_en, del_unit.label, del_unit.code) AS delegation_label,

            -- Canonical occupation
            o.occupation_node_id::text AS occupation_node_id,
            occ.preferred_label AS occupation_node_label,

            -- Experience & education
            o.min_experience_months,
            o.diploma_ref_id::text AS diploma_ref_id,
            o.specialty_ref_id::text AS specialty_ref_id,

            -- Accessibility
            COALESCE(o.is_accessible_to_disabled, FALSE) AS is_accessible_to_disabled,
            o.accessibility_notes,

            o.submitted_at,
            o.published_at,
            o.deadline_at,
            o.created_by_user_id::text AS created_by_user_id,
            o.validated_by_user_id::text AS validated_by_user_id,
            o.created_at,
            o.updated_at,
            COALESCE(e.commercial_name, e.legal_name) AS employer_name
        FROM aneti.job_offer o
        JOIN aneti.employer e ON e.id = o.employer_id

        LEFT JOIN geo.country offer_country
            ON offer_country.id = o.country_id

        LEFT JOIN geo.admin_unit gov
            ON gov.id = o.governorate_unit_id

        LEFT JOIN geo.admin_unit del_unit
            ON del_unit.id = o.delegation_unit_id

        LEFT JOIN taxonomy.taxonomy_node occ
            ON occ.id = o.occupation_node_id

        LEFT JOIN reference.ref_value rv_ct
            ON rv_ct.id = o.contract_type_ref_id

        LEFT JOIN reference.ref_value rv_wm
            ON rv_wm.id = o.work_mode_ref_id
"""


def list_offers(db: Session, employer_id: str | None = None) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            o.id::text AS id,
            o.aneti_identifier AS aneti_identifier,
            o.employer_id::text AS employer_id,

            -- Compatibilité front : company_name vient maintenant de employer
            COALESCE(e.commercial_name, e.legal_name, '') AS company_name,
            COALESCE(e.commercial_name, e.legal_name, '') AS employer_name,

            o.title,
            o.description,
            o.number_of_positions,
            o.status,

            o.contract_type_ref_id::text AS contract_type_ref_id,
            rv_ct.code AS contract_type,
            COALESCE(rv_ct.label_fr, rv_ct.label_en, rv_ct.label, rv_ct.code) AS contract_type_label,

            o.work_mode_ref_id::text AS work_mode_ref_id,
            rv_wm.code AS work_mode,
            COALESCE(rv_wm.label_fr, rv_wm.label_en, rv_wm.label, rv_wm.code) AS work_mode_label,

            o.salary_min,
            o.salary_max,
            COALESCE(o.salary_currency_code, 'TND') AS salary_currency_code,

            o.country_id::text AS country_id,
            offer_country.iso2 AS country,
            COALESCE(offer_country.name_fr, offer_country.name_en, offer_country.iso2) AS country_label,

            o.governorate_unit_id::text AS governorate_unit_id,
            gov.code AS governorate_code,
            COALESCE(gov.label_fr, gov.label_en, gov.label, gov.code) AS governorate_label,

            o.delegation_unit_id::text AS delegation_unit_id,
            del_unit.code AS delegation_code,
            COALESCE(del_unit.label_fr, del_unit.label_en, del_unit.label, del_unit.code) AS delegation_label,

            o.imada_unit_id::text AS imada_unit_id,
            ima_unit.code AS imada_code,
            COALESCE(ima_unit.label_fr, ima_unit.label_en, ima_unit.label, ima_unit.code) AS imada_label,

            o.location_unit_id::text AS location_unit_id,
            loc_unit.code AS location_code,
            COALESCE(loc_unit.label_fr, loc_unit.label_en, loc_unit.label, loc_unit.code) AS location_label,

            o.postal_code_id::text AS postal_code_id,
            o.postal_code,

            o.occupation_node_id::text AS occupation_node_id,
            occ.preferred_label AS occupation_node_label,

            o.min_experience_months,
            o.diploma_ref_id::text AS diploma_ref_id,
            rv_diploma.code AS diploma_code,
            COALESCE(rv_diploma.label_fr, rv_diploma.label_en, rv_diploma.label, rv_diploma.code) AS diploma_label,

            o.specialty_ref_id::text AS specialty_ref_id,
            rv_specialty.code AS specialty_code,
            COALESCE(rv_specialty.label_fr, rv_specialty.label_en, rv_specialty.label, rv_specialty.code) AS specialty_label,

            COALESCE(o.is_accessible_to_disabled, FALSE) AS is_accessible_to_disabled,
            o.accessibility_notes,

            o.submitted_at,
            o.published_at,
            o.deadline_at,
            o.created_by_user_id::text AS created_by_user_id,
            o.validated_by_user_id::text AS validated_by_user_id,
            o.created_at,
            o.updated_at

        FROM aneti.job_offer o

        JOIN aneti.employer e
            ON e.id = o.employer_id

        LEFT JOIN geo.country offer_country
            ON offer_country.id = o.country_id

        LEFT JOIN geo.admin_unit gov
            ON gov.id = o.governorate_unit_id

        LEFT JOIN geo.admin_unit del_unit
            ON del_unit.id = o.delegation_unit_id

        LEFT JOIN geo.admin_unit ima_unit
            ON ima_unit.id = o.imada_unit_id

        LEFT JOIN geo.admin_unit loc_unit
            ON loc_unit.id = o.location_unit_id

        LEFT JOIN taxonomy.taxonomy_node occ
            ON occ.id = o.occupation_node_id

        LEFT JOIN reference.ref_value rv_ct
            ON rv_ct.id = o.contract_type_ref_id

        LEFT JOIN reference.ref_value rv_wm
            ON rv_wm.id = o.work_mode_ref_id

        LEFT JOIN reference.ref_value rv_diploma
            ON rv_diploma.id = o.diploma_ref_id

        LEFT JOIN reference.ref_value rv_specialty
            ON rv_specialty.id = o.specialty_ref_id

        WHERE (:employer_id IS NULL OR o.employer_id = CAST(:employer_id AS uuid))
        ORDER BY o.updated_at DESC;
        """,
        {"employer_id": employer_id},
    )


def get_offer_by_id(db: Session, offer_id: str) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            o.id::text AS id,
            o.aneti_identifier AS aneti_identifier,
            o.employer_id::text AS employer_id,

            -- Compatibilité front : company_name vient maintenant de employer
            COALESCE(e.commercial_name, e.legal_name, '') AS company_name,
            COALESCE(e.commercial_name, e.legal_name, '') AS employer_name,

            o.title,
            o.description,
            o.number_of_positions,
            o.status,

            o.contract_type_ref_id::text AS contract_type_ref_id,
            rv_ct.code AS contract_type,
            COALESCE(rv_ct.label_fr, rv_ct.label_en, rv_ct.label, rv_ct.code) AS contract_type_label,

            o.work_mode_ref_id::text AS work_mode_ref_id,
            rv_wm.code AS work_mode,
            COALESCE(rv_wm.label_fr, rv_wm.label_en, rv_wm.label, rv_wm.code) AS work_mode_label,

            o.salary_min,
            o.salary_max,
            COALESCE(o.salary_currency_code, 'TND') AS salary_currency_code,

            o.country_id::text AS country_id,
            offer_country.iso2 AS country,
            COALESCE(offer_country.name_fr, offer_country.name_en, offer_country.iso2) AS country_label,

            o.governorate_unit_id::text AS governorate_unit_id,
            gov.code AS governorate_code,
            COALESCE(gov.label_fr, gov.label_en, gov.label, gov.code) AS governorate_label,

            o.delegation_unit_id::text AS delegation_unit_id,
            del_unit.code AS delegation_code,
            COALESCE(del_unit.label_fr, del_unit.label_en, del_unit.label, del_unit.code) AS delegation_label,

            o.imada_unit_id::text AS imada_unit_id,
            ima_unit.code AS imada_code,
            COALESCE(ima_unit.label_fr, ima_unit.label_en, ima_unit.label, ima_unit.code) AS imada_label,

            o.location_unit_id::text AS location_unit_id,
            loc_unit.code AS location_code,
            COALESCE(loc_unit.label_fr, loc_unit.label_en, loc_unit.label, loc_unit.code) AS location_label,

            o.postal_code_id::text AS postal_code_id,
            o.postal_code,

            o.occupation_node_id::text AS occupation_node_id,
            occ.preferred_label AS occupation_node_label,

            o.min_experience_months,

            o.diploma_ref_id::text AS diploma_ref_id,
            rv_diploma.code AS diploma_code,
            COALESCE(rv_diploma.label_fr, rv_diploma.label_en, rv_diploma.label, rv_diploma.code) AS diploma_label,

            o.specialty_ref_id::text AS specialty_ref_id,
            rv_specialty.code AS specialty_code,
            COALESCE(rv_specialty.label_fr, rv_specialty.label_en, rv_specialty.label, rv_specialty.code) AS specialty_label,

            COALESCE(o.is_accessible_to_disabled, FALSE) AS is_accessible_to_disabled,
            o.accessibility_notes,

            o.submitted_at,
            o.published_at,
            o.deadline_at,
            o.created_by_user_id::text AS created_by_user_id,
            o.validated_by_user_id::text AS validated_by_user_id,
            o.created_at,
            o.updated_at

        FROM aneti.job_offer o

        JOIN aneti.employer e
            ON e.id = o.employer_id

        LEFT JOIN geo.country offer_country
            ON offer_country.id = o.country_id

        LEFT JOIN geo.admin_unit gov
            ON gov.id = o.governorate_unit_id

        LEFT JOIN geo.admin_unit del_unit
            ON del_unit.id = o.delegation_unit_id

        LEFT JOIN geo.admin_unit ima_unit
            ON ima_unit.id = o.imada_unit_id

        LEFT JOIN geo.admin_unit loc_unit
            ON loc_unit.id = o.location_unit_id

        LEFT JOIN taxonomy.taxonomy_node occ
            ON occ.id = o.occupation_node_id

        LEFT JOIN reference.ref_value rv_ct
            ON rv_ct.id = o.contract_type_ref_id

        LEFT JOIN reference.ref_value rv_wm
            ON rv_wm.id = o.work_mode_ref_id

        LEFT JOIN reference.ref_value rv_diploma
            ON rv_diploma.id = o.diploma_ref_id

        LEFT JOIN reference.ref_value rv_specialty
            ON rv_specialty.id = o.specialty_ref_id

        WHERE o.id = CAST(:offer_id AS uuid)
        LIMIT 1;
        """,
        {"offer_id": offer_id},
    )


def create_offer(db: Session, payload: Mapping[str, object]) -> dict | None:
    params = dict(payload)

    status = params.get("status") or "DRAFT"

    return _fetch_one(
        db,
        """
        INSERT INTO aneti.job_offer (
            employer_id,
            occupation_node_id,
            title,
            description,
            number_of_positions,
            status,

            contract_type_ref_id,
            work_mode_ref_id,

            salary_min,
            salary_max,
            salary_currency_code,

            country_id,
            governorate_unit_id,
            delegation_unit_id,
            imada_unit_id,
            location_unit_id,
            postal_code_id,
            postal_code,

            min_experience_months,
            diploma_ref_id,
            specialty_ref_id,

            is_accessible_to_disabled,
            accessibility_notes,

            deadline_at,
            submitted_at,
            published_at,
            created_by_user_id
        )
        VALUES (
            CAST(:employer_id AS uuid),

            CASE
                WHEN :occupation_node_id IS NOT NULL AND :occupation_node_id != ''
                THEN CAST(:occupation_node_id AS uuid)
            END,

            :title,
            :description,
            COALESCE(:number_of_positions, 1),
            COALESCE(:status, 'DRAFT'),

            COALESCE(
                CASE
                    WHEN :contract_type_ref_id IS NOT NULL AND :contract_type_ref_id != ''
                    THEN CAST(:contract_type_ref_id AS uuid)
                END,
                (
                    SELECT rv.id
                    FROM reference.ref_value rv
                    JOIN reference.ref_group rg ON rg.id = rv.group_id
                    WHERE rg.code = 'CONTRACT_TYPE'
                      AND rv.code = :contract_type
                    LIMIT 1
                )
            ),

            COALESCE(
                CASE
                    WHEN :work_mode_ref_id IS NOT NULL AND :work_mode_ref_id != ''
                    THEN CAST(:work_mode_ref_id AS uuid)
                END,
                (
                    SELECT rv.id
                    FROM reference.ref_value rv
                    JOIN reference.ref_group rg ON rg.id = rv.group_id
                    WHERE rg.code = 'WORK_MODE'
                      AND rv.code = :work_mode
                    LIMIT 1
                )
            ),

            :salary_min,
            :salary_max,
            COALESCE(:salary_currency_code, 'TND'),

            COALESCE(
                CASE
                    WHEN :country_id IS NOT NULL AND :country_id != ''
                    THEN CAST(:country_id AS uuid)
                END,
                (
                    SELECT c.id
                    FROM geo.country c
                    WHERE c.iso2 = COALESCE(NULLIF(:country, ''), 'TN')
                    LIMIT 1
                )
            ),

            COALESCE(
                CASE
                    WHEN :governorate_unit_id IS NOT NULL AND :governorate_unit_id != ''
                    THEN CAST(:governorate_unit_id AS uuid)
                END,
                (
                    SELECT au.id
                    FROM geo.admin_unit au
                    JOIN geo.country cn ON cn.id = au.country_id
                    WHERE cn.iso2 = COALESCE(NULLIF(:country, ''), 'TN')
                      AND au.admin_level = 1
                      AND au.code = :governorate_code
                    LIMIT 1
                )
            ),

            COALESCE(
                CASE
                    WHEN :delegation_unit_id IS NOT NULL AND :delegation_unit_id != ''
                    THEN CAST(:delegation_unit_id AS uuid)
                END,
                (
                    SELECT au.id
                    FROM geo.admin_unit au
                    JOIN geo.country cn ON cn.id = au.country_id
                    WHERE cn.iso2 = COALESCE(NULLIF(:country, ''), 'TN')
                      AND au.admin_level = 2
                      AND au.code = :delegation_code
                    LIMIT 1
                )
            ),

            CASE
                WHEN :imada_unit_id IS NOT NULL AND :imada_unit_id != ''
                THEN CAST(:imada_unit_id AS uuid)
            END,

            COALESCE(
                CASE
                    WHEN :imada_unit_id IS NOT NULL AND :imada_unit_id != ''
                    THEN CAST(:imada_unit_id AS uuid)
                END,
                CASE
                    WHEN :location_unit_id IS NOT NULL AND :location_unit_id != ''
                    THEN CAST(:location_unit_id AS uuid)
                END,
                CASE
                    WHEN :delegation_unit_id IS NOT NULL AND :delegation_unit_id != ''
                    THEN CAST(:delegation_unit_id AS uuid)
                END,
                CASE
                    WHEN :governorate_unit_id IS NOT NULL AND :governorate_unit_id != ''
                    THEN CAST(:governorate_unit_id AS uuid)
                END
            ),

            CASE
                WHEN :postal_code_id IS NOT NULL AND :postal_code_id != ''
                THEN CAST(:postal_code_id AS uuid)
            END,

            :postal_code,

            :min_experience_months,

            CASE
                WHEN :diploma_ref_id IS NOT NULL AND :diploma_ref_id != ''
                THEN CAST(:diploma_ref_id AS uuid)
            END,

            CASE
                WHEN :specialty_ref_id IS NOT NULL AND :specialty_ref_id != ''
                THEN CAST(:specialty_ref_id AS uuid)
            END,

            COALESCE(:is_accessible_to_disabled, FALSE),
            :accessibility_notes,

            :deadline_at,

            CASE
                WHEN COALESCE(:status, 'DRAFT') IN ('SUBMITTED', 'PUBLISHED', 'VALIDATED', 'ACTIVE')
                THEN COALESCE(:submitted_at, now())
                ELSE :submitted_at
            END,

            CASE
                WHEN COALESCE(:status, 'DRAFT') IN ('PUBLISHED', 'ACTIVE')
                THEN COALESCE(:published_at, now())
                ELSE :published_at
            END,

            CAST(:created_by_user_id AS uuid)
        )
        RETURNING
            id::text AS id,
            aneti_identifier AS aneti_identifier;
        """,
        {
            "employer_id": params.get("employer_id"),
            "occupation_node_id": str(params.get("occupation_node_id") or "") or None,

            "title": params.get("title"),
            "description": params.get("description"),
            "number_of_positions": params.get("number_of_positions"),
            "status": status,

            "contract_type_ref_id": str(params.get("contract_type_ref_id") or "") or None,
            "contract_type": params.get("contract_type"),

            "work_mode_ref_id": str(params.get("work_mode_ref_id") or "") or None,
            "work_mode": params.get("work_mode"),

            "salary_min": params.get("salary_min"),
            "salary_max": params.get("salary_max"),
            "salary_currency_code": params.get("salary_currency_code") or "TND",

            "country_id": str(params.get("country_id") or "") or None,
            "country": params.get("country") or "TN",

            "governorate_unit_id": str(params.get("governorate_unit_id") or "") or None,
            "governorate_code": params.get("governorate_code"),

            "delegation_unit_id": str(params.get("delegation_unit_id") or "") or None,
            "delegation_code": params.get("delegation_code"),

            "imada_unit_id": str(params.get("imada_unit_id") or "") or None,
            "location_unit_id": str(params.get("location_unit_id") or "") or None,
            "postal_code_id": str(params.get("postal_code_id") or "") or None,
            "postal_code": params.get("postal_code"),

            "min_experience_months": params.get("min_experience_months"),

            "diploma_ref_id": str(params.get("diploma_ref_id") or "") or None,
            "specialty_ref_id": str(params.get("specialty_ref_id") or "") or None,

            "is_accessible_to_disabled": params.get("is_accessible_to_disabled"),
            "accessibility_notes": params.get("accessibility_notes"),

            "deadline_at": params.get("deadline_at"),
            "submitted_at": params.get("submitted_at"),
            "published_at": params.get("published_at"),

            "created_by_user_id": params.get("created_by_user_id"),
        },
    )


def update_offer(db: Session, offer_id: str, payload: Mapping[str, object]) -> dict | None:
    params = dict(payload)
    params["offer_id"] = offer_id

    return _fetch_one(
        db,
        """
        UPDATE aneti.job_offer
        SET
            occupation_node_id = COALESCE(
                CASE
                    WHEN :occupation_node_id IS NOT NULL AND :occupation_node_id != ''
                    THEN CAST(:occupation_node_id AS uuid)
                END,
                occupation_node_id
            ),

            title = COALESCE(:title, title),
            description = COALESCE(:description, description),
            number_of_positions = COALESCE(:number_of_positions, number_of_positions),
            status = COALESCE(:status, status),

            contract_type_ref_id = COALESCE(
                CASE
                    WHEN :contract_type_ref_id IS NOT NULL AND :contract_type_ref_id != ''
                    THEN CAST(:contract_type_ref_id AS uuid)
                END,
                (
                    SELECT rv.id
                    FROM reference.ref_value rv
                    JOIN reference.ref_group rg ON rg.id = rv.group_id
                    WHERE rg.code = 'CONTRACT_TYPE'
                      AND rv.code = :contract_type
                    LIMIT 1
                ),
                contract_type_ref_id
            ),

            work_mode_ref_id = COALESCE(
                CASE
                    WHEN :work_mode_ref_id IS NOT NULL AND :work_mode_ref_id != ''
                    THEN CAST(:work_mode_ref_id AS uuid)
                END,
                (
                    SELECT rv.id
                    FROM reference.ref_value rv
                    JOIN reference.ref_group rg ON rg.id = rv.group_id
                    WHERE rg.code = 'WORK_MODE'
                      AND rv.code = :work_mode
                    LIMIT 1
                ),
                work_mode_ref_id
            ),

            salary_min = COALESCE(:salary_min, salary_min),
            salary_max = COALESCE(:salary_max, salary_max),
            salary_currency_code = COALESCE(:salary_currency_code, salary_currency_code, 'TND'),

            country_id = COALESCE(
                CASE
                    WHEN :country_id IS NOT NULL AND :country_id != ''
                    THEN CAST(:country_id AS uuid)
                END,
                (
                    SELECT c.id
                    FROM geo.country c
                    WHERE c.iso2 = COALESCE(NULLIF(:country, ''), 'TN')
                    LIMIT 1
                ),
                country_id
            ),

            governorate_unit_id = COALESCE(
                CASE
                    WHEN :governorate_unit_id IS NOT NULL AND :governorate_unit_id != ''
                    THEN CAST(:governorate_unit_id AS uuid)
                END,
                (
                    SELECT au.id
                    FROM geo.admin_unit au
                    JOIN geo.country cn ON cn.id = au.country_id
                    WHERE cn.iso2 = COALESCE(NULLIF(:country, ''), 'TN')
                      AND au.admin_level = 1
                      AND au.code = :governorate_code
                    LIMIT 1
                ),
                governorate_unit_id
            ),

            delegation_unit_id = COALESCE(
                CASE
                    WHEN :delegation_unit_id IS NOT NULL AND :delegation_unit_id != ''
                    THEN CAST(:delegation_unit_id AS uuid)
                END,
                (
                    SELECT au.id
                    FROM geo.admin_unit au
                    JOIN geo.country cn ON cn.id = au.country_id
                    WHERE cn.iso2 = COALESCE(NULLIF(:country, ''), 'TN')
                      AND au.admin_level = 2
                      AND au.code = :delegation_code
                    LIMIT 1
                ),
                delegation_unit_id
            ),

            imada_unit_id = COALESCE(
                CASE
                    WHEN :imada_unit_id IS NOT NULL AND :imada_unit_id != ''
                    THEN CAST(:imada_unit_id AS uuid)
                END,
                imada_unit_id
            ),

            location_unit_id = COALESCE(
                CASE
                    WHEN :imada_unit_id IS NOT NULL AND :imada_unit_id != ''
                    THEN CAST(:imada_unit_id AS uuid)
                END,
                CASE
                    WHEN :location_unit_id IS NOT NULL AND :location_unit_id != ''
                    THEN CAST(:location_unit_id AS uuid)
                END,
                CASE
                    WHEN :delegation_unit_id IS NOT NULL AND :delegation_unit_id != ''
                    THEN CAST(:delegation_unit_id AS uuid)
                END,
                CASE
                    WHEN :governorate_unit_id IS NOT NULL AND :governorate_unit_id != ''
                    THEN CAST(:governorate_unit_id AS uuid)
                END,
                location_unit_id
            ),

            postal_code_id = COALESCE(
                CASE
                    WHEN :postal_code_id IS NOT NULL AND :postal_code_id != ''
                    THEN CAST(:postal_code_id AS uuid)
                END,
                postal_code_id
            ),

            postal_code = COALESCE(:postal_code, postal_code),

            min_experience_months = COALESCE(:min_experience_months, min_experience_months),

            diploma_ref_id = COALESCE(
                CASE
                    WHEN :diploma_ref_id IS NOT NULL AND :diploma_ref_id != ''
                    THEN CAST(:diploma_ref_id AS uuid)
                END,
                diploma_ref_id
            ),

            specialty_ref_id = COALESCE(
                CASE
                    WHEN :specialty_ref_id IS NOT NULL AND :specialty_ref_id != ''
                    THEN CAST(:specialty_ref_id AS uuid)
                END,
                specialty_ref_id
            ),

            is_accessible_to_disabled = COALESCE(
                :is_accessible_to_disabled,
                is_accessible_to_disabled,
                false
            ),

            accessibility_notes = COALESCE(:accessibility_notes, accessibility_notes),
            deadline_at = COALESCE(:deadline_at, deadline_at),

            submitted_at = CASE
                WHEN COALESCE(:status, status) IN ('SUBMITTED', 'PUBLISHED', 'VALIDATED', 'ACTIVE')
                THEN COALESCE(submitted_at, now())
                ELSE submitted_at
            END,

            published_at = CASE
                WHEN COALESCE(:status, status) IN ('PUBLISHED', 'ACTIVE')
                THEN COALESCE(published_at, now())
                ELSE published_at
            END,

            updated_at = now()

        WHERE id = CAST(:offer_id AS uuid)

        RETURNING
            id::text AS id,
            aneti_identifier AS aneti_identifier;
        """,
        {
            "offer_id": offer_id,

            "occupation_node_id": str(params.get("occupation_node_id") or "") or None,

            "title": params.get("title"),
            "description": params.get("description"),
            "number_of_positions": params.get("number_of_positions"),
            "status": params.get("status"),

            "contract_type_ref_id": str(params.get("contract_type_ref_id") or "") or None,
            "contract_type": params.get("contract_type"),

            "work_mode_ref_id": str(params.get("work_mode_ref_id") or "") or None,
            "work_mode": params.get("work_mode"),

            "salary_min": params.get("salary_min"),
            "salary_max": params.get("salary_max"),
            "salary_currency_code": params.get("salary_currency_code"),

            "country_id": str(params.get("country_id") or "") or None,
            "country": params.get("country") or "TN",

            "governorate_unit_id": str(params.get("governorate_unit_id") or "") or None,
            "governorate_code": params.get("governorate_code"),

            "delegation_unit_id": str(params.get("delegation_unit_id") or "") or None,
            "delegation_code": params.get("delegation_code"),

            "imada_unit_id": str(params.get("imada_unit_id") or "") or None,
            "location_unit_id": str(params.get("location_unit_id") or "") or None,
            "postal_code_id": str(params.get("postal_code_id") or "") or None,
            "postal_code": params.get("postal_code"),

            "min_experience_months": params.get("min_experience_months"),

            "diploma_ref_id": str(params.get("diploma_ref_id") or "") or None,
            "specialty_ref_id": str(params.get("specialty_ref_id") or "") or None,

            "is_accessible_to_disabled": params.get("is_accessible_to_disabled"),
            "accessibility_notes": params.get("accessibility_notes"),
            "deadline_at": params.get("deadline_at"),
        },
    )


def set_offer_status(
    db: Session,
    offer_id: str,
    *,
    status_value: str,
    validated_by_user_id: str | None = None,
    published_at: bool = False,
) -> dict | None:
    return _fetch_one(
        db,
        """
        UPDATE aneti.job_offer
        SET
            status = :status_value,

            submitted_at = CASE
                WHEN :status_value IN ('SUBMITTED', 'UNDER_REVIEW', 'VALIDATED', 'PUBLISHED', 'ACTIVE')
                THEN COALESCE(submitted_at, now())
                ELSE submitted_at
            END,

            validated_by_user_id = CASE
                WHEN :validated_by_user_id IS NOT NULL
                     AND :validated_by_user_id != ''
                THEN CAST(:validated_by_user_id AS uuid)
                ELSE validated_by_user_id
            END,

            published_at = CASE
                WHEN :published_at = true
                     OR :status_value IN ('PUBLISHED', 'ACTIVE')
                THEN COALESCE(published_at, now())
                ELSE published_at
            END,

            updated_at = now()

        WHERE id = CAST(:offer_id AS uuid)

        RETURNING
            id::text AS id,
            aneti_identifier AS aneti_identifier,
            status;
        """,
        {
            "offer_id": offer_id,
            "status_value": status_value,
            "validated_by_user_id": validated_by_user_id,
            "published_at": published_at,
        },
    )


# ─── Requirements ─────────────────────────────────────────────────────────────

def list_offer_requirements(db: Session, offer_id: str) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            r.id::text AS id,

            rv_ct.code AS criterion_type,
            rv_ct.id::text AS criterion_type_ref_id,
            COALESCE(rv_ct.label_fr, rv_ct.label_en, rv_ct.label, rv_ct.code) AS criterion_type_label,

            r.taxonomy_node_id::text AS taxonomy_node_id,
            n.preferred_label AS node_label,
            n.node_type AS node_type,

            r.ref_value_id::text AS ref_value_id,
            COALESCE(rv.label_fr, rv.label_en, rv.label, rv.code) AS ref_value_label,

            rv_ml.code AS min_level,
            r.min_level_ref_id::text AS min_level_ref_id,
            COALESCE(rv_ml.label_fr, rv_ml.label_en, rv_ml.label, rv_ml.code) AS min_level_label,

            r.min_years,
            r.is_must,
            r.weight,
            r.created_at,
            r.updated_at
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
        ORDER BY r.created_at ASC;
        """,
        {"offer_id": offer_id},
    )

def delete_offer_requirements(db: Session, offer_id: str) -> None:
    db.execute(
        text("""
        DELETE FROM aneti.job_offer_requirement
        WHERE offer_id = CAST(:offer_id AS uuid);
        """),
        {"offer_id": offer_id},
    )


def create_offer_requirement(db: Session, offer_id: str, payload: Mapping[str, object]) -> dict:
    params = dict(payload)
    params["offer_id"] = offer_id
    params["weight"] = params.get("weight") if params.get("weight") is not None else 1.0

    return _fetch_one(
        db,
        """
        INSERT INTO aneti.job_offer_requirement (
            offer_id,
            criterion_type_ref_id,
            taxonomy_node_id,
            ref_value_id,
            min_level_ref_id,
            min_years,
            is_must,
            weight
        )
        VALUES (
            CAST(:offer_id AS uuid),

            COALESCE(
                CASE WHEN :criterion_type_ref_id IS NOT NULL AND :criterion_type_ref_id != ''
                     THEN CAST(:criterion_type_ref_id AS uuid) END,
                (
                    SELECT rv.id FROM reference.ref_value rv
                    JOIN reference.ref_group rg ON rg.id = rv.group_id
                    WHERE rg.code = 'CRITERION_TYPE'
                      AND rv.code = :criterion_type
                    LIMIT 1
                )
            ),

            CASE WHEN :taxonomy_node_id IS NOT NULL AND :taxonomy_node_id != ''
                 THEN CAST(:taxonomy_node_id AS uuid) END,

            CASE WHEN :ref_value_id IS NOT NULL AND :ref_value_id != ''
                 THEN CAST(:ref_value_id AS uuid) END,

            COALESCE(
                CASE WHEN :min_level_ref_id IS NOT NULL AND :min_level_ref_id != ''
                     THEN CAST(:min_level_ref_id AS uuid) END,
                (
                    SELECT rv.id FROM reference.ref_value rv
                    JOIN reference.ref_group rg ON rg.id = rv.group_id
                    WHERE rg.code IN ('SKILL_LEVEL', 'LANGUAGE_LEVEL', 'LEVEL')
                      AND rv.code = :min_level_code
                    LIMIT 1
                )
            ),

            :min_years,
            :is_must,
            :weight
        )
        RETURNING id::text AS id;
        """,
        {
            "offer_id":              offer_id,
            "criterion_type":        params.get("criterion_type"),
            "criterion_type_ref_id": str(params.get("criterion_type_ref_id") or "") or None,
            "taxonomy_node_id":      str(params.get("taxonomy_node_id") or "") or None,
            "ref_value_id":          str(params.get("ref_value_id") or "") or None,
            "min_level_ref_id":      str(params.get("min_level_ref_id") or "") or None,
            "min_level_code":        params.get("min_level_code"),
            "min_years":             params.get("min_years"),
            "is_must":               params.get("is_must", False),
            "weight":                params["weight"],
        },
    )

# ─── Language requirements ────────────────────────────────────────────────────

def list_offer_language_requirements(db: Session, offer_id: str) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            lr.id::text AS id,
            lr.offer_id::text AS offer_id,

            lr.language_ref_id::text AS language_ref_id,
            COALESCE(lang.code) AS language_code,
            COALESCE(lang.label_fr, lang.label_en, lang.label, lang.code) AS language_label,

            lr.level_ref_id::text AS level_ref_id,
            COALESCE(lvl.code) AS level_code,
            COALESCE(lvl.label_fr, lvl.label_en, lvl.label, lvl.code) AS level_label,

            lr.is_mandatory,
            lr.created_at,
            lr.updated_at
        FROM aneti.job_offer_language_requirement lr
        LEFT JOIN reference.ref_value lang
            ON lang.id = lr.language_ref_id
        LEFT JOIN reference.ref_value lvl
            ON lvl.id = lr.level_ref_id
        WHERE lr.offer_id = CAST(:offer_id AS uuid)
        ORDER BY lr.created_at ASC;
        """,
        {"offer_id": offer_id},
    )


def delete_offer_language_requirements(db: Session, offer_id: str) -> None:
    db.execute(
        text("""
        DELETE FROM aneti.job_offer_language_requirement
        WHERE offer_id = CAST(:offer_id AS uuid);
        """),
        {"offer_id": offer_id},
    )


def create_offer_language_requirement(db: Session, offer_id: str, payload: Mapping[str, object]) -> dict:
    params = dict(payload)
    params["offer_id"] = offer_id

    return _fetch_one(
        db,
        """
        INSERT INTO aneti.job_offer_language_requirement (
            offer_id,
            language_ref_id,
            level_ref_id,
            is_mandatory
        )
        VALUES (
            CAST(:offer_id AS uuid),

            COALESCE(
                CASE WHEN :language_ref_id IS NOT NULL AND :language_ref_id != ''
                     THEN CAST(:language_ref_id AS uuid) END,
                (
                    SELECT v.id
                    FROM reference.ref_value v
                    JOIN reference.ref_group g ON g.id = v.group_id
                    WHERE g.code = 'LANGUAGE'
                      AND lower(v.code) = lower(:language_code)
                    LIMIT 1
                )
            ),

            COALESCE(
                CASE WHEN :level_ref_id IS NOT NULL AND :level_ref_id != ''
                     THEN CAST(:level_ref_id AS uuid) END,
                (
                    SELECT v.id
                    FROM reference.ref_value v
                    JOIN reference.ref_group g ON g.id = v.group_id
                    WHERE g.code = 'LANGUAGE_LEVEL'
                      AND lower(v.code) = lower(
                            CASE
                                WHEN :level_code = 'basic'        THEN 'A2'
                                WHEN :level_code = 'intermediate'  THEN 'B1'
                                WHEN :level_code = 'advanced'      THEN 'B2'
                                WHEN :level_code = 'fluent'        THEN 'C1'
                                WHEN :level_code = 'native'        THEN 'C2'
                                ELSE :level_code
                            END
                      )
                    LIMIT 1
                )
            ),

            COALESCE(:is_mandatory, true)
        )
        RETURNING id::text AS id;
        """,
        {
            "offer_id":       offer_id,
            "language_ref_id": str(params.get("language_ref_id") or "") or None,
            "language_code":  params.get("language_code"),
            "level_ref_id":   str(params.get("level_ref_id") or "") or None,
            "level_code":     params.get("level_code"),
            "is_mandatory":   params.get("is_mandatory", True),
        },
    )

# ─── Stats ────────────────────────────────────────────────────────────────────

def count_offer_stats(db: Session) -> dict:
    return _fetch_one(
        db,
        """
        SELECT
            COUNT(*) FILTER (WHERE status IN ('SUBMITTED', 'UNDER_REVIEW'))::int AS pending_offers_count,
            COUNT(*) FILTER (WHERE status = 'PUBLISHED')::int AS published_offers_count
        FROM aneti.job_offer;
        """,
    )
