from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.audit.service import log_business_event
from app.modules.auth.dependencies import require_roles
from app.modules.auth.schemas import CurrentUserResponse

from .schemas import (
    MatchingCriterionCreateRequest,
    MatchingCriterionResponse,
    MatchingCriterionUpdateRequest,
    MatchingHardFilterCreateRequest,
    MatchingHardFilterResponse,
    MatchingHardFilterUpdateRequest,
    MatchingModelCreateRequest,
    MatchingModelCriterionCreateRequest,
    MatchingModelCriterionResponse,
    MatchingModelCriterionUpdateRequest,
    MatchingModelResponse,
    MatchingModelUpdateRequest,
    MatchingModelVersionCreateRequest,
    MatchingModelVersionResponse,
    MatchingModelVersionUpdateRequest,
)
from .service import (
    archive_model_version,
    create_criterion,
    create_model,
    create_model_version,
    create_model_version_criterion,
    create_model_version_hard_filter,
    deactivate_criterion,
    deactivate_model,
    delete_model_version_criterion,
    delete_model_version_hard_filter,
    get_criterion,
    get_model,
    list_criteria,
    list_model_version_criteria,
    list_model_version_hard_filters,
    list_model_versions,
    list_models,
    publish_model_version,
    update_criterion,
    update_model,
    update_model_version,
    update_model_version_criterion,
    update_model_version_hard_filter,
)

READ_ROLES = ("ANETI_ADVISOR", "FUNCTIONAL_ADMIN", "TECH_ADMIN")
WRITE_ROLES = ("FUNCTIONAL_ADMIN", "TECH_ADMIN")

router = APIRouter(prefix="/matching", tags=["Matching Config"])


@router.get("/criteria", response_model=list[MatchingCriterionResponse])
def list_criteria_endpoint(
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*READ_ROLES)),
):
    return list_criteria(db)


@router.get("/criteria/{criterion_id}", response_model=MatchingCriterionResponse)
def get_criterion_endpoint(
    criterion_id: UUID,
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*READ_ROLES)),
):
    return get_criterion(db, str(criterion_id))


@router.post(
    "/criteria",
    response_model=MatchingCriterionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_criterion_endpoint(
    payload: MatchingCriterionCreateRequest,
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*WRITE_ROLES)),
):
    return create_criterion(db, payload)


@router.put("/criteria/{criterion_id}", response_model=MatchingCriterionResponse)
def update_criterion_endpoint(
    criterion_id: UUID,
    payload: MatchingCriterionUpdateRequest,
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*WRITE_ROLES)),
):
    return update_criterion(db, str(criterion_id), payload)


@router.delete("/criteria/{criterion_id}", response_model=MatchingCriterionResponse)
def deactivate_criterion_endpoint(
    criterion_id: UUID,
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*WRITE_ROLES)),
):
    return deactivate_criterion(db, str(criterion_id))


@router.get("/models", response_model=list[MatchingModelResponse])
def list_models_endpoint(
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*READ_ROLES)),
):
    return list_models(db)


@router.get("/models/{model_id}", response_model=MatchingModelResponse)
def get_model_endpoint(
    model_id: UUID,
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*READ_ROLES)),
):
    return get_model(db, str(model_id))


@router.post(
    "/models",
    response_model=MatchingModelResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_model_endpoint(
    payload: MatchingModelCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles(*WRITE_ROLES)),
):
    model = create_model(db, payload)
    log_business_event(
        db,
        request=request,
        current_user=current_user,
        event_type="MATCHING_MODEL_CREATED",
        action="CREATE",
        status="SUCCESS",
        entity_type="MATCHING_MODEL",
        entity_id=model["id"],
        message="Matching model created",
        metadata={
            "code": model["code"],
            "label": model["label"],
            "direction": model["direction"],
            "active": model["active"],
        },
    )
    return model


@router.put("/models/{model_id}", response_model=MatchingModelResponse)
def update_model_endpoint(
    model_id: UUID,
    payload: MatchingModelUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles(*WRITE_ROLES)),
):
    model = update_model(db, str(model_id), payload)
    log_business_event(
        db,
        request=request,
        current_user=current_user,
        event_type="MATCHING_MODEL_UPDATED",
        action="UPDATE",
        status="SUCCESS",
        entity_type="MATCHING_MODEL",
        entity_id=model["id"],
        message="Matching model updated",
        metadata={
            "code": model["code"],
            "label": model["label"],
            "direction": model["direction"],
            "active": model["active"],
        },
    )
    return model


@router.delete("/models/{model_id}", response_model=MatchingModelResponse)
def deactivate_model_endpoint(
    model_id: UUID,
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*WRITE_ROLES)),
):
    return deactivate_model(db, str(model_id))


@router.get("/models/{model_id}/versions", response_model=list[MatchingModelVersionResponse])
def list_model_versions_endpoint(
    model_id: UUID,
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*READ_ROLES)),
):
    return list_model_versions(db, str(model_id))


@router.post(
    "/models/{model_id}/versions",
    response_model=MatchingModelVersionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_model_version_endpoint(
    model_id: UUID,
    payload: MatchingModelVersionCreateRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles(*WRITE_ROLES)),
):
    return create_model_version(
        db,
        str(model_id),
        payload,
        created_by_user_id=current_user.id,
    )


@router.put(
    "/models/{model_id}/versions/{version_id}",
    response_model=MatchingModelVersionResponse,
)
def update_model_version_endpoint(
    model_id: UUID,
    version_id: UUID,
    payload: MatchingModelVersionUpdateRequest,
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*WRITE_ROLES)),
):
    return update_model_version(
        db,
        str(model_id),
        str(version_id),
        payload,
    )


@router.post(
    "/models/{model_id}/versions/{version_id}/publish",
    response_model=MatchingModelVersionResponse,
)
def publish_model_version_endpoint(
    model_id: UUID,
    version_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles(*WRITE_ROLES)),
):
    version = publish_model_version(db, str(model_id), str(version_id))
    log_business_event(
        db,
        request=request,
        current_user=current_user,
        event_type="MATCHING_MODEL_VERSION_PUBLISHED",
        action="PUBLISH",
        status="SUCCESS",
        entity_type="MATCHING_MODEL_VERSION",
        entity_id=version["id"],
        message="Matching model version published",
        metadata={
            "model_id": str(model_id),
            "version_number": version["version_number"],
            "status": version["status"],
            "criteria_count": len(version["criteria"]),
            "hard_filter_count": len(version["hard_filters"]),
        },
    )
    return version


@router.post(
    "/models/{model_id}/versions/{version_id}/archive",
    response_model=MatchingModelVersionResponse,
)
def archive_model_version_endpoint(
    model_id: UUID,
    version_id: UUID,
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*WRITE_ROLES)),
):
    return archive_model_version(db, str(model_id), str(version_id))


@router.get(
    "/model-versions/{version_id}/criteria",
    response_model=list[MatchingModelCriterionResponse],
)
def list_model_version_criteria_endpoint(
    version_id: UUID,
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*READ_ROLES)),
):
    return list_model_version_criteria(db, str(version_id))


@router.post(
    "/model-versions/{version_id}/criteria",
    response_model=MatchingModelCriterionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_model_version_criterion_endpoint(
    version_id: UUID,
    payload: MatchingModelCriterionCreateRequest,
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*WRITE_ROLES)),
):
    return create_model_version_criterion(db, str(version_id), payload)


@router.put(
    "/model-versions/{version_id}/criteria/{model_criterion_id}",
    response_model=MatchingModelCriterionResponse,
)
def update_model_version_criterion_endpoint(
    version_id: UUID,
    model_criterion_id: UUID,
    payload: MatchingModelCriterionUpdateRequest,
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*WRITE_ROLES)),
):
    return update_model_version_criterion(
        db,
        str(version_id),
        str(model_criterion_id),
        payload,
    )


@router.delete(
    "/model-versions/{version_id}/criteria/{model_criterion_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_model_version_criterion_endpoint(
    version_id: UUID,
    model_criterion_id: UUID,
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*WRITE_ROLES)),
):
    delete_model_version_criterion(db, str(version_id), str(model_criterion_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/model-versions/{version_id}/hard-filters",
    response_model=list[MatchingHardFilterResponse],
)
def list_model_version_hard_filters_endpoint(
    version_id: UUID,
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*READ_ROLES)),
):
    return list_model_version_hard_filters(db, str(version_id))


@router.post(
    "/model-versions/{version_id}/hard-filters",
    response_model=MatchingHardFilterResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_model_version_hard_filter_endpoint(
    version_id: UUID,
    payload: MatchingHardFilterCreateRequest,
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*WRITE_ROLES)),
):
    return create_model_version_hard_filter(db, str(version_id), payload)


@router.put(
    "/model-versions/{version_id}/hard-filters/{filter_id}",
    response_model=MatchingHardFilterResponse,
)
def update_model_version_hard_filter_endpoint(
    version_id: UUID,
    filter_id: UUID,
    payload: MatchingHardFilterUpdateRequest,
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*WRITE_ROLES)),
):
    return update_model_version_hard_filter(
        db,
        str(version_id),
        str(filter_id),
        payload,
    )


@router.delete(
    "/model-versions/{version_id}/hard-filters/{filter_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_model_version_hard_filter_endpoint(
    version_id: UUID,
    filter_id: UUID,
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*WRITE_ROLES)),
):
    delete_model_version_hard_filter(db, str(version_id), str(filter_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
