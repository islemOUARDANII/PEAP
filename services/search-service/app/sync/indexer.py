"""
Pipeline de sync PostgreSQL → Elasticsearch.

Deux modes :
  bulk_sync_offers / bulk_sync_candidates  → full initial sync (since=None)
  incremental_sync                         → appelé par le cron APScheduler

Checkpoint : timestamp de la dernière sync stocké dans ES (.sync_state index).
Survit aux redémarrages container (pas de fichier local).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from app.config import settings
from app.embeddings import build_offer_text, embed_batch
from app.es_client import bulk_index, get_client
from app.sync.pg_reader import fetch_candidates, fetch_offers

logger = logging.getLogger(__name__)

_SYNC_STATE_INDEX = ".sync_state"
_SYNC_STATE_DOC_ID = "checkpoint"


# ---------------------------------------------------------------------------
# Checkpoint helpers (stockés dans ES, pas dans un fichier local)
# ---------------------------------------------------------------------------

def _load_state() -> dict:
    client = get_client()
    try:
        resp = client.get(index=_SYNC_STATE_INDEX, id=_SYNC_STATE_DOC_ID)
        return resp["_source"]
    except Exception:
        return {}


def _save_state(state: dict) -> None:
    client = get_client()
    try:
        client.index(index=_SYNC_STATE_INDEX, id=_SYNC_STATE_DOC_ID, document=state)
    except Exception as exc:
        logger.warning("Impossible de sauvegarder le checkpoint ES: %s", exc)


def _get_last_sync(key: str) -> Optional[datetime]:
    state = _load_state()
    raw = state.get(key)
    if raw:
        return datetime.fromisoformat(raw)
    return None


def _set_last_sync(key: str) -> None:
    state = _load_state()
    state[key] = datetime.now(timezone.utc).isoformat()
    _save_state(state)


# ---------------------------------------------------------------------------
# OFFERS SYNC
# ---------------------------------------------------------------------------

def _enrich_offers_with_embeddings(docs: list[dict]) -> list[dict]:
    """Génère les embeddings en batch puis les attache aux docs."""
    texts = [
        build_offer_text(d["title"], d["description"], d["skills"], d.get("occupations"))
        for d in docs
    ]
    vectors = embed_batch(texts)
    for doc, vec in zip(docs, vectors):
        doc["embedding"] = vec
    return docs


def bulk_sync_offers(since: Optional[datetime] = None) -> int:
    """
    Sync toutes les offres (ou depuis `since`).
    Retourne le nombre total de docs indexés.
    """
    label = "full" if since is None else f"incremental since {since}"
    logger.info("Sync offers start [%s]", label)
    total = 0
    for batch in fetch_offers(since=since, batch_size=settings.sync_batch_size):
        enriched = _enrich_offers_with_embeddings(batch)
        ids = [d["_id"] for d in enriched]   # sauvegardé avant pop dans bulk_index
        # bulk_index pop "_id" du dict — on copie pour ne pas perdre les autres champs
        to_index = [{**d} for d in enriched]
        success, _ = bulk_index(settings.es_index_offers, to_index)
        total += success
        logger.info("  -> %d offers indexed (batch)", success)
    logger.info("Sync offers done: %d docs total", total)
    return total


# ---------------------------------------------------------------------------
# CANDIDATES SYNC
# ---------------------------------------------------------------------------

def bulk_sync_candidates(since: Optional[datetime] = None) -> int:
    """
    Sync tous les candidats (ou depuis `since`).
    Pas d'embeddings pour les candidats (filter-only au MVP).
    """
    label = "full" if since is None else f"incremental since {since}"
    logger.info("Sync candidates start [%s]", label)
    total = 0
    for batch in fetch_candidates(since=since, batch_size=settings.sync_batch_size):
        to_index = [{**d} for d in batch]
        success, _ = bulk_index(settings.es_index_candidates, to_index)
        total += success
        logger.info("  -> %d candidates indexed (batch)", success)
    logger.info("Sync candidates done: %d docs total", total)
    return total


# ---------------------------------------------------------------------------
# INCREMENTAL CRON (appelé par APScheduler)
# ---------------------------------------------------------------------------

def incremental_sync() -> None:
    """
    Sync incrémentale : récupère uniquement les docs modifiés depuis la
    dernière exécution. Appelé toutes les `sync_interval_seconds` secondes.
    """
    since_offers = _get_last_sync("offers")
    since_candidates = _get_last_sync("candidates")

    n_offers = bulk_sync_offers(since=since_offers)
    _set_last_sync("offers")

    n_candidates = bulk_sync_candidates(since=since_candidates)
    _set_last_sync("candidates")

    logger.info(
        "Incremental sync done: %d offres + %d candidats",
        n_offers,
        n_candidates,
    )


# ---------------------------------------------------------------------------
# INITIAL BULK SYNC (script standalone)
# ---------------------------------------------------------------------------

def run_initial_sync() -> None:
    """
    Lance la sync complète depuis zéro.
    Appeler ce script une seule fois au déploiement initial :
        python -m app.sync.indexer
    """
    from app.es_client import bootstrap_indices
    logger.info("=== INITIAL BULK SYNC START ===")
    bootstrap_indices()
    bulk_sync_offers(since=None)
    _set_last_sync("offers")
    bulk_sync_candidates(since=None)
    _set_last_sync("candidates")
    logger.info("=== INITIAL BULK SYNC COMPLETE ===")


if __name__ == "__main__":
    import sys
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s - %(message)s",
        stream=sys.stdout,
    )
    run_initial_sync()
