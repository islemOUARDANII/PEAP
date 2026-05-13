"""
Service de mapping RTMC.

Lancement demo :
    python -m mapper_app.service "data analyst" --types occupation --no-vector
    python -m mapper_app.service "python" --types skill --no-llm
"""

import argparse
from typing import Sequence

from mapper_app.config import settings
from mapper_app.retrievers.hybrid import HybridRetriever
from mapper_app.reranker import LLMReranker
from mapper_app.schemas import MappingCandidate, MappingResult


DECISION_SOURCE_BONUS = {
    "exact": 0.28,
    "alias": 0.10,
    "bm25_aliases": 0.08,
    "bm25_nodes": 0.08,
    "vector": 0.10,
}


class MapperService:
    """
    Rule-based mapping service with optional LLM fallback for ambiguous cases.
    """

    def __init__(
        self,
        hybrid_retriever: HybridRetriever | None = None,
        llm_reranker: LLMReranker | None = None,
    ):
        self.hybrid_retriever = hybrid_retriever or HybridRetriever()
        self.llm_reranker = llm_reranker or LLMReranker()

    @staticmethod
    def _parse_sources(source: str | None) -> set[str]:
        return {
            part.strip()
            for part in str(source or "").split(",")
            if part.strip()
        }

    def _compute_candidate_confidence(self, candidate: MappingCandidate) -> float:
        lexical = max(0.0, min(1.0, float(candidate.lexical_score or 0.0)))
        vector = max(0.0, min(1.0, float(candidate.vector_score or 0.0)))
        sources = self._parse_sources(candidate.source)

        score = 0.40 * lexical
        score += 0.35 * vector
        score += min(sum(DECISION_SOURCE_BONUS.get(src, 0.0) for src in sources), 0.40)
        score += min(0.02 * max(len(sources) - 1, 0), 0.06)

        if "exact" in sources and lexical >= 0.98:
            score = max(score, 0.98)
        if sources == {"alias"} and lexical >= 0.95:
            score = max(score, 0.95)
        if (
            "vector" in sources
            and self._has_reliable_lexical_source(sources)
            and vector >= 0.70
            and lexical >= 0.60
        ):
            score = max(score, 0.85)

        return max(0.0, min(1.0, score))

    @staticmethod
    def _has_reliable_lexical_source(sources: set[str]) -> bool:
        return bool(sources.intersection({"alias", "bm25_nodes", "bm25_aliases", "exact"}))

    @staticmethod
    def _has_vector_confirmation(candidate: MappingCandidate, sources: set[str]) -> bool:
        return "vector" in sources and candidate.vector_score is not None

    @classmethod
    def _is_high_confidence_exact(
        cls,
        candidate: MappingCandidate,
        sources: set[str],
    ) -> bool:
        return "exact" in sources and float(candidate.lexical_score or 0.0) >= 0.98

    @classmethod
    def _is_high_confidence_local_alias(
        cls,
        candidate: MappingCandidate,
        sources: set[str],
    ) -> bool:
        # At the fused RRF stage, alias candidates are collapsed to the "alias" source.
        # Manual/local aliases are intentionally scored >= 0.95, while raw RTMC appellations
        # stay below that threshold.
        return (
            "alias" in sources
            and float(candidate.lexical_score or 0.0) >= 0.95
        )

    @classmethod
    def _has_bm25_vector_agreement(
        cls,
        candidate: MappingCandidate,
        sources: set[str],
    ) -> bool:
        return (
            cls._has_vector_confirmation(candidate, sources)
            and cls._has_reliable_lexical_source(sources)
            and float(candidate.vector_score or 0.0) >= 0.70
            and float(candidate.lexical_score or 0.0) >= 0.60
        )

    @classmethod
    def _is_alias_or_bm25_only_without_vector(
        cls,
        candidate: MappingCandidate,
        sources: set[str],
    ) -> bool:
        if cls._has_vector_confirmation(candidate, sources):
            return False
        if "exact" in sources:
            return False
        return bool(sources.intersection({"alias", "bm25_nodes", "bm25_aliases"}))

    @staticmethod
    def _score_to_label(score: float | None) -> str:
        if score is None:
            return "unknown"
        if score >= 0.85:
            return "high"
        if score >= 0.60:
            return "medium"
        if score >= 0.40:
            return "low"
        return "very_low"

    def _apply_rule_based_decision(self, result: MappingResult) -> MappingResult:
        candidates = list(result.candidates or [])

        if not candidates:
            result.selected_candidate = None
            result.decision = "reject"
            result.confidence_label = "very_low"
            result.decision_score = 0.0
            result.decision_reason = "low_confidence_reject"
            return result

        scored = [
            (candidate, self._compute_candidate_confidence(candidate))
            for candidate in candidates
        ]
        scored.sort(key=lambda item: item[1], reverse=True)

        top_candidate, top_score = scored[0]

        result.selected_candidate = top_candidate
        result.decision_score = round(top_score, 4)
        result.confidence_label = self._score_to_label(top_score)

        sources = self._parse_sources(top_candidate.source)

        if self._is_high_confidence_exact(top_candidate, sources):
            result.decision = "auto_accept"
            result.decision_score = max(result.decision_score or 0.0, 0.98)
            result.confidence_label = self._score_to_label(result.decision_score)
            result.decision_reason = "exact_match_high_confidence"
            return result

        if self._is_high_confidence_local_alias(top_candidate, sources):
            result.decision = "auto_accept"
            result.decision_score = max(result.decision_score or 0.0, 0.95)
            result.confidence_label = self._score_to_label(result.decision_score)
            result.decision_reason = "local_alias_high_confidence"
            return result

        if self._has_bm25_vector_agreement(top_candidate, sources):
            result.decision = "auto_accept"
            result.decision_score = max(result.decision_score or 0.0, 0.85)
            result.confidence_label = self._score_to_label(result.decision_score)
            result.decision_reason = "bm25_vector_agreement"
            return result

        if top_score < 0.50:
            result.decision = "reject"
            result.decision_reason = "low_confidence_reject"
            return result

        if self._is_alias_or_bm25_only_without_vector(top_candidate, sources):
            result.decision = "manual_review"
            result.decision_reason = "bm25_alias_only_without_vector_confirmation"
            return result

        result.decision = "manual_review"
        result.decision_reason = "ambiguous_candidates_requires_review"
        return result

    def _apply_llm_fallback(
        self,
        result: MappingResult,
        *,
        entity_types: Sequence[str] | None,
    ) -> MappingResult:
        if not settings.llm_fallback_enabled:
            return result

        if result.decision != "manual_review":
            return result

        if not self.llm_reranker.is_available():
            result.decision_reason = (
                f"{result.decision_reason or ''} LLM fallback unavailable for provider "
                f"'{self.llm_reranker.provider}'."
            ).strip()
            return result

        llm_candidates = list(result.candidates[:5])
        original_selected = result.selected_candidate
        original_score = result.decision_score
        original_confidence_label = result.confidence_label
        original_reason = result.decision_reason
        result.used_fallback = True
        result.fallback_provider = self.llm_reranker.provider

        try:
            llm_decision = self.llm_reranker.rerank(
                raw_text=result.raw_text,
                entity_types=entity_types,
                candidates=llm_candidates,
            )
        except Exception as exc:
            result.decision_reason = (
                f"{result.decision_reason or ''} LLM fallback error: {exc}"
            ).strip()
            return result

        result.fallback_provider = llm_decision.provider

        if llm_decision.selected_rank == 0 or llm_decision.decision == "reject":
            result.selected_candidate = original_selected
            result.decision = "manual_review"
            result.decision_score = original_score
            result.confidence_label = original_confidence_label
            result.decision_reason = original_reason or "ambiguous_candidates_requires_review"
            return result

        if llm_decision.selected_rank and 1 <= llm_decision.selected_rank <= len(llm_candidates):
            selected = llm_candidates[llm_decision.selected_rank - 1]

            if llm_decision.decision == "accept" and (llm_decision.confidence or 0.0) >= settings.reject_score:
                result.selected_candidate = selected
                result.decision_score = llm_decision.confidence or result.decision_score
                result.confidence_label = self._score_to_label(result.decision_score)
                result.decision = "llm_accept"
                result.decision_reason = "llm_confirmed_candidate"
            else:
                result.selected_candidate = original_selected
                result.decision_score = original_score
                result.confidence_label = original_confidence_label
                result.decision = "manual_review"
                result.decision_reason = original_reason or "ambiguous_candidates_requires_review"
            return result

        result.decision_reason = (
            f"{result.decision_reason or ''} LLM fallback returned an invalid selection."
        ).strip()
        return result

    def map_text_to_rtmc(
        self,
        text: str,
        *,
        entity_types: Sequence[str] | None = None,
        top_k_each: int = 10,
        top_k_final: int = 10,
        include_vector: bool = True,
        allow_llm_fallback: bool = True,
    ) -> MappingResult:
        initial = self.hybrid_retriever.map_query(
            text,
            top_k_each=top_k_each,
            top_k_final=top_k_final,
            entity_types=entity_types,
            include_vector=include_vector,
        )

        result = self._apply_rule_based_decision(initial)

        if allow_llm_fallback:
            result = self._apply_llm_fallback(
                result,
                entity_types=entity_types,
            )

        return result


_DEFAULT_SERVICE: MapperService | None = None


def get_mapper_service() -> MapperService:
    global _DEFAULT_SERVICE
    if _DEFAULT_SERVICE is None:
        _DEFAULT_SERVICE = MapperService()
    return _DEFAULT_SERVICE


def map_text_to_rtmc(
    text: str,
    *,
    entity_types: Sequence[str] | None = None,
    top_k_each: int = 10,
    top_k_final: int = 10,
    include_vector: bool = True,
    allow_llm_fallback: bool = True,
) -> MappingResult:
    service = get_mapper_service()
    return service.map_text_to_rtmc(
        text,
        entity_types=entity_types,
        top_k_each=top_k_each,
        top_k_final=top_k_final,
        include_vector=include_vector,
        allow_llm_fallback=allow_llm_fallback,
    )


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Demo du service de mapping RTMC.")
    parser.add_argument("query", nargs="+", help="Texte a mapper.")
    parser.add_argument("--types", nargs="*", default=None, help="Filtre taxonomy_type.")
    parser.add_argument("--top-k-each", type=int, default=5, help="Top-K par retriever.")
    parser.add_argument("--top-k-final", type=int, default=5, help="Top-K final apres RRF.")
    parser.add_argument("--no-vector", action="store_true", help="Desactive la recherche vectorielle.")
    parser.add_argument("--no-llm", action="store_true", help="Desactive le fallback LLM.")
    return parser.parse_args()


def _normalize_types(values: Sequence[str] | None) -> list[str] | None:
    if not values:
        return None

    out = []
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


def main() -> None:
    args = _parse_args()
    query = " ".join(args.query).strip()
    entity_types = _normalize_types(args.types)

    result = map_text_to_rtmc(
        query,
        entity_types=entity_types,
        top_k_each=args.top_k_each,
        top_k_final=args.top_k_final,
        include_vector=not args.no_vector,
        allow_llm_fallback=not args.no_llm,
    )

    print("=" * 72)
    print("  RTMC MAPPING SERVICE")
    print("=" * 72)
    print(f"Query             : {result.raw_text}")
    print(f"Normalized query  : {result.normalized_text}")
    print(f"Decision          : {result.decision}")
    print(f"Confidence label  : {result.confidence_label}")
    print(f"Decision score    : {result.decision_score}")
    print(f"Used fallback     : {result.used_fallback}")
    print(f"Fallback provider : {result.fallback_provider}")
    print(f"Reason            : {result.decision_reason}")

    print("\n[SELECTED]")
    if result.selected_candidate is None:
        print("  None")
    else:
        candidate = result.selected_candidate
        print(
            f"  {candidate.entity_type} | {candidate.entity_code or '-'} | {candidate.label} | "
            f"lex={candidate.lexical_score} | vec={candidate.vector_score} | rrf={candidate.final_score} | src={candidate.source}"
        )

    print("\n[CANDIDATES]")
    if not result.candidates:
        print("  Aucun candidat.")
    else:
        for idx, candidate in enumerate(result.candidates, start=1):
            print(
                f"  {idx:>2}. {candidate.entity_type:<10} {candidate.entity_code or '-':<18} {candidate.label}"
            )
            print(
                f"      lex={candidate.lexical_score} vec={candidate.vector_score} "
                f"rrf={candidate.final_score} src={candidate.source}"
            )

    print("\n" + "=" * 72)
    print("  FIN SERVICE MAPPING")
    print("=" * 72)


if __name__ == "__main__":
    main()
