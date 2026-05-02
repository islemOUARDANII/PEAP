from __future__ import annotations

import uuid
from typing import Any


def clamp(value: Any, min_value: float = 0.0, max_value: float = 1.0) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        numeric = min_value
    return max(min_value, min(max_value, numeric))


def safe_divide(a: Any, b: Any, default: float = 0.0) -> float:
    try:
        denominator = float(b)
        if denominator == 0:
            return default
        return float(a) / denominator
    except (TypeError, ValueError, ZeroDivisionError):
        return default


def normalize_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, str):
        items = [item.strip() for item in value.split(",")]
    elif isinstance(value, (list, tuple, set)):
        items = list(value)
    else:
        items = [value]

    normalized: list[Any] = []
    seen: set[str] = set()
    for item in items:
        if item is None:
            continue
        if isinstance(item, str):
            cleaned = item.strip()
            if not cleaned:
                continue
            marker = cleaned.casefold()
            if marker in seen:
                continue
            seen.add(marker)
            normalized.append(cleaned)
        else:
            marker = str(item)
            if marker in seen:
                continue
            seen.add(marker)
            normalized.append(item)
    return normalized


def as_uuid_or_none(value: Any) -> str | None:
    if value in (None, ""):
        return None
    try:
        return str(uuid.UUID(str(value)))
    except (ValueError, TypeError, AttributeError):
        return None


def to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default
