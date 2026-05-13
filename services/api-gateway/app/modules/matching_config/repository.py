from collections.abc import Mapping

from sqlalchemy import text
from sqlalchemy.orm import Session


def _fetch_one(
    db: Session,
    query: str,
    params: dict | None = None,
) -> dict | None:
    row = db.execute(text(query), params or {}).mappings().first()
    return dict(row) if row else None


def _fetch_all(
    db: Session,
    query: str,
    params: dict | None = None,
) -> list[dict]:
    rows = db.execute(text(query), params or {}).mappings().all()
    return [dict(row) for row in rows]


def list_criteria(db: Session) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            c.id::text AS id,
            c.code,
            c.label,
            c.description,
            c.data_type,
            c.active
        FROM matching.matching_criterion c
        ORDER BY c.active DESC, c.code ASC;
        """,
    )


def get_criterion_by_id(db: Session, criterion_id: str) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            c.id::text AS id,
            c.code,
            c.label,
            c.description,
            c.data_type,
            c.active
        FROM matching.matching_criterion c
        WHERE c.id = CAST(:criterion_id AS uuid)
        LIMIT 1;
        """,
        {"criterion_id": criterion_id},
    )


def get_criterion_by_code(db: Session, code: str) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            c.id::text AS id,
            c.code,
            c.label,
            c.description,
            c.data_type,
            c.active
        FROM matching.matching_criterion c
        WHERE c.code = :code
        LIMIT 1;
        """,
        {"code": code},
    )


def create_criterion(db: Session, payload: Mapping[str, object]) -> dict:
    return _fetch_one(
        db,
        """
        INSERT INTO matching.matching_criterion (
            code,
            label,
            description,
            data_type,
            active
        )
        VALUES (
            :code,
            :label,
            :description,
            :data_type,
            :active
        )
        RETURNING
            id::text AS id,
            code,
            label,
            description,
            data_type,
            active;
        """,
        dict(payload),
    )


def update_criterion(
    db: Session,
    criterion_id: str,
    payload: Mapping[str, object],
) -> dict | None:
    params = dict(payload)
    params["criterion_id"] = criterion_id

    return _fetch_one(
        db,
        """
        UPDATE matching.matching_criterion
        SET
            code = :code,
            label = :label,
            description = :description,
            data_type = :data_type,
            active = :active
        WHERE id = CAST(:criterion_id AS uuid)
        RETURNING
            id::text AS id,
            code,
            label,
            description,
            data_type,
            active;
        """,
        params,
    )


def deactivate_criterion(db: Session, criterion_id: str) -> dict | None:
    return _fetch_one(
        db,
        """
        UPDATE matching.matching_criterion
        SET active = FALSE
        WHERE id = CAST(:criterion_id AS uuid)
        RETURNING
            id::text AS id,
            code,
            label,
            description,
            data_type,
            active;
        """,
        {"criterion_id": criterion_id},
    )


def list_models(db: Session) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            m.id::text AS id,
            m.code,
            m.label,
            m.direction,
            m.description,
            m.active
        FROM matching.matching_model m
        ORDER BY m.active DESC, m.code ASC;
        """,
    )


def get_model_by_id(db: Session, model_id: str) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            m.id::text AS id,
            m.code,
            m.label,
            m.direction,
            m.description,
            m.active
        FROM matching.matching_model m
        WHERE m.id = CAST(:model_id AS uuid)
        LIMIT 1;
        """,
        {"model_id": model_id},
    )


def get_model_by_code(db: Session, code: str) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            m.id::text AS id,
            m.code,
            m.label,
            m.direction,
            m.description,
            m.active
        FROM matching.matching_model m
        WHERE m.code = :code
        LIMIT 1;
        """,
        {"code": code},
    )


def create_model(db: Session, payload: Mapping[str, object]) -> dict:
    return _fetch_one(
        db,
        """
        INSERT INTO matching.matching_model (
            code,
            label,
            direction,
            description,
            active
        )
        VALUES (
            :code,
            :label,
            :direction,
            :description,
            :active
        )
        RETURNING
            id::text AS id,
            code,
            label,
            direction,
            description,
            active;
        """,
        dict(payload),
    )


def update_model(
    db: Session,
    model_id: str,
    payload: Mapping[str, object],
) -> dict | None:
    params = dict(payload)
    params["model_id"] = model_id

    return _fetch_one(
        db,
        """
        UPDATE matching.matching_model
        SET
            code = :code,
            label = :label,
            direction = :direction,
            description = :description,
            active = :active
        WHERE id = CAST(:model_id AS uuid)
        RETURNING
            id::text AS id,
            code,
            label,
            direction,
            description,
            active;
        """,
        params,
    )


def deactivate_model(db: Session, model_id: str) -> dict | None:
    return _fetch_one(
        db,
        """
        UPDATE matching.matching_model
        SET active = FALSE
        WHERE id = CAST(:model_id AS uuid)
        RETURNING
            id::text AS id,
            code,
            label,
            direction,
            description,
            active;
        """,
        {"model_id": model_id},
    )


def list_model_versions(db: Session, model_id: str | None = None) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            mv.id::text AS id,
            mv.model_id::text AS model_id,
            mv.version_number,
            mv.status,
            mv.created_by_user_id::text AS created_by_user_id,
            mv.created_at,
            mv.published_at
        FROM matching.matching_model_version mv
        WHERE (:model_id IS NULL OR mv.model_id = CAST(:model_id AS uuid))
        ORDER BY mv.model_id ASC, mv.version_number DESC;
        """,
        {"model_id": model_id},
    )


def get_model_version_by_id(db: Session, version_id: str) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            mv.id::text AS id,
            mv.model_id::text AS model_id,
            mv.version_number,
            mv.status,
            mv.created_by_user_id::text AS created_by_user_id,
            mv.created_at,
            mv.published_at
        FROM matching.matching_model_version mv
        WHERE mv.id = CAST(:version_id AS uuid)
        LIMIT 1;
        """,
        {"version_id": version_id},
    )


def get_model_version_for_model(
    db: Session,
    model_id: str,
    version_id: str,
) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            mv.id::text AS id,
            mv.model_id::text AS model_id,
            mv.version_number,
            mv.status,
            mv.created_by_user_id::text AS created_by_user_id,
            mv.created_at,
            mv.published_at
        FROM matching.matching_model_version mv
        WHERE mv.model_id = CAST(:model_id AS uuid)
          AND mv.id = CAST(:version_id AS uuid)
        LIMIT 1;
        """,
        {
            "model_id": model_id,
            "version_id": version_id,
        },
    )


def get_model_version_by_number(
    db: Session,
    model_id: str,
    version_number: int,
) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            mv.id::text AS id,
            mv.model_id::text AS model_id,
            mv.version_number,
            mv.status,
            mv.created_by_user_id::text AS created_by_user_id,
            mv.created_at,
            mv.published_at
        FROM matching.matching_model_version mv
        WHERE mv.model_id = CAST(:model_id AS uuid)
          AND mv.version_number = :version_number
        LIMIT 1;
        """,
        {
            "model_id": model_id,
            "version_number": version_number,
        },
    )


def get_next_model_version_number(db: Session, model_id: str) -> int:
    row = _fetch_one(
        db,
        """
        SELECT COALESCE(MAX(mv.version_number), 0) + 1 AS next_version_number
        FROM matching.matching_model_version mv
        WHERE mv.model_id = CAST(:model_id AS uuid);
        """,
        {"model_id": model_id},
    )
    return int(row["next_version_number"])


def create_model_version(
    db: Session,
    model_id: str,
    *,
    version_number: int,
    created_by_user_id: str | None,
) -> dict:
    return _fetch_one(
        db,
        """
        INSERT INTO matching.matching_model_version (
            model_id,
            version_number,
            status,
            created_by_user_id
        )
        VALUES (
            CAST(:model_id AS uuid),
            :version_number,
            'DRAFT',
            CAST(:created_by_user_id AS uuid)
        )
        RETURNING
            id::text AS id,
            model_id::text AS model_id,
            version_number,
            status,
            created_by_user_id::text AS created_by_user_id,
            created_at,
            published_at;
        """,
        {
            "model_id": model_id,
            "version_number": version_number,
            "created_by_user_id": created_by_user_id,
        },
    )


def update_model_version_number(
    db: Session,
    model_id: str,
    version_id: str,
    *,
    version_number: int,
) -> dict | None:
    return _fetch_one(
        db,
        """
        UPDATE matching.matching_model_version
        SET version_number = :version_number
        WHERE model_id = CAST(:model_id AS uuid)
          AND id = CAST(:version_id AS uuid)
        RETURNING
            id::text AS id,
            model_id::text AS model_id,
            version_number,
            status,
            created_by_user_id::text AS created_by_user_id,
            created_at,
            published_at;
        """,
        {
            "model_id": model_id,
            "version_id": version_id,
            "version_number": version_number,
        },
    )


def get_model_version_weight_summary(db: Session, version_id: str) -> dict:
    return _fetch_one(
        db,
        """
        SELECT
            COUNT(*)::int AS criterion_count,
            COALESCE(SUM(mc.weight), 0)::numeric AS total_weight
        FROM matching.matching_model_criterion mc
        WHERE mc.model_version_id = CAST(:version_id AS uuid);
        """,
        {"version_id": version_id},
    )


def archive_other_active_model_versions(
    db: Session,
    model_id: str,
    version_id: str,
) -> None:
    db.execute(
        text("""
        UPDATE matching.matching_model_version
        SET status = 'ARCHIVED'
        WHERE model_id = CAST(:model_id AS uuid)
          AND id <> CAST(:version_id AS uuid)
          AND status = 'ACTIVE';
        """),
        {
            "model_id": model_id,
            "version_id": version_id,
        },
    )


def publish_model_version(
    db: Session,
    model_id: str,
    version_id: str,
) -> dict | None:
    return _fetch_one(
        db,
        """
        UPDATE matching.matching_model_version
        SET
            status = 'ACTIVE',
            published_at = now()
        WHERE model_id = CAST(:model_id AS uuid)
          AND id = CAST(:version_id AS uuid)
        RETURNING
            id::text AS id,
            model_id::text AS model_id,
            version_number,
            status,
            created_by_user_id::text AS created_by_user_id,
            created_at,
            published_at;
        """,
        {
            "model_id": model_id,
            "version_id": version_id,
        },
    )


def archive_model_version(
    db: Session,
    model_id: str,
    version_id: str,
) -> dict | None:
    return _fetch_one(
        db,
        """
        UPDATE matching.matching_model_version
        SET status = 'ARCHIVED'
        WHERE model_id = CAST(:model_id AS uuid)
          AND id = CAST(:version_id AS uuid)
        RETURNING
            id::text AS id,
            model_id::text AS model_id,
            version_number,
            status,
            created_by_user_id::text AS created_by_user_id,
            created_at,
            published_at;
        """,
        {
            "model_id": model_id,
            "version_id": version_id,
        },
    )


def list_model_criteria(db: Session, version_id: str | None = None) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            mc.id::text AS id,
            mc.model_version_id::text AS model_version_id,
            mc.criterion_id::text AS criterion_id,
            c.code AS criterion_code,
            c.label AS criterion_label,
            c.data_type,
            mc.weight::float8 AS weight,
            mc.is_must,
            mc.min_threshold::float8 AS min_threshold,
            mc.logic_operator
        FROM matching.matching_model_criterion mc
        JOIN matching.matching_criterion c
            ON c.id = mc.criterion_id
        WHERE (:version_id IS NULL OR mc.model_version_id = CAST(:version_id AS uuid))
        ORDER BY mc.model_version_id ASC, mc.weight DESC, c.code ASC;
        """,
        {"version_id": version_id},
    )


def get_model_criterion_by_id(
    db: Session,
    version_id: str,
    model_criterion_id: str,
) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            mc.id::text AS id,
            mc.model_version_id::text AS model_version_id,
            mc.criterion_id::text AS criterion_id,
            c.code AS criterion_code,
            c.label AS criterion_label,
            c.data_type,
            mc.weight::float8 AS weight,
            mc.is_must,
            mc.min_threshold::float8 AS min_threshold,
            mc.logic_operator
        FROM matching.matching_model_criterion mc
        JOIN matching.matching_criterion c
            ON c.id = mc.criterion_id
        WHERE mc.model_version_id = CAST(:version_id AS uuid)
          AND mc.id = CAST(:model_criterion_id AS uuid)
        LIMIT 1;
        """,
        {
            "version_id": version_id,
            "model_criterion_id": model_criterion_id,
        },
    )


def get_model_criterion_by_version_and_criterion(
    db: Session,
    version_id: str,
    criterion_id: str,
) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            mc.id::text AS id,
            mc.model_version_id::text AS model_version_id,
            mc.criterion_id::text AS criterion_id
        FROM matching.matching_model_criterion mc
        WHERE mc.model_version_id = CAST(:version_id AS uuid)
          AND mc.criterion_id = CAST(:criterion_id AS uuid)
        LIMIT 1;
        """,
        {
            "version_id": version_id,
            "criterion_id": criterion_id,
        },
    )


def create_model_criterion(
    db: Session,
    version_id: str,
    payload: Mapping[str, object],
) -> dict:
    params = dict(payload)
    params["version_id"] = version_id

    return _fetch_one(
        db,
        """
        INSERT INTO matching.matching_model_criterion (
            model_version_id,
            criterion_id,
            weight,
            is_must,
            min_threshold,
            logic_operator
        )
        VALUES (
            CAST(:version_id AS uuid),
            CAST(:criterion_id AS uuid),
            :weight,
            :is_must,
            :min_threshold,
            :logic_operator
        )
        RETURNING id::text AS id;
        """,
        params,
    )


def update_model_criterion(
    db: Session,
    version_id: str,
    model_criterion_id: str,
    payload: Mapping[str, object],
) -> dict | None:
    params = dict(payload)
    params["version_id"] = version_id
    params["model_criterion_id"] = model_criterion_id

    return _fetch_one(
        db,
        """
        UPDATE matching.matching_model_criterion
        SET
            criterion_id = CAST(:criterion_id AS uuid),
            weight = :weight,
            is_must = :is_must,
            min_threshold = :min_threshold,
            logic_operator = :logic_operator
        WHERE model_version_id = CAST(:version_id AS uuid)
          AND id = CAST(:model_criterion_id AS uuid)
        RETURNING id::text AS id;
        """,
        params,
    )


def delete_model_criterion(
    db: Session,
    version_id: str,
    model_criterion_id: str,
) -> bool:
    result = db.execute(
        text("""
        DELETE FROM matching.matching_model_criterion
        WHERE model_version_id = CAST(:version_id AS uuid)
          AND id = CAST(:model_criterion_id AS uuid);
        """),
        {
            "version_id": version_id,
            "model_criterion_id": model_criterion_id,
        },
    )
    return result.rowcount > 0


def list_hard_filters(db: Session, version_id: str | None = None) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            hf.id::text AS id,
            hf.model_version_id::text AS model_version_id,
            hf.criterion_id::text AS criterion_id,
            c.code AS criterion_code,
            c.label AS criterion_label,
            hf.rule_operator,
            hf.rule_value,
            hf.rejection_reason
        FROM matching.matching_hard_filter hf
        JOIN matching.matching_criterion c
            ON c.id = hf.criterion_id
        WHERE (:version_id IS NULL OR hf.model_version_id = CAST(:version_id AS uuid))
        ORDER BY hf.model_version_id ASC, c.code ASC, hf.id ASC;
        """,
        {"version_id": version_id},
    )


def get_hard_filter_by_id(
    db: Session,
    version_id: str,
    filter_id: str,
) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            hf.id::text AS id,
            hf.model_version_id::text AS model_version_id,
            hf.criterion_id::text AS criterion_id,
            c.code AS criterion_code,
            c.label AS criterion_label,
            hf.rule_operator,
            hf.rule_value,
            hf.rejection_reason
        FROM matching.matching_hard_filter hf
        JOIN matching.matching_criterion c
            ON c.id = hf.criterion_id
        WHERE hf.model_version_id = CAST(:version_id AS uuid)
          AND hf.id = CAST(:filter_id AS uuid)
        LIMIT 1;
        """,
        {
            "version_id": version_id,
            "filter_id": filter_id,
        },
    )


def create_hard_filter(
    db: Session,
    version_id: str,
    payload: Mapping[str, object],
) -> dict:
    params = dict(payload)
    params["version_id"] = version_id

    return _fetch_one(
        db,
        """
        INSERT INTO matching.matching_hard_filter (
            model_version_id,
            criterion_id,
            rule_operator,
            rule_value,
            rejection_reason
        )
        VALUES (
            CAST(:version_id AS uuid),
            CAST(:criterion_id AS uuid),
            :rule_operator,
            :rule_value,
            :rejection_reason
        )
        RETURNING id::text AS id;
        """,
        params,
    )


def update_hard_filter(
    db: Session,
    version_id: str,
    filter_id: str,
    payload: Mapping[str, object],
) -> dict | None:
    params = dict(payload)
    params["version_id"] = version_id
    params["filter_id"] = filter_id

    return _fetch_one(
        db,
        """
        UPDATE matching.matching_hard_filter
        SET
            criterion_id = CAST(:criterion_id AS uuid),
            rule_operator = :rule_operator,
            rule_value = :rule_value,
            rejection_reason = :rejection_reason
        WHERE model_version_id = CAST(:version_id AS uuid)
          AND id = CAST(:filter_id AS uuid)
        RETURNING id::text AS id;
        """,
        params,
    )


def delete_hard_filter(
    db: Session,
    version_id: str,
    filter_id: str,
) -> bool:
    result = db.execute(
        text("""
        DELETE FROM matching.matching_hard_filter
        WHERE model_version_id = CAST(:version_id AS uuid)
          AND id = CAST(:filter_id AS uuid);
        """),
        {
            "version_id": version_id,
            "filter_id": filter_id,
        },
    )
    return result.rowcount > 0
