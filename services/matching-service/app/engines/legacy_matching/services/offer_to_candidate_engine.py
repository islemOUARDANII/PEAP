from __future__ import annotations

from sqlalchemy.orm import Session

from app.engines.scoring_adapter import compute_matching_score


OFFER_TO_CANDIDATE_DIRECTION = "OFFER_TO_CANDIDATE"


def ensure_offer_to_candidate_models_available(session: Session) -> None:
    # Compatibility function.
    # Model availability is now managed by the official matching configuration tables.
    return None


def score_one_offer_against_one_cv(
    session: Session,
    mapped_offer: dict,
    mapped_cv: dict,
    model_config: dict | None = None,
) -> dict:
    if model_config is None:
        raise RuntimeError(
            "model_config is required. The legacy offer_to_candidate service must not "
            "select models or load config by itself anymore."
        )

    return compute_matching_score(
        candidate_payload=mapped_cv,
        offer_payload=mapped_offer,
        model_config=model_config,
    )