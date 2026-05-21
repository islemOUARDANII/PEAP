from __future__ import annotations

from typing import Any
from uuid import UUID
import json
from sqlalchemy import text
from sqlalchemy.orm import Session

def _to_json(value: dict[str, Any] | None) -> str:
    return json.dumps(value or {}, ensure_ascii=False, default=str)

def insert_advisor_activity(
    db: Session,
    *,
    actor_user_id: str | UUID | None,
    actor_email: str | None,
    actor_role: str | None,
    activity_type: str,
    target_type: str,
    action_label: str,
    direction: str | None = None,
    query_text: str | None = None,
    filters_json: dict[str, Any] | None = None,
    model_id: str | UUID | None = None,
    model_version_id: str | UUID | None = None,
    model_code: str | None = None,
    model_label: str | None = None,
    source_entity_type: str | None = None,
    source_entity_id: str | UUID | None = None,
    run_id: str | UUID | None = None,
    result_count: int | None = None,
    duration_ms: int | None = None,
    status: str = "SUCCESS",
    error_message: str | None = None,
    metadata_json: dict[str, Any] | None = None,
) -> None:
    db.execute(
        text(
            """
            INSERT INTO audit.advisor_activity (
                actor_user_id,
                actor_email,
                actor_role,
                activity_type,
                target_type,
                direction,
                action_label,
                query_text,
                filters_json,
                model_id,
                model_version_id,
                model_code,
                model_label,
                source_entity_type,
                source_entity_id,
                run_id,
                result_count,
                duration_ms,
                status,
                error_message,
                metadata_json
            )
            VALUES (
                CAST(:actor_user_id AS uuid),
                :actor_email,
                :actor_role,
                :activity_type,
                :target_type,
                :direction,
                :action_label,
                :query_text,
                CAST(:filters_json AS jsonb),
                CAST(:model_id AS uuid),
                CAST(:model_version_id AS uuid),
                :model_code,
                :model_label,
                :source_entity_type,
                CAST(:source_entity_id AS uuid),
                CAST(:run_id AS uuid),
                :result_count,
                :duration_ms,
                :status,
                :error_message,
                CAST(:metadata_json AS jsonb)
            )
            """
        ),
        {
            "actor_user_id": str(actor_user_id) if actor_user_id else None,
            "actor_email": actor_email,
            "actor_role": actor_role,
            "activity_type": activity_type,
            "target_type": target_type,
            "direction": direction,
            "action_label": action_label,
            "query_text": query_text,
            "filters_json": _to_json(filters_json),
            "model_id": str(model_id) if model_id else None,
            "model_version_id": str(model_version_id) if model_version_id else None,
            "model_code": model_code,
            "model_label": model_label,
            "source_entity_type": source_entity_type,
            "source_entity_id": str(source_entity_id) if source_entity_id else None,
            "run_id": str(run_id) if run_id else None,
            "result_count": result_count,
            "duration_ms": duration_ms,
            "status": status,
            "error_message": error_message,
            "metadata_json": _to_json(metadata_json),
        },
    )
    db.commit()


def list_advisor_activities(
    db: Session,
    *,
    actor_user_id: str,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    rows = db.execute(
        text(
            """
            SELECT
                id::text AS id,
                activity_time,

                actor_user_id::text AS actor_user_id,
                actor_email,
                actor_role,

                activity_type,
                target_type,
                direction,
                action_label,

                query_text,
                COALESCE(filters_json, '{}'::jsonb) AS filters_json,

                model_id::text AS model_id,
                model_version_id::text AS model_version_id,
                model_code,
                model_label,

                source_entity_type,
                source_entity_id::text AS source_entity_id,
                run_id::text AS run_id,

                result_count,
                duration_ms,

                status,
                error_message,
                COALESCE(metadata_json, '{}'::jsonb) AS metadata_json

            FROM audit.advisor_activity
            WHERE actor_user_id = CAST(:actor_user_id AS uuid)
            ORDER BY activity_time DESC
            LIMIT :limit
            OFFSET :offset;
            """
        ),
        {
            "actor_user_id": actor_user_id,
            "limit": limit,
            "offset": offset,
        },
    ).mappings().all()

    return [dict(row) for row in rows]    