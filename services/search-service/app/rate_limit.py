"""
Rate limiter en mémoire — fenêtre glissante par IP.
Adapté à un déploiement single-instance (MVP).
Pour multi-instance, remplacer par Redis + slowapi.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

from app.config import settings

_windows: defaultdict[str, deque] = defaultdict(deque)
_lock = threading.Lock()


def rate_limit(request: Request) -> None:
    """Dependency FastAPI : lève 429 si l'IP dépasse la limite."""
    ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    window_start = now - settings.rate_limit_period

    with _lock:
        calls = _windows[ip]
        while calls and calls[0] < window_start:
            calls.popleft()
        if len(calls) >= settings.rate_limit_calls:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded: max {settings.rate_limit_calls} req/{settings.rate_limit_period}s",
            )
        calls.append(now)
