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


def list_postal_codes(
    db: Session,
    *,
    country_id: str | None = None,
    country_iso2: str | None = None,
    admin_unit_id: str | None = None,
    q: str | None = None,
    active_only: bool = True,
    limit: int = 100,
    offset: int = 0,
) -> list[dict]:
    """
    Retourne les codes postaux avec leur unité admin (imada ou délégation) via
    geo.postal_code_admin_unit.

    Quand admin_unit_id est fourni :
    - filtre directement sur geo.postal_code_admin_unit.admin_unit_id
    - retourne une ligne par (code postal, localité)
    - inclut admin_level, unit_type, admin_unit_label_fr, confidence

    Sinon :
    - retourne les codes postaux avec leur meilleure association PAU (confidence DESC)
    """
    params: dict[str, object] = {"limit": limit, "offset": offset}

    if admin_unit_id:
        # ── Mode filtrage par admin_unit_id ─────────────────────────────────
        params["admin_unit_id"] = admin_unit_id

        extra_filters: list[str] = []
        if active_only:
            extra_filters.append("p.active = true")
            extra_filters.append("pau.active = true")
        if country_id:
            extra_filters.append("p.country_id = CAST(:country_id AS uuid)")
            params["country_id"] = country_id
        elif country_iso2:
            extra_filters.append("c.iso2 = :country_iso2")
            params["country_iso2"] = country_iso2
        if q:
            extra_filters.append(
                "(p.postal_code ILIKE :q OR pau.locality_label ILIKE :q)"
            )
            params["q"] = f"%{q}%"

        extra_clause = ("AND " + " AND ".join(extra_filters)) if extra_filters else ""

        return _fetch_all(
            db,
            f"""
            SELECT
                p.id::text              AS id,
                p.country_id::text      AS country_id,
                p.postal_code,
                p.label,
                pau.locality_label,
                pau.locality_label_ar,
                pau.admin_unit_id::text AS admin_unit_id,
                au.admin_level,
                au.unit_type,
                COALESCE(au.label_fr, au.label_en, au.label) AS admin_unit_label_fr,
                pau.confidence,
                p.active
            FROM geo.postal_code_admin_unit pau
            JOIN geo.postal_code  p  ON p.id  = pau.postal_code_id
            JOIN geo.admin_unit   au ON au.id  = pau.admin_unit_id
            LEFT JOIN geo.country c  ON c.id   = p.country_id
            WHERE pau.admin_unit_id = CAST(:admin_unit_id AS uuid)
            {extra_clause}
            ORDER BY p.postal_code ASC, pau.confidence DESC NULLS LAST
            LIMIT :limit OFFSET :offset;
            """,
            params,
        )

    # ── Mode général (sans admin_unit_id) ────────────────────────────────────
    filters: list[str] = []

    if country_id:
        filters.append("p.country_id = CAST(:country_id AS uuid)")
        params["country_id"] = country_id
    elif country_iso2:
        filters.append("c.iso2 = :country_iso2")
        params["country_iso2"] = country_iso2

    if active_only:
        filters.append("p.active = true")

    if q:
        filters.append(
            "(p.postal_code ILIKE :q OR p.label ILIKE :q OR pau_best.locality_label ILIKE :q)"
        )
        params["q"] = f"%{q}%"

    where_clause = ("WHERE " + " AND ".join(filters)) if filters else ""

    return _fetch_all(
        db,
        f"""
        SELECT
            p.id::text                   AS id,
            p.country_id::text           AS country_id,
            p.postal_code,
            p.label,
            pau_best.locality_label,
            pau_best.locality_label_ar,
            pau_best.admin_unit_id::text AS admin_unit_id,
            au.admin_level,
            au.unit_type,
            COALESCE(au.label_fr, au.label_en, au.label) AS admin_unit_label_fr,
            pau_best.confidence,
            p.active
        FROM geo.postal_code p
        LEFT JOIN geo.country c ON c.id = p.country_id
        LEFT JOIN LATERAL (
            SELECT
                pau.admin_unit_id,
                pau.locality_label,
                pau.locality_label_ar,
                pau.confidence
            FROM geo.postal_code_admin_unit pau
            WHERE pau.postal_code_id = p.id
              AND pau.active = true
            ORDER BY pau.confidence DESC NULLS LAST
            LIMIT 1
        ) pau_best ON true
        LEFT JOIN geo.admin_unit au ON au.id = pau_best.admin_unit_id
        {where_clause}
        ORDER BY p.postal_code ASC
        LIMIT :limit OFFSET :offset;
        """,
        params,
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
