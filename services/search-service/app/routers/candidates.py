"""
POST /search/candidates

Input  : { "filters": { "years_experience": 3, "skills": ["python"], "education": "master", "location": "Paris" } }
Logic  : Elasticsearch bool filter query (pas de scoring sémantique au MVP)
Output : liste de candidats matchant les filtres
"""

from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import settings
from app.es_client import get_client
from app.queries.candidates import build_candidates_filter_query

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class CandidateFilters(BaseModel):
    query: Optional[str] = Field(
        default=None,
        max_length=300,
        description="Texte libre : ex. 'développeur Java Sfax expérimenté'",
    )
    years_experience: Optional[int] = Field(
        default=None,
        ge=0,
        description="Années d'expérience minimum",
    )
    education: Optional[str] = Field(
        default=None,
        description="Niveau d'éducation : bachelor, master, phd, engineer…",
    )
    skills: Optional[List[str]] = Field(
        default=None,
        description="Au moins un skill de cette liste",
    )
    location: Optional[str] = Field(
        default=None,
        description="Ville / région (fuzzy)",
    )
    size: int = Field(default=20, ge=1, le=100)
    from_: int = Field(default=0, ge=0, description="Offset pour la pagination")


class CandidateSearchRequest(BaseModel):
    filters: CandidateFilters


class CandidateHit(BaseModel):
    candidate_id: str
    years_experience: int
    education: str
    skills: List[str]
    location: str
    primary_lang: str
    created_at: Optional[str]


class CandidateSearchResponse(BaseModel):
    total: int
    results: List[CandidateHit]
    filters_applied: dict


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post(
    "/search/candidates",
    response_model=CandidateSearchResponse,
    summary="Recherche de candidats par filtres structurés",
    tags=["Search"],
)
def search_candidates(
    body: CandidateSearchRequest,
) -> CandidateSearchResponse:
    """
    Recherche de candidats par filtres uniquement (MVP).
    Tous les filtres fournis sont appliqués en AND.
    Le filtre `skills` fonctionne en OR (au moins 1 skill matchant).

    Aucun scoring sémantique — les résultats sont triés par date de mise à jour.
    """
    f = body.filters
    client = get_client()

    es_query = build_candidates_filter_query(
        query_text=f.query,
        years_experience=f.years_experience,
        education=f.education,
        skills=f.skills,
        location=f.location,
        size=f.size,
        from_=f.from_,
    )

    try:
        resp = client.search(index=settings.es_index_candidates, body=es_query)
    except Exception as exc:
        logger.error("ES search error: %s", exc)
        raise HTTPException(status_code=503, detail=f"Search unavailable: {exc}")

    hits = resp["hits"]["hits"]
    total = resp["hits"]["total"]["value"]

    results = [
        CandidateHit(
            candidate_id=h["_source"].get("candidate_id", h["_id"]),
            years_experience=h["_source"].get("years_experience", 0),
            education=h["_source"].get("education", ""),
            skills=h["_source"].get("skills", []),
            location=h["_source"].get("location", ""),
            primary_lang=h["_source"].get("primary_lang", ""),
            created_at=h["_source"].get("created_at"),
        )
        for h in hits
    ]

    filters_applied = {
        k: v
        for k, v in {
            "query": f.query,
            "years_experience": f.years_experience,
            "education": f.education,
            "skills": f.skills,
            "location": f.location,
        }.items()
        if v is not None
    }

    return CandidateSearchResponse(
        total=total,
        results=results,
        filters_applied=filters_applied,
    )
