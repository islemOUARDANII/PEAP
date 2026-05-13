from __future__ import annotations

from typing import Any, Dict, List


def _build_offer_filters(
    *,
    contract_type: str | None = None,
    work_mode: str | None = None,
    governorate: str | None = None,
    salary_min: float | None = None,
    salary_max: float | None = None,
) -> List[Dict[str, Any]]:
    filters: List[Dict[str, Any]] = [
        {"terms": {"status": ["PUBLISHED", "ACTIVE"]}},
    ]

    if contract_type:
        filters.append({"term": {"contract_type": contract_type}})

    if work_mode:
        filters.append({"term": {"work_mode": work_mode}})

    if governorate:
        filters.append(
            {
                "bool": {
                    "should": [
                        {"term": {"governorate_code": governorate}},
                        {"term": {"governorate": governorate.upper()}},
                        {"term": {"governorate": governorate}},
                        {"wildcard": {"location": {"value": f"*{governorate.upper()}*", "case_insensitive": True}}},
                    ],
                    "minimum_should_match": 1,
                }
            }
        )

    if salary_min is not None:
        filters.append({"range": {"salary_max": {"gte": salary_min}}})

    if salary_max is not None:
        filters.append({"range": {"salary_min": {"lte": salary_max}}})

    return filters


def build_offers_search_query(
    query_text: str,
    query_vector: List[float],
    size: int = 20,
    from_: int = 0,
    contract_type: str | None = None,
    work_mode: str | None = None,
    governorate: str | None = None,
    salary_min: float | None = None,
    salary_max: float | None = None,
) -> Dict[str, Any]:
    """
    Hybrid search: kNN semantic + BM25 keyword.
    À appeler uniquement avec un query_vector valide et non nul.
    """
    vec_boost = 4.0
    kw_boost = 3.0

    filters = _build_offer_filters(
        contract_type=contract_type,
        work_mode=work_mode,
        governorate=governorate,
        salary_min=salary_min,
        salary_max=salary_max,
    )

    knn_filter = {"bool": {"filter": filters}}

    return {
        "size": size,
        "from": from_,
        "min_score": 0.1,
        "knn": {
            "field": "embedding",
            "query_vector": query_vector,
            "k": max(size * 2, 10),
            "num_candidates": max(size * 10, 50),
            "similarity": 0.35,
            "boost": vec_boost,
            "filter": knn_filter,
        },
        "query": {
            "bool": {
                "filter": filters,
                "should": [
                    {
                        "multi_match": {
                            "query": query_text,
                            "fields": [
                                "title^3",
                                "skills^2",
                                "occupations^2",
                                "description",
                                "location",
                            ],
                            "type": "best_fields",
                            "fuzziness": "AUTO",
                            "prefix_length": 1,
                            "max_expansions": 50,
                            "minimum_should_match": "60%",
                            "boost": kw_boost,
                        }
                    }
                ],
                "minimum_should_match": 0,
            }
        },
        "_source": {"excludes": ["embedding"]},
    }


def build_offers_keyword_only_query(
    query_text: str,
    *,
    size: int = 20,
    from_: int = 0,
    contract_type: str | None = None,
    work_mode: str | None = None,
    governorate: str | None = None,
    salary_min: float | None = None,
    salary_max: float | None = None,
) -> Dict[str, Any]:
    """
    Fallback si embedding indisponible ou vecteur nul.
    """
    filters = _build_offer_filters(
        contract_type=contract_type,
        work_mode=work_mode,
        governorate=governorate,
        salary_min=salary_min,
        salary_max=salary_max,
    )

    return {
        "from": from_,
        "size": size,
        "query": {
            "bool": {
                "must": [
                    {
                        "multi_match": {
                            "query": query_text,
                            "fields": [
                                "title^4",
                                "description",
                                "skills^3",
                                "occupations^2",
                                "location",
                                "contract_type",
                            ],
                            "type": "best_fields",
                            "fuzziness": "AUTO",
                            "minimum_should_match": "50%",
                        }
                    }
                ],
                "filter": filters,
            }
        },
        "_source": {"excludes": ["embedding"]},
    }


def build_offers_match_all_query(
    *,
    size: int = 20,
    from_: int = 0,
    contract_type: str | None = None,
    work_mode: str | None = None,
    governorate: str | None = None,
    salary_min: float | None = None,
    salary_max: float | None = None,
) -> Dict[str, Any]:
    """
    Query vide : retourner toutes les offres publiées/actives.
    """
    filters = _build_offer_filters(
        contract_type=contract_type,
        work_mode=work_mode,
        governorate=governorate,
        salary_min=salary_min,
        salary_max=salary_max,
    )

    return {
        "from": from_,
        "size": size,
        "query": {
            "bool": {
                "must": [{"match_all": {}}],
                "filter": filters,
            }
        },
        "sort": [
            {"created_at": {"order": "desc", "missing": "_last"}},
            {"updated_at": {"order": "desc", "missing": "_last"}},
        ],
        "_source": {"excludes": ["embedding"]},
    }