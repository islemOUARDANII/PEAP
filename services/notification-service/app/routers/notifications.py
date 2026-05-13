from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.config import settings
from app.repositories.notification_log_repository import list_logs, list_logs_for_run
from app.schemas import NotifyMatchingRunRequest, NotifyMatchingRunResponse
from app.services.notification_service import notify_matching_run

logger = logging.getLogger(__name__)

router = APIRouter(tags=["notifications"])


def require_internal_api_key(
    x_internal_api_key: str | None = Header(default=None),
):
    expected = settings.internal_api_key

    if not expected:
        logger.warning("INTERNAL_API_KEY is empty; internal auth disabled")
        return

    if x_internal_api_key != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal API key",
        )


@router.post(
    "/internal/notifications/matching-runs/{run_id}/notify",
    response_model=NotifyMatchingRunResponse,
)
def notify_matching_run_endpoint(
    run_id: UUID,
    payload: NotifyMatchingRunRequest,
    _auth=Depends(require_internal_api_key),
):
    return notify_matching_run(
        run_id=run_id,
        threshold=payload.threshold,
        top_limit=payload.top_limit,
        force=payload.force,
    )


@router.get("/internal/notifications/matching-runs/{run_id}/logs")
def get_matching_run_notification_logs_endpoint(
    run_id: UUID,
    limit: int = 100,
    _auth=Depends(require_internal_api_key),
):
    return list_logs_for_run(run_id=run_id, limit=limit)


@router.get("/internal/notifications/logs")
def get_notification_logs_endpoint(
    limit: int = 100,
    _auth=Depends(require_internal_api_key),
):
    return list_logs(limit=limit)