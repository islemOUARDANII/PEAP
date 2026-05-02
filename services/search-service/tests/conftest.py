"""
Fixtures partagées pour tous les tests du search-service.

Stratégie de mocking :
  - Elasticsearch  → mock complet (pas besoin d'instance réelle)
  - SentenceTransformer → mock retourne un vecteur fixe (évite de charger 80MB)
  - PostgreSQL      → mock psycopg2.connect (tests unitaires sync)
"""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

import numpy as np
import pytest
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Fixtures de base
# ---------------------------------------------------------------------------

FAKE_VECTOR = [0.1] * 384           # vecteur 384d normalisé factice
FAKE_API_KEY = "test-key"

FAKE_OFFER = {
    "_id": "offer-uuid-001",
    "offer_id": "offer-uuid-001",
    "company_id": "company-uuid-001",
    "status": "published",
    "title": "Senior Python Backend Engineer",
    "description": "Développement d'APIs REST avec FastAPI et PostgreSQL.",
    "skills": ["python", "fastapi", "postgresql"],
    "location": "Paris",
    "contract_type": "CDI",
    "created_at": "2024-01-15T10:00:00+00:00",
    "updated_at": "2024-01-15T10:00:00+00:00",
}

FAKE_CANDIDATE = {
    "_id": "candidate-uuid-001",
    "candidate_id": "candidate-uuid-001",
    "status": "active",
    "years_experience": 5,
    "education": "master",
    "skills": ["python", "django", "fastapi"],
    "location": "Paris",
    "primary_lang": "fr",
    "created_at": "2024-01-10T08:00:00+00:00",
    "updated_at": "2024-01-10T08:00:00+00:00",
}


def _make_es_hit(source: dict, score: float = 1.5) -> dict:
    """Formate un hit ES comme le vrai client le retourne."""
    return {
        "_id": source["_id"],
        "_score": score,
        "_source": {k: v for k, v in source.items() if k != "_id"},
    }


def _make_es_response(hits: list[dict], total: int | None = None) -> dict:
    max_score = max((h["_score"] for h in hits), default=None)
    return {
        "hits": {
            "total": {"value": total or len(hits), "relation": "eq"},
            "max_score": max_score,
            "hits": hits,
        }
    }


# ---------------------------------------------------------------------------
# Fixture client FastAPI avec mocks injectés
# ---------------------------------------------------------------------------

@pytest.fixture()
def mock_es_client():
    """Mock du client Elasticsearch."""
    client = MagicMock()
    client.indices.exists.return_value = True   # index déjà présent → pas de création
    return client


@pytest.fixture()
def app_client(mock_es_client):
    """
    TestClient FastAPI avec :
      - ES client mocké
      - SentenceTransformer mocké (retourne FAKE_VECTOR)
      - API key de test injectée
    """
    import os
    os.environ["API_KEY"] = FAKE_API_KEY
    os.environ["ES_URL"] = "http://localhost:9200"
    os.environ["POSTGRES_DSN"] = "postgresql://test:test@localhost/test"

    # Mock du modèle d'embedding
    fake_model = MagicMock()
    fake_model.encode.return_value = np.array(FAKE_VECTOR, dtype=np.float32)

    with (
        patch("app.es_client.get_client", return_value=mock_es_client),
        patch("app.embeddings._get_model", return_value=fake_model),
        patch("app.sync.indexer.incremental_sync"),       # pas de sync au démarrage
        patch("apscheduler.schedulers.background.BackgroundScheduler.start"),
        patch("apscheduler.schedulers.background.BackgroundScheduler.shutdown"),
        patch("apscheduler.schedulers.background.BackgroundScheduler.add_job"),
    ):
        from app.main import app
        with TestClient(app, raise_server_exceptions=True) as client:
            client.headers.update({"X-Api-Key": FAKE_API_KEY})
            yield client


@pytest.fixture()
def headers():
    return {"X-Api-Key": FAKE_API_KEY}
