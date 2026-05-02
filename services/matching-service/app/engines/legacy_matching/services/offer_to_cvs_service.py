from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.engines.legacy_matching.services.offer_to_candidate_engine import (
    ensure_offer_to_candidate_models_available,
    score_one_offer_against_one_cv,
)
from app.engines.legacy_matching.services.scoring_feature_extractor import extract_cv_id, extract_offer_id


logger = logging.getLogger(__name__)


def score_offer_to_cvs(
    session: Session,
    mapped_offer: dict,
    mapped_cvs: list[dict],
    top: int | None = None,
) -> list[dict]:
    ensure_offer_to_candidate_models_available(session)

    offer_id = extract_offer_id(mapped_offer)
    results: list[dict] = []
    for mapped_cv in mapped_cvs:
        try:
            with session.begin_nested():
                results.append(score_one_offer_against_one_cv(session, mapped_offer, mapped_cv))
        except Exception as exc:
            logger.exception("Erreur scoring Offre -> CV")
            results.append(
                {
                    "cv_id": extract_cv_id(mapped_cv),
                    "offer_id": offer_id,
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
                    "explanation": {
                        "error": str(exc),
                        "service": "offer_to_cvs",
                        "direction": "OFFER_TO_CANDIDATE",
                        "final_formula": "final_score = rule_score",
                        "no_semantic_score": True,
                    },
                    "direction": "OFFER_TO_CANDIDATE",
                    "service": "offer_to_cvs",
                }
            )

    results = sorted(results, key=lambda item: float(item.get("final_score") or 0.0), reverse=True)
    if top is not None:
        return results[:top]
    return results
