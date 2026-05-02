from collections import defaultdict
from pathlib import Path
from typing import List, Sequence

import numpy as np

from mapper_app.config import settings
from mapper_app.normalizer import tokenize_text
from mapper_app.retrievers.common import build_candidate, dedupe_candidates, fetch_nodes_by_codes, load_pickle
from mapper_app.schemas import MappingCandidate


class BM25Retriever:
    """
    BM25 lookup on canonical RTMC nodes and RTMC appellations.
    """

    def __init__(self, bm25_dir: Path | None = None):
        self.bm25_dir = bm25_dir or settings.bm25_index_full_dir
        self._nodes_index = None
        self._appellations_index = None

    def _load_nodes_index(self):
        if self._nodes_index is None:
            path = self.bm25_dir / "bm25_nodes.pkl"
            if not path.exists():
                self._nodes_index = {}
            else:
                self._nodes_index = load_pickle(path)
        return self._nodes_index or {}

    def _load_appellations_index(self):
        if self._appellations_index is None:
            path = self.bm25_dir / "bm25_appellations.pkl"
            if not path.exists():
                self._appellations_index = {}
            else:
                self._appellations_index = load_pickle(path)
        return self._appellations_index or {}

    @staticmethod
    def _top_hits(scores, top_k: int) -> List[int]:
        score_array = np.asarray(scores, dtype=np.float32)
        positive_idx = np.where(score_array > 0)[0]
        if len(positive_idx) == 0:
            return []

        positive_scores = score_array[positive_idx]
        order = np.argsort(-positive_scores)
        return positive_idx[order][:top_k].tolist()

    @staticmethod
    def _normalized_bm25_score(score: float, max_score: float) -> float:
        if max_score <= 0:
            return 0.0
        return float(score) / float(max_score)

    def search_nodes(
        self,
        query_text: str,
        top_k: int = 10,
        entity_types: Sequence[str] | None = None,
    ) -> List[MappingCandidate]:
        payload = self._load_nodes_index()
        bm25 = payload.get("bm25")
        meta = payload.get("meta") or []
        tokens = tokenize_text(query_text)

        if not bm25 or not tokens:
            return []

        scores = bm25.get_scores(tokens)
        hit_indexes = self._top_hits(scores, top_k=top_k * 3)
        if not hit_indexes:
            return []

        max_score = max(float(scores[idx]) for idx in hit_indexes) or 0.0
        candidates: List[MappingCandidate] = []

        for idx in hit_indexes:
            row = meta[idx]
            entity_type = str(row.get("taxonomy_type") or "").strip()
            if entity_types and entity_type not in entity_types:
                continue

            candidates.append(
                build_candidate(
                    entity_type=entity_type,
                    entity_code=row.get("code"),
                    label=row.get("label") or "",
                    lexical_score=self._normalized_bm25_score(scores[idx], max_score),
                    source="bm25_nodes",
                )
            )

        candidates = dedupe_candidates(candidates)
        candidates.sort(key=lambda item: item.lexical_score or 0.0, reverse=True)
        return candidates[:top_k]

    def search_aliases(
        self,
        query_text: str,
        top_k: int = 10,
        entity_types: Sequence[str] | None = None,
    ) -> List[MappingCandidate]:
        if entity_types and "occupation" not in entity_types:
            return []

        payload = self._load_appellations_index()
        bm25 = payload.get("bm25")
        meta = payload.get("meta") or []
        tokens = tokenize_text(query_text)

        if not bm25 or not tokens:
            return []

        scores = bm25.get_scores(tokens)
        hit_indexes = self._top_hits(scores, top_k=max(top_k * 20, 50))
        if not hit_indexes:
            return []

        max_score = max(float(scores[idx]) for idx in hit_indexes) or 0.0
        occupation_codes = [
            str(meta[idx].get("code_metier") or "").strip()
            for idx in hit_indexes
            if str(meta[idx].get("code_metier") or "").strip()
        ]
        occupation_map = fetch_nodes_by_codes(occupation_codes, taxonomy_type="occupation")

        aggregated = defaultdict(
            lambda: {
                "sum_score": 0.0,
                "max_score": 0.0,
                "match_count": 0,
                "best_alias": None,
            }
        )

        for idx in hit_indexes:
            row = meta[idx]
            code_metier = str(row.get("code_metier") or "").strip()
            if not code_metier:
                continue

            score_value = float(scores[idx])
            alias_label = str(row.get("libelle_appellation") or "").strip()
            bucket = aggregated[code_metier]
            bucket["sum_score"] += score_value
            bucket["match_count"] += 1

            if score_value > bucket["max_score"]:
                bucket["max_score"] = score_value
                bucket["best_alias"] = alias_label

        if not aggregated:
            return []

        best_sum_score = max(info["sum_score"] for info in aggregated.values()) or 0.0
        candidates: List[MappingCandidate] = []

        for code_metier, info in aggregated.items():
            occupation = occupation_map.get(code_metier)

            if occupation:
                label = occupation["label"]
                entity_id = occupation["id"]
                normalized_label = occupation.get("normalized_label")
            else:
                label = info["best_alias"] or ""
                entity_id = None
                normalized_label = None

            lexical_score = 0.0
            if best_sum_score > 0:
                lexical_score = info["sum_score"] / best_sum_score

            candidates.append(
                build_candidate(
                    entity_type="occupation",
                    entity_id=entity_id,
                    entity_code=code_metier or None,
                    label=label,
                    normalized_label=normalized_label,
                    lexical_score=lexical_score,
                    source="bm25_aliases",
                )
            )

        candidates = dedupe_candidates(candidates)
        candidates.sort(
            key=lambda item: (
                item.lexical_score or 0.0,
                aggregated.get(item.entity_code or "", {}).get("max_score", 0.0),
                aggregated.get(item.entity_code or "", {}).get("match_count", 0),
            ),
            reverse=True,
        )
        return candidates[:top_k]
