from __future__ import annotations

from sqlalchemy.orm import Session

from app.engines.legacy_matching.services.profile_selector import select_candidate_segment


def detect_candidate_profile(session: Session, mapped_cv: dict) -> dict:
    segment = select_candidate_segment(session, mapped_cv)
    return {
        "id": segment.id,
        "code": segment.code,
        "label": segment.label,
        "priority": segment.priority,
    }
