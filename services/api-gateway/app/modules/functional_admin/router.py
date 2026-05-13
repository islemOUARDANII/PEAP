from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import require_roles
from app.modules.auth.schemas import CurrentUserResponse
from app.modules.employers.schemas import EmployerListItemResponse
from app.modules.job_seekers.schemas import CandidateListItemResponse
from app.modules.offers.schemas import JobOfferListItemResponse

from .schemas import FunctionalAdminDashboardResponse
from .service import (
    get_functional_admin_dashboard,
    get_functional_admin_me,
    list_candidates,
    list_employers_for_functional_admin,
    list_offers_for_functional_admin,
)

router = APIRouter(tags=["Functional Admin"])


@router.get("/functional-admin/me")
def functional_admin_me(
    current_user: CurrentUserResponse = Depends(require_roles("FUNCTIONAL_ADMIN", "TECH_ADMIN")),
):
    return get_functional_admin_me(current_user)


@router.get("/functional-admin/dashboard", response_model=FunctionalAdminDashboardResponse)
def functional_admin_dashboard(
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles("FUNCTIONAL_ADMIN", "TECH_ADMIN")),
):
    return get_functional_admin_dashboard(db)


@router.get("/functional-admin/candidates", response_model=list[CandidateListItemResponse])
def functional_admin_candidates(
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles("FUNCTIONAL_ADMIN", "TECH_ADMIN")),
):
    return list_candidates(db)


@router.get("/functional-admin/employers", response_model=list[EmployerListItemResponse])
def functional_admin_employers(
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles("FUNCTIONAL_ADMIN", "TECH_ADMIN")),
):
    return list_employers_for_functional_admin(db)


@router.get("/functional-admin/offers", response_model=list[JobOfferListItemResponse])
def functional_admin_offers(
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles("FUNCTIONAL_ADMIN", "TECH_ADMIN")),
):
    return list_offers_for_functional_admin(db)
