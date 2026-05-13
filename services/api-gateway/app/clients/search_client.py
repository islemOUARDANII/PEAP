import logging
import os

import httpx
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)


def _timeout_seconds() -> float:
    return float(os.getenv("SEARCH_SERVICE_TIMEOUT_SECONDS", "120"))


def _base_url() -> str:
    url = os.getenv("SEARCH_SERVICE_URL")
    if not url:
        raise RuntimeError("SEARCH_SERVICE_URL is not set")
    return url.rstrip("/")


def _headers() -> dict[str, str]:
    api_key = os.getenv("SEARCH_SERVICE_API_KEY") or os.getenv("INTERNAL_API_KEY")
    if api_key:
        return {"X-Api-Key": api_key}
    return {}


def _request(method: str, path: str, *, json_payload: dict | None = None) -> dict:
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
        logger.info("Search service call succeeded method=%s url=%s", method, url)
        return response.json()
    except httpx.HTTPStatusError as exc:
        logger.error(
            "Search service returned HTTP %s for method=%s url=%s body=%s",
            exc.response.status_code,
            method,
            url,
            exc.response.text,
        )
        try:
            detail = exc.response.json()
        except ValueError:
            detail = exc.response.text
        raise HTTPException(status_code=exc.response.status_code, detail=detail) from exc
    except httpx.HTTPError as exc:
        logger.exception("Search service request failed method=%s url=%s", method, url)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Search service is unavailable",
        ) from exc


def health() -> dict:
    url = os.getenv("SEARCH_SERVICE_URL")
    if not url:
        return {
            "service": "search",
            "url": None,
            "status": "NOT_CONFIGURED",
            "detail": "SEARCH_SERVICE_URL is not configured.",
        }

    health_url = f"{url.rstrip('/')}/health"
    try:
        with httpx.Client(timeout=min(_timeout_seconds(), 5.0)) as client:
            response = client.get(health_url)
            response.raise_for_status()
        return {
            "service": "search",
            "url": url,
            "status": "UP",
            "detail": response.text,
        }
    except Exception as exc:
        logger.warning("Search service health check failed for url=%s: %s", health_url, exc)
        return {
            "service": "search",
            "url": url,
            "status": "DOWN",
            "detail": str(exc),
        }


def search_offers(payload: dict) -> dict:
    return _request("POST", "/search/offers", json_payload=payload)


def search_candidates(payload: dict) -> dict:
    return _request("POST", "/search/candidates", json_payload=payload)


def get_offer_detail(offer_id: str) -> dict:
    return _request("GET", f"/offers/{offer_id}")


def trigger_sync() -> dict:
    return _request("POST", "/admin/sync")
