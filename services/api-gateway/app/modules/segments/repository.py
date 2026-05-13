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


def list_segments(
    db: Session,
    *,
    active: bool | None = None,
    macro_segment: str | None = None,
    q: str | None = None,
) -> list[dict]:
    filters: list[str] = []
    params: dict[str, object] = {}

    if active is not None:
        filters.append("s.active = :active")
        params["active"] = active

    if macro_segment:
        filters.append("s.macro_segment = :macro_segment")
        params["macro_segment"] = macro_segment

    if q:
        filters.append("(s.code ILIKE :search OR s.label ILIKE :search)")
        params["search"] = f"%{q}%"

    where_clause = ""
    if filters:
        where_clause = "WHERE " + " AND ".join(filters)

    return _fetch_all(
        db,
        f"""
        SELECT
            s.id::text AS id,
            s.code,
            s.label,
            s.macro_segment,
            s.priority,
            s.active
        FROM matching.segment s
        {where_clause}
        ORDER BY s.priority ASC, s.code ASC;
        """,
        params,
    )


def get_segment_by_id(db: Session, segment_id: str) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            s.id::text AS id,
            s.code,
            s.label,
            s.macro_segment,
            s.priority,
            s.active
        FROM matching.segment s
        WHERE s.id = CAST(:segment_id AS uuid)
        LIMIT 1;
        """,
        {"segment_id": segment_id},
    )


def get_segment_by_code(db: Session, code: str) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            s.id::text AS id,
            s.code,
            s.label,
            s.macro_segment,
            s.priority,
            s.active
        FROM matching.segment s
        WHERE s.code = :code
        LIMIT 1;
        """,
        {"code": code},
    )


def create_segment(db: Session, payload: Mapping[str, object]) -> dict:
    return _fetch_one(
        db,
        """
        INSERT INTO matching.segment (
            code,
            label,
            macro_segment,
            priority,
            active
        )
        VALUES (
            :code,
            :label,
            :macro_segment,
            :priority,
            :active
        )
        RETURNING
            id::text AS id,
            code,
            label,
            macro_segment,
            priority,
            active;
        """,
        dict(payload),
    )


def update_segment(
    db: Session,
    segment_id: str,
    payload: Mapping[str, object],
) -> dict | None:
    params = dict(payload)
    params["segment_id"] = segment_id

    return _fetch_one(
        db,
        """
        UPDATE matching.segment
        SET
            code = :code,
            label = :label,
            macro_segment = :macro_segment,
            priority = :priority,
            active = :active
        WHERE id = CAST(:segment_id AS uuid)
        RETURNING
            id::text AS id,
            code,
            label,
            macro_segment,
            priority,
            active;
        """,
        params,
    )


def deactivate_segment(db: Session, segment_id: str) -> dict | None:
    return _fetch_one(
        db,
        """
        UPDATE matching.segment
        SET active = FALSE
        WHERE id = CAST(:segment_id AS uuid)
        RETURNING
            id::text AS id,
            code,
            label,
            macro_segment,
            priority,
            active;
        """,
        {"segment_id": segment_id},
    )


def list_segment_rules(db: Session, segment_id: str) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            sr.id::text AS id,
            sr.segment_id::text AS segment_id,
            sr.target_type,
            sr.attribute_path,
            sr.operator,
            sr.value,
            sr.logic
        FROM matching.segment_rule sr
        WHERE sr.segment_id = CAST(:segment_id AS uuid)
        ORDER BY sr.attribute_path ASC, sr.id ASC;
        """,
        {"segment_id": segment_id},
    )


def get_segment_rule_by_id(
    db: Session,
    segment_id: str,
    rule_id: str,
) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            sr.id::text AS id,
            sr.segment_id::text AS segment_id,
            sr.target_type,
            sr.attribute_path,
            sr.operator,
            sr.value,
            sr.logic
        FROM matching.segment_rule sr
        WHERE sr.segment_id = CAST(:segment_id AS uuid)
          AND sr.id = CAST(:rule_id AS uuid)
        LIMIT 1;
        """,
        {
            "segment_id": segment_id,
            "rule_id": rule_id,
        },
    )


def create_segment_rule(
    db: Session,
    segment_id: str,
    payload: Mapping[str, object],
) -> dict:
    params = dict(payload)
    params["segment_id"] = segment_id

    return _fetch_one(
        db,
        """
        INSERT INTO matching.segment_rule (
            segment_id,
            target_type,
            attribute_path,
            operator,
            value,
            logic
        )
        VALUES (
            CAST(:segment_id AS uuid),
            :target_type,
            :attribute_path,
            :operator,
            :value,
            :logic
        )
        RETURNING
            id::text AS id,
            segment_id::text AS segment_id,
            target_type,
            attribute_path,
            operator,
            value,
            logic;
        """,
        params,
    )


def update_segment_rule(
    db: Session,
    segment_id: str,
    rule_id: str,
    payload: Mapping[str, object],
) -> dict | None:
    params = dict(payload)
    params["segment_id"] = segment_id
    params["rule_id"] = rule_id

    return _fetch_one(
        db,
        """
        UPDATE matching.segment_rule
        SET
            target_type = :target_type,
            attribute_path = :attribute_path,
            operator = :operator,
            value = :value,
            logic = :logic
        WHERE segment_id = CAST(:segment_id AS uuid)
          AND id = CAST(:rule_id AS uuid)
        RETURNING
            id::text AS id,
            segment_id::text AS segment_id,
            target_type,
            attribute_path,
            operator,
            value,
            logic;
        """,
        params,
    )


def delete_segment_rule(
    db: Session,
    segment_id: str,
    rule_id: str,
) -> bool:
    result = db.execute(
        text("""
        DELETE FROM matching.segment_rule
        WHERE segment_id = CAST(:segment_id AS uuid)
          AND id = CAST(:rule_id AS uuid);
        """),
        {
            "segment_id": segment_id,
            "rule_id": rule_id,
        },
    )
    return result.rowcount > 0
