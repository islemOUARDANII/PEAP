from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.auth.schemas import CurrentUserResponse
from app.modules.job_seekers.schemas import CandidateStatusUpdateRequest
from app.modules.job_seekers.service import (
    get_profile_by_id,
    list_candidate_summaries,
    update_candidate_status,
)

from . import repository
from .schemas import AdvisorMeResponse


def _raise_not_found(entity_name: str) -> None:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{entity_name} not found")


def get_advisor_me(db: Session, current_user: CurrentUserResponse) -> dict:
    advisor = repository.get_advisor_profile_by_user_id(db, current_user.id)
    if not advisor:
        _raise_not_found("Advisor profile")

    agency = None
    if advisor["agency_id"]:
        agency = {
            "id": advisor["agency_id"],
            "code": advisor["agency_code"],
            "name": advisor["agency_name"],
            "address": advisor["agency_address"],
            "governorate": advisor["agency_governorate"],
            "delegation": advisor["agency_delegation"],
        }

    return AdvisorMeResponse(
        id=advisor["id"],
        user_id=advisor["user_id"],
        email=advisor["email"],
        roles=current_user.roles,
        full_name=advisor["full_name"],
        position=advisor["position"],
        active=advisor["active"],
        agency=agency,
    ).model_dump(mode="json")


def list_supervised_candidates(
    db: Session,
    *,
    q: str | None,
    status_value: str | None,
    governorate_code: str | None,
    delegation_code: str | None,
    has_cv: bool | None,
    limit: int,
    offset: int,
) -> list[dict]:
    return list_candidate_summaries(
        db,
        q=q,
        status_value=status_value,
        governorate_code=governorate_code,
        delegation_code=delegation_code,
        has_cv=has_cv,
        limit=limit,
        offset=offset,
    )


def get_supervised_candidate(db: Session, candidate_id: str) -> dict:
    return get_profile_by_id(db, candidate_id)


def change_candidate_status(db: Session, candidate_id: str, payload: CandidateStatusUpdateRequest) -> dict:
    return update_candidate_status(db, candidate_id, payload)
