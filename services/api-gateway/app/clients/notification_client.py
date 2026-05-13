from __future__ import annotations

import os
from typing import Any

import httpx
from fastapi import HTTPException, status


def _base_url() -> str:
    url = os.getenv("NOTIFICATION_SERVICE_URL")
    if not url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="NOTIFICATION_SERVICE_URL is not configured.",
        )
    return url.rstrip("/")


def _headers() -> dict[str, str]:
    internal_api_key = os.getenv("INTERNAL_API_KEY")
    headers = {"Content-Type": "application/json"}

    if internal_api_key:
        headers["X-Internal-Api-Key"] = internal_api_key

    return headers


def notify_matching_run(run_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    try:
        response = httpx.post(
            f"{_base_url()}/internal/notifications/matching-runs/{run_id}/notify",
            json=payload,
            headers=_headers(),
            timeout=60,
        )
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=exc.response.text,
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Notification service unavailable: {exc}",
        ) from exc


def get_matching_run_notification_logs(run_id: str, limit: int = 100) -> list[dict[str, Any]]:
    try:
        response = httpx.get(
            f"{_base_url()}/internal/notifications/matching-runs/{run_id}/logs",
            params={"limit": limit},
            headers=_headers(),
            timeout=30,
        )
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=exc.response.text,
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Notification service unavailable: {exc}",
        ) from exc


def get_notification_logs(limit: int = 100) -> list[dict[str, Any]]:
    try:
        response = httpx.get(
            f"{_base_url()}/internal/notifications/logs",
            params={"limit": limit},
            headers=_headers(),
            timeout=30,
        )
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=exc.response.text,
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Notification service unavailable: {exc}",
        ) from exc