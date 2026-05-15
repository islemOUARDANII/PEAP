from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import require_roles

from . import repository
from .schemas import (
    RefDropdownItem,
    RefGroupCreateRequest,
    RefGroupListResponse,
    RefGroupResponse,
    RefGroupUpdateRequest,
    RefValueCreateRequest,
    RefValueListResponse,
    RefValueResponse,
    RefValueUpdateRequest,
)

ALL_ROLES   = ("JOB_SEEKER", "EMPLOYER", "ANETI_ADVISOR", "FUNCTIONAL_ADMIN", "TECH_ADMIN")
ADMIN_ROLES = ("FUNCTIONAL_ADMIN", "TECH_ADMIN")

# IMPORTANT: admin sub-routes are declared before the parameterised /{group_code}
# catch-all so FastAPI does not resolve "admin" as a group code.
router = APIRouter(prefix="/references", tags=["References"])


# ═══════════════════════════════════════════════════════════════════════════════
# Admin — ref_group
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/groups", response_model=RefGroupListResponse)
def admin_list_groups(
    q:      str  | None = Query(default=None),
    active: bool | None = Query(default=None),
    limit:  int         = Query(default=20, ge=1, le=500),
    offset: int         = Query(default=0,  ge=0),
    db: Session = Depends(get_db),
    _: object   = Depends(require_roles(*ADMIN_ROLES)),
):
    return repository.list_groups(db, q=q, active=active, limit=limit, offset=offset)


@router.post("/admin/groups", response_model=RefGroupResponse, status_code=status.HTTP_201_CREATED)
def admin_create_group(
    body: RefGroupCreateRequest,
    db:   Session = Depends(get_db),
    _:    object  = Depends(require_roles(*ADMIN_ROLES)),
):
    row = repository.create_group(
        db,
        code=body.code,
        label=body.label,
        description=body.description,
        domain=body.domain,
        active=body.active,
        metadata_json=body.metadata_json,
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Insert failed")
    return row


@router.patch("/admin/groups/{group_id}", response_model=RefGroupResponse)
def admin_update_group(
    group_id: UUID,
    body: RefGroupUpdateRequest,
    db:   Session = Depends(get_db),
    _:    object  = Depends(require_roles(*ADMIN_ROLES)),
):
    row = repository.update_group(
        db,
        str(group_id),
        label=body.label,
        description=body.description,
        domain=body.domain,
        active=body.active,
        metadata_json=body.metadata_json,
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reference group not found")
    return row


@router.delete("/admin/groups/{group_id}", response_model=RefGroupResponse)
def admin_delete_group(
    group_id: UUID,
    db: Session = Depends(get_db),
    _:  object  = Depends(require_roles(*ADMIN_ROLES)),
):
    row = repository.delete_group(db, str(group_id))
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reference group not found")
    return row


# ═══════════════════════════════════════════════════════════════════════════════
# Admin — ref_value
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/values", response_model=RefValueListResponse)
def admin_list_values(
    group_code: str  | None = Query(default=None),
    group_id:   str  | None = Query(default=None),
    q:          str  | None = Query(default=None),
    active:     bool | None = Query(default=None),
    limit:      int         = Query(default=20, ge=1, le=500),
    offset:     int         = Query(default=0,  ge=0),
    db: Session = Depends(get_db),
    _:  object  = Depends(require_roles(*ADMIN_ROLES)),
):
    return repository.list_values(
        db,
        group_code=group_code,
        group_id=group_id,
        q=q,
        active=active,
        limit=limit,
        offset=offset,
    )


@router.post("/admin/values", response_model=RefValueResponse, status_code=status.HTTP_201_CREATED)
def admin_create_value(
    body: RefValueCreateRequest,
    db:   Session = Depends(get_db),
    _:    object  = Depends(require_roles(*ADMIN_ROLES)),
):
    row = repository.create_value(
        db,
        group_id=body.group_id,
        code=body.code,
        label=body.label,
        label_fr=body.label_fr,
        label_en=body.label_en,
        label_ar=body.label_ar,
        sort_order=body.sort_order,
        active=body.active,
        valid_from=body.valid_from,
        valid_to=body.valid_to,
        source=body.source,
        external_code=body.external_code,
        metadata_json=body.metadata_json,
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Insert failed")
    return row


@router.patch("/admin/values/{value_id}", response_model=RefValueResponse)
def admin_update_value(
    value_id: UUID,
    body: RefValueUpdateRequest,
    db:   Session = Depends(get_db),
    _:    object  = Depends(require_roles(*ADMIN_ROLES)),
):
    row = repository.update_value(
        db,
        str(value_id),
        label=body.label,
        label_fr=body.label_fr,
        label_en=body.label_en,
        label_ar=body.label_ar,
        sort_order=body.sort_order,
        active=body.active,
        valid_from=body.valid_from,
        valid_to=body.valid_to,
        source=body.source,
        external_code=body.external_code,
        metadata_json=body.metadata_json,
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reference value not found")
    return row


@router.delete("/admin/values/{value_id}", response_model=RefValueResponse)
def admin_delete_value(
    value_id: UUID,
    db: Session = Depends(get_db),
    _:  object  = Depends(require_roles(*ADMIN_ROLES)),
):
    row = repository.delete_value(db, str(value_id))
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reference value not found")
    return row


# ═══════════════════════════════════════════════════════════════════════════════
# Public dropdown — must stay AFTER all /admin/... routes
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/{group_code}", response_model=list[RefDropdownItem])
def get_dropdown(
    group_code: str,
    db: Session = Depends(get_db),
    _:  object  = Depends(require_roles(*ALL_ROLES)),
):
    return repository.list_dropdown_values(db, group_code)
