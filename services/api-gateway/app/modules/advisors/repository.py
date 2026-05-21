from collections.abc import Mapping

from sqlalchemy import text
from sqlalchemy.orm import Session


def _fetch_one(db: Session, query: str, params: dict | None = None) -> dict | None:
    row = db.execute(text(query), params or {}).mappings().first()
    return dict(row) if row else None


def _fetch_all(db: Session, query: str, params: dict | None = None) -> list[dict]:
    rows = db.execute(text(query), params or {}).mappings().all()
    return [dict(row) for row in rows]


def get_advisor_profile_by_user_id(db: Session, user_id: str) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            ap.id::text AS id,
            ap.user_id::text AS user_id,
            u.email,
            ap.full_name,
            ap.position,
            ap.active,
            aa.id::text AS agency_id,
            aa.code AS agency_code,
            aa.name AS agency_name,
            aa.address AS agency_address,
            aa.governorate AS agency_governorate,
            aa.delegation AS agency_delegation
        FROM aneti.advisor_profile ap
        JOIN iam.auth_user u
            ON u.id = ap.user_id
        LEFT JOIN aneti.aneti_agency aa
            ON aa.id = ap.agency_id
        WHERE ap.user_id = CAST(:user_id AS uuid)
        LIMIT 1;
        """,
        {"user_id": user_id},
    )


def get_role_id_by_code(db: Session, code: str) -> str | None:
    row = _fetch_one(
        db,
        "SELECT id::text AS id FROM iam.auth_role WHERE code = :code LIMIT 1;",
        {"code": code},
    )
    return row["id"] if row else None


def create_job_seeker(db: Session, payload: Mapping[str, object]) -> dict:
    return _fetch_one(
        db,
        """
        INSERT INTO aneti.job_seeker (user_id, status, registration_date)
        VALUES (CAST(:user_id AS uuid), 'ACTIVE', now())
        RETURNING id::text AS id, user_id::text AS user_id, status;
        """,
        {"user_id": dict(payload).get("user_id")},
    )


def upsert_candidate_identity(db: Session, candidate_id: str, payload: Mapping[str, object]) -> None:
    params = dict(payload)
    params["candidate_id"] = candidate_id
    db.execute(
        text("""
        INSERT INTO aneti.job_seeker_identity (job_seeker_id, first_name, last_name)
        VALUES (CAST(:candidate_id AS uuid), :first_name, :last_name)
        ON CONFLICT (job_seeker_id)
        DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name;
        """),
        params,
    )


def upsert_candidate_contact(db: Session, candidate_id: str, payload: Mapping[str, object]) -> None:
    params = dict(payload)
    params["candidate_id"] = candidate_id
    db.execute(
        text("""
        INSERT INTO aneti.job_seeker_contact (
            job_seeker_id,
            governorate_unit_id,
            delegation_unit_id
        )
        VALUES (
            CAST(:candidate_id AS uuid),
            (
                SELECT au.id FROM geo.admin_unit au
                JOIN geo.country cn ON cn.id = au.country_id
                WHERE cn.iso2 = 'TN' AND au.admin_level = 1
                  AND au.code = :governorate_code
                LIMIT 1
            ),
            (
                SELECT au.id FROM geo.admin_unit au
                JOIN geo.country cn ON cn.id = au.country_id
                WHERE cn.iso2 = 'TN' AND au.admin_level = 2
                  AND au.code = :delegation_code
                LIMIT 1
            )
        )
        ON CONFLICT (job_seeker_id)
        DO UPDATE SET
            governorate_unit_id = EXCLUDED.governorate_unit_id,
            delegation_unit_id  = EXCLUDED.delegation_unit_id;
        """),
        {
            "candidate_id":    candidate_id,
            "governorate_code": params.get("governorate_code"),
            "delegation_code":  params.get("delegation_code"),
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
            u.email
        FROM aneti.employer e
        JOIN iam.auth_user u ON u.id = e.user_id
        ORDER BY e.legal_name ASC;
        """,
    )


def create_offer_for_advisor(db: Session, payload: Mapping[str, object], _db: Session) -> dict:
    params = dict(payload)
    row = _fetch_one(
        db,
        """
        INSERT INTO aneti.job_offer (
            employer_id,
            company_name,
            title,
            description,
            number_of_positions,
            status,
            contract_type_ref_id,
            work_mode_ref_id,
            salary_min,
            salary_max,
            country_id,
            governorate_unit_id,
            delegation_unit_id,
            deadline_at,
            submitted_at,
            published_at,
            created_by_user_id
        )
        VALUES (
            CAST(:employer_id AS uuid),
            :company_name,
            :title,
            :description,
            :number_of_positions,
            'DRAFT',
            (SELECT rv.id FROM reference.ref_value rv
             JOIN reference.ref_group rg ON rg.id = rv.group_id
             WHERE rg.code = 'CONTRACT_TYPE' AND rv.code = :contract_type LIMIT 1),
            (SELECT rv.id FROM reference.ref_value rv
             JOIN reference.ref_group rg ON rg.id = rv.group_id
             WHERE rg.code = 'WORK_MODE' AND rv.code = :work_mode LIMIT 1),
            :salary_min,
            :salary_max,
            (SELECT c.id FROM geo.country c WHERE c.iso2 = COALESCE(NULLIF(:country,''),'TN') LIMIT 1),
            (SELECT au.id FROM geo.admin_unit au
             JOIN geo.country cn ON cn.id = au.country_id
             WHERE cn.iso2 = COALESCE(NULLIF(:country,''),'TN')
               AND au.admin_level = 1 AND au.code = :governorate_code LIMIT 1),
            (SELECT au.id FROM geo.admin_unit au
             JOIN geo.country cn ON cn.id = au.country_id
             WHERE cn.iso2 = COALESCE(NULLIF(:country,''),'TN')
               AND au.admin_level = 2 AND au.code = :delegation_code LIMIT 1),
            CAST(:deadline_at AS timestamptz),
            now(),
            now(),
            CAST(:created_by_user_id AS uuid)
        )
        RETURNING id::text AS id, aneti_identifier;
        """,
        {
            "employer_id":       params.get("employer_id"),
            "company_name":      params.get("company_name"),
            "title":             params.get("title"),
            "description":       params.get("description"),
            "number_of_positions": params.get("number_of_positions") or 1,
            "contract_type":     params.get("contract_type"),
            "work_mode":         params.get("work_mode"),
            "salary_min":        params.get("salary_min"),
            "salary_max":        params.get("salary_max"),
            "country":           params.get("country") or "TN",
            "governorate_code":  params.get("governorate_code"),
            "delegation_code":   params.get("delegation_code"),
            "deadline_at":       params.get("deadline_at"),
            "created_by_user_id": params.get("created_by_user_id"),
        },
    )
    db.commit()
    return row
