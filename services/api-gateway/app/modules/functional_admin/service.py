from sqlalchemy.orm import Session

from app.modules.auth.schemas import CurrentUserResponse
from app.modules.employers.service import employer_counts, list_employers
from app.modules.job_seekers.service import candidate_counts, list_candidate_summaries
from app.modules.offers.service import list_offers_for_advisor, offer_counts

from . import repository
from .schemas import FunctionalAdminDashboardResponse


def get_functional_admin_me(current_user: CurrentUserResponse) -> dict:
    return current_user.model_dump(mode="json")


def get_functional_admin_dashboard(db: Session) -> dict:
    candidate_stats = candidate_counts(db)
    employer_stats = employer_counts(db)
    offer_stats = offer_counts(db)
    return FunctionalAdminDashboardResponse(
        candidates_count=candidate_stats["candidates_count"],
        active_candidates_count=candidate_stats["active_candidates_count"],
        employers_count=employer_stats["employers_count"],
        pending_offers_count=offer_stats["pending_offers_count"],
        published_offers_count=offer_stats["published_offers_count"],
        active_matching_models_count=repository.count_active_matching_models(db),
        active_segments_count=repository.count_active_segments(db),
    ).model_dump(mode="json")


def list_candidates(db: Session) -> list[dict]:
    return list_candidate_summaries(
        db,
        q=None,
        status_value=None,
        governorate_code=None,
        delegation_code=None,
        has_cv=None,
        limit=200,
        offset=0,
    )


def list_employers_for_functional_admin(db: Session) -> list[dict]:
    return list_employers(db)


def list_offers_for_functional_admin(db: Session) -> list[dict]:
    return list_offers_for_advisor(db)
