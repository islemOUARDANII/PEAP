from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.clients.matching_client import execute_run as execute_matching_service_run
from app.modules.auth.schemas import CurrentUserResponse
from app.modules.matching_config import repository as matching_config_repository

from . import repository
from .schemas import (
    MatchingDecisionStatus,
    MatchingExecutionResponse,
    MatchingResultDecisionRequest,
    MatchingResultDetailResponse,
    MatchingResultResponse,
    MatchingResultWithDetailsResponse,
    MatchingRunCreateRequest,
    MatchingRunDirection,
    MatchingRunExecuteRequest,
    MatchingRunResponse,
    MatchingSourceEntityType,
)

_DIRECTION_TO_INTERNAL = {
    MatchingRunDirection.OFFER_TO_CANDIDATES.value: "OFFER_TO_CANDIDATE",
    MatchingRunDirection.CANDIDATE_TO_OFFERS.value: "CANDIDATE_TO_OFFER",
    "OFFER_TO_CANDIDATE": "OFFER_TO_CANDIDATE",
    "CANDIDATE_TO_OFFER": "CANDIDATE_TO_OFFER",
}

_DIRECTION_TO_PUBLIC = {
    "OFFER_TO_CANDIDATE": MatchingRunDirection.OFFER_TO_CANDIDATES.value,
    "CANDIDATE_TO_OFFER": MatchingRunDirection.CANDIDATE_TO_OFFERS.value,
}

_SOURCE_TYPE_TO_INTERNAL = {
    MatchingSourceEntityType.OFFER.value: "JOB_OFFER",
    MatchingSourceEntityType.CANDIDATE.value: "JOB_SEEKER",
    "JOB_OFFER": "JOB_OFFER",
    "JOB_SEEKER": "JOB_SEEKER",
}

_SOURCE_TYPE_TO_PUBLIC = {
    "JOB_OFFER": MatchingSourceEntityType.OFFER.value,
    "JOB_SEEKER": MatchingSourceEntityType.CANDIDATE.value,
}

_DECISION_TO_INTERNAL = {
    MatchingDecisionStatus.PENDING.value: "TEMPORARY",
    MatchingDecisionStatus.RETAINED.value: "RETAINED",
    MatchingDecisionStatus.REJECTED.value: "REJECTED",
    MatchingDecisionStatus.EXPIRED.value: "EXPIRED",
    "TEMPORARY": "TEMPORARY",
    "RETAINED": "RETAINED",
    "REJECTED": "REJECTED",
    "EXPIRED": "EXPIRED",
}

_DECISION_TO_PUBLIC = {
    "TEMPORARY": MatchingDecisionStatus.PENDING.value,
    "RETAINED": MatchingDecisionStatus.RETAINED.value,
    "REJECTED": MatchingDecisionStatus.REJECTED.value,
    "EXPIRED": MatchingDecisionStatus.EXPIRED.value,
}

_ADMIN_OVERRIDE_ROLES = {"FUNCTIONAL_ADMIN", "TECH_ADMIN"}


def _raise_not_found(entity_name: str) -> None:
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"{entity_name} not found",
    )


def _raise_conflict(detail: str) -> None:
    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


def _handle_integrity_error(exc: IntegrityError) -> None:
    message = str(exc.orig) if exc.orig else str(exc)
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Database constraint violated: {message}",
    ) from exc


def _normalize_optional_string(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


def _serialize_run(run: dict) -> dict:
    return MatchingRunResponse(
        id=run["id"],
        run_type=run["run_type"],
        direction=_DIRECTION_TO_PUBLIC.get(run["direction"], run["direction"]),
        model_version_id=run["model_version_id"],
        launched_by_user_id=run.get("launched_by_user_id"),
        source_entity_type=_SOURCE_TYPE_TO_PUBLIC.get(run["source_entity_type"], run["source_entity_type"]),
        source_entity_id=str(run["source_entity_id"]),
        status=run["status"],
        parameters_json=run.get("parameters_json") or {},
        started_at=run["started_at"],
        finished_at=run.get("finished_at"),
        error_message=run.get("error_message"),
    ).model_dump(mode="json")


def _serialize_result(result: dict) -> dict:
    return MatchingResultResponse(
        id=result["id"],
        run_id=result["run_id"],
        candidate_id=result.get("candidate_id"),
        candidate_label=result.get("candidate_label"),
        offer_id=result.get("offer_id"),
        offer_title=result.get("offer_title"),
        occupation_id=result.get("occupation_id"),
        score_global=float(result["score_global"]),
        score_rule_based=float(result["score_rule_based"]) if result.get("score_rule_based") is not None else None,
        score_semantic=float(result["score_semantic"]) if result.get("score_semantic") is not None else None,
        rank=int(result["rank"]),
        eligibility_status=result["eligibility_status"],
        decision_status=_DECISION_TO_PUBLIC.get(result["decision_status"], result["decision_status"]),
        decision_reason=result.get("decision_reason"),
        decision_by_user_id=result.get("decision_by_user_id"),
        decision_at=result.get("decision_at"),
        explanation_short=result.get("explanation_short"),
        explanation_json=result.get("explanation_json") or {},
        has_gaps=bool(result.get("has_gaps")),
        created_at=result["created_at"],
    ).model_dump(mode="json")


def _serialize_result_detail(detail: dict) -> dict:
    return MatchingResultDetailResponse(
        id=detail["id"],
        result_id=detail["result_id"],
        criterion_code=detail.get("criterion_code"),
        criterion_label=detail.get("criterion_label"),
        score=float(detail["score"]) if detail.get("score") is not None else None,
        weight=float(detail["weight"]) if detail.get("weight") is not None else None,
        weighted_score=float(detail["weighted_score"]) if detail.get("weighted_score") is not None else None,
        matched=detail.get("matched"),
        is_gap=bool(detail.get("is_gap")),
        gap_type=detail.get("gap_type"),
        gap_message=detail.get("gap_message"),
        recommendation=detail.get("recommendation"),
        metadata_json=detail.get("metadata_json") or {},
        created_at=detail.get("created_at"),
    ).model_dump(mode="json")


def create_matching_run(
    db: Session,
    payload: MatchingRunCreateRequest,
    *,
    current_user: CurrentUserResponse,
) -> dict:
    model_version = matching_config_repository.get_model_version_by_id(db, str(payload.model_version_id))
    if not model_version:
        _raise_not_found("Matching model version")

    try:
        created = repository.create_matching_run(
            db,
            run_type=payload.run_type.value,
            direction=_DIRECTION_TO_INTERNAL[payload.direction.value],
            model_version_id=str(payload.model_version_id),
            launched_by_user_id=current_user.id,
            source_entity_type=_SOURCE_TYPE_TO_INTERNAL[payload.source_entity_type.value],
            source_entity_id=str(payload.source_entity_id),
            parameters_json=payload.parameters_json,
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    return _serialize_run(created)


def get_matching_run(db: Session, run_id: str) -> dict:
    run = repository.get_matching_run_by_id(db, run_id)
    if not run:
        _raise_not_found("Matching run")
    return _serialize_run(run)


def execute_matching_run(
    db: Session,
    run_id: str,
    payload: MatchingRunExecuteRequest,
    *,
    current_user: CurrentUserResponse,
) -> dict:
    run = repository.get_matching_run_by_id(db, run_id)
    if not run:
        _raise_not_found("Matching run")

    version = matching_config_repository.get_model_version_by_id(db, run["model_version_id"])
    if not version:
        _raise_not_found("Matching model version")

    if version["status"] != "ACTIVE":
        has_admin_override = payload.admin_override and bool(_ADMIN_OVERRIDE_ROLES.intersection(current_user.roles))
        if not has_admin_override:
            _raise_conflict("Only published model versions can be executed unless an admin override is enabled")

    response = execute_matching_service_run(
        run_id,
        {
            "run_id": run_id,
            "trace_id": payload.trace_id or f"gateway-matching-run-{run_id}",
            "dry_run": payload.dry_run,
            "admin_override": payload.admin_override,
        },
    )
    return MatchingExecutionResponse(**response).model_dump(mode="json")


def list_matching_results(db: Session, run_id: str) -> list[dict]:
    if not repository.get_matching_run_by_id(db, run_id):
        _raise_not_found("Matching run")

    return [_serialize_result(row) for row in repository.list_matching_results_by_run(db, run_id)]


def get_matching_result(db: Session, result_id: str) -> dict:
    result = repository.get_matching_result_by_id(db, result_id)
    if not result:
        _raise_not_found("Matching result")

    details = repository.list_matching_result_details(db, result_id)
    return MatchingResultWithDetailsResponse(
        result=MatchingResultResponse(**_serialize_result(result)),
        details=[MatchingResultDetailResponse(**_serialize_result_detail(detail)) for detail in details],
    ).model_dump(mode="json")


def update_matching_result_decision(
    db: Session,
    result_id: str,
    payload: MatchingResultDecisionRequest,
    *,
    current_user: CurrentUserResponse,
) -> dict:
    if not repository.get_matching_result_by_id(db, result_id):
        _raise_not_found("Matching result")

    internal_status = _DECISION_TO_INTERNAL[payload.decision_status.value]

    updated = repository.update_matching_result_decision(
        db,
        result_id=result_id,
        decision_status=internal_status,
        decision_reason=_normalize_optional_string(payload.decision_reason),
        decision_by_user_id=current_user.id,
    )
    if not updated:
        db.rollback()
        _raise_not_found("Matching result")

    db.commit()
    refreshed = repository.get_matching_result_by_id(db, result_id)
    if not refreshed:
        _raise_not_found("Matching result")

    return _serialize_result(refreshed)
