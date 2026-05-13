from sqlalchemy import bindparam, text
from sqlalchemy.orm import Session


def list_offer_metadata(db: Session, offer_ids: list[str]) -> dict[str, dict]:
    if not offer_ids:
        return {}

    query = text(
        """
        SELECT
            o.id::text AS offer_id,
            o.status,
            o.work_mode
        FROM aneti.job_offer o
        WHERE o.id::text IN :offer_ids;
        """
    ).bindparams(bindparam("offer_ids", expanding=True))

    rows = db.execute(query, {"offer_ids": offer_ids}).mappings().all()
    return {
        str(row["offer_id"]): {
            "status": row["status"],
            "work_mode": row["work_mode"],
        }
        for row in rows
    }


def get_offer_metadata(db: Session, offer_id: str) -> dict | None:
    row = db.execute(
        text(
            """
            SELECT
                o.id::text AS offer_id,
                o.status,
                o.work_mode
            FROM aneti.job_offer o
            WHERE o.id = CAST(:offer_id AS uuid)
            LIMIT 1;
            """
        ),
        {"offer_id": offer_id},
    ).mappings().first()

    return dict(row) if row else None
