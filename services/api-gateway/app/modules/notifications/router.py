from uuid import UUID

from fastapi import APIRouter, Body, Depends, Query

from app.clients.notification_client import (
    get_matching_run_notification_logs,
    get_notification_logs,
    notify_matching_run,
)
from app.modules.auth.dependencies import require_roles

router = APIRouter(prefix="/notifications", tags=["Notifications"])

READ_ROLES = ("ANETI_ADVISOR", "FUNCTIONAL_ADMIN", "TECH_ADMIN")
WRITE_ROLES = ("ANETI_ADVISOR", "FUNCTIONAL_ADMIN", "TECH_ADMIN")


@router.post("/matching-runs/{run_id}/notify")
def notify_matching_run_endpoint(
    run_id: UUID,
    payload: dict | None = Body(default=None),
    _current_user=Depends(require_roles(*WRITE_ROLES)),
):
    payload = payload or {}

    return notify_matching_run(
        str(run_id),
        {
            "threshold": payload.get("threshold"),
            "top_limit": payload.get("top_limit"),
            "force": bool(payload.get("force", False)),
        },
    )


@router.get("/matching-runs/{run_id}/logs")
def get_matching_run_notification_logs_endpoint(
    run_id: UUID,
    limit: int = Query(default=100, ge=1, le=500),
    _current_user=Depends(require_roles(*READ_ROLES)),
):
    return get_matching_run_notification_logs(str(run_id), limit=limit)


@router.get("/logs")
def get_notification_logs_endpoint(
    limit: int = Query(default=100, ge=1, le=500),
    _current_user=Depends(require_roles(*READ_ROLES)),
):
    return get_notification_logs(limit=limit)