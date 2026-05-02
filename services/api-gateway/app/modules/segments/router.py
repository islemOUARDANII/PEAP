from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.audit.service import log_business_event
from app.modules.auth.dependencies import require_roles
from app.modules.auth.schemas import CurrentUserResponse

from .schemas import (
    SegmentCreateRequest,
    SegmentListItemResponse,
    SegmentResponse,
    SegmentRuleCreateRequest,
    SegmentRuleResponse,
    SegmentRuleUpdateRequest,
    SegmentUpdateRequest,
)
from .service import (
    create_segment,
    create_segment_rule,
    deactivate_segment,
    delete_segment_rule,
    get_segment,
    list_segment_rules,
    list_segments,
    update_segment,
    update_segment_rule,
)

READ_ROLES = ("ANETI_ADVISOR", "FUNCTIONAL_ADMIN", "TECH_ADMIN")
WRITE_ROLES = ("FUNCTIONAL_ADMIN", "TECH_ADMIN")

router = APIRouter(prefix="/segments", tags=["Segments"])


@router.get("", response_model=list[SegmentListItemResponse])
def list_segments_endpoint(
    active: bool | None = Query(default=None),
    macro_segment: str | None = Query(default=None),
    q: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*READ_ROLES)),
):
    return list_segments(
        db,
        active=active,
        macro_segment=macro_segment,
        q=q,
    )


@router.get("/{segment_id}", response_model=SegmentResponse)
def get_segment_endpoint(
    segment_id: UUID,
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*READ_ROLES)),
):
    return get_segment(db, str(segment_id))


@router.post(
    "",
    response_model=SegmentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_segment_endpoint(
    payload: SegmentCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles(*WRITE_ROLES)),
):
    segment = create_segment(db, payload)
    log_business_event(
        db,
        request=request,
        current_user=current_user,
        event_type="SEGMENT_CREATED",
        action="CREATE",
        status="SUCCESS",
        entity_type="SEGMENT",
        entity_id=segment["id"],
        message="Functional configuration segment created",
        metadata={
            "code": segment["code"],
            "label": segment["label"],
            "active": segment["active"],
        },
    )
    return segment


@router.put("/{segment_id}", response_model=SegmentResponse)
def update_segment_endpoint(
    segment_id: UUID,
    payload: SegmentUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles(*WRITE_ROLES)),
):
    segment = update_segment(db, str(segment_id), payload)
    log_business_event(
        db,
        request=request,
        current_user=current_user,
        event_type="SEGMENT_UPDATED",
        action="UPDATE",
        status="SUCCESS",
        entity_type="SEGMENT",
        entity_id=segment["id"],
        message="Functional configuration segment updated",
        metadata={
            "code": segment["code"],
            "label": segment["label"],
            "active": segment["active"],
        },
    )
    return segment


@router.delete("/{segment_id}", response_model=SegmentResponse)
def deactivate_segment_endpoint(
    segment_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles(*WRITE_ROLES)),
):
    segment = deactivate_segment(db, str(segment_id))
    log_business_event(
        db,
        request=request,
        current_user=current_user,
        event_type="SEGMENT_DEACTIVATED",
        action="DEACTIVATE",
        status="SUCCESS",
        entity_type="SEGMENT",
        entity_id=segment["id"],
        message="Functional configuration segment deactivated",
        metadata={
            "code": segment["code"],
            "label": segment["label"],
            "active": segment["active"],
        },
    )
    return segment


@router.get("/{segment_id}/rules", response_model=list[SegmentRuleResponse])
def list_segment_rules_endpoint(
    segment_id: UUID,
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*READ_ROLES)),
):
    return list_segment_rules(db, str(segment_id))


@router.post(
    "/{segment_id}/rules",
    response_model=SegmentRuleResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_segment_rule_endpoint(
    segment_id: UUID,
    payload: SegmentRuleCreateRequest,
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*WRITE_ROLES)),
):
    return create_segment_rule(db, str(segment_id), payload)


@router.put("/{segment_id}/rules/{rule_id}", response_model=SegmentRuleResponse)
def update_segment_rule_endpoint(
    segment_id: UUID,
    rule_id: UUID,
    payload: SegmentRuleUpdateRequest,
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*WRITE_ROLES)),
):
    return update_segment_rule(
        db,
        str(segment_id),
        str(rule_id),
        payload,
    )


@router.delete(
    "/{segment_id}/rules/{rule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_segment_rule_endpoint(
    segment_id: UUID,
    rule_id: UUID,
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*WRITE_ROLES)),
):
    delete_segment_rule(db, str(segment_id), str(rule_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
