from __future__ import annotations

from sqlalchemy.orm import Session

from app.engines.legacy_matching.services.scoring_engine import (
    score_cv_against_offers as _score_cv_against_offers,
    score_one_cv_against_one_offer as _score_one_cv_against_one_offer,
)


def score_cv_against_offer(session: Session, mapped_cv: dict, mapped_offer: dict) -> dict:
    return _score_one_cv_against_one_offer(session, mapped_cv, mapped_offer)


def score_cv_against_offers(session: Session, mapped_cv: dict, mapped_offers: list[dict]) -> list[dict]:
    return _score_cv_against_offers(session, mapped_cv, mapped_offers)
