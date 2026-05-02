from sqlalchemy import text
from sqlalchemy.orm import Session


def _fetch_one(db: Session, query: str, params: dict | None = None) -> dict | None:
    row = db.execute(text(query), params or {}).mappings().first()
    return dict(row) if row else None


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
