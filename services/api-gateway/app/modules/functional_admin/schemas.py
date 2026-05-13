from pydantic import BaseModel


class FunctionalAdminDashboardResponse(BaseModel):
    candidates_count: int
    active_candidates_count: int
    employers_count: int
    pending_offers_count: int
    published_offers_count: int
    active_matching_models_count: int
    active_segments_count: int
