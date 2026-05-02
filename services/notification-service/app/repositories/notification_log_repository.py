from __future__ import annotations

import json
from uuid import UUID

from app.db import execute_returning_one, fetch_all, fetch_one


def already_notified(*, result_id: UUID, recipient_email: str) -> bool:
    row = fetch_one(
        """
        SELECT id
        FROM matching.match_notification_log
        WHERE result_id = %(result_id)s
          AND recipient_email = %(recipient_email)s
          AND email_status IN ('SENT', 'DRY_RUN')
        LIMIT 1
        """,
        {
            "result_id": str(result_id),
            "recipient_email": recipient_email,
        },
    )
    return row is not None


def create_notification_log(
    *,
    run_id,
    result_id,
    offer_id,
    candidate_id,
    recipient_email,
    candidate_name,
    company_name,
    offer_title,
    match_score,
    common_skills,
    email_subject,
    email_status,
    error_message,
) -> dict:
    return execute_returning_one(
        """
        INSERT INTO matching.match_notification_log (
            run_id,
            result_id,
            offer_id,
            candidate_id,
            recipient_email,
            candidate_name,
            company_name,
            offer_title,
            match_score,
            common_skills,
            email_subject,
            email_status,
            error_message,
            sent_at,
            created_at
        )
        VALUES (
            %(run_id)s,
            %(result_id)s,
            %(offer_id)s,
            %(candidate_id)s,
            %(recipient_email)s,
            %(candidate_name)s,
            %(company_name)s,
            %(offer_title)s,
            %(match_score)s,
            CAST(%(common_skills)s AS jsonb),
            %(email_subject)s,
            %(email_status)s,
            %(error_message)s,
            CASE
                WHEN %(email_status)s IN ('SENT', 'DRY_RUN') THEN now()
                ELSE NULL
            END,
            now()
        )
        RETURNING *
        """,
        {
            "run_id": str(run_id) if run_id else None,
            "result_id": str(result_id) if result_id else None,
            "offer_id": str(offer_id) if offer_id else None,
            "candidate_id": str(candidate_id) if candidate_id else None,
            "recipient_email": recipient_email,
            "candidate_name": candidate_name,
            "company_name": company_name,
            "offer_title": offer_title,
            "match_score": float(match_score or 0),
            "common_skills": json.dumps(common_skills or []),
            "email_subject": email_subject or "",
            "email_status": email_status,
            "error_message": error_message,
        },
    )


def list_logs_for_run(*, run_id: UUID, limit: int = 100) -> list[dict]:
    return fetch_all(
        """
        SELECT *
        FROM matching.match_notification_log
        WHERE run_id = %(run_id)s
        ORDER BY created_at DESC
        LIMIT %(limit)s
        """,
        {
            "run_id": str(run_id),
            "limit": limit,
        },
    )


def list_logs(*, limit: int = 100) -> list[dict]:
    return fetch_all(
        """
        SELECT *
        FROM matching.match_notification_log
        ORDER BY created_at DESC
        LIMIT %(limit)s
        """,
        {"limit": limit},
    )