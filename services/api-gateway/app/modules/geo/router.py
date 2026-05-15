from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import require_roles

from . import repository
from .schemas import GeoAdminUnitResponse, GeoCountryResponse

ALL_ROLES = ("JOB_SEEKER", "EMPLOYER", "ANETI_ADVISOR", "FUNCTIONAL_ADMIN", "TECH_ADMIN")

router = APIRouter(prefix="/geo", tags=["Geo"])


@router.get("/countries", response_model=list[GeoCountryResponse])
def list_countries_endpoint(
    active_only: bool = Query(default=True),
    db: Session = Depends(get_db),
    _: object = Depends(require_roles(*ALL_ROLES)),
):
    return repository.list_countries(db, active_only=active_only)


@router.get("/admin-units", response_model=list[GeoAdminUnitResponse])
def list_admin_units_endpoint(
    country_id: str | None = Query(default=None),
    country_iso2: str | None = Query(default=None),
    admin_level: int | None = Query(default=None),
    parent_id: str | None = Query(default=None),
    q: str | None = Query(default=None),
    active_only: bool = Query(default=True),
    limit: int = Query(default=500, ge=1, le=2000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: object = Depends(require_roles(*ALL_ROLES)),
):
    return repository.list_admin_units(
        db,
        country_id=country_id,
        country_iso2=country_iso2,
        admin_level=admin_level,
        parent_id=parent_id,
        q=q,
        active_only=active_only,
        limit=limit,
        offset=offset,
    )
