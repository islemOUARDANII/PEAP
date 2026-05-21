from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modules.auth.schemas import CurrentUserResponse
from app.modules.job_seekers.schemas import CandidateStatusUpdateRequest
from app.modules.job_seekers.service import (
    get_profile_by_id,
    list_candidate_summaries,
    update_candidate_status,
)
from app.modules.tech_admin import repository as tech_admin_repository

from . import repository
from .schemas import (
    AdvisorCreateCandidateRequest,
    AdvisorCreateCandidateResponse,
    AdvisorCreateOfferRequest,
    AdvisorMeResponse,
    EmployerListItemResponse,
)


def _raise_not_found(entity_name: str) -> None:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{entity_name} not found")


def get_advisor_me(db: Session, current_user: CurrentUserResponse) -> dict:
    advisor = repository.get_advisor_profile_by_user_id(db, current_user.id)
    if not advisor:
        _raise_not_found("Advisor profile")

    agency = None
    if advisor["agency_id"]:
        agency = {
            "id": advisor["agency_id"],
            "code": advisor["agency_code"],
            "name": advisor["agency_name"],
            "address": advisor["agency_address"],
            "governorate": advisor["agency_governorate"],
            "delegation": advisor["agency_delegation"],
        }

    return AdvisorMeResponse(
        id=advisor["id"],
        user_id=advisor["user_id"],
        email=advisor["email"],
        roles=current_user.roles,
        full_name=advisor["full_name"],
        position=advisor["position"],
        active=advisor["active"],
        agency=agency,
    ).model_dump(mode="json")


def list_supervised_candidates(
    db: Session,
    *,
    q: str | None,
    status_value: str | None,
    governorate_code: str | None,
    delegation_code: str | None,
    has_cv: bool | None,
    limit: int,
    offset: int,
) -> list[dict]:
    return list_candidate_summaries(
        db,
        q=q,
        status_value=status_value,
        governorate_code=governorate_code,
        delegation_code=delegation_code,
        has_cv=has_cv,
        limit=limit,
        offset=offset,
    )


def get_supervised_candidate(db: Session, candidate_id: str) -> dict:
    return get_profile_by_id(db, candidate_id)


def change_candidate_status(db: Session, candidate_id: str, payload: CandidateStatusUpdateRequest) -> dict:
    return update_candidate_status(db, candidate_id, payload)


def create_candidate(db: Session, payload: AdvisorCreateCandidateRequest) -> dict:
    if tech_admin_repository.get_user_by_email(db, payload.email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Un utilisateur avec cet email existe déjà.")

    try:
        user = tech_admin_repository.create_user(db, {
            "email": payload.email,
            "password": payload.password,
            "phone": payload.phone,
            "status": "ACTIVE",
        })

        role_id = repository.get_role_id_by_code(db, "JOB_SEEKER")
        if not role_id:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Role JOB_SEEKER introuvable.")

        tech_admin_repository.assign_role(db, user["id"], role_id)

        candidate = repository.create_job_seeker(db, {
            "user_id": user["id"],
        })

        repository.upsert_candidate_identity(db, candidate["id"], {
            "first_name": payload.first_name,
            "last_name": payload.last_name,
        })

        if payload.governorate_code or payload.delegation_code:
            repository.upsert_candidate_contact(db, candidate["id"], {
                "governorate_code": payload.governorate_code,
                "delegation_code": payload.delegation_code,
            })

        db.commit()
    except IntegrityError as exc:
        db.rollback()
        message = str(exc.orig) if exc.orig else str(exc)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message) from exc

    return AdvisorCreateCandidateResponse(
        candidate_id=candidate["id"],
        user_id=user["id"],
        email=user["email"],
        temporary_password=payload.password,
        first_name=payload.first_name,
        last_name=payload.last_name,
    ).model_dump(mode="json")


def list_employers(db: Session) -> list[dict]:
    rows = repository.list_employers(db)
    return [EmployerListItemResponse(**row).model_dump(mode="json") for row in rows]


def create_offer(db: Session, payload: AdvisorCreateOfferRequest, current_user: CurrentUserResponse) -> dict:
    return repository.create_offer_for_advisor(db, {
        "employer_id": payload.employer_id,
        "title": payload.title,
        "description": payload.description,
        "company_name": payload.company_name,
        "contract_type": payload.contract_type,
        "work_mode": payload.work_mode,
        "governorate_code": payload.governorate_code,
        "delegation_code": payload.delegation_code,
        "number_of_positions": payload.number_of_positions,
        "salary_min": payload.salary_min,
        "salary_max": payload.salary_max,
        "deadline_at": payload.deadline_at,
        "country": "TN",
        "created_by_user_id": current_user.id,
    }, db)
