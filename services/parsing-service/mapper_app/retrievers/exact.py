from typing import List, Sequence

from sqlalchemy import bindparam, text

from mapper_app.db import engine
from mapper_app.normalizer import normalize_text
from mapper_app.retrievers.common import build_candidate, dedupe_candidates
from mapper_app.schemas import MappingCandidate


class ExactRetriever:
    """
    Exact lookup on RTMC canonical nodes using code or normalized label.
    """

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

        sql = """
            SELECT
                id,
                taxonomy_type,
                code,
                label,
                normalized_label,
                source_kind,
                CASE
                    WHEN code = :raw_query THEN 1.0
                    WHEN normalized_label = :normalized_query THEN 0.97
                    WHEN lower(label) = lower(:raw_query) THEN 0.95
                    ELSE 0.90
                END AS lexical_score
            FROM rtmc_node
            WHERE (
                code = :raw_query
                OR normalized_label = :normalized_query
                OR lower(label) = lower(:raw_query)
            )
        """
        params = {
            "raw_query": raw_query,
            "normalized_query": normalized_query,
            "limit": int(top_k),
        }

        if entity_types:
            sql += " AND taxonomy_type IN :entity_types"

        sql += " ORDER BY lexical_score DESC, id ASC LIMIT :limit"

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
                lexical_score=row.get("lexical_score"),
                source="exact",
            )
            for row in rows
        ]

        candidates.sort(key=lambda item: item.lexical_score or 0.0, reverse=True)
        return dedupe_candidates(candidates)[:top_k]
