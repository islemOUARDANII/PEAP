from __future__ import annotations

from typing import Any, Dict, List, Optional


def build_candidates_filter_query(
    query_text: Optional[str] = None,
    years_experience: Optional[int] = None,
    education: Optional[str] = None,
    skills: Optional[List[str]] = None,
    location: Optional[str] = None,
    governorate: Optional[str] = None,
    governorate_code: Optional[str] = None,
    size: int = 20,
    from_: int = 0,
) -> Dict[str, Any]:

    filters: List[Dict[str, Any]] = [
        {"term": {"status": "ACTIVE"}},
    ]

    should: List[Dict[str, Any]] = []

    if years_experience is not None:
        filters.append({
            "range": {"years_experience": {"gte": years_experience}}
        })

    if location:
        filters.append({
            "bool": {
                "should": [
                    {"match": {"location": {"query": location, "fuzziness": "AUTO"}}},
                    {"term": {"governorate": location.upper()}},
                    {"term": {"governorate": location}},
                ],
                "minimum_should_match": 1,
            }
        })

    # Education : filtre strict (keyword normalisé en minuscules)
    if education:
        filters.append({"term": {"education": education.lower()}})

    # Texte libre : recherche sur skills uniquement en OR
    if query_text:
        should.append({
            "multi_match": {
                "query": query_text,
                "fields": ["skills^2"],
                "type": "best_fields",
                "fuzziness": "AUTO",
                "minimum_should_match": "60%",
            }
        })

    if skills:
        for skill in skills:
            should.append({
                "match": {"skills": {"query": skill, "fuzziness": "AUTO"}}
            })

    if governorate:
        filters.append({
            "bool": {
                "should": [
                    {"match": {"governorate": {"query": governorate, "fuzziness": "AUTO"}}},
                    {"match": {"location": {"query": governorate, "fuzziness": "AUTO"}}},
                    {"term": {"governorate.keyword": governorate}},
                    {"term": {"governorate": governorate}},
                    {"term": {"governorate": governorate.upper()}},
                ],
                "minimum_should_match": 1,
            }
        })

    if governorate_code:
        filters.append({
            "bool": {
                "should": [
                    {"term": {"governorate_code": governorate_code}},
                    {"term": {"governorate_code.keyword": governorate_code}},
                ],
                "minimum_should_match": 1,
            }
        })
        
    query: Dict[str, Any] = {"bool": {"filter": filters}}
    if should:
        query["bool"]["should"] = should
        query["bool"]["minimum_should_match"] = 1

    return {
        "size": size,
        "from": from_,
        "query": query,
        "sort": [{"_score": "desc"}, {"updated_at": "desc"}],
        "_source": True,
    }


def build_candidates_strict_skills_query(
    skills: List[str],
    size: int = 20,
) -> Dict[str, Any]:

    filters: List[Dict[str, Any]] = [
        {"term": {"status": "active"}}
    ]

    for skill in skills:
        filters.append({
            "term": {"skills.keyword": skill}
        })

    return {
        "size": size,
        "query": {
            "bool": {
                "filter": filters
            }
        },
        "_source": True,
    }