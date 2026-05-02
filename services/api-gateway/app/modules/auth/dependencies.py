from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.audit.service import log_event

from .schemas import CurrentUserResponse
from .security import decode_access_token
from .service import build_current_user_response, get_user_by_id

bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> CurrentUserResponse:
    token = credentials.credentials

    try:
        payload = decode_access_token(token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user_id = payload.get("sub")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    user = get_user_by_id(db, user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if user["status"] != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is not active",
        )

    return build_current_user_response(db, user)


def require_roles(*allowed_roles: str):
    def dependency(
        request: Request,
        db: Session = Depends(get_db),
        current_user: CurrentUserResponse = Depends(get_current_user),
    ) -> CurrentUserResponse:
        if not set(current_user.roles).intersection(set(allowed_roles)):
            log_event(
                db,
                request=request,
                current_user=current_user,
                event_category="SECURITY",
                event_type="ACCESS_DENIED",
                severity="WARNING",
                action="AUTHORIZE",
                status="DENIED",
                entity_type="AUTH_USER",
                entity_id=current_user.id,
                message="User attempted to access a forbidden resource",
                error_code=str(status.HTTP_403_FORBIDDEN),
                error_message="Insufficient permissions",
                metadata={
                    "allowed_roles": list(allowed_roles),
                    "user_roles": current_user.roles,
                },
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )

        return current_user

    return dependency
