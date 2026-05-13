from __future__ import annotations

from app.engines.legacy_matching.services.feature_extractor import (
    extract_cv_features,
    extract_cv_id,
    extract_offer_features,
    extract_offer_id,
)


def extract_cv_scoring_features(mapped_cv: dict, scoring_params: dict | None = None) -> dict:
    return extract_cv_features(mapped_cv, scoring_params)


def extract_offer_scoring_features(mapped_offer: dict, scoring_params: dict | None = None) -> dict:
    return extract_offer_features(mapped_offer, scoring_params)


__all__ = [
    "extract_cv_id",
    "extract_offer_id",
    "extract_cv_scoring_features",
    "extract_offer_scoring_features",
]
