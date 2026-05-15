from sqlalchemy import text
from sqlalchemy.orm import Session


def _fetch_one(db: Session, query: str, params: dict | None = None) -> dict | None:
    row = db.execute(text(query), params or {}).mappings().first()
    return dict(row) if row else None


def _fetch_all(db: Session, query: str, params: dict | None = None) -> list[dict]:
    rows = db.execute(text(query), params or {}).mappings().all()
    return [dict(row) for row in rows]


def list_countries(db: Session, *, active_only: bool = True) -> list[dict]:
    where = "WHERE c.active = true" if active_only else ""
    return _fetch_all(
        db,
        f"""
        SELECT
            c.id::text  AS id,
            c.iso2,
            c.iso3,
            c.name_fr,
            c.name_en,
            c.name_ar,
            c.phone_prefix,
            c.currency_code,
            c.active
        FROM geo.country c
        {where}
        ORDER BY c.name_fr ASC;
        """,
    )


def get_country_by_iso2(db: Session, iso2: str) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            c.id::text  AS id,
            c.iso2,
            c.iso3,
            c.name_fr,
            c.name_en,
            c.name_ar,
            c.phone_prefix,
            c.currency_code,
            c.active
        FROM geo.country c
        WHERE c.iso2 = :iso2
        LIMIT 1;
        """,
        {"iso2": iso2},
    )


def list_admin_units(
    db: Session,
    *,
    country_id: str | None = None,
    country_iso2: str | None = None,
    admin_level: int | None = None,
    parent_id: str | None = None,
    active_only: bool = True,
    q: str | None = None,
    limit: int = 500,
    offset: int = 0,
) -> list[dict]:
    filters: list[str] = []
    params: dict[str, object] = {"limit": limit, "offset": offset}

    if country_id:
        filters.append("u.country_id = CAST(:country_id AS uuid)")
        params["country_id"] = country_id
    elif country_iso2:
        filters.append("c.iso2 = :country_iso2")
        params["country_iso2"] = country_iso2

    if admin_level is not None:
        filters.append("u.admin_level = :admin_level")
        params["admin_level"] = admin_level

    if parent_id:
        filters.append("u.parent_id = CAST(:parent_id AS uuid)")
        params["parent_id"] = parent_id

    if active_only:
        filters.append("u.active = true")

    if q:
        filters.append(
            "(u.label ILIKE :q OR u.normalized_label ILIKE :q OR u.code ILIKE :q)"
        )
        params["q"] = f"%{q}%"

    where_clause = ("WHERE " + " AND ".join(filters)) if filters else ""

    return _fetch_all(
        db,
        f"""
        SELECT
            u.id::text       AS id,
            u.country_id::text AS country_id,
            u.parent_id::text  AS parent_id,
            u.code,
            u.label,
            u.label_fr,
            u.label_en,
            u.label_ar,
            u.admin_level,
            u.unit_type,
            u.active
        FROM geo.admin_unit u
        LEFT JOIN geo.country c ON c.id = u.country_id
        {where_clause}
        ORDER BY u.admin_level ASC, u.label ASC
        LIMIT :limit OFFSET :offset;
        """,
        params,
    )
