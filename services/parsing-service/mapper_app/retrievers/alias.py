from typing import List, Sequence

from sqlalchemy import text

from mapper_app.db import engine
from mapper_app.normalizer import normalize_text
from mapper_app.retrievers.common import (
    build_candidate,
    dedupe_candidates,
    fetch_nodes_by_codes,
    load_manual_alias_index,
)
from mapper_app.schemas import MappingCandidate


class AliasRetriever:
    """
    Alias lookup using RTMC appellations and an optional local aliases.json file.
    """

    def __init__(self):
        self._manual_alias_index = None

    @property
    def manual_alias_index(self):
        if self._manual_alias_index is None:
            self._manual_alias_index = load_manual_alias_index()
        return self._manual_alias_index

    def _search_manual_aliases(
        self,
        normalized_query: str,
        top_k: int,
        entity_types: Sequence[str] | None = None,
    ) -> List[MappingCandidate]:
        matches = self.manual_alias_index.get(normalized_query, [])
        if not matches:
            return []

        candidates: List[MappingCandidate] = []

        for item in matches:
            if not isinstance(item, dict):
                continue

            entity_type = str(item.get("taxonomy_type") or item.get("entity_type") or "occupation").strip()
            if entity_types and entity_type not in entity_types:
                continue

            code = str(item.get("code") or item.get("entity_code") or "").strip()
            label = str(item.get("label") or item.get("canonical_label") or normalized_query).strip()
            normalized_label = item.get("normalized_label") or normalize_text(label)

            if code:
                try:
                    canonical_map = fetch_nodes_by_codes([code], taxonomy_type=entity_type)
                except Exception:
                    canonical_map = {}
                canonical = canonical_map.get(code)
                if canonical:
                    candidates.append(
                        build_candidate(
                            entity_type=canonical["taxonomy_type"],
                            entity_id=canonical["id"],
                            entity_code=canonical["code"],
                            label=canonical["label"],
                            normalized_label=canonical.get("normalized_label"),
                            lexical_score=0.96,
                            source="alias_file",
                        )
                    )
                    continue

            candidates.append(
                build_candidate(
                    entity_type=entity_type,
                    entity_code=code or None,
                    label=label,
                    normalized_label=normalized_label,
                    lexical_score=0.96,
                    source="alias_file",
                )
            )

        return dedupe_candidates(candidates)[:top_k]

    def _search_appellations(
        self,
        raw_query: str,
        normalized_query: str,
        top_k: int,
        entity_types: Sequence[str] | None = None,
    ) -> List[MappingCandidate]:
        if entity_types and "occupation" not in entity_types:
            return []

        query = text(
            """
            SELECT
                n.id,
                n.taxonomy_type,
                n.code,
                n.label,
                n.normalized_label,
                n.source_kind,
                a.libelle_appellation,
                a.normalized_label AS alias_normalized_label,
                CASE
                    WHEN a.normalized_label = :normalized_query THEN 0.94
                    WHEN lower(a.libelle_appellation) = lower(:raw_query) THEN 0.92
                    ELSE 0.90
                END AS lexical_score
            FROM rtmc_appellation a
            JOIN rtmc_node n
              ON n.code = a.code_metier
             AND n.taxonomy_type = 'occupation'
            WHERE (
                a.normalized_label = :normalized_query
                OR lower(a.libelle_appellation) = lower(:raw_query)
            )
            ORDER BY lexical_score DESC, n.id ASC
            LIMIT :limit
            """
        )

        with engine.connect() as conn:
            rows = conn.execute(
                query,
                {
                    "raw_query": raw_query,
                    "normalized_query": normalized_query,
                    "limit": int(top_k),
                },
            ).mappings().all()

        candidates = [
            build_candidate(
                entity_type=row["taxonomy_type"],
                entity_id=row["id"],
                entity_code=row["code"],
                label=row["label"],
                normalized_label=row.get("normalized_label"),
                lexical_score=row.get("lexical_score"),
                source="alias_db",
            )
            for row in rows
        ]

        return dedupe_candidates(candidates)[:top_k]

    def search(
        self,
        query_text: str,
        top_k: int = 10,
        entity_types: Sequence[str] | None = None,
    ) -> List[MappingCandidate]:
        raw_query = str(query_text or "").strip()
        normalized_query = normalize_text(raw_query)
        if not normalized_query:
            return []

        candidates = []
        manual_candidates = self._search_manual_aliases(
            normalized_query,
            top_k=top_k,
            entity_types=entity_types,
        )
        if manual_candidates:
            return manual_candidates[:top_k]

        candidates.extend(manual_candidates)
        candidates.extend(
            self._search_appellations(
                raw_query,
                normalized_query,
                top_k=top_k,
                entity_types=entity_types,
            )
        )

        candidates = dedupe_candidates(candidates)
        candidates.sort(key=lambda item: item.lexical_score or 0.0, reverse=True)
        return candidates[:top_k]
