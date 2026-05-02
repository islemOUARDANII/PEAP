import json
from collections.abc import Mapping

from sqlalchemy import text
from sqlalchemy.orm import Session

from .schemas import AuditEventFilters

_EVENT_SELECT = """
SELECT
    ae.id::text AS id,
    ae.event_time,
    ae.event_category,
    ae.event_type,
    ae.severity,
    ae.actor_user_id::text AS actor_user_id,
    ae.actor_email,
    ae.actor_roles,
    ae.entity_type,
    ae.entity_id,
    ae.action,
    ae.status,
    ae.request_id,
    ae.trace_id,
    ae.correlation_id,
    ae.ip_address,
    ae.user_agent,
    ae.request_method,
    ae.request_path,
    ae.message,
    ae.error_code,
    ae.error_message,
    ae.metadata
FROM audit.audit_event ae
"""

_FILTERS_SQL = """
WHERE (:event_category IS NULL OR ae.event_category = :event_category)
  AND (:event_type IS NULL OR ae.event_type = :event_type)
  AND (:severity IS NULL OR ae.severity = :severity)
  AND (:actor_email IS NULL OR lower(ae.actor_email) = lower(:actor_email))
  AND (:entity_type IS NULL OR ae.entity_type = :entity_type)
  AND (:entity_id IS NULL OR ae.entity_id = :entity_id)
  AND (:trace_id IS NULL OR ae.trace_id = :trace_id)
  AND (:date_from IS NULL OR ae.event_time >= :date_from)
  AND (:date_to IS NULL OR ae.event_time <= :date_to)
"""


def _fetch_one(db: Session, query: str, params: dict | None = None) -> dict | None:
    row = db.execute(text(query), params or {}).mappings().first()
    return dict(row) if row else None


def _fetch_all(db: Session, query: str, params: dict | None = None) -> list[dict]:
    rows = db.execute(text(query), params or {}).mappings().all()
    return [dict(row) for row in rows]


def audit_event_table_exists(db: Session) -> bool:
    row = _fetch_one(
        db,
        """
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'audit'
              AND table_name = 'audit_event'
        ) AS exists_flag;
        """,
    )
    return bool(row and row["exists_flag"])


def insert_event(db: Session, payload: Mapping[str, object]) -> dict | None:
    params = dict(payload)
    params["metadata"] = json.dumps(params.get("metadata") or {})
    return _fetch_one(
        db,
        """
        INSERT INTO audit.audit_event (
            event_category,
            event_type,
            severity,
            actor_user_id,
            actor_email,
            actor_roles,
            entity_type,
            entity_id,
            action,
            status,
            request_id,
            trace_id,
            correlation_id,
            ip_address,
            user_agent,
            request_method,
            request_path,
            message,
            error_code,
            error_message,
            metadata
        )
        VALUES (
            :event_category,
            :event_type,
            :severity,
            CAST(:actor_user_id AS uuid),
            :actor_email,
            :actor_roles,
            :entity_type,
            :entity_id,
            :action,
            :status,
            :request_id,
            :trace_id,
            :correlation_id,
            :ip_address,
            :user_agent,
            :request_method,
            :request_path,
            :message,
            :error_code,
            :error_message,
            CAST(:metadata AS jsonb)
        )
        RETURNING id::text AS id;
        """,
        params,
    )


def list_events(db: Session, filters: AuditEventFilters) -> list[dict]:
    params = filters.model_dump(mode="python")
    for key in ("event_category", "event_type", "severity"):
        if params.get(key):
            params[key] = str(params[key]).upper()
    return _fetch_all(
        db,
        f"""
        {_EVENT_SELECT}
        {_FILTERS_SQL}
        ORDER BY ae.event_time DESC
        LIMIT :limit
        OFFSET :offset;
        """,
        params,
    )


def get_event_by_id(db: Session, event_id: str) -> dict | None:
    return _fetch_one(
        db,
        f"""
        {_EVENT_SELECT}
        WHERE ae.id = CAST(:event_id AS uuid)
        LIMIT 1;
        """,
        {"event_id": event_id},
    )


def get_summary_totals(db: Session) -> dict:
    return _fetch_one(
        db,
        """
        SELECT
            COUNT(*)::int AS total_events,
            COUNT(*) FILTER (
                WHERE severity IN ('ERROR', 'CRITICAL')
            )::int AS error_events,
            MAX(event_time) AS latest_event_time
        FROM audit.audit_event;
        """,
    ) or {
        "total_events": 0,
        "error_events": 0,
        "latest_event_time": None,
    }


def get_summary_group_counts(db: Session, group_by: str) -> list[dict]:
    group_column = {
        "event_category": "ae.event_category",
        "severity": "ae.severity",
        "event_type": "ae.event_type",
    }[group_by]
    return _fetch_all(
        db,
        f"""
        SELECT
            {group_column} AS key,
            COUNT(*)::int AS count
        FROM audit.audit_event ae
        GROUP BY {group_column}
        ORDER BY count DESC, key ASC;
        """,
    )
