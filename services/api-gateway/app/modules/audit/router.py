from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import require_roles
from app.modules.auth.schemas import CurrentUserResponse

from .schemas import AuditEventFilters, AuditEventResponse, AuditSummaryResponse
from .service import get_audit_event, get_audit_summary, list_audit_events

router = APIRouter(prefix="/tech-admin/audit", tags=["Audit"])


@router.get("/events", response_model=list[AuditEventResponse])
def list_audit_events_endpoint(
    event_category: str | None = Query(default=None),
    event_type: str | None = Query(default=None),
    severity: str | None = Query(default=None),
    actor_email: str | None = Query(default=None),
    entity_type: str | None = Query(default=None),
    entity_id: str | None = Query(default=None),
    trace_id: str | None = Query(default=None),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _current_user: CurrentUserResponse = Depends(require_roles("TECH_ADMIN")),
):
    return list_audit_events(
        db,
        AuditEventFilters(
            event_category=event_category,
            event_type=event_type,
            severity=severity,
            actor_email=actor_email,
            entity_type=entity_type,
            entity_id=entity_id,
            trace_id=trace_id,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
            offset=offset,
        ),
    )


@router.get("/events/{event_id}", response_model=AuditEventResponse)
def get_audit_event_endpoint(
    event_id: UUID,
    db: Session = Depends(get_db),
    _current_user: CurrentUserResponse = Depends(require_roles("TECH_ADMIN")),
):
    return get_audit_event(db, str(event_id))


@router.get("/summary", response_model=AuditSummaryResponse)
def get_audit_summary_endpoint(
    db: Session = Depends(get_db),
    _current_user: CurrentUserResponse = Depends(require_roles("TECH_ADMIN")),
):
    return get_audit_summary(db)
