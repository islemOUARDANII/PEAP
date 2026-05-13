import json
import pickle
from pathlib import Path
from typing import Dict, Iterable, List, Sequence, Tuple

from mapper_app.config import settings
from mapper_app.normalizer import normalize_text
from mapper_app.schemas import MappingCandidate


def clamp_score(value, lower: float | None = None, upper: float | None = None) -> float | None:
    if value is None:
        return None
    score = float(value)
    if lower is not None:
        score = max(lower, score)
    if upper is not None:
        score = min(upper, score)
    return score


def build_candidate(
    *,
    entity_type: str,
    entity_id=None,
    entity_code=None,
    label: str,
    normalized_label: str | None = None,
    lexical_score=None,
    vector_score=None,
    final_score=None,
    source: str | None = None,
) -> MappingCandidate:
    clean_label = str(label or "").strip()
    clean_code = str(entity_code).strip() if entity_code is not None else None
    return MappingCandidate(
        entity_type=str(entity_type or "").strip(),
        entity_id=int(entity_id) if entity_id is not None else None,
        entity_code=clean_code or None,
        label=clean_label,
        normalized_label=(normalized_label or normalize_text(clean_label) or None),
        lexical_score=clamp_score(lexical_score),
        vector_score=clamp_score(vector_score),
        final_score=clamp_score(final_score),
        source=source,
    )


def candidate_identity(candidate: MappingCandidate) -> Tuple[str, str]:
    entity_type = str(candidate.entity_type or "").strip()
    entity_code = str(candidate.entity_code or "").strip()
    if entity_code:
        return entity_type, entity_code
    fallback = normalize_text(candidate.label or "")
    return entity_type, fallback


def dedupe_candidates(candidates: Iterable[MappingCandidate]) -> List[MappingCandidate]:
    best_by_key: Dict[Tuple[str, str], MappingCandidate] = {}

    for candidate in candidates:
        key = candidate_identity(candidate)
        current = best_by_key.get(key)

        candidate_score = (
            candidate.final_score
            if candidate.final_score is not None
            else candidate.lexical_score
            if candidate.lexical_score is not None
            else candidate.vector_score
            if candidate.vector_score is not None
            else 0.0
        )
        current_score = (
            current.final_score
            if current and current.final_score is not None
            else current.lexical_score
            if current and current.lexical_score is not None
            else current.vector_score
            if current and current.vector_score is not None
            else 0.0
        )

        if current is None or candidate_score > current_score:
            best_by_key[key] = candidate

    return list(best_by_key.values())


def load_pickle(path: Path):
    with open(path, "rb") as fh:
        return pickle.load(fh)


def load_manual_alias_index() -> Dict[str, List[dict]]:
    path = settings.aliases_full_path
    if not path.exists():
        return {}

    with open(path, "r", encoding="utf-8") as fh:
        payload = json.load(fh)

    alias_index: Dict[str, List[dict]] = {}

    def add_alias(alias_value, item: dict) -> None:
        alias = normalize_text(str(alias_value or ""))
        if not alias:
            return
        alias_index.setdefault(alias, []).append(item)

    if isinstance(payload, dict):
        entries = payload.get("aliases")
        if isinstance(entries, list):
            payload = entries
        else:
            for alias_key, value in payload.items():
                if isinstance(value, list):
                    for item in value:
                        if isinstance(item, dict):
                            add_alias(alias_key, item)
                        else:
                            add_alias(alias_key, {"code": item})
                elif isinstance(value, dict):
                    add_alias(alias_key, value)
                else:
                    add_alias(alias_key, {"code": value})
            return alias_index

    if isinstance(payload, list):
        for item in payload:
            if not isinstance(item, dict):
                continue
            alias_value = item.get("alias") or item.get("label") or item.get("source")
            add_alias(alias_value, item)

    return alias_index


def fetch_nodes_by_codes(codes: Sequence[str], taxonomy_type: str | None = None) -> Dict[str, dict]:
    from sqlalchemy import bindparam, text

    from mapper_app.db import engine

    clean_codes = [str(code).strip() for code in codes if str(code).strip()]
    if not clean_codes:
        return {}

    sql = """
        SELECT id, taxonomy_type, code, label, normalized_label, source_kind
        FROM rtmc_node
        WHERE code IN :codes
    """
    params = {"codes": clean_codes}

    if taxonomy_type:
        sql += " AND taxonomy_type = :taxonomy_type"
        params["taxonomy_type"] = taxonomy_type

    query = text(sql).bindparams(bindparam("codes", expanding=True))

    with engine.connect() as conn:
        rows = conn.execute(query, params).mappings().all()

    return {str(row["code"]): dict(row) for row in rows}
