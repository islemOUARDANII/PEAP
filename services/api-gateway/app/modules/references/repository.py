import json

from sqlalchemy import text
from sqlalchemy.orm import Session


# ─── low-level helpers ────────────────────────────────────────────────────────

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


def _json_param(value: dict | None) -> str | None:
    """Serialize a Python dict to a JSON string for CAST(:p AS jsonb) bindings."""
    return json.dumps(value) if value is not None else None


# ─── shared column projections ────────────────────────────────────────────────

_GROUP_COLS = """
    g.id::text   AS id,
    g.code,
    g.label,
    g.description,
    g.domain,
    g.active,
    g.metadata_json,
    g.created_at,
    g.updated_at
"""

_GROUP_RETURNING = """
    id::text AS id, code, label, description, domain, active,
    metadata_json, created_at, updated_at
"""

_VALUE_COLS = """
    v.id::text        AS id,
    v.group_id::text  AS group_id,
    g.code            AS group_code,
    v.code,
    v.label,
    v.normalized_label,
    v.label_fr,
    v.label_en,
    v.label_ar,
    v.sort_order,
    v.active,
    v.valid_from,
    v.valid_to,
    v.source,
    v.external_code,
    v.metadata_json,
    v.created_at,
    v.updated_at
"""

_VALUE_RETURNING_JOINED = """
    u.id::text       AS id,
    u.group_id::text AS group_id,
    g.code           AS group_code,
    u.code,
    u.label,
    u.normalized_label,
    u.label_fr,
    u.label_en,
    u.label_ar,
    u.sort_order,
    u.active,
    u.valid_from,
    u.valid_to,
    u.source,
    u.external_code,
    u.metadata_json,
    u.created_at,
    u.updated_at
"""


# ═══════════════════════════════════════════════════════════════════════════════
# ref_group
# ═══════════════════════════════════════════════════════════════════════════════

def list_groups(
    db: Session,
    *,
    q: str | None,
    active: bool | None,
    limit: int,
    offset: int,
) -> dict:
    filters: list[str] = []
    params: dict[str, object] = {"limit": limit, "offset": offset}

    if q:
        filters.append(
            "(g.code ILIKE :q OR g.label ILIKE :q OR g.description ILIKE :q OR g.domain ILIKE :q)"
        )
        params["q"] = f"%{q}%"
    if active is not None:
        filters.append("g.active = :active")
        params["active"] = active

    where_clause = ("WHERE " + " AND ".join(filters)) if filters else ""

    total_row = _fetch_one(
        db,
        f"SELECT COUNT(*)::int AS total FROM reference.ref_group g {where_clause};",
        params,
    )
    total = total_row["total"] if total_row else 0

    items = _fetch_all(
        db,
        f"""
        SELECT {_GROUP_COLS}
        FROM reference.ref_group g
        {where_clause}
        ORDER BY g.label ASC
        LIMIT :limit OFFSET :offset;
        """,
        params,
    )
    return {"total": total, "items": items}


def create_group(
    db: Session,
    *,
    code: str,
    label: str,
    description: str | None,
    domain: str | None,
    active: bool,
    metadata_json: dict | None,
) -> dict | None:
    return _write_one(
        db,
        f"""
        INSERT INTO reference.ref_group
            (id, code, label, description, domain, active, metadata_json, created_at, updated_at)
        VALUES
            (gen_random_uuid(), :code, :label, :description, :domain, :active,
             CAST(:metadata_json AS jsonb), now(), now())
        RETURNING {_GROUP_RETURNING};
        """,
        {
            "code": code,
            "label": label,
            "description": description,
            "domain": domain,
            "active": active,
            "metadata_json": _json_param(metadata_json),
        },
    )


def update_group(
    db: Session,
    group_id: str,
    *,
    label: str | None,
    description: str | None,
    domain: str | None,
    active: bool | None,
    metadata_json: dict | None,
) -> dict | None:
    set_parts: list[str] = ["updated_at = now()"]
    params: dict[str, object] = {"group_id": group_id}

    if label is not None:
        set_parts.append("label = :label")
        params["label"] = label
    if description is not None:
        set_parts.append("description = :description")
        params["description"] = description
    if domain is not None:
        set_parts.append("domain = :domain")
        params["domain"] = domain
    if active is not None:
        set_parts.append("active = :active")
        params["active"] = active
    if metadata_json is not None:
        set_parts.append(
            "metadata_json = COALESCE(metadata_json, '{}'::jsonb) || CAST(:metadata_json AS jsonb)"
        )
        params["metadata_json"] = _json_param(metadata_json)

    return _write_one(
        db,
        f"""
        UPDATE reference.ref_group
        SET {", ".join(set_parts)}
        WHERE id = CAST(:group_id AS uuid)
        RETURNING {_GROUP_RETURNING};
        """,
        params,
    )


def delete_group(db: Session, group_id: str) -> dict | None:
    return _write_one(
        db,
        f"""
        UPDATE reference.ref_group
        SET active = false, updated_at = now()
        WHERE id = CAST(:group_id AS uuid)
        RETURNING {_GROUP_RETURNING};
        """,
        {"group_id": group_id},
    )


# ═══════════════════════════════════════════════════════════════════════════════
# ref_value
# ═══════════════════════════════════════════════════════════════════════════════

# Inline normalization: trim → collapse whitespace → lower.
_NORMALIZE_LABEL = (
    "lower(trim(regexp_replace(coalesce(:label_for_norm, ''), '\\s+', ' ', 'g')))"
)


def list_values(
    db: Session,
    *,
    group_code: str | None,
    group_id: str | None,
    q: str | None,
    active: bool | None,
    limit: int,
    offset: int,
) -> dict:
    filters: list[str] = []
    params: dict[str, object] = {"limit": limit, "offset": offset}

    if group_code:
        filters.append("g.code = :group_code")
        params["group_code"] = group_code
    if group_id:
        filters.append("v.group_id = CAST(:group_id AS uuid)")
        params["group_id"] = group_id
    if q:
        filters.append(
            "(v.code ILIKE :q OR v.label ILIKE :q"
            " OR v.label_fr ILIKE :q OR v.label_en ILIKE :q"
            " OR v.label_ar ILIKE :q OR v.external_code ILIKE :q)"
        )
        params["q"] = f"%{q}%"
    if active is not None:
        filters.append("v.active = :active")
        params["active"] = active

    where_clause = ("WHERE " + " AND ".join(filters)) if filters else ""
    from_clause = """
        reference.ref_value v
        LEFT JOIN reference.ref_group g ON g.id = v.group_id
    """

    total_row = _fetch_one(
        db,
        f"SELECT COUNT(*)::int AS total FROM {from_clause} {where_clause};",
        params,
    )
    total = total_row["total"] if total_row else 0

    items = _fetch_all(
        db,
        f"""
        SELECT {_VALUE_COLS}
        FROM {from_clause}
        {where_clause}
        ORDER BY v.sort_order ASC, v.label ASC
        LIMIT :limit OFFSET :offset;
        """,
        params,
    )
    return {"total": total, "items": items}


def create_value(
    db: Session,
    *,
    group_id: str,
    code: str,
    label: str,
    label_fr: str | None,
    label_en: str | None,
    label_ar: str | None,
    sort_order: int,
    active: bool,
    valid_from: object,
    valid_to: object,
    source: str | None,
    external_code: str | None,
    metadata_json: dict | None,
) -> dict | None:
    return _write_one(
        db,
        f"""
        WITH inserted AS (
            INSERT INTO reference.ref_value
                (id, group_id, code, label, normalized_label,
                 label_fr, label_en, label_ar,
                 sort_order, active, valid_from, valid_to,
                 source, external_code, metadata_json,
                 created_at, updated_at)
            VALUES
                (gen_random_uuid(), CAST(:group_id AS uuid), :code, :label,
                 {_NORMALIZE_LABEL},
                 :label_fr, :label_en, :label_ar,
                 COALESCE(:sort_order, 0), :active,
                 CAST(:valid_from AS date), CAST(:valid_to AS date),
                 :source, :external_code, CAST(:metadata_json AS jsonb),
                 now(), now())
            RETURNING *
        )
        SELECT {_VALUE_RETURNING_JOINED}
        FROM inserted u
        LEFT JOIN reference.ref_group g ON g.id = u.group_id;
        """,
        {
            "group_id": group_id,
            "code": code,
            "label": label,
            "label_for_norm": label,
            "label_fr": label_fr,
            "label_en": label_en,
            "label_ar": label_ar,
            "sort_order": sort_order,
            "active": active,
            "valid_from": valid_from,
            "valid_to": valid_to,
            "source": source,
            "external_code": external_code,
            "metadata_json": _json_param(metadata_json),
        },
    )


def update_value(
    db: Session,
    value_id: str,
    *,
    label: str | None,
    label_fr: str | None,
    label_en: str | None,
    label_ar: str | None,
    sort_order: int | None,
    active: bool | None,
    valid_from: object,
    valid_to: object,
    source: str | None,
    external_code: str | None,
    metadata_json: dict | None,
) -> dict | None:
    set_parts: list[str] = ["updated_at = now()"]
    params: dict[str, object] = {"value_id": value_id}

    if label is not None:
        set_parts.append("label = :label")
        # Recompute normalized_label whenever label changes.
        set_parts.append(
            f"normalized_label = {_NORMALIZE_LABEL}"
        )
        params["label"] = label
        params["label_for_norm"] = label
    if label_fr is not None:
        set_parts.append("label_fr = :label_fr")
        params["label_fr"] = label_fr
    if label_en is not None:
        set_parts.append("label_en = :label_en")
        params["label_en"] = label_en
    if label_ar is not None:
        set_parts.append("label_ar = :label_ar")
        params["label_ar"] = label_ar
    if sort_order is not None:
        set_parts.append("sort_order = :sort_order")
        params["sort_order"] = sort_order
    if active is not None:
        set_parts.append("active = :active")
        params["active"] = active
    if valid_from is not None:
        set_parts.append("valid_from = CAST(:valid_from AS date)")
        params["valid_from"] = valid_from
    if valid_to is not None:
        set_parts.append("valid_to = CAST(:valid_to AS date)")
        params["valid_to"] = valid_to
    if source is not None:
        set_parts.append("source = :source")
        params["source"] = source
    if external_code is not None:
        set_parts.append("external_code = :external_code")
        params["external_code"] = external_code
    if metadata_json is not None:
        set_parts.append(
            "metadata_json = COALESCE(metadata_json, '{}'::jsonb) || CAST(:metadata_json AS jsonb)"
        )
        params["metadata_json"] = _json_param(metadata_json)

    return _write_one(
        db,
        f"""
        WITH updated AS (
            UPDATE reference.ref_value
            SET {", ".join(set_parts)}
            WHERE id = CAST(:value_id AS uuid)
            RETURNING *
        )
        SELECT {_VALUE_RETURNING_JOINED}
        FROM updated u
        LEFT JOIN reference.ref_group g ON g.id = u.group_id;
        """,
        params,
    )


def delete_value(db: Session, value_id: str) -> dict | None:
    return _write_one(
        db,
        f"""
        WITH updated AS (
            UPDATE reference.ref_value
            SET active = false, updated_at = now()
            WHERE id = CAST(:value_id AS uuid)
            RETURNING *
        )
        SELECT {_VALUE_RETURNING_JOINED}
        FROM updated u
        LEFT JOIN reference.ref_group g ON g.id = u.group_id;
        """,
        {"value_id": value_id},
    )


# ═══════════════════════════════════════════════════════════════════════════════
# public dropdown
# ═══════════════════════════════════════════════════════════════════════════════

def list_dropdown_values(db: Session, group_code: str) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            v.id::text   AS id,
            v.code,
            v.label,
            v.label_fr,
            v.label_en,
            v.label_ar,
            v.sort_order
        FROM reference.ref_value v
        JOIN reference.ref_group g ON g.id = v.group_id
        WHERE g.code   = :group_code
          AND v.active = true
          AND g.active = true
        ORDER BY v.sort_order ASC, v.label ASC;
        """,
        {"group_code": group_code},
    )
