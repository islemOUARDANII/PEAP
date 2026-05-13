from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.audit.service import log_auth_event

from .dependencies import get_current_user
from .schemas import CurrentUserResponse, LoginRequest, TokenResponse
from .security import create_access_token
from .service import authenticate_user, build_current_user_response

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    try:
        user = authenticate_user(db, payload.email, payload.password)
    except HTTPException as exc:
        log_auth_event(
            db,
            request=request,
            event_type="LOGIN_FAILED",
            severity="WARNING" if exc.status_code < 500 else "ERROR",
            actor_email=payload.email,
            action="LOGIN",
            status="FAILED",
            message="User login failed",
            error_code=str(exc.status_code),
            error_message=exc.detail,
            metadata={
                "attempted_email": payload.email,
                "reason": exc.detail,
            },
        )
        raise

    access_token, expires_in = create_access_token(
        user_id=user["id"],
        email=user["email"],
        roles=user["roles"],
    )

    current_user = build_current_user_response(db, user)

    log_auth_event(
        db,
        request=request,
        current_user=current_user,
        event_type="LOGIN_SUCCESS",
        action="LOGIN",
        status="SUCCESS",
        entity_type="AUTH_USER",
        entity_id=user["id"],
        message="User login succeeded",
        metadata={
            "roles": user["roles"],
        },
    )

    return TokenResponse(
        access_token=access_token,
        expires_in=expires_in,
        user=current_user,
    )


@router.get("/me", response_model=CurrentUserResponse)
def me(
    current_user: CurrentUserResponse = Depends(get_current_user),
):
    return current_user
