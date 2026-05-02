from uuid import UUID

from fastapi import APIRouter, Body, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import require_roles
from app.modules.auth.schemas import CurrentUserResponse

from .schemas import (
    MatchingExecutionResponse,
    MatchingResultDecisionRequest,
    MatchingResultResponse,
    MatchingResultWithDetailsResponse,
    MatchingRunCreateRequest,
    MatchingRunExecuteRequest,
    MatchingRunResponse,
)
from .service import (
    create_matching_run,
    execute_matching_run,
    get_matching_result,
    get_matching_run,
    list_matching_results,
    update_matching_result_decision,
)

READ_WRITE_ROLES = ("ANETI_ADVISOR", "FUNCTIONAL_ADMIN", "TECH_ADMIN")

router = APIRouter(prefix="/matching", tags=["Matching"])


@router.post("/runs", response_model=MatchingRunResponse, status_code=status.HTTP_201_CREATED)
def create_matching_run_endpoint(
    payload: MatchingRunCreateRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles(*READ_WRITE_ROLES)),
):
    return create_matching_run(db, payload, current_user=current_user)


@router.post("/runs/{run_id}/execute", response_model=MatchingExecutionResponse)
def execute_matching_run_endpoint(
    run_id: UUID,
    payload: MatchingRunExecuteRequest | None = Body(default=None),
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles(*READ_WRITE_ROLES)),
):
    return execute_matching_run(
        db,
        str(run_id),
        payload or MatchingRunExecuteRequest(),
        current_user=current_user,
    )


@router.get("/runs/{run_id}", response_model=MatchingRunResponse)
def get_matching_run_endpoint(
    run_id: UUID,
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*READ_WRITE_ROLES)),
):
    return get_matching_run(db, str(run_id))


@router.get("/runs/{run_id}/results", response_model=list[MatchingResultResponse])
def list_matching_results_endpoint(
    run_id: UUID,
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*READ_WRITE_ROLES)),
):
    return list_matching_results(db, str(run_id))


@router.get("/results/{result_id}", response_model=MatchingResultWithDetailsResponse)
def get_matching_result_endpoint(
    result_id: UUID,
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*READ_WRITE_ROLES)),
):
    return get_matching_result(db, str(result_id))


@router.put("/results/{result_id}/decision", response_model=MatchingResultResponse)
def update_matching_result_decision_endpoint(
    result_id: UUID,
    payload: MatchingResultDecisionRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles(*READ_WRITE_ROLES)),
):
    return update_matching_result_decision(db, str(result_id), payload, current_user=current_user)
