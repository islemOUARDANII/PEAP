"""
Pool de connexions PostgreSQL partagé entre les workers FastAPI.
Utilise ThreadedConnectionPool (thread-safe, adapté à uvicorn sync workers).
"""

from __future__ import annotations

import threading
from contextlib import contextmanager
from typing import Generator

import psycopg2
import psycopg2.extras
from psycopg2.pool import ThreadedConnectionPool

from app.config import settings

_pool: ThreadedConnectionPool | None = None
_lock = threading.Lock()


def _get_pool() -> ThreadedConnectionPool:
    global _pool
    if _pool is None:
        with _lock:
            if _pool is None:
                _pool = ThreadedConnectionPool(
                    minconn=settings.pg_pool_min,
                    maxconn=settings.pg_pool_max,
                    dsn=settings.postgres_dsn,
                )
    return _pool


@contextmanager
def get_conn() -> Generator[psycopg2.extensions.connection, None, None]:
    """Emprunte une connexion du pool et la restitue automatiquement."""
    conn = _get_pool().getconn()
    try:
        yield conn
    except Exception:
        conn.rollback()
        raise
    finally:
        _get_pool().putconn(conn)


def close_pool() -> None:
    """Ferme toutes les connexions du pool (appelé au shutdown)."""
    global _pool
    if _pool:
        _pool.closeall()
        _pool = None
