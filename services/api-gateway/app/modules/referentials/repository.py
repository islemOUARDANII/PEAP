from sqlalchemy import text
from sqlalchemy.orm import Session


def _fetch_all(db: Session, query: str, params: dict | None = None) -> list[dict]:
    rows = db.execute(text(query), params or {}).mappings().all()
    return [dict(row) for row in rows]


def list_reference(db: Session, table_name: str, code_column: str, label_column: str) -> list[dict]:
    return _fetch_all(
        db,
        f"""
        SELECT
            {code_column}::text AS code,
            {label_column}::text AS label
        FROM taxonomy.{table_name}
        ORDER BY {label_column} ASC;
        """,
    )


def list_delegations(db: Session, governorate_code: str | None = None) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            code_delegation::text AS code,
            libelle_delegation::text AS label,
            code_gouvernorat::text AS governorate_code
        FROM taxonomy.ref_n_delegat
        WHERE (:governorate_code IS NULL OR code_gouvernorat = :governorate_code)
        ORDER BY libelle_delegation ASC;
        """,
        {"governorate_code": governorate_code},
    )

def list_languages(db: Session) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            code::text AS code,
            label_fr::text AS label
        FROM taxonomy.ref_language
        WHERE is_active = true
        ORDER BY label_fr ASC;
        """,
    )


def list_language_levels(db: Session) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            code::text AS code,
            label_fr::text AS label
        FROM taxonomy.ref_language_level
        WHERE is_active = true
        ORDER BY rank_order ASC;
        """,
    )