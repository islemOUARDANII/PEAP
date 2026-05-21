from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import require_roles
from app.modules.advisor_activity.schemas import AdvisorActivityResponse
from app.modules.advisor_activity.service import list_my_advisor_activities

router = APIRouter(tags=["Advisor Activity"])


@router.get(
    "/advisors/me/activities",
    response_model=list[AdvisorActivityResponse],
)
def list_my_advisor_activities_endpoint(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("ANETI_ADVISOR")),
):
    return list_my_advisor_activities(
        db,
        current_user,
        limit=limit,
        offset=offset,
    )