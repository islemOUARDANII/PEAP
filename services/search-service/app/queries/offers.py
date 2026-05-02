from __future__ import annotations

from typing import Any, Dict, List



def build_offers_search_query(
    query_text: str,
    query_vector: List[float],
    size: int = 20,
    from_: int = 0,
    contract_type: str = None,
    work_mode: str = None,
    governorate: str = None,
    salary_min: int = None,
    salary_max: int = None,
) -> Dict[str, Any]:
    """
    Hybrid search: kNN (semantic) + BM25 (keyword) combined.
vec_boost
    Score final = kNN_score *  + BM25_score * kw_boost
    min_score calibre sur vec_boost : cosine >= 0.55 avec vec_boost=8 → min ~4.5
    """
    # Calibration 70% semantic / 30% keyword
    # cosine score : range [0, 1]   → vec_boost = 7.0
    # BM25 score   : range [0, ~3]  → kw_boost  = 1.0  (3 * 1.0 ≈ 30% du max total)
    # Score max théorique : 1.0*7 + 3.0*1 = 10.0
    # Offre semantic pure  : 0.8*7 = 5.6  → 56% du max
    # Offre keyword exact  : 0.6*7 + 2.5*1 = 4.2+2.5 = 6.7 → 67% du max
    vec_boost = 4.0
    kw_boost  = 3.0

    # Filtres structurés optionnels (appliqués en AND)
    struct_filters: List[Dict[str, Any]] = [
        {"term": {"status": "PUBLISHED"}},
        {"exists": {"field": "skills"}},
    ]
    if contract_type:
        struct_filters.append({"term": {"contract_type": contract_type}})
    if work_mode:
        struct_filters.append({"term": {"work_mode": work_mode}})
    if governorate:
        struct_filters.append({"match": {"governorate": {"query": governorate, "fuzziness": "AUTO"}}})
    salary_range: Dict[str, Any] = {}
    if salary_min is not None:
        salary_range["gte"] = salary_min
    if salary_max is not None:
        salary_range["lte"] = salary_max
    if salary_range:
        struct_filters.append({"range": {"salary_min": salary_range}})

    knn_filter = {"bool": {"filter": struct_filters}}

    return {
        "size": size,
        "from": from_,
        "min_score": 0.5,
        "knn": {
            "field": "embedding",
            "query_vector": query_vector,
            "k": size * 2,
            "num_candidates": size * 10,
            "similarity": 0.60,
            "boost": vec_boost,
            "filter": knn_filter,
        },
        "query": {
            "bool": {
                "filter": struct_filters,
                "should": [
                    {
                        "multi_match": {
                            "query": query_text,
                            "fields": ["title^2", "skills^1.5", "occupations^1.5", "description^1"],
                            "type": "best_fields",
                            "fuzziness": "AUTO",
                            "prefix_length": 1,
                            "max_expansions": 50,
                            "minimum_should_match": "70%",
                            "boost": kw_boost,
                        }
                    }
                ],
            }
        },
        "_source": {"excludes": ["embedding"]},
    }


def build_offers_keyword_only_query(
    query_text: str,
    size: int = 20,
) -> Dict[str, Any]:
    """Fallback si embedding indisponible."""
    return {
        "size": size,
        "query": {
            "multi_match": {
                "query": query_text,
                "fields": ["title^3", "description^1", "skills^2"],
                "type": "best_fields",
                "fuzziness": "AUTO",
                "minimum_should_match": "60%",
            }
        },
        "_source": {"excludes": ["embedding"]},
    }
