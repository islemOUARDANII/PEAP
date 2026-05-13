from sqlalchemy import text
from sqlalchemy.orm import Session


def _fetch_one(db: Session, query: str, params: dict | None = None) -> dict | None:
    row = db.execute(text(query), params or {}).mappings().first()
    return dict(row) if row else None


def count_active_matching_models(db: Session) -> int:
    row = _fetch_one(
        db,
        """
        SELECT COUNT(*)::int AS total
        FROM matching.matching_model
        WHERE active = TRUE;
        """,
    )
    return int(row["total"])


def count_active_segments(db: Session) -> int:
    row = _fetch_one(
        db,
        """
        SELECT COUNT(*)::int AS total
        FROM matching.segment
        WHERE active = TRUE;
        """,
    )
    return int(row["total"])
