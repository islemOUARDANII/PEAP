from __future__ import annotations

import logging

from app.db.session import get_session
from app.engines.legacy_matching.services.scoring_engine import score_one_cv_against_one_offer


logger = logging.getLogger(__name__)


def score_cv_to_many_offers(mapped_cv: dict, mapped_offers: list[dict]) -> list[dict]:
    results: list[dict] = []
    with get_session() as session:
        for mapped_offer in mapped_offers:
            try:
                with session.begin_nested():
                    results.append(score_one_cv_against_one_offer(session, mapped_cv, mapped_offer))
            except Exception as exc:
                logger.exception("Erreur batch sur une offre")
                results.append(
                    {
                        "cv_id": mapped_cv.get("cv_id"),
                        "offer_id": mapped_offer.get("offer_id"),
                        "segment_code": "UNKNOWN",
                        "model_code": "UNKNOWN",
                        "model_version_id": "UNKNOWN",
                        "final_score": 0.0,
                        "rule_score": 0.0,
                        "semantic_score": 0.0,
                        "decision": "error",
                        "hard_filter_passed": False,
                        "rejection_reason": str(exc),
                        "sub_scores": {},
                        "weights_used": {},
                        "hard_filters_result": {},
                        "bonus_result": {"total_bonus": 0.0, "rules_applied": []},
                        "explanation": {"error": str(exc)},
                    }
                )
        session.commit()
    return sorted(results, key=lambda item: float(item.get("final_score") or 0.0), reverse=True)
