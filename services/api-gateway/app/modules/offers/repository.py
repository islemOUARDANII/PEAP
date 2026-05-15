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
            o.contract_type,
            o.work_mode,
            o.salary_min,
            o.salary_max,
            COALESCE(o.salary_currency_code, 'TND') AS salary_currency_code,

            -- Canonical geo ids
            o.country_id::text AS country_id,
            o.governorate_unit_id::text AS governorate_unit_id,
            o.delegation_unit_id::text AS delegation_unit_id,

            -- Resolved country iso2
            COALESCE(country.iso2, o.country) AS country,

            -- Resolved governorate
            COALESCE(gov.code, o.governorate_code) AS governorate_code,
            COALESCE(
                gov.label_fr,
                gov.label_en,
                gov.label,
                gov.code,
                o.governorate_code
            ) AS governorate_label,

            -- Resolved delegation
            COALESCE(del_unit.code, o.delegation_code) AS delegation_code,
            COALESCE(
                del_unit.label_fr,
                del_unit.label_en,
                del_unit.label,
                del_unit.code,
                o.delegation_code
            ) AS delegation_label,

            -- Canonical occupation
            COALESCE(o.occupation_node_id, o.rtmc_occupation_id)::text AS occupation_node_id,
            occ.preferred_label AS occupation_node_label,

            -- Experience & education
            o.min_experience_months,
            o.diploma_ref_id::text AS diploma_ref_id,
            o.specialty_ref_id::text AS specialty_ref_id,

            -- Accessibility
            COALESCE(o.is_accessible_to_disabled, FALSE) AS is_accessible_to_disabled,
            o.accessibility_notes,

            o.published_at,
            o.deadline_at,
            o.created_by_user_id::text AS created_by_user_id,
            o.validated_by_user_id::text AS validated_by_user_id,
            o.created_at,
            o.updated_at,
            COALESCE(e.commercial_name, e.legal_name) AS employer_name
        FROM aneti.job_offer o
        JOIN aneti.employer e ON e.id = o.employer_id

        LEFT JOIN geo.country country
            ON country.id = o.country_id

        LEFT JOIN geo.admin_unit gov
            ON gov.id = o.governorate_unit_id

        LEFT JOIN geo.admin_unit del_unit
            ON del_unit.id = o.delegation_unit_id

        LEFT JOIN taxonomy.taxonomy_node occ
            ON occ.id = COALESCE(o.occupation_node_id, o.rtmc_occupation_id)
"""


def list_offers(db: Session, employer_id: str | None = None) -> list[dict]:
    return _fetch_all(
        db,
        f"""
        {_OFFER_SELECT}
        WHERE (:employer_id IS NULL OR o.employer_id = CAST(:employer_id AS uuid))
        ORDER BY o.updated_at DESC;
        """,
        {"employer_id": employer_id},
    )


def get_offer_by_id(db: Session, offer_id: str) -> dict | None:
    return _fetch_one(
        db,
        f"""
        {_OFFER_SELECT}
        WHERE o.id = CAST(:offer_id AS uuid)
        LIMIT 1;
        """,
        {"offer_id": offer_id},
    )


def create_offer(db: Session, payload: Mapping[str, object]) -> dict:
    return _fetch_one(
        db,
        """
        INSERT INTO aneti.job_offer (
            employer_id,
            occupation_node_id,
            rtmc_occupation_id,
            company_name,
            title,
            description,
            number_of_positions,
            status,
            contract_type,
            work_mode,
            salary_min,
            salary_max,
            salary_currency_code,
            country,
            governorate_code,
            delegation_code,
            country_id,
            governorate_unit_id,
            delegation_unit_id,
            min_experience_months,
            diploma_ref_id,
            specialty_ref_id,
            is_accessible_to_disabled,
            accessibility_notes,
            deadline_at,
            published_at,
            created_by_user_id
        )
        VALUES (
            CAST(:employer_id AS uuid),
            CAST(:occupation_node_id AS uuid),
            CAST(:occupation_node_id AS uuid),
            :company_name,
            :title,
            :description,
            :number_of_positions,
            'DRAFT',
            :contract_type,
            :work_mode,
            :salary_min,
            :salary_max,
            COALESCE(:salary_currency_code, 'TND'),
            :country,
            :governorate_code,
            :delegation_code,
            CAST(:country_id AS uuid),
            CAST(:governorate_unit_id AS uuid),
            CAST(:delegation_unit_id AS uuid),
            :min_experience_months,
            CAST(:diploma_ref_id AS uuid),
            CAST(:specialty_ref_id AS uuid),
            COALESCE(:is_accessible_to_disabled, FALSE),
            :accessibility_notes,
            :deadline_at,
            now(),
            CAST(:created_by_user_id AS uuid)
        )
        RETURNING
            id::text AS id,
            aneti_identifier AS aneti_identifier;
        """,
        dict(payload),
    )


def update_offer(db: Session, offer_id: str, payload: Mapping[str, object]) -> dict | None:
    params = dict(payload)
    params["offer_id"] = offer_id
    return _fetch_one(
        db,
        """
        UPDATE aneti.job_offer
        SET
            occupation_node_id       = CAST(:occupation_node_id AS uuid),
            rtmc_occupation_id       = CAST(:occupation_node_id AS uuid),
            company_name             = :company_name,
            title                    = :title,
            description              = :description,
            number_of_positions      = :number_of_positions,
            contract_type            = :contract_type,
            work_mode                = :work_mode,
            salary_min               = :salary_min,
            salary_max               = :salary_max,
            salary_currency_code     = COALESCE(:salary_currency_code, salary_currency_code, 'TND'),
            country                  = :country,
            governorate_code         = :governorate_code,
            delegation_code          = :delegation_code,
            country_id               = CAST(:country_id AS uuid),
            governorate_unit_id      = CAST(:governorate_unit_id AS uuid),
            delegation_unit_id       = CAST(:delegation_unit_id AS uuid),
            min_experience_months    = :min_experience_months,
            diploma_ref_id           = CAST(:diploma_ref_id AS uuid),
            specialty_ref_id         = CAST(:specialty_ref_id AS uuid),
            is_accessible_to_disabled = COALESCE(:is_accessible_to_disabled, FALSE),
            accessibility_notes      = :accessibility_notes,
            deadline_at              = :deadline_at
        WHERE id = CAST(:offer_id AS uuid)
        RETURNING
            id::text AS id,
            aneti_identifier AS aneti_identifier;
        """,
        params,
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
            validated_by_user_id = CAST(:validated_by_user_id AS uuid),
            published_at = CASE
                WHEN :published_at THEN now()
                ELSE published_at
            END
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
            r.criterion_type,

            r.taxonomy_node_id::text AS taxonomy_node_id,
            r.taxonomy_node_id::text AS node_id,

            n.preferred_label AS node_label,
            n.node_type AS node_type,

            r.ref_value_id::text AS ref_value_id,
            COALESCE(rv.label_fr, rv.label_en, rv.label, rv.code) AS ref_value_label,

            r.raw_value,
            r.min_level,
            r.min_years,
            r.is_must,
            r.weight,
            r.created_at,
            r.updated_at
        FROM aneti.job_offer_requirement r
        LEFT JOIN taxonomy.taxonomy_node n
            ON n.id = r.taxonomy_node_id
        LEFT JOIN reference.ref_value rv
            ON rv.id = r.ref_value_id
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

    # Backward compatibility:
    # frontend/service may still send node_id, but DB now uses taxonomy_node_id
    params["taxonomy_node_id"] = params.get("taxonomy_node_id") or params.get("node_id")
    params["ref_value_id"] = params.get("ref_value_id")
    params["weight"] = params.get("weight") if params.get("weight") is not None else 1.0

    return _fetch_one(
        db,
        """
        INSERT INTO aneti.job_offer_requirement (
            offer_id,
            criterion_type,
            taxonomy_node_id,
            ref_value_id,
            raw_value,
            min_level,
            min_years,
            is_must,
            weight
        )
        VALUES (
            CAST(:offer_id AS uuid),
            :criterion_type,

            CASE
                WHEN :taxonomy_node_id IS NULL OR :taxonomy_node_id = ''
                    THEN NULL
                ELSE CAST(:taxonomy_node_id AS uuid)
            END,

            CASE
                WHEN :ref_value_id IS NULL OR :ref_value_id = ''
                    THEN NULL
                ELSE CAST(:ref_value_id AS uuid)
            END,

            :raw_value,
            :min_level,
            :min_years,
            :is_must,
            :weight
        )
        RETURNING id::text AS id;
        """,
        params,
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
            COALESCE(lang.code, lr.language_code) AS language_code,
            COALESCE(lang.label_fr, lang.label_en, lang.label, lang.code, lr.language_code) AS language_label,

            lr.level_ref_id::text AS level_ref_id,
            COALESCE(lvl.code, lr.level_code) AS level_code,
            COALESCE(lvl.label_fr, lvl.label_en, lvl.label, lvl.code, lr.level_code) AS level_label,

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

    # Backward compatibility:
    # Front may send language_code / level_code.
    # New DB model stores language_ref_id / level_ref_id.
    params["language_ref_id"] = params.get("language_ref_id")
    params["level_ref_id"] = params.get("level_ref_id")
    params["language_code"] = params.get("language_code")
    params["level_code"] = params.get("level_code")

    return _fetch_one(
        db,
        """
        INSERT INTO aneti.job_offer_language_requirement (
            offer_id,
            language_ref_id,
            level_ref_id,
            language_code,
            level_code,
            is_mandatory
        )
        VALUES (
            CAST(:offer_id AS uuid),

            COALESCE(
                CASE
                    WHEN :language_ref_id IS NULL OR :language_ref_id = ''
                        THEN NULL
                    ELSE CAST(:language_ref_id AS uuid)
                END,
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
                CASE
                    WHEN :level_ref_id IS NULL OR :level_ref_id = ''
                        THEN NULL
                    ELSE CAST(:level_ref_id AS uuid)
                END,
                (
                    SELECT v.id
                    FROM reference.ref_value v
                    JOIN reference.ref_group g ON g.id = v.group_id
                    WHERE g.code = 'LANGUAGE_LEVEL'
                      AND lower(v.code) = lower(
                            CASE
                                WHEN :level_code = 'basic' THEN 'A2'
                                WHEN :level_code = 'intermediate' THEN 'B1'
                                WHEN :level_code = 'advanced' THEN 'B2'
                                WHEN :level_code = 'fluent' THEN 'C1'
                                WHEN :level_code = 'native' THEN 'C2'
                                ELSE :level_code
                            END
                      )
                    LIMIT 1
                )
            ),

            :language_code,

            CASE
                WHEN :level_code = 'basic' THEN 'A2'
                WHEN :level_code = 'intermediate' THEN 'B1'
                WHEN :level_code = 'advanced' THEN 'B2'
                WHEN :level_code = 'fluent' THEN 'C1'
                WHEN :level_code = 'native' THEN 'C2'
                ELSE :level_code
            END,

            COALESCE(:is_mandatory, true)
        )
        RETURNING id::text AS id;
        """,
        params,
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
