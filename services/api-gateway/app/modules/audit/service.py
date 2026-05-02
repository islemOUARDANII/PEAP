import json
import logging
from collections.abc import Mapping
from typing import Any

from fastapi import HTTPException, Request, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.modules.auth.schemas import CurrentUserResponse

from . import repository
from .schemas import (
    AuditEventFilters,
    AuditEventResponse,
    AuditSummaryBucketResponse,
    AuditSummaryResponse,
)

logger = logging.getLogger(__name__)


def _normalize_optional_text(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return str(value)


def _json_safe_payload(value: Any) -> Any:
    return json.loads(json.dumps(value, default=str))


def _clean_metadata(metadata: Mapping[str, Any] | None) -> dict[str, Any]:
    if not metadata:
        return {}
    cleaned = {
        key: value
        for key, value in metadata.items()
        if value is not None
    }
    return _json_safe_payload(cleaned)


def _extract_header(request: Request | None, *names: str) -> str | None:
    if request is None:
        return None
    for name in names:
        value = request.headers.get(name)
        if value:
            return value
    return None


def _ensure_table_available(db: Session) -> None:
    if not repository.audit_event_table_exists(db):
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="audit.audit_event table is not available yet",
        )


def list_audit_events(db: Session, filters: AuditEventFilters) -> list[dict]:
    _ensure_table_available(db)
    return [
        AuditEventResponse(**row).model_dump(mode="json")
        for row in repository.list_events(db, filters)
    ]


def get_audit_event(db: Session, event_id: str) -> dict:
    _ensure_table_available(db)
    event = repository.get_event_by_id(db, event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audit event not found",
        )
    return AuditEventResponse(**event).model_dump(mode="json")


def get_audit_summary(db: Session) -> dict:
    _ensure_table_available(db)
    totals = repository.get_summary_totals(db)
    by_category = repository.get_summary_group_counts(db, "event_category")
    by_severity = repository.get_summary_group_counts(db, "severity")
    by_event_type = repository.get_summary_group_counts(db, "event_type")
    return AuditSummaryResponse(
        total_events=totals["total_events"],
        error_events=totals["error_events"],
        latest_event_time=totals["latest_event_time"],
        by_category=[AuditSummaryBucketResponse(**row) for row in by_category],
        by_severity=[AuditSummaryBucketResponse(**row) for row in by_severity],
        by_event_type=[AuditSummaryBucketResponse(**row) for row in by_event_type],
    ).model_dump(mode="json")


def log_event(
    db: Session,
    *,
    event_category: str,
    event_type: str,
    severity: str = "INFO",
    current_user: CurrentUserResponse | None = None,
    actor_user_id: str | None = None,
    actor_email: str | None = None,
    actor_roles: list[str] | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    action: str | None = None,
    status: str | None = None,
    request: Request | None = None,
    request_id: str | None = None,
    trace_id: str | None = None,
    correlation_id: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    request_method: str | None = None,
    request_path: str | None = None,
    message: str | None = None,
    error_code: str | None = None,
    error_message: str | None = None,
    metadata: Mapping[str, Any] | None = None,
) -> dict | None:
    if not repository.audit_event_table_exists(db):
        logger.warning(
            "Skipping audit event %s because audit.audit_event is unavailable",
            event_type,
        )
        return None

    resolved_current_user_id = current_user.id if current_user else None
    resolved_actor_email = current_user.email if current_user else None
    resolved_actor_roles = current_user.roles if current_user else None

    payload = {
        "event_category": event_category.upper(),
        "event_type": event_type.upper(),
        "severity": severity.upper(),
        "actor_user_id": _normalize_optional_text(actor_user_id or resolved_current_user_id),
        "actor_email": _normalize_optional_text(actor_email or resolved_actor_email),
        "actor_roles": actor_roles or resolved_actor_roles,
        "entity_type": _normalize_optional_text(entity_type),
        "entity_id": _normalize_optional_text(entity_id),
        "action": _normalize_optional_text(action),
        "status": _normalize_optional_text(status),
        "request_id": _normalize_optional_text(
            request_id or _extract_header(request, "x-request-id", "request-id"),
        ),
        "trace_id": _normalize_optional_text(
            trace_id or _extract_header(request, "x-trace-id", "trace-id", "traceparent"),
        ),
        "correlation_id": _normalize_optional_text(
            correlation_id or _extract_header(request, "x-correlation-id", "correlation-id"),
        ),
        "ip_address": _normalize_optional_text(
            ip_address or (request.client.host if request and request.client else None),
        ),
        "user_agent": _normalize_optional_text(
            user_agent or _extract_header(request, "user-agent"),
        ),
        "request_method": _normalize_optional_text(
            request_method or (request.method if request else None),
        ),
        "request_path": _normalize_optional_text(
            request_path or (request.url.path if request else None),
        ),
        "message": _normalize_optional_text(message),
        "error_code": _normalize_optional_text(error_code),
        "error_message": _normalize_optional_text(error_message),
        "metadata": _clean_metadata(metadata),
    }

    try:
        created = repository.insert_event(db, payload)
        db.commit()
        return created
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Failed to persist audit event %s", event_type)
        return None


def log_auth_event(
    db: Session,
    *,
    event_type: str,
    severity: str = "INFO",
    **kwargs: Any,
) -> dict | None:
    return log_event(
        db,
        event_category="AUTH",
        event_type=event_type,
        severity=severity,
        **kwargs,
    )


def log_user_activity(
    db: Session,
    *,
    event_type: str,
    severity: str = "INFO",
    **kwargs: Any,
) -> dict | None:
    return log_event(
        db,
        event_category="USER_ACTIVITY",
        event_type=event_type,
        severity=severity,
        **kwargs,
    )


def log_business_event(
    db: Session,
    *,
    event_type: str,
    severity: str = "INFO",
    **kwargs: Any,
) -> dict | None:
    return log_event(
        db,
        event_category="BUSINESS",
        event_type=event_type,
        severity=severity,
        **kwargs,
    )


def log_pipeline_event(
    db: Session,
    *,
    event_type: str,
    severity: str = "INFO",
    **kwargs: Any,
) -> dict | None:
    return log_event(
        db,
        event_category="PIPELINE",
        event_type=event_type,
        severity=severity,
        **kwargs,
    )
