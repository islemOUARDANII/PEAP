from __future__ import annotations

import psycopg2
import psycopg2.extras

from app.config import settings


def get_connection():
    return psycopg2.connect(settings.database_url)


def fetch_all(query: str, params: dict | None = None) -> list[dict]:
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(query, params or {})
            rows = cur.fetchall()
            return [dict(row) for row in rows]
    finally:
        conn.close()


def fetch_one(query: str, params: dict | None = None) -> dict | None:
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(query, params or {})
            row = cur.fetchone()
            return dict(row) if row else None
    finally:
        conn.close()


def execute_returning_one(query: str, params: dict | None = None) -> dict | None:
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(query, params or {})
            row = cur.fetchone()
            conn.commit()
            return dict(row) if row else None
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()