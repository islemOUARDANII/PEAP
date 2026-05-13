from __future__ import annotations

from typing import TYPE_CHECKING, Dict, List, Sequence

from mapper_app.normalizer import normalize_text
from mapper_app.retrievers.alias import AliasRetriever
from mapper_app.retrievers.bm25 import BM25Retriever
from mapper_app.retrievers.exact import ExactRetriever
from mapper_app.retrievers.rrf import reciprocal_rank_fusion
from mapper_app.schemas import MappingCandidate, MappingResult

if TYPE_CHECKING:
    from mapper_app.retrievers.vector import VectorRetriever


class HybridRetriever:
    """
    Orchestrates exact, alias, BM25 and vector retrievers, then fuses them with RRF.
    """

    def __init__(
        self,
        exact_retriever: ExactRetriever | None = None,
        alias_retriever: AliasRetriever | None = None,
        bm25_retriever: BM25Retriever | None = None,
        vector_retriever: VectorRetriever | None = None,
    ):
        self.exact_retriever = exact_retriever or ExactRetriever()
        self.alias_retriever = alias_retriever or AliasRetriever()
        self.bm25_retriever = bm25_retriever or BM25Retriever()
        self.vector_retriever = vector_retriever

    def _get_vector_retriever(self) -> VectorRetriever:
        if self.vector_retriever is None:
            from mapper_app.retrievers.vector import VectorRetriever

            self.vector_retriever = VectorRetriever()
        return self.vector_retriever

    @staticmethod
    def _safe_search(search_fn, *args, **kwargs) -> List[MappingCandidate]:
        try:
            return list(search_fn(*args, **kwargs))
        except Exception:
            return []

    def retrieve(
        self,
        query_text: str,
        *,
        top_k_each: int = 10,
        top_k_final: int = 10,
        entity_types: Sequence[str] | None = None,
        include_vector: bool = True,
    ) -> Dict[str, List[MappingCandidate] | str]:
        normalized_text = normalize_text(query_text)

        exact = self._safe_search(
            self.exact_retriever.search,
            query_text,
            top_k=top_k_each,
            entity_types=entity_types,
        )
        alias = self._safe_search(
            self.alias_retriever.search,
            query_text,
            top_k=top_k_each,
            entity_types=entity_types,
        )
        bm25_nodes = self._safe_search(
            self.bm25_retriever.search_nodes,
            query_text,
            top_k=top_k_each,
            entity_types=entity_types,
        )
        bm25_aliases = self._safe_search(
            self.bm25_retriever.search_aliases,
            query_text,
            top_k=top_k_each,
            entity_types=entity_types,
        )

        vector = []
        if include_vector:
            try:
                vector_retriever = self._get_vector_retriever()
            except Exception:
                vector_retriever = None

            if vector_retriever is not None:
                vector = self._safe_search(
                    vector_retriever.search,
                    query_text,
                    top_k=top_k_each,
                    entity_types=entity_types,
                )

        fused = reciprocal_rank_fusion(
            {
                "exact": exact,
                "alias": alias,
                "bm25_nodes": bm25_nodes,
                "bm25_aliases": bm25_aliases,
                "vector": vector,
            },
            top_k=top_k_final,
        )

        return {
            "raw_text": query_text,
            "normalized_text": normalized_text,
            "exact": exact,
            "alias": alias,
            "bm25_nodes": bm25_nodes,
            "bm25_aliases": bm25_aliases,
            "vector": vector,
            "rrf": fused,
        }

    def map_query(
        self,
        query_text: str,
        *,
        top_k_each: int = 10,
        top_k_final: int = 10,
        entity_types: Sequence[str] | None = None,
        include_vector: bool = True,
    ) -> MappingResult:
        payload = self.retrieve(
            query_text,
            top_k_each=top_k_each,
            top_k_final=top_k_final,
            entity_types=entity_types,
            include_vector=include_vector,
        )
        fused = payload["rrf"]
        return MappingResult(
            raw_text=str(payload["raw_text"]),
            normalized_text=str(payload["normalized_text"]),
            candidates=list(fused),
            selected_candidate=fused[0] if fused else None,
        )
