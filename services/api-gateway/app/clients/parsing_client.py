from __future__ import annotations

import os
from typing import Any

import httpx


class ParsingServiceError(RuntimeError):
    pass


def _base_url() -> str:
    return os.getenv("PARSING_SERVICE_URL", "http://parsing-service:8001").rstrip("/")


def _headers() -> dict[str, str]:
    internal_api_key = os.getenv("INTERNAL_API_KEY")
    headers = {"Content-Type": "application/json"}

    if internal_api_key:
        headers["X-Internal-Api-Key"] = internal_api_key

    return headers


def _timeout() -> float:
    return float(os.getenv("PARSING_SERVICE_TIMEOUT_SECONDS", "180"))


def health() -> dict:
    url = _base_url()

    try:
        response = httpx.get(f"{url}/health", timeout=5.0)
        response.raise_for_status()
        return {
            "service": "parsing",
            "url": url,
            "status": "UP",
            "detail": response.json(),
        }
    except Exception as exc:
        return {
            "service": "parsing",
            "url": url,
            "status": "DOWN",
            "detail": str(exc),
        }


def parse_cv(payload: dict[str, Any]) -> dict[str, Any]:
    url = f"{_base_url()}/internal/parse/cv"

    try:
        response = httpx.post(
            url,
            json=payload,
            headers=_headers(),
            timeout=_timeout(),
        )
    except httpx.RequestError as exc:
        raise ParsingServiceError(f"Parsing service unavailable: {exc}") from exc

    if response.status_code >= 400:
        raise ParsingServiceError(
            f"Parsing service error {response.status_code}: {response.text}"
        )

    return response.json()


def parse_offer(payload: dict[str, Any]) -> dict[str, Any]:
    url = f"{_base_url()}/internal/parse/offer"

    try:
        response = httpx.post(
            url,
            json=payload,
            headers=_headers(),
            timeout=_timeout(),
        )
    except httpx.RequestError as exc:
        raise ParsingServiceError(f"Parsing service unavailable: {exc}") from exc

    if response.status_code >= 400:
        raise ParsingServiceError(
            f"Parsing service error {response.status_code}: {response.text}"
        )

    return response.json()