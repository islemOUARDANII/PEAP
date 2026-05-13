"""
Pipeline d'ingestion RTMC : PostgreSQL + index BM25.
Lancement : python -m mapper_app.ingestion.ingest_rtmc

Étapes :
  1. Création des tables (sql/create_tables.sql)
  2. Ingestion nodes     (12 941 occupations + skills)
  3. Ingestion appellations (8 277 synonymes)
  4. Ingestion relations  (23 614 core)
  5. Construction index BM25 nodes
  6. Construction index BM25 appellations
"""

import pickle
import sys

import pandas as pd
from rank_bm25 import BM25Okapi
from sqlalchemy import text
from tqdm import tqdm

from mapper_app.config import settings
from mapper_app.db import engine, test_db_connection
from mapper_app.ingestion.load_rtmc import load_appellations, load_nodes, load_relations
from mapper_app.normalizer import normalize_text, tokenize_text


# ──────────────────────────────────────────────────────────────
# 1. Création des tables
# ──────────────────────────────────────────────────────────────

def clean_sql_statement(statement: str) -> str:
    """
    Supprime les lignes vides et les commentaires SQL.
    Évite d'exécuter un bloc qui contient seulement des commentaires.
    """
    cleaned_lines = []

    for line in statement.splitlines():
        line = line.strip()

        if not line:
            continue

        if line.startswith("--"):
            continue

        cleaned_lines.append(line)

    return "\n".join(cleaned_lines).strip()


def create_tables() -> None:
    sql_path = settings.project_root / "sql" / "create_tables.sql"
    sql = sql_path.read_text(encoding="utf-8")

    with engine.begin() as conn:
        for statement in sql.split(";"):
            stmt = clean_sql_statement(statement)

            if not stmt:
                continue

            conn.execute(text(stmt))

    print("[TABLES] Tables créées / vérifiées.")

# ──────────────────────────────────────────────────────────────
# 2. Ingestion nodes
# ──────────────────────────────────────────────────────────────

_INSERT_NODE = text("""
    INSERT INTO rtmc_node
        (taxonomy_type, code, label, normalized_label,
         parent_code, depth, is_leaf, is_deprecated, source_kind)
    VALUES
        (:taxonomy_type, :code, :label, :normalized_label,
         :parent_code, :depth, :is_leaf, :is_deprecated, :source_kind)
    ON CONFLICT (code, taxonomy_type) DO UPDATE SET
        label            = EXCLUDED.label,
        normalized_label = EXCLUDED.normalized_label,
        parent_code      = EXCLUDED.parent_code,
        depth            = EXCLUDED.depth,
        is_leaf          = EXCLUDED.is_leaf,
        is_deprecated    = EXCLUDED.is_deprecated,
        source_kind      = EXCLUDED.source_kind
""")


def _row_to_node_params(row: pd.Series) -> dict:
    return {
        "taxonomy_type":    row["taxonomy_type"],
        "code":             str(row["code"]),
        "label":            str(row["label"]),
        "normalized_label": normalize_text(str(row["label"])),
        "parent_code":      str(row["parent_code"]) if pd.notna(row.get("parent_code")) else None,
        "depth":            int(row["depth"]) if pd.notna(row.get("depth")) else None,
        "is_leaf":          bool(row.get("is_leaf", False)),
        "is_deprecated":    bool(row.get("is_deprecated", False)),
        "source_kind":      str(row["source_kind"]) if pd.notna(row.get("source_kind")) else None,
    }


def ingest_nodes(df: pd.DataFrame) -> int:
    with engine.begin() as conn:
        for _, row in tqdm(df.iterrows(), total=len(df), desc="  Nodes", ncols=70):
            conn.execute(_INSERT_NODE, _row_to_node_params(row))
    return len(df)


# ──────────────────────────────────────────────────────────────
# 3. Ingestion appellations
# ──────────────────────────────────────────────────────────────

_INSERT_APPELL = text("""
    INSERT INTO rtmc_appellation
        (code_appellation, libelle_appellation, normalized_label, code_metier, actif)
    VALUES
        (:code_appellation, :libelle_appellation, :normalized_label, :code_metier, :actif)
""")


def ingest_appellations(df: pd.DataFrame) -> int:
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE rtmc_appellation RESTART IDENTITY"))
        for _, row in tqdm(df.iterrows(), total=len(df), desc="  Appell.", ncols=70):
            conn.execute(_INSERT_APPELL, {
                "code_appellation":    int(row["code_appellation"]) if pd.notna(row.get("code_appellation")) else None,
                "libelle_appellation": str(row["libelle_appellation"]),
                "normalized_label":    normalize_text(str(row["libelle_appellation"])),
                "code_metier":         str(row["code_metier"]) if pd.notna(row.get("code_metier")) else None,
                "actif":               str(row.get("actif", "O")),
            })
    return len(df)


# ──────────────────────────────────────────────────────────────
# 4. Ingestion relations
# ──────────────────────────────────────────────────────────────

_INSERT_REL = text("""
    INSERT INTO rtmc_relation
        (src_type, src_code, relation_type, dst_type, dst_code, score_forward, score_backward)
    VALUES
        (:src_type, :src_code, :relation_type, :dst_type, :dst_code, :score_forward, :score_backward)
""")


def ingest_relations(df: pd.DataFrame) -> int:
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE rtmc_relation RESTART IDENTITY"))
        for _, row in tqdm(df.iterrows(), total=len(df), desc="  Relat.", ncols=70):
            conn.execute(_INSERT_REL, {
                "src_type":      str(row["src_taxonomy_type"]),
                "src_code":      str(row["src_code"]),
                "relation_type": str(row["relation_type"]),
                "dst_type":      str(row["dst_taxonomy_type"]),
                "dst_code":      str(row["dst_code"]),
                "score_forward":  float(row["score_forward"]) if pd.notna(row.get("score_forward")) else None,
                "score_backward": float(row["score_backward"]) if pd.notna(row.get("score_backward")) else None,
            })
    return len(df)


# ──────────────────────────────────────────────────────────────
# 5 & 6. Index BM25
# ──────────────────────────────────────────────────────────────

def build_bm25_nodes(df: pd.DataFrame) -> None:
    bm25_dir = settings.bm25_index_full_dir
    bm25_dir.mkdir(parents=True, exist_ok=True)

    labels = df["label"].fillna("").tolist()
    corpus = [tokenize_text(lbl) for lbl in tqdm(labels, desc="  BM25 nodes tok.", ncols=70)]
    bm25 = BM25Okapi(corpus)

    meta = [
        {
            "code":          str(row["code"]),
            "taxonomy_type": str(row["taxonomy_type"]),
            "label":         str(row["label"]),
            "source_kind":   str(row.get("source_kind", "")),
        }
        for _, row in df.iterrows()
    ]

    out = bm25_dir / "bm25_nodes.pkl"
    with open(out, "wb") as f:
        pickle.dump({"bm25": bm25, "meta": meta}, f, protocol=pickle.HIGHEST_PROTOCOL)
    print(f"  [BM25] nodes → {out}  ({len(corpus)} docs)")


def build_bm25_appellations(df: pd.DataFrame) -> None:
    bm25_dir = settings.bm25_index_full_dir

    labels = df["libelle_appellation"].fillna("").tolist()
    corpus = [tokenize_text(lbl) for lbl in tqdm(labels, desc="  BM25 appell. tok.", ncols=70)]
    bm25 = BM25Okapi(corpus)

    meta = [
        {
            "code_metier":         str(row.get("code_metier", "")),
            "libelle_appellation": str(row["libelle_appellation"]),
        }
        for _, row in df.iterrows()
    ]

    out = bm25_dir / "bm25_appellations.pkl"
    with open(out, "wb") as f:
        pickle.dump({"bm25": bm25, "meta": meta}, f, protocol=pickle.HIGHEST_PROTOCOL)
    print(f"  [BM25] appellations → {out}  ({len(corpus)} docs)")


# ──────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────

def main() -> None:
    print("=" * 60)
    print("  INGEST RTMC — PostgreSQL + BM25")
    print("=" * 60)

    if not test_db_connection():
        print("\n[STOP] Connexion PostgreSQL impossible.")
        print("  Vérifie que la base 'rtmc_mapper' existe et que pgvector est activé.")
        sys.exit(1)

    # ── 1. Tables ──────────────────────────────────────────────
    print("\n[1/6] Création des tables SQL...")
    create_tables()

    # ── 2. Chargement XLSX ────────────────────────────────────
    print("\n[2/6] Chargement RTMC.xlsx...")
    nodes_df = load_nodes(core_only=True)
    appell_df = load_appellations(actif_only=True)
    rels_df = load_relations(core_only=True)
    print(f"  Nodes         : {len(nodes_df):>6}")
    print(f"    occupation  : {(nodes_df['taxonomy_type']=='occupation').sum():>6}")
    print(f"    skill       : {(nodes_df['taxonomy_type']=='skill').sum():>6}")
    print(f"  Appellations  : {len(appell_df):>6}")
    print(f"  Relations core: {len(rels_df):>6}")

    # ── 3. Nodes ──────────────────────────────────────────────
    print("\n[3/6] Ingestion nodes...")
    n = ingest_nodes(nodes_df)
    print(f"  [OK] {n} nodes insérés / mis à jour")

    # ── 4. Appellations ───────────────────────────────────────
    print("\n[4/6] Ingestion appellations...")
    n = ingest_appellations(appell_df)
    print(f"  [OK] {n} appellations insérées")

    # ── 5. Relations ──────────────────────────────────────────
    print("\n[5/6] Ingestion relations...")
    n = ingest_relations(rels_df)
    print(f"  [OK] {n} relations insérées")

    # ── 6. BM25 ───────────────────────────────────────────────
    print("\n[6/6] Construction index BM25...")
    build_bm25_nodes(nodes_df)
    build_bm25_appellations(appell_df)

    print("\n" + "=" * 60)
    print("  INGEST RTMC TERMINÉ")
    print("  Prochaine étape : générer les embeddings BAAI/bge-m3")
    print("    → python -m mapper_app.ingestion.embed_rtmc  (étape 2)")
    print("=" * 60)


if __name__ == "__main__":
    main()
