import os

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.clients.kafka_client import kafka_status
from app.clients.matching_client import health as matching_health
from app.clients.parsing_client import health as parsing_health
from app.clients.search_client import health as search_health
from app.modules.auth.schemas import CurrentUserResponse

from . import repository
from .schemas import (
    ServiceHealthResponse,
    TechAdminDashboardResponse,
    TechAdminRoleResponse,
    TechAdminUserCreateRequest,
    TechAdminUserResponse,
    TechAdminUserStatusUpdateRequest,
    TechAdminUserUpdateRequest,
)


def _raise_not_found(entity_name: str) -> None:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{entity_name} not found")


def _handle_integrity_error(exc: IntegrityError) -> None:
    message = str(exc.orig) if exc.orig else str(exc)
    if "duplicate key value" in message.lower():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=message) from exc
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Database constraint violated: {message}",
    ) from exc


def get_tech_admin_me(current_user: CurrentUserResponse) -> dict:
    return current_user.model_dump(mode="json")


def get_tech_admin_dashboard(db: Session) -> dict:
    parsing = parsing_health()
    matching = matching_health()
    search = search_health()
    return TechAdminDashboardResponse(
        api_gateway="UP",
        database=repository.database_health(db),
        parsing_service=parsing["status"],
        matching_service=matching["status"],
        search_service=search["status"],
        storage_provider=os.getenv("CV_STORAGE_PROVIDER", "LOCAL"),
        kafka_status=kafka_status(),
    ).model_dump(mode="json")


def get_service_health(service_name: str) -> dict:
    mapping = {
        "parsing": parsing_health,
        "matching": matching_health,
        "search": search_health,
    }
    result = mapping[service_name]()
    return ServiceHealthResponse(**result).model_dump(mode="json")


def _build_user_response(db: Session, user: dict) -> dict:
    roles = repository.list_user_roles(db, user["id"])
    return TechAdminUserResponse(
        **user,
        roles=[TechAdminRoleResponse(**role) for role in roles],
    ).model_dump(mode="json")


def list_users(db: Session) -> list[dict]:
    return [_build_user_response(db, row) for row in repository.list_users(db)]


def get_user(db: Session, user_id: str) -> dict:
    user = repository.get_user_by_id(db, user_id)
    if not user:
        _raise_not_found("User")
    return _build_user_response(db, user)


def create_user(db: Session, payload: TechAdminUserCreateRequest) -> dict:
    if repository.get_user_by_email(db, payload.email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A user with this email already exists")

    try:
        user = repository.create_user(db, payload.model_dump())
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    return _build_user_response(db, user)


def update_user(db: Session, user_id: str, payload: TechAdminUserUpdateRequest) -> dict:
    existing = repository.get_user_by_id(db, user_id)
    if not existing:
        _raise_not_found("User")

    duplicate = repository.get_user_by_email(db, payload.email)
    if duplicate and duplicate["id"] != user_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A user with this email already exists")

    try:
        updated = repository.update_user(db, user_id, payload.model_dump())
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    if not updated:
        _raise_not_found("User")

    return _build_user_response(db, updated)


def update_user_status(db: Session, user_id: str, payload: TechAdminUserStatusUpdateRequest) -> dict:
    if not repository.get_user_by_id(db, user_id):
        _raise_not_found("User")

    try:
        updated = repository.update_user_status(db, user_id, payload.status)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    if not updated:
        _raise_not_found("User")

    return _build_user_response(db, updated)


def list_roles(db: Session) -> list[dict]:
    return [TechAdminRoleResponse(**role).model_dump(mode="json") for role in repository.list_roles(db)]


def assign_role(db: Session, user_id: str, role_id: str) -> dict:
    if not repository.get_user_by_id(db, user_id):
        _raise_not_found("User")

    roles = {role["id"] for role in repository.list_roles(db)}
    if role_id not in roles:
        _raise_not_found("Role")

    try:
        repository.assign_role(db, user_id, role_id)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    return get_user(db, user_id)


def remove_role(db: Session, user_id: str, role_id: str) -> dict:
    if not repository.get_user_by_id(db, user_id):
        _raise_not_found("User")

    deleted = repository.remove_role(db, user_id, role_id)
    if not deleted:
        db.rollback()
        _raise_not_found("User role")

    db.commit()
    return get_user(db, user_id)
