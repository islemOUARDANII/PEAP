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
            e.sector_code,
            e.size_category,
            e.status,
            e.created_at,
            e.updated_at
        FROM aneti.employer e
        WHERE e.id = CAST(:employer_id AS uuid)
        LIMIT 1;
        """,
        {"employer_id": employer_id},
    )


def get_employer_by_user_id(db: Session, user_id: str) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            e.id::text AS id,
            e.user_id::text AS user_id,
            e.legal_name,
            e.commercial_name,
            e.tax_identifier,
            e.sector_code,
            e.size_category,
            e.status,
            e.created_at,
            e.updated_at
        FROM aneti.employer e
        WHERE e.user_id = CAST(:user_id AS uuid)
        LIMIT 1;
        """,
        {"user_id": user_id},
    )


def update_employer(db: Session, employer_id: str, payload: Mapping[str, object]) -> dict | None:
    params = dict(payload)
    params["employer_id"] = employer_id
    return _fetch_one(
        db,
        """
        UPDATE aneti.employer
        SET
            legal_name = :legal_name,
            commercial_name = :commercial_name,
            tax_identifier = :tax_identifier,
            sector_code = :sector_code,
            size_category = :size_category
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
            c.contact_name,
            c.job_title,
            c.email,
            c.phone,
            c.website,
            c.created_at,
            c.updated_at
        FROM aneti.employer_contact c
        WHERE c.employer_id = CAST(:employer_id AS uuid)
        ORDER BY c.updated_at DESC
        LIMIT 1;
        """,
        {"employer_id": employer_id},
    )


def upsert_employer_contact(db: Session, employer_id: str, payload: Mapping[str, object]) -> dict:
    existing = get_employer_contact(db, employer_id)
    params = dict(payload)
    params["employer_id"] = employer_id

    if existing:
        params["contact_id"] = existing["id"]
        return _fetch_one(
            db,
            """
            UPDATE aneti.employer_contact
            SET
                contact_name = :contact_name,
                job_title = :job_title,
                email = :email,
                phone = :phone,
                website = :website
            WHERE id = CAST(:contact_id AS uuid)
            RETURNING id::text AS id;
            """,
            params,
        )

    return _fetch_one(
        db,
        """
        INSERT INTO aneti.employer_contact (
            employer_id,
            contact_name,
            job_title,
            email,
            phone,
            website
        )
        VALUES (
            CAST(:employer_id AS uuid),
            :contact_name,
            :job_title,
            :email,
            :phone,
            :website
        )
        RETURNING id::text AS id;
        """,
        params,
    )


def get_employer_location(db: Session, employer_id: str) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            l.id::text AS id,
            l.address,
            l.country,
            l.governorate_code,
            g.libelle_gouvernorat AS governorate_label,
            l.delegation_code,
            d.libelle_delegation AS delegation_label,
            l.created_at,
            l.updated_at
        FROM aneti.employer_location l
        LEFT JOIN taxonomy.ref_n_gouvern g
            ON g.code_gouvernorat = l.governorate_code
        LEFT JOIN taxonomy.ref_n_delegat d
            ON d.code_delegation = l.delegation_code
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

    if existing:
        params["location_id"] = existing["id"]
        return _fetch_one(
            db,
            """
            UPDATE aneti.employer_location
            SET
                address = :address,
                country = :country,
                governorate_code = :governorate_code,
                delegation_code = :delegation_code
            WHERE id = CAST(:location_id AS uuid)
            RETURNING id::text AS id;
            """,
            params,
        )

    return _fetch_one(
        db,
        """
        INSERT INTO aneti.employer_location (
            employer_id,
            address,
            country,
            governorate_code,
            delegation_code
        )
        VALUES (
            CAST(:employer_id AS uuid),
            :address,
            :country,
            :governorate_code,
            :delegation_code
        )
        RETURNING id::text AS id;
        """,
        params,
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
            l.governorate_code,
            g.libelle_gouvernorat AS governorate_label,
            l.delegation_code,
            d.libelle_delegation AS delegation_label,
            e.updated_at
        FROM aneti.employer e
        LEFT JOIN aneti.employer_location l
            ON l.employer_id = e.id
        LEFT JOIN taxonomy.ref_n_gouvern g
            ON g.code_gouvernorat = l.governorate_code
        LEFT JOIN taxonomy.ref_n_delegat d
            ON d.code_delegation = l.delegation_code
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

def list_employer_applications(db: Session, employer_id: str) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            ja.id::text AS id,
            ja.job_seeker_id::text AS job_seeker_id,
            ja.offer_id::text AS offer_id,
            jo.title AS offer_title,
            jo.aneti_identifier AS offer_aneti_identifier,

            TRIM(
                COALESCE(jsi.first_name, '') || ' ' || COALESCE(jsi.last_name, '')
            ) AS candidate_name,
            jsc.email AS candidate_email,
            jsc.phone AS candidate_phone,

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
        WHERE jo.employer_id = CAST(:employer_id AS uuid)
        ORDER BY ja.applied_at DESC;
        """,
        {"employer_id": employer_id},
    )