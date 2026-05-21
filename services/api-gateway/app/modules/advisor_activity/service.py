from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.modules.advisor_activity.repository import (
    insert_advisor_activity,
    list_advisor_activities,
)

from app.modules.advisor_activity.schemas import AdvisorActivityResponse

def _get_user_id(current_user: Any) -> str | None:
    return (
        getattr(current_user, "id", None)
        or getattr(current_user, "user_id", None)
        or getattr(current_user, "sub", None)
    )


def _get_user_email(current_user: Any) -> str | None:
    return getattr(current_user, "email", None)


def _get_user_role(current_user: Any) -> str | None:
    role = getattr(current_user, "role", None)
    if role:
        return str(role)

    roles = getattr(current_user, "roles", None)
    if roles:
        return ",".join(str(item) for item in roles)

    return None


def is_advisor_user(current_user: Any) -> bool:
    role = (_get_user_role(current_user) or "").upper()
    return (
        "ADVISOR" in role
        or "FUNCTIONAL_ADMIN" in role
        or "TECH_ADMIN" in role
    )


def log_advisor_activity(
    db: Session,
    current_user: Any,
    *,
    activity_type: str,
    target_type: str,
    action_label: str,
    direction: str | None = None,
    query_text: str | None = None,
    filters_json: dict[str, Any] | None = None,
    model_id: str | None = None,
    model_version_id: str | None = None,
    model_code: str | None = None,
    model_label: str | None = None,
    source_entity_type: str | None = None,
    source_entity_id: str | None = None,
    run_id: str | None = None,
    result_count: int | None = None,
    duration_ms: int | None = None,
    status: str = "SUCCESS",
    error_message: str | None = None,
    metadata_json: dict[str, Any] | None = None,
) -> None:
    if not is_advisor_user(current_user):
        return

    insert_advisor_activity(
        db,
        actor_user_id=_get_user_id(current_user),
        actor_email=_get_user_email(current_user),
        actor_role=_get_user_role(current_user),
        activity_type=activity_type,
        target_type=target_type,
        direction=direction,
        action_label=action_label,
        query_text=query_text,
        filters_json=filters_json,
        model_id=model_id,
        model_version_id=model_version_id,
        model_code=model_code,
        model_label=model_label,
        source_entity_type=source_entity_type,
        source_entity_id=source_entity_id,
        run_id=run_id,
        result_count=result_count,
        duration_ms=duration_ms,
        status=status,
        error_message=error_message,
        metadata_json=metadata_json,
    )

def list_my_advisor_activities(
    db: Session,
    current_user: Any,
    *,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    actor_user_id = _get_user_id(current_user)

    rows = list_advisor_activities(
        db,
        actor_user_id=str(actor_user_id),
        limit=limit,
        offset=offset,
    )

    return [
        AdvisorActivityResponse(**row).model_dump(mode="json")
        for row in rows
    ]