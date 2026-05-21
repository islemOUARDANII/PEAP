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
            COALESCE(
                work_ref.code,
                work_ref.label_fr,
                work_ref.label_en,
                work_ref.label,
                ''
            ) AS work_mode
        FROM aneti.job_offer o
        LEFT JOIN reference.ref_value work_ref
            ON work_ref.id = o.work_mode_ref_id
        WHERE o.id::text IN :offer_ids;
        """
    ).bindparams(bindparam("offer_ids", expanding=True))

    rows = db.execute(query, {"offer_ids": offer_ids}).mappings().all()

    return {
        row["offer_id"]: dict(row)
        for row in rows
    }


def get_offer_metadata(db: Session, offer_id: str) -> dict | None:
    row = db.execute(
        text(
            """
            SELECT
                o.id::text AS offer_id,
                o.status,
                COALESCE(
                    work_ref.code,
                    work_ref.label_fr,
                    work_ref.label_en,
                    work_ref.label,
                    ''
                ) AS work_mode
            FROM aneti.job_offer o
            LEFT JOIN reference.ref_value work_ref
                ON work_ref.id = o.work_mode_ref_id
            WHERE o.id = CAST(:offer_id AS uuid)
            LIMIT 1;
            """
        ),
        {"offer_id": offer_id},
    ).mappings().first()

    return dict(row) if row else None
