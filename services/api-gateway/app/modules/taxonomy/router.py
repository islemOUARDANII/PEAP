from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import require_roles

from . import repository
from .schemas import (
    CrosswalkRejectRequest,
    CrosswalkValidateRequest,
    TaxonomyAliasResponse,
    TaxonomyCrosswalkListResponse,
    TaxonomyCrosswalkResponse,
    TaxonomyModelResponse,
    TaxonomyNodeListResponse,
    TaxonomyNodeResponse,
    TaxonomyRelationResponse,
    TaxonomySummaryResponse,
)

ALL_ROLES = ("JOB_SEEKER", "EMPLOYER", "ANETI_ADVISOR", "FUNCTIONAL_ADMIN", "TECH_ADMIN")
ADMIN_ROLES = ("FUNCTIONAL_ADMIN", "TECH_ADMIN")

router = APIRouter(prefix="/taxonomy", tags=["Taxonomy"])


def _ensure_table_exists(db: Session) -> None:
    if not repository.taxonomy_node_exists(db):
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="taxonomy_node table is not available yet",
        )


@router.get("/models", response_model=list[TaxonomyModelResponse])
def list_models_endpoint(
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*ALL_ROLES)),
):
    _ensure_table_exists(db)
    return repository.list_models(db)


@router.get("/summary", response_model=TaxonomySummaryResponse)
def get_summary_endpoint(
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*ALL_ROLES)),
):
    _ensure_table_exists(db)
    return repository.get_summary(db)


@router.get("/nodes", response_model=TaxonomyNodeListResponse)
def list_nodes_endpoint(
    model_code: str | None = Query(default=None),
    model_version: str | None = Query(default=None),
    node_type: str | None = Query(default=None),
    parent_id: str | None = Query(default=None),
    q: str | None = Query(default=None),
    active: bool | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=10000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*ALL_ROLES)),
):
    _ensure_table_exists(db)
    return repository.list_nodes(
        db,
        model_code=model_code,
        model_version=model_version,
        node_type=node_type,
        parent_id=parent_id,
        q=q,
        active=active,
        limit=limit,
        offset=offset,
    )


# Sub-routes must be registered before /{node_id} to avoid being shadowed.
@router.get("/nodes/{node_id}/children", response_model=list[TaxonomyNodeResponse])
def list_node_children_endpoint(
    node_id: UUID,
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*ALL_ROLES)),
):
    _ensure_table_exists(db)
    return repository.list_node_children(db, str(node_id))


@router.get("/nodes/{node_id}/aliases", response_model=list[TaxonomyAliasResponse])
def list_node_aliases_endpoint(
    node_id: UUID,
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*ALL_ROLES)),
):
    _ensure_table_exists(db)
    return repository.list_node_aliases(db, str(node_id))


@router.get("/nodes/{node_id}/relations", response_model=list[TaxonomyRelationResponse])
def list_node_relations_endpoint(
    node_id: UUID,
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*ALL_ROLES)),
):
    _ensure_table_exists(db)
    return repository.list_node_relations(db, str(node_id))


@router.get("/nodes/{node_id}", response_model=TaxonomyNodeResponse)
def get_node_endpoint(
    node_id: UUID,
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*ALL_ROLES)),
):
    _ensure_table_exists(db)
    node = repository.get_node_by_id(db, str(node_id))
    if not node:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Taxonomy node not found")
    return node


@router.get("/crosswalks/review", response_model=TaxonomyCrosswalkListResponse)
def list_crosswalks_review_endpoint(
    validated: bool | None = Query(default=None),
    active: bool | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=10000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*ALL_ROLES)),
):
    _ensure_table_exists(db)
    return repository.list_crosswalks_review(
        db,
        validated=validated,
        active=active,
        limit=limit,
        offset=offset,
    )


@router.patch("/crosswalks/{crosswalk_id}/validate", response_model=TaxonomyCrosswalkResponse)
def validate_crosswalk_endpoint(
    crosswalk_id: UUID,
    body: CrosswalkValidateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(*ADMIN_ROLES)),
):
    _ensure_table_exists(db)
    result = repository.validate_crosswalk(
        db,
        crosswalk_id=str(crosswalk_id),
        validated_by=current_user.id,
        mapping_type=body.mapping_type,
        confidence=body.confidence,
        note=body.note,
    )
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Crosswalk not found")
    return result


@router.patch("/crosswalks/{crosswalk_id}/reject", response_model=TaxonomyCrosswalkResponse)
def reject_crosswalk_endpoint(
    crosswalk_id: UUID,
    body: CrosswalkRejectRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(*ADMIN_ROLES)),
):
    _ensure_table_exists(db)
    result = repository.reject_crosswalk(
        db,
        crosswalk_id=str(crosswalk_id),
        reason=body.reason,
    )
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Crosswalk not found")
    return result


@router.get("/references/handicap-types")
def get_handicap_types(
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*ALL_ROLES)),
):
    return repository.list_handicap_types(db)


@router.get("/references/handicap-degrees")
def get_handicap_degrees(
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*ALL_ROLES)),
):
    return repository.list_handicap_degrees(db)
