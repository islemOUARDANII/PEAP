from __future__ import annotations

from sqlalchemy.orm import Session

from app.repositories.model_config_repository import load_model_config


def load_dynamic_scoring_config(session: Session, model_version_id: str):
    return load_model_config(session, model_version_id)