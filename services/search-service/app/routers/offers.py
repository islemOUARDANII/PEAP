"""
POST /search/offers

Input  : { "query": "python backend api", "size": 20 }
Logic  : embed(query) → ES hybrid (BM25 + kNN)
Output : ranked offers list
"""

from __future__ import annotations

import logging
from typing import List, Optional

import psycopg2.extras
from fastapi import APIRouter, HTTPException

from pydantic import BaseModel, Field

from app.config import settings
from app.embeddings import embed_text
from app.es_client import get_client
from app.pg_pool import get_conn
from app.queries.offers import build_offers_keyword_only_query, build_offers_search_query, build_offers_match_all_query

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class OfferDetail(BaseModel):
    offer_id: str
    company_id: str
    status: str
    title: str
    description: str
    location: str
    contract_type: str
    skills: List[str]
    created_at: Optional[str]
    updated_at: Optional[str]


class OfferSearchRequest(BaseModel):
    query: str = Field(default="", max_length=500, description="Texte de recherche")
    size: int = Field(default=20, ge=1, le=100)
    from_: int = Field(default=0, ge=0, description="Offset pour la pagination")
    contract_type: Optional[str] = Field(default=None, description="CDI, CDD, STAGE, SIVP...")
    work_mode: Optional[str] = Field(default=None, description="REMOTE, HYBRID, ONSITE...")
    governorate: Optional[str] = Field(default=None, description="Gouvernorat ex: Tunis, Sfax")
    salary_min: Optional[int] = Field(default=None, ge=0, description="Salaire minimum (DT)")
    salary_max: Optional[int] = Field(default=None, ge=0, description="Salaire maximum (DT)")


class OfferHit(BaseModel):
    offer_id: str
    title: str
    description: str
    skills: List[str]
    location: str
    contract_type: str
    company_id: str
    score: float
    created_at: Optional[str]


class OfferSearchResponse(BaseModel):
    total: int
    results: List[OfferHit]
    query: str
    mode: str                   # "hybrid" ou "keyword_only"


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


def _is_valid_vector(vector: list[float] | None) -> bool:
    if not vector:
        return False

    return any(abs(float(value)) > 1e-12 for value in vector)

@router.post(
    "/search/offers",
    response_model=OfferSearchResponse,
    summary="Recherche d'offres",
    tags=["Offers"],
)
def search_offers(
    body: OfferSearchRequest,
) -> OfferSearchResponse:
    """
    Recherche sur les offres :
    - query vide        => retourne toutes les offres publiées/actives
    - embedding invalide => fallback keyword-only
    - embedding valide  => recherche hybride keyword + vector
    """
    client = get_client()

    query_text = (body.query or "").strip()
    mode = "hybrid"

    try:
        if not query_text:
            es_query = build_offers_match_all_query(
                size=body.size,
                from_=body.from_,
                contract_type=body.contract_type,
                work_mode=body.work_mode,
                governorate=body.governorate,
                salary_min=body.salary_min,
                salary_max=body.salary_max,
            )
            mode = "match_all"

        else:
            query_vector = None

            try:
                query_vector = embed_text(query_text)
            except Exception as exc:
                logger.warning("Embedding indisponible, fallback keyword-only: %s", exc)

            if not _is_valid_vector(query_vector):
                es_query = build_offers_keyword_only_query(
                    query_text=query_text,
                    size=body.size,
                    from_=body.from_,
                    contract_type=body.contract_type,
                    work_mode=body.work_mode,
                    governorate=body.governorate,
                    salary_min=body.salary_min,
                    salary_max=body.salary_max,
                )
                mode = "keyword_only"
            else:
                es_query = build_offers_search_query(
                    query_text=query_text,
                    query_vector=query_vector,
                    size=body.size,
                    from_=body.from_,
                    contract_type=body.contract_type,
                    work_mode=body.work_mode,
                    governorate=body.governorate,
                    salary_min=body.salary_min,
                    salary_max=body.salary_max,
                )
                mode = "hybrid"

        resp = client.search(index=settings.es_index_offers, body=es_query)

    except Exception as exc:
        logger.error("ES search error: %s", exc)
        raise HTTPException(status_code=503, detail=f"Search unavailable: {exc}")

    hits = resp["hits"]["hits"]
    total = resp["hits"]["total"]["value"]

    max_score = resp["hits"]["max_score"] or 1.0

    results = [
        OfferHit(
            offer_id=h["_source"].get("offer_id", h["_id"]),
            title=h["_source"].get("title", ""),
            description=h["_source"].get("description", ""),
            skills=h["_source"].get("skills", []),
            location=h["_source"].get("location", ""),
            contract_type=h["_source"].get("contract_type", ""),
            company_id=h["_source"].get("company_id", ""),
            score=round((h["_score"] or 0.0) / max_score * 100, 1),
            created_at=h["_source"].get("created_at"),
        )
        for h in hits
    ]

    return OfferSearchResponse(
        total=total,
        results=results,
        query=query_text,
        mode=mode,
    )


_OFFER_DETAIL_QUERY = """
SELECT
    o.id            AS offer_id,
    o.employer_id   AS company_id,
    o.status,
    o.title,
    o.description,
    COALESCE(
        NULLIF(TRIM(
            COALESCE(o.governorate_code, '')
            || CASE WHEN o.delegation_code IS NOT NULL THEN ', ' || o.delegation_code ELSE '' END
        ), ', '),
        o.governorate_code,
        o.delegation_code,
        ''
    )               AS location,
    o.contract_type,
    o.created_at,
    o.updated_at,
    COALESCE(
        array_agg(DISTINCT r.raw_value) FILTER (
            WHERE r.criterion_type = 'SKILL' AND r.raw_value IS NOT NULL
        ),
        '{}'
    )               AS skills
FROM aneti.job_offer o
LEFT JOIN aneti.job_offer_requirement r ON r.offer_id = o.id
WHERE o.id = %(offer_id)s
GROUP BY o.id, o.employer_id, o.governorate_code, o.delegation_code
"""


@router.get(
    "/offers/{offer_id}",
    response_model=OfferDetail,
    summary="Détail complet d'une offre (depuis PostgreSQL)",
    tags=["Offers"],
)
def get_offer(offer_id: str) -> OfferDetail:
    try:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(_OFFER_DETAIL_QUERY, {"offer_id": offer_id})
                row = cur.fetchone()
    except Exception as exc:
        logger.error("PostgreSQL error: %s", exc)
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}")

    if row is None:
        raise HTTPException(status_code=404, detail="Offer not found")

    return OfferDetail(
        offer_id=str(row["offer_id"]),
        company_id=str(row["company_id"]),
        status=row["status"],
        title=row["title"] or "",
        description=row["description"] or "",
        location=row["location"] or "",
        contract_type=row["contract_type"] or "",
        skills=list(row["skills"] or []),
        created_at=row["created_at"].isoformat() if row["created_at"] else None,
        updated_at=row["updated_at"].isoformat() if row["updated_at"] else None,
    )
