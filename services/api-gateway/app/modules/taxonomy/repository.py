from sqlalchemy import text
from sqlalchemy.orm import Session


def _fetch_one(db: Session, query: str, params: dict | None = None) -> dict | None:
    row = db.execute(text(query), params or {}).mappings().first()
    return dict(row) if row else None


def _fetch_all(db: Session, query: str, params: dict | None = None) -> list[dict]:
    rows = db.execute(text(query), params or {}).mappings().all()
    return [dict(row) for row in rows]


def _write_one(db: Session, query: str, params: dict | None = None) -> dict | None:
    row = db.execute(text(query), params or {}).mappings().first()
    db.commit()
    return dict(row) if row else None


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


def list_models(db: Session) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            m.id::text AS id,
            m.code,
            m.label,
            m.version,
            m.source,
            m.is_active,
            m.is_default,
            m.released_at,
            m.imported_at,
            m.metadata_json
        FROM taxonomy.taxonomy_model m
        ORDER BY m.label ASC;
        """,
    )


def get_summary(db: Session) -> dict:
    return _fetch_one(
        db,
        """
        SELECT
            (SELECT COUNT(*) FROM taxonomy.taxonomy_model)::int AS total_models,
            (SELECT COUNT(*) FROM taxonomy.taxonomy_model WHERE is_active)::int AS active_models,
            (SELECT COUNT(*) FROM taxonomy.taxonomy_node)::int AS total_nodes,
            (SELECT COUNT(*) FROM taxonomy.taxonomy_node WHERE active)::int AS active_nodes,
            (SELECT COUNT(*) FROM taxonomy.taxonomy_alias)::int AS total_aliases,
            (SELECT COUNT(*) FROM taxonomy.taxonomy_relation)::int AS total_relations,
            (SELECT COUNT(*) FROM taxonomy.taxonomy_crosswalk)::int AS total_crosswalks;
        """,
    )


def list_nodes(
    db: Session,
    *,
    model_code: str | None,
    model_version: str | None,
    node_type: str | None,
    parent_id: str | None,
    q: str | None,
    active: bool | None,
    limit: int,
    offset: int,
) -> dict:
    filters: list[str] = []
    params: dict[str, object] = {"limit": limit, "offset": offset}
    join_model = ""

    if model_code or model_version:
        join_model = "JOIN taxonomy.taxonomy_model m ON m.id = n.model_id"
        if model_code:
            filters.append("m.code = :model_code")
            params["model_code"] = model_code
        if model_version:
            filters.append("m.version = :model_version")
            params["model_version"] = model_version

    if node_type:
        filters.append("n.node_type = :node_type")
        params["node_type"] = node_type

    if parent_id:
        filters.append("n.parent_id = CAST(:parent_id AS uuid)")
        params["parent_id"] = parent_id

    if q:
        filters.append(
            "(n.preferred_label ILIKE :search OR n.normalized_label ILIKE :search OR n.external_code ILIKE :search)"
        )
        params["search"] = f"%{q}%"

    if active is not None:
        filters.append("n.active = :active")
        params["active"] = active

    where_clause = ("WHERE " + " AND ".join(filters)) if filters else ""

    total_row = _fetch_one(
        db,
        f"""
        SELECT COUNT(*)::int AS total
        FROM taxonomy.taxonomy_node n
        {join_model}
        {where_clause};
        """,
        params,
    )
    total = total_row["total"] if total_row else 0

    items = _fetch_all(
        db,
        f"""
        SELECT
            n.id::text AS id,
            n.model_id::text AS model_id,
            n.parent_id::text AS parent_id,
            n.external_code,
            n.external_uri,
            n.node_type,
            n.preferred_label,
            n.normalized_label,
            n.description,
            n.language_code,
            n.active,
            n.metadata_json,
            n.created_at,
            n.updated_at
        FROM taxonomy.taxonomy_node n
        {join_model}
        {where_clause}
        ORDER BY n.preferred_label ASC
        LIMIT :limit OFFSET :offset;
        """,
        params,
    )

    return {"total": total, "items": items}


def get_node_by_id(db: Session, node_id: str) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            n.id::text AS id,
            n.model_id::text AS model_id,
            n.parent_id::text AS parent_id,
            n.external_code,
            n.external_uri,
            n.node_type,
            n.preferred_label,
            n.normalized_label,
            n.description,
            n.language_code,
            n.active,
            n.metadata_json,
            n.created_at,
            n.updated_at
        FROM taxonomy.taxonomy_node n
        WHERE n.id = CAST(:node_id AS uuid);
        """,
        {"node_id": node_id},
    )


def list_node_children(db: Session, node_id: str) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            n.id::text AS id,
            n.model_id::text AS model_id,
            n.parent_id::text AS parent_id,
            n.external_code,
            n.external_uri,
            n.node_type,
            n.preferred_label,
            n.normalized_label,
            n.description,
            n.language_code,
            n.active,
            n.metadata_json,
            n.created_at,
            n.updated_at
        FROM taxonomy.taxonomy_node n
        WHERE n.parent_id = CAST(:node_id AS uuid)
        ORDER BY n.preferred_label ASC;
        """,
        {"node_id": node_id},
    )


def list_node_aliases(db: Session, node_id: str) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            a.id::text AS id,
            a.node_id::text AS node_id,
            a.alias,
            a.normalized_alias,
            a.language_code,
            a.source,
            a.confidence,
            a.active,
            a.metadata_json,
            a.created_at
        FROM taxonomy.taxonomy_alias a
        WHERE a.node_id = CAST(:node_id AS uuid)
        ORDER BY a.alias ASC;
        """,
        {"node_id": node_id},
    )


def list_node_relations(db: Session, node_id: str) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            r.id::text AS id,
            r.model_id::text AS model_id,
            r.source_node_id::text AS source_node_id,
            r.target_node_id::text AS target_node_id,
            r.relation_type,
            r.weight,
            r.confidence,
            r.active,
            r.metadata_json,
            r.created_at
        FROM taxonomy.taxonomy_relation r
        WHERE r.source_node_id = CAST(:node_id AS uuid)
           OR r.target_node_id = CAST(:node_id AS uuid)
        ORDER BY r.relation_type ASC, r.created_at ASC;
        """,
        {"node_id": node_id},
    )


def _crosswalk_review_view_exists(db: Session) -> bool:
    row = _fetch_one(
        db,
        """
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.views
            WHERE table_schema = 'taxonomy'
              AND table_name   = 'v_crosswalk_review'
        ) AS exists_flag;
        """,
    )
    return bool(row["exists_flag"])


# Columns selected when reading from the pre-built view.
# The view is expected to expose a `crosswalk_id` primary-key column (to avoid
# name-collision with node/model `id` columns inside the view definition).
_CW_REVIEW_VIEW_SELECT = """
    v.crosswalk_id::text  AS id,
    v.source_model_code,
    v.source_model_version,
    v.source_node_id::text AS source_node_id,
    v.source_node_type,
    v.source_label,
    v.target_model_code,
    v.target_model_version,
    v.target_node_id::text AS target_node_id,
    v.target_node_type,
    v.target_label,
    v.mapping_type,
    v.confidence,
    v.method,
    v.validated,
    v.active,
    v.metadata_json,
    v.created_at
"""

# Columns selected when falling back to live JOINs.
_CW_REVIEW_JOIN_SELECT = """
    c.id::text              AS id,
    sm.code                 AS source_model_code,
    sm.version              AS source_model_version,
    c.source_node_id::text  AS source_node_id,
    src.node_type           AS source_node_type,
    src.preferred_label     AS source_label,
    tm.code                 AS target_model_code,
    tm.version              AS target_model_version,
    c.target_node_id::text  AS target_node_id,
    tgt.node_type           AS target_node_type,
    tgt.preferred_label     AS target_label,
    c.mapping_type,
    c.confidence,
    c.method,
    c.validated,
    c.active,
    c.metadata_json,
    c.created_at
"""

# FROM fragment for the live-JOIN fallback.
_CW_REVIEW_JOIN_FROM = """
    taxonomy.taxonomy_crosswalk c
    LEFT JOIN taxonomy.taxonomy_node  src ON src.id = c.source_node_id
    LEFT JOIN taxonomy.taxonomy_model sm  ON sm.id  = src.model_id
    LEFT JOIN taxonomy.taxonomy_node  tgt ON tgt.id = c.target_node_id
    LEFT JOIN taxonomy.taxonomy_model tm  ON tm.id  = tgt.model_id
"""


def list_crosswalks_review(
    db: Session,
    *,
    validated: bool | None,
    active: bool | None,
    limit: int,
    offset: int,
) -> dict:
    use_view = _crosswalk_review_view_exists(db)
    alias = "v" if use_view else "c"

    filters: list[str] = []
    params: dict[str, object] = {"limit": limit, "offset": offset}

    if validated is not None:
        filters.append(f"{alias}.validated = :validated")
        params["validated"] = validated

    if active is not None:
        filters.append(f"{alias}.active = :active")
        params["active"] = active

    where_clause = ("WHERE " + " AND ".join(filters)) if filters else ""

    if use_view:
        from_clause = "taxonomy.v_crosswalk_review v"
        select_columns = _CW_REVIEW_VIEW_SELECT
    else:
        from_clause = _CW_REVIEW_JOIN_FROM
        select_columns = _CW_REVIEW_JOIN_SELECT

    total_row = _fetch_one(
        db,
        f"""
        SELECT COUNT(*)::int AS total
        FROM {from_clause}
        {where_clause};
        """,
        params,
    )
    total = total_row["total"] if total_row else 0

    items = _fetch_all(
        db,
        f"""
        SELECT
            {select_columns}
        FROM {from_clause}
        {where_clause}
        ORDER BY {alias}.created_at DESC
        LIMIT :limit OFFSET :offset;
        """,
        params,
    )

    return {"total": total, "items": items}


_CROSSWALK_RETURNING = """
    RETURNING
        id::text AS id,
        import_batch_id::text AS import_batch_id,
        source_node_id::text AS source_node_id,
        target_node_id::text AS target_node_id,
        mapping_type,
        confidence,
        method,
        validated,
        validated_by,
        validated_at,
        active,
        metadata_json,
        created_at
"""


def validate_crosswalk(
    db: Session,
    *,
    crosswalk_id: str,
    validated_by: str,
    mapping_type: str | None,
    confidence: float | None,
    note: str | None,
) -> dict | None:
    return _write_one(
        db,
        f"""
        UPDATE taxonomy.taxonomy_crosswalk
        SET
            validated    = true,
            validated_at = now(),
            validated_by = :validated_by,
            active       = true,
            mapping_type = COALESCE(:mapping_type, mapping_type),
            confidence   = COALESCE(CAST(:confidence AS double precision), confidence),
            metadata_json = COALESCE(metadata_json, '{{}}'::jsonb)
                           || jsonb_build_object('validated_at', now()::text)
                           || CASE WHEN :note IS NOT NULL
                                   THEN jsonb_build_object('validated_note', :note)
                                   ELSE '{{}}'::jsonb
                              END
        WHERE id = CAST(:crosswalk_id AS uuid)
        {_CROSSWALK_RETURNING};
        """,
        {
            "crosswalk_id": crosswalk_id,
            "validated_by": validated_by,
            "mapping_type": mapping_type,
            "confidence": confidence,
            "note": note,
        },
    )


def reject_crosswalk(
    db: Session,
    *,
    crosswalk_id: str,
    reason: str,
) -> dict | None:
    return _write_one(
        db,
        f"""
        UPDATE taxonomy.taxonomy_crosswalk
        SET
            active   = false,
            metadata_json = COALESCE(metadata_json, '{{}}'::jsonb)
                           || jsonb_build_object(
                                  'rejected_at',      now()::text,
                                  'rejection_reason', :reason
                              )
        WHERE id = CAST(:crosswalk_id AS uuid)
        {_CROSSWALK_RETURNING};
        """,
        {
            "crosswalk_id": crosswalk_id,
            "reason": reason,
        },
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
