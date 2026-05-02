from __future__ import annotations

from sqlalchemy.orm import Session

from app.engines.legacy_matching.schemas import SelectedSegment
from app.engines.legacy_matching.services.model_selector import select_model_for_segment


def select_matching_model(
    session: Session,
    segment: dict,
    mapped_cv: dict,
    mapped_offer: dict,
    direction: str = "CANDIDATE_TO_OFFER",
) -> dict:
    selected = select_model_for_segment(
        session,
        SelectedSegment(
            id=str(segment["id"]),
            code=str(segment["code"]),
            label=str(segment["label"]),
            priority=int(segment["priority"]),
        ),
        mapped_cv,
        mapped_offer,
        direction=direction,
    )
    return {
        "assignment_id": selected.assignment_id,
        "segment_id": selected.segment_id,
        "case_id": selected.case_id,
        "case_code": selected.case_code,
        "model_id": selected.model_id,
        "model_code": selected.model_code,
        "model_version_id": selected.model_version_id,
        "version_number": selected.version_number,
    }
