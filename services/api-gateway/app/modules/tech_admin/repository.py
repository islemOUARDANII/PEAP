from collections.abc import Mapping

from sqlalchemy import text
from sqlalchemy.orm import Session


def _fetch_one(db: Session, query: str, params: dict | None = None) -> dict | None:
    row = db.execute(text(query), params or {}).mappings().first()
    return dict(row) if row else None


def _fetch_all(db: Session, query: str, params: dict | None = None) -> list[dict]:
    rows = db.execute(text(query), params or {}).mappings().all()
    return [dict(row) for row in rows]


def database_health(db: Session) -> str:
    row = _fetch_one(db, "SELECT 'UP' AS status;")
    return row["status"]


def list_users(db: Session) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            u.id::text AS id,
            u.email,
            u.phone,
            u.status,
            u.created_at,
            u.updated_at
        FROM iam.auth_user u
        ORDER BY u.created_at DESC;
        """,
    )


def get_user_by_id(db: Session, user_id: str) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            u.id::text AS id,
            u.email,
            u.phone,
            u.status,
            u.created_at,
            u.updated_at
        FROM iam.auth_user u
        WHERE u.id = CAST(:user_id AS uuid)
        LIMIT 1;
        """,
        {"user_id": user_id},
    )


def get_user_by_email(db: Session, email: str) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            u.id::text AS id,
            u.email,
            u.phone,
            u.status,
            u.created_at,
            u.updated_at
        FROM iam.auth_user u
        WHERE lower(u.email) = lower(:email)
        LIMIT 1;
        """,
        {"email": email},
    )


def create_user(db: Session, payload: Mapping[str, object]) -> dict:
    return _fetch_one(
        db,
        """
        INSERT INTO iam.auth_user (
            email,
            password_hash,
            phone,
            status
        )
        VALUES (
            :email,
            crypt(:password, gen_salt('bf')),
            :phone,
            :status
        )
        RETURNING
            id::text AS id,
            email,
            phone,
            status,
            created_at,
            updated_at;
        """,
        dict(payload),
    )


def update_user(db: Session, user_id: str, payload: Mapping[str, object]) -> dict | None:
    params = dict(payload)
    params["user_id"] = user_id
    if params.get("password"):
        return _fetch_one(
            db,
            """
            UPDATE iam.auth_user
            SET
                email = :email,
                phone = :phone,
                status = :status,
                password_hash = crypt(:password, gen_salt('bf'))
            WHERE id = CAST(:user_id AS uuid)
            RETURNING
                id::text AS id,
                email,
                phone,
                status,
                created_at,
                updated_at;
            """,
            params,
        )

    return _fetch_one(
        db,
        """
        UPDATE iam.auth_user
        SET
            email = :email,
            phone = :phone,
            status = :status
        WHERE id = CAST(:user_id AS uuid)
        RETURNING
            id::text AS id,
            email,
            phone,
            status,
            created_at,
            updated_at;
        """,
        params,
    )


def update_user_status(db: Session, user_id: str, status_value: str) -> dict | None:
    return _fetch_one(
        db,
        """
        UPDATE iam.auth_user
        SET status = :status_value
        WHERE id = CAST(:user_id AS uuid)
        RETURNING
            id::text AS id,
            email,
            phone,
            status,
            created_at,
            updated_at;
        """,
        {
            "user_id": user_id,
            "status_value": status_value,
        },
    )


def list_roles(db: Session) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT id::text AS id, code, label
        FROM iam.auth_role
        ORDER BY code ASC;
        """,
    )


def list_user_roles(db: Session, user_id: str) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            r.id::text AS id,
            r.code,
            r.label
        FROM iam.auth_user_role ur
        JOIN iam.auth_role r
            ON r.id = ur.role_id
        WHERE ur.user_id = CAST(:user_id AS uuid)
        ORDER BY r.code ASC;
        """,
        {"user_id": user_id},
    )


def assign_role(db: Session, user_id: str, role_id: str) -> None:
    db.execute(
        text(
            """
            INSERT INTO iam.auth_user_role (user_id, role_id)
            VALUES (CAST(:user_id AS uuid), CAST(:role_id AS uuid))
            ON CONFLICT (user_id, role_id) DO NOTHING;
            """,
        ),
        {
            "user_id": user_id,
            "role_id": role_id,
        },
    )


def remove_role(db: Session, user_id: str, role_id: str) -> bool:
    result = db.execute(
        text(
            """
            DELETE FROM iam.auth_user_role
            WHERE user_id = CAST(:user_id AS uuid)
              AND role_id = CAST(:role_id AS uuid);
            """,
        ),
        {
            "user_id": user_id,
            "role_id": role_id,
        },
    )
    return result.rowcount > 0
