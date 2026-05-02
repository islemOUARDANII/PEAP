from __future__ import annotations

from collections import Counter
from uuid import UUID

from app.config import settings
from app.repositories.matching_result_repository import get_eligible_results_for_run
from app.repositories.notification_log_repository import (
    already_notified,
    create_notification_log,
)
from app.schemas import NotificationItem, NotifyMatchingRunResponse
from app.services.email_sender import send_email
from app.services.email_templates import (
    build_match_email_html,
    build_match_email_subject,
    build_match_email_text,
)


def _candidate_name(row: dict) -> str:
    first_name = row.get("first_name") or ""
    last_name = row.get("last_name") or ""
    full_name = f"{first_name} {last_name}".strip()
    return full_name or "Candidat"


def _company_name(row: dict) -> str:
    return (
        row.get("company_commercial_name")
        or row.get("company_name")
        or "Entreprise"
    )


def _extract_common_skills(row: dict) -> list[str]:
    explanation = row.get("explanation_json") or {}

    if not isinstance(explanation, dict):
        return []

    for key in ["common_skills", "matched_skills", "skills"]:
        value = explanation.get(key)
        if isinstance(value, list):
            return [str(item) for item in value]

    return []


def notify_matching_run(
    *,
    run_id: UUID,
    threshold: float | None = None,
    top_limit: int | None = None,
    force: bool = False,
) -> NotifyMatchingRunResponse:
    final_threshold = (
        threshold
        if threshold is not None
        else settings.match_notification_threshold
    )

    final_top_limit = (
        top_limit
        if top_limit is not None
        else settings.match_notification_top_limit
    )

    rows = get_eligible_results_for_run(
        run_id=run_id,
        threshold=final_threshold,
        top_limit=final_top_limit,
    )

    counter: Counter[str] = Counter()
    details: list[NotificationItem] = []

    for row in rows:
        result_id = row.get("result_id")
        candidate_id = row.get("candidate_id")
        offer_id = row.get("offer_id")
        recipient_email = row.get("candidate_email")

        candidate_name = _candidate_name(row)
        company_name = _company_name(row)
        offer_title = row.get("offer_title") or "Offre"
        score = float(row.get("score_global") or 0)
        common_skills = _extract_common_skills(row)

        if not recipient_email:
            status = "SKIPPED_NO_EMAIL"

            create_notification_log(
                run_id=run_id,
                result_id=result_id,
                offer_id=offer_id,
                candidate_id=candidate_id,
                recipient_email=None,
                candidate_name=candidate_name,
                company_name=company_name,
                offer_title=offer_title,
                match_score=score,
                common_skills=common_skills,
                email_subject="",
                email_status=status,
                error_message="Candidate has no email",
            )

            counter[status] += 1

            details.append(
                NotificationItem(
                    result_id=result_id,
                    candidate_id=candidate_id,
                    offer_id=offer_id,
                    recipient_email=None,
                    candidate_name=candidate_name,
                    offer_title=offer_title,
                    company_name=company_name,
                    match_score=score,
                    email_status=status,
                    error_message="Candidate has no email",
                )
            )
            continue

        if not force and already_notified(
            result_id=result_id,
            recipient_email=recipient_email,
        ):
            status = "SKIPPED_ALREADY_SENT"

            create_notification_log(
                run_id=run_id,
                result_id=result_id,
                offer_id=offer_id,
                candidate_id=candidate_id,
                recipient_email=recipient_email,
                candidate_name=candidate_name,
                company_name=company_name,
                offer_title=offer_title,
                match_score=score,
                common_skills=common_skills,
                email_subject="",
                email_status=status,
                error_message="Already notified",
            )

            counter[status] += 1

            details.append(
                NotificationItem(
                    result_id=result_id,
                    candidate_id=candidate_id,
                    offer_id=offer_id,
                    recipient_email=recipient_email,
                    candidate_name=candidate_name,
                    offer_title=offer_title,
                    company_name=company_name,
                    match_score=score,
                    email_status=status,
                    error_message="Already notified",
                )
            )
            continue

        subject = build_match_email_subject(
            offer_title=offer_title,
            score=score,
        )

        html_body = build_match_email_html(
            candidate_name=candidate_name,
            offer_title=offer_title,
            company_name=company_name,
            score=score,
            offer_id=str(offer_id),
        )

        text_body = build_match_email_text(
            candidate_name=candidate_name,
            offer_title=offer_title,
            company_name=company_name,
            score=score,
            offer_id=str(offer_id),
        )

        status, error_message = send_email(
            to_email=recipient_email,
            subject=subject,
            html_body=html_body,
            text_body=text_body,
        )

        create_notification_log(
            run_id=run_id,
            result_id=result_id,
            offer_id=offer_id,
            candidate_id=candidate_id,
            recipient_email=recipient_email,
            candidate_name=candidate_name,
            company_name=company_name,
            offer_title=offer_title,
            match_score=score,
            common_skills=common_skills,
            email_subject=subject,
            email_status=status,
            error_message=error_message,
        )

        counter[status] += 1

        details.append(
            NotificationItem(
                result_id=result_id,
                candidate_id=candidate_id,
                offer_id=offer_id,
                recipient_email=recipient_email,
                candidate_name=candidate_name,
                offer_title=offer_title,
                company_name=company_name,
                match_score=score,
                email_status=status,
                error_message=error_message,
            )
        )

    return NotifyMatchingRunResponse(
        run_id=run_id,
        threshold=float(final_threshold),
        top_limit=int(final_top_limit),
        total_candidates=len(rows),
        eligible_count=len(rows),
        notifications=dict(counter),
        details=details,
    )