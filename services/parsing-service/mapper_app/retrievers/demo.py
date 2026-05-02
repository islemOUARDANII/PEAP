"""
Demo terminal pour interroger les retrievers RTMC.

Lancement :
    python -m mapper_app.retrievers.demo "data analyst"
    python -m mapper_app.retrievers.demo "developpeur python" --types occupation skill
    python -m mapper_app.retrievers.demo "power bi" --no-vector
"""

import argparse
import sys
from typing import Callable, Iterable, List, Sequence

from sqlalchemy import text

from mapper_app.db import engine, test_db_connection
from mapper_app.retrievers.alias import AliasRetriever
from mapper_app.retrievers.bm25 import BM25Retriever
from mapper_app.retrievers.exact import ExactRetriever
from mapper_app.retrievers.rrf import reciprocal_rank_fusion
from mapper_app.retrievers.vector import VectorRetriever
from mapper_app.schemas import MappingCandidate


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Demo des retrievers RTMC : exact, alias, BM25, vector et RRF."
    )
    parser.add_argument(
        "query",
        nargs="+",
        help="Texte a mapper vers RTMC.",
    )
    parser.add_argument(
        "--types",
        nargs="*",
        default=None,
        help="Filtre optionnel des taxonomy_type. Ex: occupation skill",
    )
    parser.add_argument(
        "--top-k-each",
        type=int,
        default=5,
        help="Nombre de resultats par retriever avant fusion.",
    )
    parser.add_argument(
        "--top-k-final",
        type=int,
        default=10,
        help="Nombre de resultats finaux apres RRF.",
    )
    parser.add_argument(
        "--no-vector",
        action="store_true",
        help="Desactive la recherche semantique vectorielle.",
    )
    return parser.parse_args()


def parse_entity_types(values: Sequence[str] | None) -> List[str] | None:
    if not values:
        return None

    out: List[str] = []
    seen = set()

    for value in values:
        for part in str(value or "").split(","):
            clean = part.strip()
            if not clean:
                continue
            key = clean.casefold()
            if key in seen:
                continue
            seen.add(key)
            out.append(clean)

    return out or None


def has_vector_embeddings() -> bool:
    query = text(
        """
        SELECT EXISTS (
            SELECT 1
            FROM rtmc_node
            WHERE embedding IS NOT NULL
        ) AS has_embeddings
        """
    )

    with engine.connect() as conn:
        value = conn.execute(query).scalar()

    return bool(value)


def run_retriever(
    name: str,
    search_fn: Callable[..., List[MappingCandidate]],
    *,
    query_text: str,
    top_k: int,
    entity_types: Sequence[str] | None,
) -> tuple[List[MappingCandidate], str | None]:
    try:
        results = list(
            search_fn(
                query_text,
                top_k=top_k,
                entity_types=entity_types,
            )
        )
        return results, None
    except Exception as exc:
        return [], f"{name} -> {exc}"


def fmt_score(value) -> str:
    if value is None:
        return "-"
    return f"{float(value):.4f}"


def print_candidates(title: str, candidates: Iterable[MappingCandidate]) -> None:
    print(f"\n[{title}]")
    rows = list(candidates)

    if not rows:
        print("  Aucun resultat.")
        return

    for idx, candidate in enumerate(rows, start=1):
        code = candidate.entity_code or "-"
        print(
            f"  {idx:>2}. "
            f"{candidate.entity_type:<10} "
            f"{code:<18} "
            f"{candidate.label}"
        )
        print(
            f"      lex={fmt_score(candidate.lexical_score)} "
            f"vec={fmt_score(candidate.vector_score)} "
            f"rrf={fmt_score(candidate.final_score)} "
            f"src={candidate.source or '-'}"
        )


def main() -> None:
    args = parse_args()
    query_text = " ".join(args.query).strip()
    entity_types = parse_entity_types(args.types)

    print("=" * 72)
    print("  RTMC RETRIEVERS DEMO")
    print("=" * 72)
    print(f"Query         : {query_text}")
    print(f"Entity types  : {entity_types or 'ALL'}")
    print(f"Top-K each    : {args.top_k_each}")
    print(f"Top-K final   : {args.top_k_final}")

    if not test_db_connection():
        print("\n[STOP] Connexion PostgreSQL impossible.")
        sys.exit(1)

    exact_retriever = ExactRetriever()
    alias_retriever = AliasRetriever()
    bm25_retriever = BM25Retriever()

    exact_hits, exact_error = run_retriever(
        "exact",
        exact_retriever.search,
        query_text=query_text,
        top_k=args.top_k_each,
        entity_types=entity_types,
    )
    alias_hits, alias_error = run_retriever(
        "alias",
        alias_retriever.search,
        query_text=query_text,
        top_k=args.top_k_each,
        entity_types=entity_types,
    )
    bm25_node_hits, bm25_node_error = run_retriever(
        "bm25_nodes",
        bm25_retriever.search_nodes,
        query_text=query_text,
        top_k=args.top_k_each,
        entity_types=entity_types,
    )
    bm25_alias_hits, bm25_alias_error = run_retriever(
        "bm25_aliases",
        bm25_retriever.search_aliases,
        query_text=query_text,
        top_k=args.top_k_each,
        entity_types=entity_types,
    )

    vector_hits: List[MappingCandidate] = []
    vector_error = None

    if args.no_vector:
        vector_error = "vector -> desactive via --no-vector"
    else:
        try:
            if has_vector_embeddings():
                vector_retriever = VectorRetriever()
                vector_hits, vector_error = run_retriever(
                    "vector",
                    vector_retriever.search,
                    query_text=query_text,
                    top_k=args.top_k_each,
                    entity_types=entity_types,
                )
            else:
                vector_error = "vector -> aucun embedding en base"
        except Exception as exc:
            vector_error = f"vector -> {exc}"

    fused_hits = reciprocal_rank_fusion(
        {
            "exact": exact_hits,
            "alias": alias_hits,
            "bm25_nodes": bm25_node_hits,
            "bm25_aliases": bm25_alias_hits,
            "vector": vector_hits,
        },
        top_k=args.top_k_final,
    )

    print_candidates("EXACT", exact_hits)
    print_candidates("ALIAS", alias_hits)
    print_candidates("BM25 NODES", bm25_node_hits)
    print_candidates("BM25 ALIASES", bm25_alias_hits)
    print_candidates("VECTOR", vector_hits)
    print_candidates("RRF", fused_hits)

    errors = [
        err
        for err in (
            exact_error,
            alias_error,
            bm25_node_error,
            bm25_alias_error,
            vector_error,
        )
        if err
    ]
    if errors:
        print("\n[NOTES]")
        for err in errors:
            print(f"  - {err}")

    print("\n" + "=" * 72)
    print("  FIN DEMO RETRIEVERS")
    print("=" * 72)


if __name__ == "__main__":
    main()
