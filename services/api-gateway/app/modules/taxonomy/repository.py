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


def list_nodes(
    db: Session,
    *,
    node_type: str | None,
    q: str | None,
    active: bool | None,
    source: str | None,
    limit: int,
    offset: int,
) -> list[dict]:
    filters: list[str] = []
    params: dict[str, object] = {"limit": limit, "offset": offset}

    if node_type:
        filters.append("n.node_type = :node_type")
        params["node_type"] = node_type

    if q:
        filters.append("(n.label ILIKE :search OR n.source_code ILIKE :search)")
        params["search"] = f"%{q}%"

    if active is not None:
        filters.append("n.active = :active")
        params["active"] = active

    if source:
        filters.append("n.source = :source")
        params["source"] = source

    where_clause = ""
    if filters:
        where_clause = "WHERE " + " AND ".join(filters)

    return _fetch_all(
        db,
        f"""
        SELECT
            n.id::text AS id,
            n.node_type,
            n.source,
            n.source_code,
            n.label,
            n.active,
            n.extra_json
        FROM taxonomy.taxonomy_node n
        {where_clause}
        ORDER BY n.label ASC
        LIMIT :limit OFFSET :offset;
        """,
        params,
    )


def get_node_by_id(db: Session, node_id: str) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            n.id::text AS id,
            n.node_type,
            n.source,
            n.source_code,
            n.label,
            n.active,
            n.extra_json
        FROM taxonomy.taxonomy_node n
        WHERE n.id = CAST(:node_id AS uuid)
        LIMIT 1;
        """,
        {"node_id": node_id},
    )

def list_handicap_types(db: Session) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            code_handicap AS code,
            libelle_handicap AS label
        FROM taxonomy.ref_type_handicap
        ORDER BY code_handicap;
        """,
    )


def list_handicap_degrees(db: Session) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            code_degre_handicap AS code,
            libelle_degre_handicap AS label
        FROM taxonomy.ref_degre_handicap
        ORDER BY code_degre_handicap;
        """,
    )