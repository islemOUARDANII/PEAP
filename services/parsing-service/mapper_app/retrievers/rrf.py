from collections import defaultdict
from typing import Dict, Iterable, List, Sequence

from mapper_app.retrievers.common import candidate_identity
from mapper_app.schemas import MappingCandidate


DEFAULT_RRF_WEIGHTS = {
    "exact": 1.6,
    "alias": 1.4,
    "bm25_nodes": 1.0,
    "bm25_aliases": 1.2,
    "vector": 0.8,
}


def reciprocal_rank_fusion(
    ranked_lists: Dict[str, Sequence[MappingCandidate]],
    top_k: int = 10,
    rrf_k: int = 60,
    weights: Dict[str, float] | None = None,
) -> List[MappingCandidate]:
    """
    Merge multiple ranked lists with Reciprocal Rank Fusion.
    """
    weights = {**DEFAULT_RRF_WEIGHTS, **(weights or {})}
    fused: Dict[tuple[str, str], MappingCandidate] = {}
    source_map = defaultdict(set)

    for source_name, candidates in ranked_lists.items():
        source_weight = float(weights.get(source_name, 1.0))
        for rank, candidate in enumerate(candidates, start=1):
            key = candidate_identity(candidate)
            if key not in fused:
                fused[key] = candidate.model_copy(deep=True)
                fused[key].final_score = 0.0
            fused_candidate = fused[key]
            fused_candidate.final_score = float(fused_candidate.final_score or 0.0) + (
                source_weight / (rrf_k + rank)
            )

            if candidate.lexical_score is not None:
                fused_candidate.lexical_score = max(
                    float(fused_candidate.lexical_score or 0.0),
                    float(candidate.lexical_score),
                )
            if candidate.vector_score is not None:
                fused_candidate.vector_score = max(
                    float(fused_candidate.vector_score or -1.0),
                    float(candidate.vector_score),
                )

            source_map[key].add(source_name)

    out: List[MappingCandidate] = []
    for key, candidate in fused.items():
        candidate.source = ",".join(sorted(source_map[key]))
        out.append(candidate)

    out.sort(key=lambda item: item.final_score or 0.0, reverse=True)
    return out[:top_k]
