from uuid import UUID
from uuid import uuid4
from fastapi import HTTPException, status
from app.clients.parsing_client import ParsingServiceError, parse_offer
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.audit.service import log_business_event
from app.modules.auth.dependencies import require_roles
from app.modules.auth.schemas import CurrentUserResponse

from .schemas import (
    JobOfferCreateRequest,
    JobOfferDraftParseRequest,
    JobOfferDraftParseResponse,
    JobOfferListItemResponse,
    JobOfferResponse,
    JobOfferUpdateRequest,
    OfferActionRequest,
    JobOfferDraftParseRequest,
    JobOfferDraftParseResponse,
)
from .service import (
    archive_my_offer,
    create_my_offer,
    get_my_offer,
    get_offer_for_advisor,
    list_my_offers,
    list_offers_for_advisor,
    parse_offer_draft,
    reject_offer,
    submit_my_offer,
    update_my_offer,
    validate_offer,
)

router = APIRouter(tags=["Offers"])


@router.get("/employers/me/offers", response_model=list[JobOfferListItemResponse])
def list_my_offers_endpoint(
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("EMPLOYER")),
):
    return list_my_offers(db, current_user)


@router.post("/employers/me/offers", response_model=JobOfferResponse)
def create_my_offer_endpoint(
    payload: JobOfferCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("EMPLOYER")),
):
    offer = create_my_offer(db, current_user, payload)
    log_business_event(
        db,
        request=request,
        current_user=current_user,
        event_type="OFFER_CREATED",
        action="CREATE",
        status="SUCCESS",
        entity_type="JOB_OFFER",
        entity_id=offer["id"],
        message="Employer created a job offer",
        metadata={
            "title": offer["title"],
            "status": offer["status"],
            "number_of_positions": offer["number_of_positions"],
        },
    )
    return offer


@router.post("/employers/me/offers/parse", response_model=JobOfferDraftParseResponse)
def parse_my_offer_draft_endpoint(
    payload: JobOfferDraftParseRequest,
    current_user: CurrentUserResponse = Depends(require_roles("EMPLOYER")),
):
    try:
        result = parse_offer(
            {
                "offer_id": str(uuid4()),
                "title": payload.title or "Offre sans titre",
                "description": payload.raw_text,
                "trace_id": "manual-offer-draft-parse",
            }
        )
    except ParsingServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        )

    parsed_payload = result.get("parsed_payload", {})
    mapped_payload = result.get("mapped_payload", {})
    extracted_requirements = result.get("extracted_requirements", [])

    draft = {
        "title": parsed_payload.get("title") or payload.title or "",
        "description": payload.raw_text,
        "number_of_positions": parsed_payload.get("number_of_positions") or 1,
        "contract_type": parsed_payload.get("contract_type"),
        "work_mode": parsed_payload.get("work_mode"),
        "salary_min": parsed_payload.get("salary_min"),
        "salary_max": parsed_payload.get("salary_max"),
        "country": "TN",
        "governorate_code": mapped_payload.get("governorate_code"),
        "delegation_code": mapped_payload.get("delegation_code"),
        "requirements": extracted_requirements,
    }

    return {
        "parsing_status": result.get("parsing_status", "PARSED"),
        "parsed_payload": parsed_payload,
        "mapped_payload": mapped_payload,
        "extracted_requirements": extracted_requirements,
        "warnings": result.get("warnings", []),
        "parser_version": result.get("parser_version"),
        "draft": draft,
    }

@router.get("/employers/me/offers/{offer_id}", response_model=JobOfferResponse)
def get_my_offer_endpoint(
    offer_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("EMPLOYER")),
):
    return get_my_offer(db, current_user, str(offer_id))


@router.put("/employers/me/offers/{offer_id}", response_model=JobOfferResponse)
def update_my_offer_endpoint(
    offer_id: UUID,
    payload: JobOfferUpdateRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("EMPLOYER")),
):
    return update_my_offer(db, current_user, str(offer_id), payload)


@router.delete("/employers/me/offers/{offer_id}", response_model=JobOfferResponse)
def archive_my_offer_endpoint(
    offer_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("EMPLOYER")),
):
    return archive_my_offer(db, current_user, str(offer_id))


@router.post("/employers/me/offers/{offer_id}/submit", response_model=JobOfferResponse)
def submit_my_offer_endpoint(
    offer_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("EMPLOYER")),
):
    offer = submit_my_offer(db, current_user, str(offer_id))
    log_business_event(
        db,
        request=request,
        current_user=current_user,
        event_type="OFFER_SUBMITTED",
        action="SUBMIT",
        status="SUCCESS",
        entity_type="JOB_OFFER",
        entity_id=offer["id"],
        message="Employer submitted a job offer for review",
        metadata={
            "title": offer["title"],
            "status": offer["status"],
            "warning": offer.get("warning"),
        },
    )
    return offer


@router.post("/advisor/offers/parse", response_model=JobOfferDraftParseResponse)
def parse_offer_draft_for_advisor_endpoint(
    payload: JobOfferDraftParseRequest,
    _current_user=Depends(require_roles("ANETI_ADVISOR", "FUNCTIONAL_ADMIN")),
):
    try:
        result = parse_offer(
            {
                "offer_id": str(uuid4()),
                "title": payload.title or "Offre sans titre",
                "description": payload.raw_text,
                "trace_id": "advisor-offer-draft-parse",
            }
        )
    except ParsingServiceError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))

    parsed_payload = result.get("parsed_payload", {})
    mapped_payload = result.get("mapped_payload", {})
    extracted_requirements = result.get("extracted_requirements", [])

    draft = {
        "title": parsed_payload.get("title") or payload.title or "",
        "description": payload.raw_text,
        "number_of_positions": parsed_payload.get("number_of_positions") or 1,
        "contract_type": parsed_payload.get("contract_type"),
        "work_mode": parsed_payload.get("work_mode"),
        "salary_min": parsed_payload.get("salary_min"),
        "salary_max": parsed_payload.get("salary_max"),
        "country": "TN",
        "governorate_code": mapped_payload.get("governorate_code"),
        "delegation_code": mapped_payload.get("delegation_code"),
        "requirements": extracted_requirements,
    }

    return {
        "parsing_status": result.get("parsing_status", "PARSED"),
        "parsed_payload": parsed_payload,
        "mapped_payload": mapped_payload,
        "extracted_requirements": extracted_requirements,
        "warnings": result.get("warnings", []),
        "parser_version": result.get("parser_version"),
        "draft": draft,
    }


@router.get("/advisor/offers", response_model=list[JobOfferListItemResponse])
def list_offers_for_advisor_endpoint(
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles("ANETI_ADVISOR", "FUNCTIONAL_ADMIN", "TECH_ADMIN")),
):
    return list_offers_for_advisor(db)


@router.get("/advisor/offers/{offer_id}", response_model=JobOfferResponse)
def get_offer_for_advisor_endpoint(
    offer_id: UUID,
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles("ANETI_ADVISOR", "FUNCTIONAL_ADMIN", "TECH_ADMIN")),
):
    return get_offer_for_advisor(db, str(offer_id))


@router.post("/advisor/offers/{offer_id}/validate", response_model=JobOfferResponse)
def validate_offer_endpoint(
    offer_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("ANETI_ADVISOR", "FUNCTIONAL_ADMIN", "TECH_ADMIN")),
):
    offer = validate_offer(db, current_user, str(offer_id))
    log_business_event(
        db,
        request=request,
        current_user=current_user,
        event_type="OFFER_VALIDATED",
        action="VALIDATE",
        status="SUCCESS",
        entity_type="JOB_OFFER",
        entity_id=offer["id"],
        message="Advisor validated and published an offer",
        metadata={
            "title": offer["title"],
            "status": offer["status"],
        },
    )
    return offer


@router.post("/advisor/offers/{offer_id}/reject", response_model=JobOfferResponse)
def reject_offer_endpoint(
    offer_id: UUID,
    payload: OfferActionRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("ANETI_ADVISOR", "FUNCTIONAL_ADMIN", "TECH_ADMIN")),
):
    offer = reject_offer(db, current_user, str(offer_id), payload)
    log_business_event(
        db,
        request=request,
        current_user=current_user,
        event_type="OFFER_REJECTED",
        action="REJECT",
        status="SUCCESS",
        entity_type="JOB_OFFER",
        entity_id=offer["id"],
        message="Advisor rejected an offer",
        metadata={
            "title": offer["title"],
            "status": offer["status"],
            "reason": payload.reason,
            "warning": offer.get("warning"),
        },
    )
    return offer
