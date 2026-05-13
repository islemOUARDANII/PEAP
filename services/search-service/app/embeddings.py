"""
Embedding singleton — même modèle que matching_engine/semantic (all-MiniLM-L6-v2).
Génère des vecteurs normalisés (cosine-ready) de dim 384.
"""

from __future__ import annotations

import concurrent.futures
import threading
import logging
from typing import List

import numpy as np

from app.config import settings

logger = logging.getLogger(__name__)

_model = None
_lock = threading.Lock()
_executor = concurrent.futures.ThreadPoolExecutor(
    max_workers=2, thread_name_prefix="embed"
)


def _get_model():
    global _model
    if _model is None:
        with _lock:
            if _model is None:
                from sentence_transformers import SentenceTransformer
                logger.info("Chargement modèle embedding : %s", settings.embedding_model)
                _model = SentenceTransformer(settings.embedding_model)
    return _model


def embed_text(text: str) -> List[float]:
    """Embed un texte unique → liste float normalisée.
    Lève RuntimeError si le modèle met plus de embed_timeout_seconds."""
    if not text or not text.strip():
        return [0.0] * settings.embedding_dim
    model = _get_model()
    future = _executor.submit(
        model.encode,
        text.strip(),
        convert_to_numpy=True,
        normalize_embeddings=True,
    )
    try:
        vec = future.result(timeout=settings.embed_timeout_seconds)
    except concurrent.futures.TimeoutError:
        raise RuntimeError(
            f"Embedding timeout after {settings.embed_timeout_seconds}s"
        )
    return vec.tolist()


def embed_batch(texts: List[str], batch_size: int = 64) -> List[List[float]]:
    """Embed une liste de textes en une passe batch (efficace pour le sync bulk)."""
    cleaned = [t.strip() if t else "" for t in texts]
    vectors = _get_model().encode(
        cleaned,
        batch_size=batch_size,
        convert_to_numpy=True,
        normalize_embeddings=True,
        show_progress_bar=False,
    )
    return [v.tolist() for v in vectors]


def build_offer_text(title: str, description: str, skills: List[str], occupations: List[str] = None) -> str:
    """Construit le texte à embedder pour une offre."""
    parts = [title or ""]
    if occupations:
        parts.append(" ".join(occupations))
    if skills:
        parts.append(" ".join(skills))
    if description:
        parts.append(description[:800])
    return " ".join(p for p in parts if p).strip()
