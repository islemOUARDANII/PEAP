"""
Generation des embeddings RTMC avec BAAI/bge-m3
et stockage dans PostgreSQL pgvector.

Lancement :
    python -m mapper_app.ingestion.embed_rtmc

Verification :
    python -m mapper_app.ingestion.embed_rtmc
"""

import sys
from typing import List

import numpy as np
import pandas as pd
import torch
from sentence_transformers import SentenceTransformer
from sqlalchemy import text
from tqdm import tqdm

from mapper_app.config import settings
from mapper_app.db import engine, test_db_connection


MODEL_NAME = "BAAI/bge-m3"
EXPECTED_DIM = 1024
BATCH_SIZE = 32


def resolve_device() -> str:
    """
    Resolve an execution device that stays safe on Windows and CPU-only PCs.
    """
    requested = str(getattr(settings, "embedding_device", "") or "").strip().lower()

    if requested in {"", "auto"}:
        return "cuda" if torch.cuda.is_available() else "cpu"

    if requested.startswith("cuda"):
        if torch.cuda.is_available():
            return requested
        print("[WARN] CUDA demandee mais indisponible. Fallback CPU.")
        return "cpu"

    if requested == "cpu":
        return "cpu"

    if requested:
        print(f"[WARN] Device '{requested}' non reconnu. Fallback automatique.")

    return "cuda" if torch.cuda.is_available() else "cpu"


def vector_to_pgvector(vec: np.ndarray) -> str:
    """
    Convert a numpy vector to pgvector text format.
    Example: [0.1,0.2,0.3]
    """
    arr = np.asarray(vec, dtype=np.float32).reshape(-1)
    return "[" + ",".join(f"{float(x):.8f}" for x in arr) + "]"


def load_nodes_to_embed() -> pd.DataFrame:
    """
    Load RTMC nodes that still do not have an embedding.
    """
    query = """
        SELECT id, taxonomy_type, code, label, normalized_label, source_kind
        FROM rtmc_node
        WHERE embedding IS NULL
        ORDER BY id
    """

    with engine.connect() as conn:
        df = pd.read_sql_query(text(query), conn)

    return df


def build_embedding_text(row: pd.Series) -> str:
    """
    Build the text sent to the embedding model.
    """
    taxonomy_type = str(row.get("taxonomy_type", "") or "").strip()
    label = str(row.get("label", "") or "").strip()
    source_kind = str(row.get("source_kind", "") or "").strip()
    return f"{taxonomy_type} | {source_kind} | {label}"


def update_embeddings(ids: List[int], embeddings: np.ndarray) -> None:
    """
    Update PostgreSQL with generated embeddings.
    """
    if len(ids) != len(embeddings):
        raise ValueError("Le nombre d'IDs ne correspond pas au nombre d'embeddings.")

    update_sql = text(
        """
        UPDATE rtmc_node
        SET embedding = (:embedding)::vector
        WHERE id = :id
        """
    )

    params = [
        {
            "id": int(node_id),
            "embedding": vector_to_pgvector(embedding),
        }
        for node_id, embedding in zip(ids, embeddings)
    ]

    with engine.begin() as conn:
        conn.execute(update_sql, params)


def create_vector_index() -> None:
    """
    Create the vector index.
    Try HNSW first, then fallback to IVFFLAT in a fresh transaction.
    """
    hnsw_sql = """
        CREATE INDEX IF NOT EXISTS idx_rtmc_node_embedding_hnsw
        ON rtmc_node
        USING hnsw (embedding vector_cosine_ops);
    """

    ivfflat_sql = """
        CREATE INDEX IF NOT EXISTS idx_rtmc_node_embedding_ivfflat
        ON rtmc_node
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
    """

    try:
        with engine.begin() as conn:
            conn.execute(text(hnsw_sql))
        print("[INDEX] HNSW cree avec succes.")
        return
    except Exception as exc:
        print("[WARN] HNSW impossible. Tentative avec IVFFLAT...")
        print(f"[DETAIL] {exc}")

    with engine.begin() as conn:
        conn.execute(text(ivfflat_sql))
    print("[INDEX] IVFFLAT cree avec succes.")


def show_stats() -> None:
    query = """
        SELECT
            COUNT(*) AS total_nodes,
            COUNT(embedding) AS embedded_nodes,
            COUNT(*) - COUNT(embedding) AS missing_embeddings
        FROM rtmc_node;
    """

    with engine.connect() as conn:
        result = conn.execute(text(query)).mappings().first()

    print("\n[STATS]")
    print(f"  Total nodes        : {result['total_nodes']}")
    print(f"  Embedded nodes     : {result['embedded_nodes']}")
    print(f"  Missing embeddings : {result['missing_embeddings']}")


def main() -> None:
    print("=" * 60)
    print("  EMBED RTMC - BAAI/bge-m3 + pgvector")
    print("=" * 60)

    if not test_db_connection():
        print("[STOP] Connexion PostgreSQL impossible.")
        sys.exit(1)

    print("\n[1/4] Chargement des nodes sans embedding...")
    df = load_nodes_to_embed()

    if df.empty:
        print("[OK] Tous les nodes ont deja un embedding.")
        show_stats()
        print("\n[4/4] Creation / verification index vectoriel...")
        create_vector_index()
        print("\n" + "=" * 60)
        print("  EMBEDDINGS RTMC DEJA COMPLETS")
        print("=" * 60)
        return

    print(f"  Nodes a encoder : {len(df)}")

    device = resolve_device()
    print("\n[2/4] Chargement du modele BAAI/bge-m3...")
    print(f"  Device retenu : {device}")
    model = SentenceTransformer(MODEL_NAME, device=device)

    print("\n[3/4] Generation + insertion des embeddings...")
    texts = [build_embedding_text(row) for _, row in df.iterrows()]
    ids = df["id"].tolist()

    for start in tqdm(range(0, len(texts), BATCH_SIZE), desc="  Embeddings", ncols=80):
        end = start + BATCH_SIZE
        batch_texts = texts[start:end]
        batch_ids = ids[start:end]

        embeddings = model.encode(
            batch_texts,
            batch_size=BATCH_SIZE,
            normalize_embeddings=True,
            show_progress_bar=False,
            convert_to_numpy=True,
        )

        embeddings = np.asarray(embeddings, dtype=np.float32)
        embeddings = np.atleast_2d(embeddings)

        if embeddings.shape[1] != EXPECTED_DIM:
            raise ValueError(
                f"Dimension incorrecte : {embeddings.shape[1]} au lieu de {EXPECTED_DIM}. "
                f"Verifie que le modele utilise est bien {MODEL_NAME}."
            )

        update_embeddings(batch_ids, embeddings)

    print("\n[4/4] Creation de l'index vectoriel...")
    create_vector_index()
    show_stats()

    print("\n" + "=" * 60)
    print("  EMBEDDINGS RTMC TERMINES")
    print("  Prochaine etape : creer les retrievers exact / BM25 / vector / RRF")
    print("=" * 60)


if __name__ == "__main__":
    main()
