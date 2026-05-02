from typing import Any
from uuid import UUID

from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

from app.clients.search_client import (
    get_offer_detail,
    search_candidates,
    search_offers,
    trigger_sync,
)
from app.db.session import get_db
from app.modules.auth.dependencies import require_roles
from app.modules.search import repository

ALL_ROLES = ("JOB_SEEKER", "EMPLOYER", "ANETI_ADVISOR", "FUNCTIONAL_ADMIN", "TECH_ADMIN")
CANDIDATE_SEARCH_ROLES = ("EMPLOYER", "ANETI_ADVISOR", "FUNCTIONAL_ADMIN", "TECH_ADMIN")

router = APIRouter(tags=["Search"])


@router.post("/search/offers")
def search_offers_endpoint(
    payload: dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*ALL_ROLES)),
):
    response = search_offers(payload)
    results = response.get("results", [])
    metadata_by_offer_id = repository.list_offer_metadata(
        db,
        [str(item.get("offer_id")) for item in results if item.get("offer_id")],
    )

    for item in results:
        metadata = metadata_by_offer_id.get(str(item.get("offer_id")))
        if not metadata:
            continue
        item["status"] = metadata.get("status")
        item["work_mode"] = metadata.get("work_mode")

    return response


@router.post("/search/candidates")
def search_candidates_endpoint(
    payload: dict[str, Any] = Body(...),
    _current_user=Depends(require_roles(*CANDIDATE_SEARCH_ROLES)),
):
    return search_candidates(payload)


@router.get("/search/offers/{offer_id}")
def get_offer_detail_endpoint(
    offer_id: UUID,
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles(*ALL_ROLES)),
):
    response = get_offer_detail(str(offer_id))
    metadata = repository.get_offer_metadata(db, str(offer_id))
    if metadata:
        response["status"] = metadata.get("status", response.get("status"))
        response["work_mode"] = metadata.get("work_mode")
    return response


@router.post("/tech-admin/services/search/sync")
def trigger_search_sync_endpoint(
    _current_user=Depends(require_roles("TECH_ADMIN")),
):
    return trigger_sync()
