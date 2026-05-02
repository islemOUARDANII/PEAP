from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import require_roles

from . import repository
from .schemas import TaxonomyNodeResponse

ALL_ROLES = ("JOB_SEEKER", "EMPLOYER", "ANETI_ADVISOR", "FUNCTIONAL_ADMIN", "TECH_ADMIN")

router = APIRouter(prefix="/taxonomy", tags=["Taxonomy"])


def _ensure_table_exists(db: Session) -> None:
    if not repository.taxonomy_node_exists(db):
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="taxonomy_node table is not available yet",
        )


@router.get("/nodes", response_model=list[TaxonomyNodeResponse])
def list_nodes_endpoint(
    type: str | None = Query(default=None),
    q: str | None = Query(default=None),
    active: bool | None = Query(default=None),
    source: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=10000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*ALL_ROLES)),
):
    _ensure_table_exists(db)
    return repository.list_nodes(
        db,
        node_type=type,
        q=q,
        active=active,
        source=source,
        limit=limit,
        offset=offset,
    )


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
