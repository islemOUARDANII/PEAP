from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session


def get_candidate_segments(session: Session) -> list[dict[str, Any]]:
    rows = session.execute(
        text("""
            SELECT
                id,
                code,
                label,
                macro_segment,
                priority,
                active
            FROM matching.segment
            WHERE active = TRUE
            ORDER BY priority ASC, code ASC
        """)
    ).mappings().all()

    return [dict(row) for row in rows]


def get_segment_rules(session: Session, segment_id: UUID | str) -> list[dict[str, Any]]:
    rows = session.execute(
        text("""
            SELECT
                id,
                segment_id,
                target_type,
                attribute_path,
                operator,
                value,
                logic
            FROM matching.segment_rule
            WHERE segment_id = :segment_id
            ORDER BY id
        """),
        {"segment_id": str(segment_id)},
    ).mappings().all()

    return [dict(row) for row in rows]