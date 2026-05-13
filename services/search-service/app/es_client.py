"""
Singleton Elasticsearch client + index bootstrap.

Mappings:
  offers     → title/description/skills (text+keyword) + embedding (dense_vector 384)
  candidates → years_experience/education/skills/location (filtres uniquement)
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

from elasticsearch import Elasticsearch, helpers

from app.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Index mappings
# ---------------------------------------------------------------------------

OFFERS_MAPPING: Dict[str, Any] = {
    "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 0,
        "analysis": {
            "filter": {
                "tech_synonyms": {
                    "type": "synonym",
                    "synonyms": [
                        "ingénieur, engineer, ingenieur",
                        "développeur, developer, developpeur",
                        "analyste, analyst",
                        "responsable, manager",
                        "chef, lead, head",
                        "stagiaire, intern, stage",
                        "comptable, accountant",
                        "infirmier, nurse",
                    ]
                }
            },
            "analyzer": {
                "text_fr_en": {
                    "type": "custom",
                    "tokenizer": "standard",
                    "filter": ["lowercase", "asciifolding", "tech_synonyms", "stop"],
                }
            }
        },
    },
    "mappings": {
        "properties": {
            # Identité
            "offer_id": {"type": "keyword"},
            "company_id": {"type": "keyword"},
            "status": {"type": "keyword"},
            # Champs texte (keyword search)
            "title": {
                "type": "text",
                "analyzer": "text_fr_en",
                "fields": {"keyword": {"type": "keyword", "ignore_above": 512}},
            },
            "description": {"type": "text", "analyzer": "text_fr_en"},
            "skills": {
                "type": "text",
                "analyzer": "text_fr_en",
                "fields": {"keyword": {"type": "keyword"}},
            },
            "location": {"type": "keyword"},
            "contract_type": {"type": "keyword"},
            # Embedding sémantique (384 dims → MiniLM-L6-v2)
            "embedding": {
                "type": "dense_vector",
                "dims": settings.embedding_dim,
                "index": True,
                "similarity": "cosine",
            },
            # Métadonnées
            "created_at": {"type": "date"},
            "updated_at": {"type": "date"},
            "governorate_code": {"type": "keyword"},
            "governorate": {"type": "keyword"},
            "delegation_code": {"type": "keyword"},
            "delegation": {"type": "keyword"},
            "country": {"type": "keyword"},
            "work_mode": {"type": "keyword"},
            "salary_min": {"type": "float"},
            "salary_max": {"type": "float"},
            "occupations": {
                "type": "text",
                "analyzer": "text_fr_en",
                "fields": {"keyword": {"type": "keyword"}},
            },
            "languages": {"type": "keyword"},
        }
    },
}

CANDIDATES_MAPPING: Dict[str, Any] = {
    "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 0,
        "analysis": {
            "analyzer": {
                "text_fr_en": {
                    "type": "custom",
                    "tokenizer": "standard",
                    "filter": ["lowercase", "asciifolding"],
                }
            }
        },
    },
    "mappings": {
        "properties": {
            "candidate_id": {"type": "keyword"},
            "status": {"type": "keyword"},
            # Filtres structurés
            "years_experience": {"type": "integer"},
            "education": {"type": "keyword"},     # niveau normalisé: "bachelor", "master"…
            "skills": {
                "type": "text",
                "analyzer": "text_fr_en",
                "fields": {"keyword": {"type": "keyword"}},
            },
            "location": {
                "type": "text",
                "analyzer": "text_fr_en",
                "fields": {"keyword": {"type": "keyword"}},
            },
            "primary_lang": {"type": "keyword"},
            # Métadonnées
            "created_at": {"type": "date"},
            "updated_at": {"type": "date"},
            "governorate_code": {"type": "keyword"},
            "governorate": {"type": "keyword"},
            "delegation_code": {"type": "keyword"},
            "delegation": {"type": "keyword"},
            "country": {"type": "keyword"},
            "languages": {"type": "keyword"},
        }
    },
}

# ---------------------------------------------------------------------------
# Client singleton
# ---------------------------------------------------------------------------

_client: Elasticsearch | None = None


def get_client() -> Elasticsearch:
    global _client
    if _client is None:
        kwargs: Dict[str, Any] = {"hosts": [settings.es_url]}
        if settings.es_api_key:
            kwargs["api_key"] = settings.es_api_key
        _client = Elasticsearch(**kwargs)
    return _client


# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------

def bootstrap_indices() -> None:
    """Crée les index si absents. Appelé au démarrage FastAPI."""
    client = get_client()
    for index, mapping in [
        (settings.es_index_offers, OFFERS_MAPPING),
        (settings.es_index_candidates, CANDIDATES_MAPPING),
    ]:
        if not client.indices.exists(index=index):
            client.indices.create(index=index, body=mapping)
            logger.info("Index créé : %s", index)
        else:
            logger.debug("Index déjà présent : %s", index)


# ---------------------------------------------------------------------------
# Bulk helpers
# ---------------------------------------------------------------------------

def bulk_index(index: str, docs: List[Dict[str, Any]]) -> tuple[int, list]:
    """
    Indexe une liste de dicts dans ES via bulk.
    Chaque doc doit avoir un champ _id (= offer_id / candidate_id).
    Retourne (nb_success, liste_erreurs).
    """
    actions = [
        {
            "_index": index,
            "_id": doc.pop("_id"),
            "_source": doc,
        }
        for doc in docs
    ]
    success, errors = helpers.bulk(get_client(), actions, raise_on_error=False, stats_only=False)
    if errors:
        logger.warning("Bulk errors (%d): %s", len(errors), errors[:3])
    return success, errors


def upsert_doc(index: str, doc_id: str, doc: Dict[str, Any]) -> None:
    """Upsert unitaire — utilisé par le hook applicatif."""
    get_client().index(index=index, id=doc_id, document=doc)
