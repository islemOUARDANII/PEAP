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


def list_offers(db: Session, employer_id: str | None = None) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            o.id::text AS id,
            o.employer_id::text AS employer_id,
            o.title,
            o.description,
            o.number_of_positions,
            o.status,
            o.contract_type,
            o.work_mode,
            o.salary_min,
            o.salary_max,
            o.country,
            o.governorate_code,
            g.libelle_gouvernorat AS governorate_label,
            o.delegation_code,
            d.libelle_delegation AS delegation_label,
            o.published_at,
            o.deadline_at,
            o.created_by_user_id::text AS created_by_user_id,
            o.validated_by_user_id::text AS validated_by_user_id,
            o.created_at,
            o.updated_at,
            COALESCE(e.commercial_name, e.legal_name) AS employer_name
        FROM aneti.job_offer o
        JOIN aneti.employer e
            ON e.id = o.employer_id
        LEFT JOIN taxonomy.ref_n_gouvern g
            ON g.code_gouvernorat = o.governorate_code
        LEFT JOIN taxonomy.ref_n_delegat d
            ON d.code_delegation = o.delegation_code
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
            o.employer_id::text AS employer_id,
            o.title,
            o.description,
            o.number_of_positions,
            o.status,
            o.contract_type,
            o.work_mode,
            o.salary_min,
            o.salary_max,
            o.country,
            o.governorate_code,
            g.libelle_gouvernorat AS governorate_label,
            o.delegation_code,
            d.libelle_delegation AS delegation_label,
            o.published_at,
            o.deadline_at,
            o.created_by_user_id::text AS created_by_user_id,
            o.validated_by_user_id::text AS validated_by_user_id,
            o.created_at,
            o.updated_at,
            COALESCE(e.commercial_name, e.legal_name) AS employer_name
        FROM aneti.job_offer o
        JOIN aneti.employer e
            ON e.id = o.employer_id
        LEFT JOIN taxonomy.ref_n_gouvern g
            ON g.code_gouvernorat = o.governorate_code
        LEFT JOIN taxonomy.ref_n_delegat d
            ON d.code_delegation = o.delegation_code
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
            rtmc_occupation_id,
            title,
            description,
            number_of_positions,
            status,
            contract_type,
            work_mode,
            salary_min,
            salary_max,
            country,
            governorate_code,
            delegation_code,
            deadline_at,
            created_by_user_id
        )
        VALUES (
            CAST(:employer_id AS uuid),
            CAST(:rtmc_occupation_id AS uuid),
            :title,
            :description,
            :number_of_positions,
            :status,
            :contract_type,
            :work_mode,
            :salary_min,
            :salary_max,
            :country,
            :governorate_code,
            :delegation_code,
            :deadline_at,
            CAST(:created_by_user_id AS uuid)
        )
        RETURNING id::text AS id;
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
            rtmc_occupation_id = CAST(:rtmc_occupation_id AS uuid),
            title = :title,
            description = :description,
            number_of_positions = :number_of_positions,
            contract_type = :contract_type,
            work_mode = :work_mode,
            salary_min = :salary_min,
            salary_max = :salary_max,
            country = :country,
            governorate_code = :governorate_code,
            delegation_code = :delegation_code,
            deadline_at = :deadline_at
        WHERE id = CAST(:offer_id AS uuid)
        RETURNING id::text AS id;
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
        RETURNING id::text AS id, status;
        """,
        {
            "offer_id": offer_id,
            "status_value": status_value,
            "validated_by_user_id": validated_by_user_id,
            "published_at": published_at,
        },
    )


def list_offer_requirements(db: Session, offer_id: str) -> list[dict]:
    if taxonomy_node_exists(db):
        return _fetch_all(
            db,
            """
            SELECT
                r.id::text AS id,
                r.criterion_type,
                r.node_id::text AS node_id,
                n.label AS node_label,
                n.node_type,
                r.raw_value,
                r.min_level,
                r.min_years,
                r.is_must,
                r.weight,
                r.created_at,
                r.updated_at
            FROM aneti.job_offer_requirement r
            LEFT JOIN taxonomy.taxonomy_node n
                ON n.id = r.node_id
            WHERE r.offer_id = CAST(:offer_id AS uuid)
            ORDER BY r.created_at ASC;
            """,
            {"offer_id": offer_id},
        )

    return _fetch_all(
        db,
        """
        SELECT
            r.id::text AS id,
            r.criterion_type,
            r.node_id::text AS node_id,
            NULL::text AS node_label,
            NULL::text AS node_type,
            r.raw_value,
            r.min_level,
            r.min_years,
            r.is_must,
            r.weight,
            r.created_at,
            r.updated_at
        FROM aneti.job_offer_requirement r
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
    return _fetch_one(
        db,
        """
        INSERT INTO aneti.job_offer_requirement (
            offer_id,
            criterion_type,
            node_id,
            raw_value,
            min_level,
            min_years,
            is_must,
            weight
        )
        VALUES (
            CAST(:offer_id AS uuid),
            :criterion_type,
            CAST(:node_id AS uuid),
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
