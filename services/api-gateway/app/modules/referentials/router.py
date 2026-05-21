from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import require_roles

from . import repository
from .schemas import (
    DelegationItemResponse,
    ReferentialItemResponse,
    ImadaItemResponse,
    PostalCodeItemResponse,
)

ALL_ROLES = ("JOB_SEEKER", "EMPLOYER", "ANETI_ADVISOR", "FUNCTIONAL_ADMIN", "TECH_ADMIN")

router = APIRouter(prefix="/referentials", tags=["Referentials"])


def _secured():
    return Depends(require_roles(*ALL_ROLES))


@router.get("/governorates", response_model=list[ReferentialItemResponse])
def governorates(db: Session = Depends(get_db), _current_user=_secured()):
    return repository.list_reference(db, "ref_n_gouvern", "code_gouvernorat", "libelle_gouvernorat")


@router.get("/delegations", response_model=list[DelegationItemResponse])
def delegations(
    governorate_code: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _current_user=_secured(),
):
    return repository.list_delegations(db, governorate_code)


@router.get("/contract-types", response_model=list[ReferentialItemResponse])
def contract_types(db: Session = Depends(get_db), _current_user=_secured()):
    return repository.list_reference(db, "ref_type_contrat", "code_contrat", "libelle_contrat")


@router.get("/permit-types", response_model=list[ReferentialItemResponse])
def permit_types(db: Session = Depends(get_db), _current_user=_secured()):
    return repository.list_reference(db, "ref_type_permis", "code_permis", "libelle_permis")


@router.get("/genders", response_model=list[ReferentialItemResponse])
def genders(db: Session = Depends(get_db), _current_user=_secured()):
    return repository.list_reference(db, "ref_genre", "code_genre", "libelle_genre")


@router.get("/education-levels", response_model=list[ReferentialItemResponse])
def education_levels(db: Session = Depends(get_db), _current_user=_secured()):
    return repository.list_reference(db, "ref_niveau_instruction", "code_niveau_instruction", "libelle_niveau_instruction")


@router.get("/diplomas", response_model=list[ReferentialItemResponse])
def diplomas(db: Session = Depends(get_db), _current_user=_secured()):
    return repository.list_reference(db, "ref_diplomes", "code_diplome", "libelle_diplome")


@router.get("/specialties", response_model=list[ReferentialItemResponse])
def specialties(db: Session = Depends(get_db), _current_user=_secured()):
    return repository.list_reference(db, "ref_specialites", "code_specialite", "libelle_specialite")


@router.get("/work-regimes", response_model=list[ReferentialItemResponse])
def work_regimes(db: Session = Depends(get_db), _current_user=_secured()):
    return repository.list_reference(db, "ref_regime_travail", "code", "libelle")


@router.get("/work-time-organizations", response_model=list[ReferentialItemResponse])
def work_time_organizations(db: Session = Depends(get_db), _current_user=_secured()):
    return repository.list_reference(db, "ref_organisation_temps_travail", "code", "libelle")


@router.get("/offer-types", response_model=list[ReferentialItemResponse])
def offer_types(db: Session = Depends(get_db), _current_user=_secured()):
    return repository.list_reference(db, "ref_type_offre", "code", "libelle")


@router.get("/offer-statuses", response_model=list[ReferentialItemResponse])
def offer_statuses(db: Session = Depends(get_db), _current_user=_secured()):
    return repository.list_reference(db, "ref_situation_offre", "code", "libelle")


@router.get("/handicap-types", response_model=list[ReferentialItemResponse])
def handicap_types(db: Session = Depends(get_db), _current_user=_secured()):
    return repository.list_reference(db, "ref_type_handicap", "code_handicap", "libelle_handicap")


@router.get("/handicap-degrees", response_model=list[ReferentialItemResponse])
def handicap_degrees(db: Session = Depends(get_db), _current_user=_secured()):
    return repository.list_reference(db, "ref_degre_handicap", "code_degre_handicap", "libelle_degre_handicap")


@router.get("/certifications", response_model=list[ReferentialItemResponse])
def certifications(db: Session = Depends(get_db), _current_user=_secured()):
    return repository.list_reference(db, "ref_certifications", "code_certification", "libelle_certification")


@router.get("/segmentations", response_model=list[ReferentialItemResponse])
def segmentations(db: Session = Depends(get_db), _current_user=_secured()):
    return repository.list_reference(db, "ref_segmentation", "code_segmentation", "libelle_segmentation")

@router.get("/languages", response_model=list[ReferentialItemResponse])
def languages(db: Session = Depends(get_db), _current_user=_secured()):
    return repository.list_languages(db)


@router.get("/language-levels", response_model=list[ReferentialItemResponse])
def language_levels(db: Session = Depends(get_db), _current_user=_secured()):
    return repository.list_language_levels(db)

@router.get("/imadas", response_model=list[ImadaItemResponse])
def imadas(
    delegation_code: str | None = Query(default=None),
    governorate_code: str | None = Query(default=None),
    q: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _current_user=_secured(),
):
    return repository.list_imadas(
        db,
        delegation_code=delegation_code,
        governorate_code=governorate_code,
        q=q,
    )


@router.get("/postal-codes", response_model=list[PostalCodeItemResponse])
def postal_codes(
    imada_code: str | None = Query(default=None),
    delegation_code: str | None = Query(default=None),
    governorate_code: str | None = Query(default=None),
    q: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _current_user=_secured(),
):
    return repository.list_postal_codes(
        db,
        imada_code=imada_code,
        delegation_code=delegation_code,
        governorate_code=governorate_code,
        q=q,
    )