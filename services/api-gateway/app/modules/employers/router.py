from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import require_roles
from app.modules.auth.schemas import CurrentUserResponse

from .schemas import (
    EmployerContactUpsertRequest,
    EmployerLocationUpsertRequest,
    EmployerProfileResponse,
    EmployerUpdateRequest,
    EmployerApplicationResponse,
)
from .service import (
    get_my_profile,
    list_my_applications,
    update_my_profile,
    upsert_contact,
    upsert_location,
)

router = APIRouter(prefix="/employers", tags=["Employers"])


@router.get("/me", response_model=EmployerProfileResponse)
def get_my_profile_endpoint(
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("EMPLOYER", "FUNCTIONAL_ADMIN", "TECH_ADMIN")),
):
    return get_my_profile(db, current_user)


@router.put("/me", response_model=EmployerProfileResponse)
def update_my_profile_endpoint(
    payload: EmployerUpdateRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("EMPLOYER", "FUNCTIONAL_ADMIN", "TECH_ADMIN")),
):
    return update_my_profile(db, current_user, payload)


@router.put("/me/contact", response_model=EmployerProfileResponse)
def upsert_contact_endpoint(
    payload: EmployerContactUpsertRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("EMPLOYER", "FUNCTIONAL_ADMIN", "TECH_ADMIN")),
):
    return upsert_contact(db, current_user, payload)


@router.put("/me/location", response_model=EmployerProfileResponse)
def upsert_location_endpoint(
    payload: EmployerLocationUpsertRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("EMPLOYER", "FUNCTIONAL_ADMIN", "TECH_ADMIN")),
):
    return upsert_location(db, current_user, payload)

@router.get("/me/applications", response_model=list[EmployerApplicationResponse])
def list_my_applications_endpoint(
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("EMPLOYER")),
):
    return list_my_applications(db, current_user)