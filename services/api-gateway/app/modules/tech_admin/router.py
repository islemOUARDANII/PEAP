from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.audit.router import router as audit_router
from app.modules.audit.service import log_event
from app.modules.auth.dependencies import require_roles
from app.modules.auth.schemas import CurrentUserResponse

from .schemas import (
    ServiceHealthResponse,
    TechAdminDashboardResponse,
    TechAdminRoleAssignRequest,
    TechAdminRoleResponse,
    TechAdminUserCreateRequest,
    TechAdminUserResponse,
    TechAdminUserStatusUpdateRequest,
    TechAdminUserUpdateRequest,
)
from .service import (
    assign_role,
    create_user,
    get_service_health,
    get_tech_admin_dashboard,
    get_tech_admin_me,
    get_user,
    list_roles,
    list_users,
    remove_role,
    update_user,
    update_user_status,
)

router = APIRouter(tags=["Tech Admin"])


@router.get("/tech-admin/me")
def tech_admin_me(
    current_user: CurrentUserResponse = Depends(require_roles("TECH_ADMIN")),
):
    return get_tech_admin_me(current_user)


@router.get("/tech-admin/dashboard", response_model=TechAdminDashboardResponse)
def tech_admin_dashboard(
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles("TECH_ADMIN")),
):
    return get_tech_admin_dashboard(db)


@router.get("/tech-admin/health")
def tech_admin_health(
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles("TECH_ADMIN")),
):
    return {
        "api_gateway": "UP",
        "database": "UP" if get_tech_admin_dashboard(db)["database"] == "UP" else "DOWN",
    }


@router.get("/tech-admin/services", response_model=dict[str, ServiceHealthResponse])
def tech_admin_services(
    _current_user=Depends(require_roles("TECH_ADMIN")),
):
    return {
        "parsing": get_service_health("parsing"),
        "matching": get_service_health("matching"),
        "search": get_service_health("search"),
    }


@router.get("/tech-admin/services/parsing/health", response_model=ServiceHealthResponse)
def parsing_service_health(_current_user=Depends(require_roles("TECH_ADMIN"))):
    return get_service_health("parsing")


@router.get("/tech-admin/services/matching/health", response_model=ServiceHealthResponse)
def matching_service_health(_current_user=Depends(require_roles("TECH_ADMIN"))):
    return get_service_health("matching")


@router.get("/tech-admin/services/search/health", response_model=ServiceHealthResponse)
def search_service_health(_current_user=Depends(require_roles("TECH_ADMIN"))):
    return get_service_health("search")


@router.get("/tech-admin/users", response_model=list[TechAdminUserResponse])
def tech_admin_users(
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles("TECH_ADMIN")),
):
    return list_users(db)


@router.get("/tech-admin/users/{user_id}", response_model=TechAdminUserResponse)
def tech_admin_user_detail(
    user_id: UUID,
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles("TECH_ADMIN")),
):
    return get_user(db, str(user_id))


@router.post("/tech-admin/users", response_model=TechAdminUserResponse, status_code=201)
def tech_admin_create_user(
    payload: TechAdminUserCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("TECH_ADMIN")),
):
    user = create_user(db, payload)
    log_event(
        db,
        request=request,
        current_user=current_user,
        event_category="SECURITY",
        event_type="USER_CREATED",
        action="CREATE",
        status="SUCCESS",
        entity_type="AUTH_USER",
        entity_id=user["id"],
        message="Tech admin created a user",
        metadata={
            "email": user["email"],
            "status": user["status"],
            "roles": [role["code"] for role in user["roles"]],
        },
    )
    return user


@router.put("/tech-admin/users/{user_id}", response_model=TechAdminUserResponse)
def tech_admin_update_user(
    user_id: UUID,
    payload: TechAdminUserUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("TECH_ADMIN")),
):
    user = update_user(db, str(user_id), payload)
    log_event(
        db,
        request=request,
        current_user=current_user,
        event_category="SECURITY",
        event_type="USER_UPDATED",
        action="UPDATE",
        status="SUCCESS",
        entity_type="AUTH_USER",
        entity_id=user["id"],
        message="Tech admin updated a user",
        metadata={
            "email": user["email"],
            "status": user["status"],
            "roles": [role["code"] for role in user["roles"]],
        },
    )
    return user


@router.put("/tech-admin/users/{user_id}/status", response_model=TechAdminUserResponse)
def tech_admin_update_user_status(
    user_id: UUID,
    payload: TechAdminUserStatusUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("TECH_ADMIN")),
):
    user = update_user_status(db, str(user_id), payload)
    log_event(
        db,
        request=request,
        current_user=current_user,
        event_category="SECURITY",
        event_type="USER_STATUS_CHANGED",
        action="UPDATE_STATUS",
        status="SUCCESS",
        entity_type="AUTH_USER",
        entity_id=user["id"],
        message="Tech admin changed a user status",
        metadata={
            "email": user["email"],
            "status": user["status"],
        },
    )
    return user


@router.get("/tech-admin/roles", response_model=list[TechAdminRoleResponse])
def tech_admin_roles(
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles("TECH_ADMIN")),
):
    return list_roles(db)


@router.post("/tech-admin/users/{user_id}/roles", response_model=TechAdminUserResponse)
def tech_admin_assign_role(
    user_id: UUID,
    payload: TechAdminRoleAssignRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("TECH_ADMIN")),
):
    user = assign_role(db, str(user_id), str(payload.role_id))
    log_event(
        db,
        request=request,
        current_user=current_user,
        event_category="SECURITY",
        event_type="USER_ROLE_ADDED",
        action="ASSIGN_ROLE",
        status="SUCCESS",
        entity_type="AUTH_USER",
        entity_id=user["id"],
        message="Tech admin assigned a role to a user",
        metadata={
            "target_role_id": str(payload.role_id),
            "roles": [role["code"] for role in user["roles"]],
        },
    )
    return user


@router.delete("/tech-admin/users/{user_id}/roles/{role_id}", response_model=TechAdminUserResponse)
def tech_admin_remove_role(
    user_id: UUID,
    role_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("TECH_ADMIN")),
):
    user = remove_role(db, str(user_id), str(role_id))
    log_event(
        db,
        request=request,
        current_user=current_user,
        event_category="SECURITY",
        event_type="USER_ROLE_REMOVED",
        action="REMOVE_ROLE",
        status="SUCCESS",
        entity_type="AUTH_USER",
        entity_id=user["id"],
        message="Tech admin removed a role from a user",
        metadata={
            "removed_role_id": str(role_id),
            "roles": [role["code"] for role in user["roles"]],
        },
    )
    return user


router.include_router(audit_router)
