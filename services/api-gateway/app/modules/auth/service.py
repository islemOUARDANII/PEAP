from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from .schemas import CurrentUserResponse, UserProfileResponse


def authenticate_user(db: Session, email: str, password: str) -> dict:
    query = text("""
        SELECT
            u.id::text AS id,
            u.email,
            u.status
        FROM iam.auth_user u
        WHERE lower(u.email) = lower(:email)
          AND u.password_hash = crypt(:password, u.password_hash)
        LIMIT 1;
    """)

    row = db.execute(
        query,
        {
            "email": email,
            "password": password,
        },
    ).mappings().first()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if row["status"] == "PENDING_VERIFICATION":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Votre adresse email n'est pas encore vérifiée. "
                "Veuillez saisir le code reçu par email."
            ),
        )

    if row["status"] != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Compte non actif : {row['status']}",
        )

    roles = get_user_roles(db, row["id"])

    if not roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User has no assigned role",
        )

    return {
        "id": row["id"],
        "email": row["email"],
        "status": row["status"],
        "roles": roles,
    }


def get_user_roles(db: Session, user_id: str) -> list[str]:
    query = text("""
        SELECT r.code
        FROM iam.auth_user_role ur
        JOIN iam.auth_role r ON r.id = ur.role_id
        WHERE ur.user_id = CAST(:user_id AS uuid)
        ORDER BY r.code;
    """)

    rows = db.execute(query, {"user_id": user_id}).mappings().all()
    return [row["code"] for row in rows]


def get_user_by_id(db: Session, user_id: str) -> dict | None:
    query = text("""
        SELECT
            u.id::text AS id,
            u.email,
            u.status
        FROM iam.auth_user u
        WHERE u.id = CAST(:user_id AS uuid)
        LIMIT 1;
    """)

    row = db.execute(query, {"user_id": user_id}).mappings().first()

    if not row:
        return None

    roles = get_user_roles(db, row["id"])

    return {
        "id": row["id"],
        "email": row["email"],
        "status": row["status"],
        "roles": roles,
    }


def resolve_user_profile(
    db: Session,
    user_id: str,
    roles: list[str],
) -> UserProfileResponse | None:
    if "JOB_SEEKER" in roles:
        row = db.execute(text("""
            SELECT
                js.id::text AS id,
                COALESCE(
                    NULLIF(trim(ji.first_name || ' ' || ji.last_name), ''),
                    js.aneti_identifier
                ) AS label
            FROM aneti.job_seeker js
            LEFT JOIN aneti.job_seeker_identity ji
                ON ji.job_seeker_id = js.id
            WHERE js.user_id = CAST(:user_id AS uuid)
            LIMIT 1;
        """), {"user_id": user_id}).mappings().first()

        if row:
            return UserProfileResponse(
                type="JOB_SEEKER",
                id=row["id"],
                label=row["label"],
            )

    if "EMPLOYER" in roles:
        row = db.execute(text("""
            SELECT
                e.id::text AS id,
                COALESCE(e.commercial_name, e.legal_name) AS label
            FROM aneti.employer e
            WHERE e.user_id = CAST(:user_id AS uuid)
            LIMIT 1;
        """), {"user_id": user_id}).mappings().first()

        if row:
            return UserProfileResponse(
                type="EMPLOYER",
                id=row["id"],
                label=row["label"],
            )

    if "ANETI_ADVISOR" in roles:
        row = db.execute(text("""
            SELECT
                ap.id::text AS id,
                ap.full_name AS label
            FROM aneti.advisor_profile ap
            WHERE ap.user_id = CAST(:user_id AS uuid)
            LIMIT 1;
        """), {"user_id": user_id}).mappings().first()

        if row:
            return UserProfileResponse(
                type="ANETI_ADVISOR",
                id=row["id"],
                label=row["label"],
            )

    return None


def build_current_user_response(
    db: Session,
    user: dict,
) -> CurrentUserResponse:
    profile = resolve_user_profile(db, user["id"], user["roles"])

    return CurrentUserResponse(
        id=user["id"],
        email=user["email"],
        status=user["status"],
        roles=user["roles"],
        profile=profile,
    )