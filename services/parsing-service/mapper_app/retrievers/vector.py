from typing import List, Sequence

import numpy as np
import torch
from sentence_transformers import SentenceTransformer
from sqlalchemy import bindparam, text

from mapper_app.config import settings
from mapper_app.db import engine
from mapper_app.retrievers.common import build_candidate, dedupe_candidates
from mapper_app.schemas import MappingCandidate


class VectorRetriever:
    """
    Semantic lookup on pgvector embeddings stored in rtmc_node.embedding.
    """

    def __init__(self, model_name: str | None = None):
        self.model_name = model_name or settings.embedding_model
        self.expected_dim = int(settings.embedding_dimension)
        self._model = None

    @staticmethod
    def _resolve_device() -> str:
        requested = str(getattr(settings, "embedding_device", "") or "").strip().lower()

        if requested in {"", "auto"}:
            return "cuda" if torch.cuda.is_available() else "cpu"

        if requested.startswith("cuda"):
            return requested if torch.cuda.is_available() else "cpu"

        if requested == "cpu":
            return "cpu"

        return "cuda" if torch.cuda.is_available() else "cpu"

    @property
    def model(self) -> SentenceTransformer:
        if self._model is None:
            self._model = SentenceTransformer(self.model_name, device=self._resolve_device())
        return self._model

    @staticmethod
    def _vector_to_pgvector(vec: np.ndarray) -> str:
        arr = np.asarray(vec, dtype=np.float32).reshape(-1)
        return "[" + ",".join(f"{float(x):.8f}" for x in arr) + "]"

    def embed_query(self, query_text: str) -> np.ndarray:
        embedding = self.model.encode(
            [str(query_text or "").strip()],
            batch_size=1,
            normalize_embeddings=True,
            show_progress_bar=False,
            convert_to_numpy=True,
        )
        vector = np.asarray(embedding, dtype=np.float32).reshape(-1)
        if vector.shape[0] != self.expected_dim:
            raise ValueError(
                f"Dimension incorrecte pour la requete : {vector.shape[0]} au lieu de {self.expected_dim}."
            )
        return vector

    def search(
        self,
        query_text: str,
        top_k: int = 10,
        entity_types: Sequence[str] | None = None,
    ) -> List[MappingCandidate]:
        clean_query = str(query_text or "").strip()
        if not clean_query:
            return []

        query_vector = self.embed_query(clean_query)
        params = {
            "embedding": self._vector_to_pgvector(query_vector),
            "limit": int(top_k),
        }

        sql = """
            SELECT
                id,
                taxonomy_type,
                code,
                label,
                normalized_label,
                source_kind,
                1 - (embedding <=> (:embedding)::vector) AS vector_score
            FROM rtmc_node
            WHERE embedding IS NOT NULL
        """

        if entity_types:
            sql += " AND taxonomy_type IN :entity_types"

        sql += " ORDER BY embedding <=> (:embedding)::vector ASC LIMIT :limit"

        query = text(sql)
        if entity_types:
            query = query.bindparams(bindparam("entity_types", expanding=True))
            params["entity_types"] = [str(item) for item in entity_types]

        with engine.connect() as conn:
            rows = conn.execute(query, params).mappings().all()

        candidates = [
            build_candidate(
                entity_type=row["taxonomy_type"],
                entity_id=row["id"],
                entity_code=row["code"],
                label=row["label"],
                normalized_label=row.get("normalized_label"),
                vector_score=row.get("vector_score"),
                source="vector",
            )
            for row in rows
        ]

        candidates = dedupe_candidates(candidates)
        candidates.sort(key=lambda item: item.vector_score or 0.0, reverse=True)
        return candidates[:top_k]
