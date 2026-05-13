from __future__ import annotations

import os
import re
import unicodedata
from datetime import datetime, timezone

import numpy as np
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
from sqlalchemy import create_engine, text

from mapper_app.config import settings


def normalize_text(value: str | None) -> str:
    value = value or ""
    value = value.lower().strip()
    value = unicodedata.normalize("NFKD", value)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = re.sub(r"[^a-z0-9+#.\s-]", " ", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def vector_to_pgvector(vector: np.ndarray) -> str:
    arr = np.asarray(vector, dtype=np.float32).reshape(-1)
    return "[" + ",".join(f"{float(x):.8f}" for x in arr) + "]"


def get_engine():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured")

    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+psycopg2://", 1)

    return create_engine(database_url, pool_pre_ping=True)


def fetch_entities(engine):
    query = text(
        """
        SELECT
            entity_type,
            code,
            label
        FROM taxonomy.v_rtmc_mapper_entities
        WHERE entity_type IN ('occupation', 'skill', 'activity')
          AND label IS NOT NULL
          AND length(trim(label)) > 0
        ORDER BY entity_type, code
        """
    )

    with engine.connect() as conn:
        return [dict(row) for row in conn.execute(query).mappings().all()]


def main() -> None:
    load_dotenv()

    engine = get_engine()

    model_name = settings.embedding_model
    expected_dim = int(settings.embedding_dimension)

    print(f"Loading embedding model: {model_name}")
    model = SentenceTransformer(model_name, device=getattr(settings, "embedding_device", "cpu"))

    entities = fetch_entities(engine)
    print(f"Entities to embed: {len(entities)}")

    batch_size = int(os.getenv("RTMC_EMBEDDING_BATCH_SIZE", "64"))

    upsert_sql = text(
        """
        INSERT INTO taxonomy.rtmc_entity_embedding (
            entity_type,
            code,
            label,
            normalized_label,
            embedding,
            embedding_model,
            generated_at
        )
        VALUES (
            :entity_type,
            :code,
            :label,
            :normalized_label,
            (:embedding)::vector,
            :embedding_model,
            :generated_at
        )
        ON CONFLICT (entity_type, code, embedding_model)
        DO UPDATE SET
            label = EXCLUDED.label,
            normalized_label = EXCLUDED.normalized_label,
            embedding = EXCLUDED.embedding,
            generated_at = EXCLUDED.generated_at
        """
    )

    total = 0

    for start in range(0, len(entities), batch_size):
        batch = entities[start : start + batch_size]
        texts = [f"{item['label']} ({item['entity_type']})" for item in batch]

        vectors = model.encode(
            texts,
            batch_size=batch_size,
            normalize_embeddings=True,
            show_progress_bar=False,
            convert_to_numpy=True,
        )

        rows = []

        for item, vector in zip(batch, vectors):
            vector = np.asarray(vector, dtype=np.float32).reshape(-1)

            if vector.shape[0] != expected_dim:
                raise ValueError(
                    f"Embedding dimension mismatch: got {vector.shape[0]}, expected {expected_dim}"
                )

            rows.append(
                {
                    "entity_type": item["entity_type"],
                    "code": item["code"],
                    "label": item["label"],
                    "normalized_label": normalize_text(item["label"]),
                    "embedding": vector_to_pgvector(vector),
                    "embedding_model": model_name,
                    "generated_at": datetime.now(timezone.utc),
                }
            )

        with engine.begin() as conn:
            conn.execute(upsert_sql, rows)

        total += len(rows)
        print(f"Embedded {total}/{len(entities)}")

    print("Vector embeddings generated successfully.")


if __name__ == "__main__":
    main()