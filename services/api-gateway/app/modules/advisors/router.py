from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import require_roles
from app.modules.auth.schemas import CurrentUserResponse
from app.modules.job_seekers.schemas import (
    CandidateListItemResponse,
    CandidateStatusUpdateRequest,
    CandidateStatusUpdateResponse,
    JobSeekerProfileResponse,
)

from .schemas import AdvisorMeResponse
from .service import (
    change_candidate_status,
    get_advisor_me,
    get_supervised_candidate,
    list_supervised_candidates,
)

router = APIRouter(tags=["Advisors"])


@router.get("/advisors/me", response_model=AdvisorMeResponse)
def advisors_me(
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("ANETI_ADVISOR")),
):
    return get_advisor_me(db, current_user)


@router.get("/advisor/candidates", response_model=list[CandidateListItemResponse])
@router.get("/advisor/job-seekers", response_model=list[CandidateListItemResponse], include_in_schema=False)
def advisor_candidates(
    q: str | None = Query(default=None),
    status_value: str | None = Query(default=None, alias="status"),
    governorate_code: str | None = Query(default=None),
    delegation_code: str | None = Query(default=None),
    has_cv: bool | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles("ANETI_ADVISOR", "FUNCTIONAL_ADMIN", "TECH_ADMIN")),
):
    return list_supervised_candidates(
        db,
        q=q,
        status_value=status_value,
        governorate_code=governorate_code,
        delegation_code=delegation_code,
        has_cv=has_cv,
        limit=limit,
        offset=offset,
    )


@router.get("/advisor/candidates/{candidate_id}", response_model=JobSeekerProfileResponse)
@router.get("/advisor/job-seekers/{candidate_id}", response_model=JobSeekerProfileResponse, include_in_schema=False)
def advisor_candidate_detail(
    candidate_id: UUID,
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles("ANETI_ADVISOR", "FUNCTIONAL_ADMIN", "TECH_ADMIN")),
):
    return get_supervised_candidate(db, str(candidate_id))


@router.put("/advisor/candidates/{candidate_id}/status", response_model=CandidateStatusUpdateResponse)
@router.put("/advisor/job-seekers/{candidate_id}/status", response_model=CandidateStatusUpdateResponse, include_in_schema=False)
def advisor_candidate_status(
    candidate_id: UUID,
    payload: CandidateStatusUpdateRequest,
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles("ANETI_ADVISOR", "FUNCTIONAL_ADMIN", "TECH_ADMIN")),
):
    return change_candidate_status(db, str(candidate_id), payload)
