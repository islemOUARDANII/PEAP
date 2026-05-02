import logging
import os
from typing import Any

import httpx
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)


def _timeout_seconds() -> float:
    return float(os.getenv("MATCHING_SERVICE_TIMEOUT_SECONDS", "180"))


def _base_url() -> str:
    return os.getenv("MATCHING_SERVICE_URL", "http://matching-service:8002").rstrip("/")


def _headers() -> dict[str, str]:
    internal_api_key = os.getenv("INTERNAL_API_KEY")
    headers = {"Content-Type": "application/json"}

    if internal_api_key:
        # Send both names so the gateway remains compatible with either internal convention.
        headers["X-Internal-Api-Key"] = internal_api_key
        headers["X-Api-Key"] = internal_api_key

    return headers


def _request(method: str, path: str, *, json_payload: dict[str, Any] | None = None) -> dict[str, Any]:
    url = f"{_base_url()}{path}"

    try:
        with httpx.Client(timeout=_timeout_seconds()) as client:
            response = client.request(
                method,
                url,
                json=json_payload,
                headers=_headers(),
            )
            response.raise_for_status()
        logger.info("Matching service call succeeded method=%s url=%s", method, url)
        return response.json()
    except httpx.HTTPStatusError as exc:
        logger.error(
            "Matching service returned HTTP %s for method=%s url=%s body=%s",
            exc.response.status_code,
            method,
            url,
            exc.response.text,
        )
        try:
            upstream_body: Any = exc.response.json()
        except ValueError:
            upstream_body = exc.response.text
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "message": "Matching service returned an error",
                "upstream_status": exc.response.status_code,
                "upstream_body": upstream_body,
            },
        ) from exc
    except httpx.HTTPError as exc:
        logger.exception("Matching service request failed method=%s url=%s", method, url)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Matching service is unavailable",
        ) from exc


def health() -> dict[str, Any]:
    url = _base_url()
    health_url = f"{url}/health"

    try:
        with httpx.Client(timeout=min(_timeout_seconds(), 5.0)) as client:
            response = client.get(health_url)
            response.raise_for_status()
        return {
            "service": "matching",
            "url": url,
            "status": "UP",
            "detail": response.text,
        }
    except Exception as exc:
        logger.warning("Matching service health check failed for url=%s: %s", health_url, exc)
        return {
            "service": "matching",
            "url": url,
            "status": "DOWN",
            "detail": str(exc),
        }


def execute_run(run_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    return _request(
        "POST",
        f"/internal/matching/runs/{run_id}/execute",
        json_payload=payload,
    )
