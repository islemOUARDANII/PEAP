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
        total=total or len(results),
        results=results,
        query=query_text,
        mode=mode,
    )


_OFFER_DETAIL_QUERY = """
    SELECT
        o.id::text AS offer_id,
        o.employer_id::text AS company_id,
        o.status,
        o.title,
        o.description,

        country.iso2 AS country,
        COALESCE(country.name_fr, country.name_en, country.iso2) AS country_label,

        gov.code AS governorate_code,
        COALESCE(gov.label_fr, gov.label_en, gov.label, gov.code) AS governorate,

        del_unit.code AS delegation_code,
        COALESCE(del_unit.label_fr, del_unit.label_en, del_unit.label, del_unit.code) AS delegation,

        COALESCE(
            NULLIF(TRIM(CONCAT_WS(
                ', ',
                NULLIF(COALESCE(del_unit.label_fr, del_unit.label_en, del_unit.label, del_unit.code), ''),
                NULLIF(COALESCE(gov.label_fr, gov.label_en, gov.label, gov.code), ''),
                NULLIF(COALESCE(country.name_fr, country.name_en, country.iso2), '')
            )), ''),
            ''
        ) AS location,

        COALESCE(contract_ref.code, '') AS contract_type,
        COALESCE(contract_ref.label_fr, contract_ref.label_en, contract_ref.label, contract_ref.code, '') AS contract_type_label,

        COALESCE(work_ref.code, '') AS work_mode,
        COALESCE(work_ref.label_fr, work_ref.label_en, work_ref.label, work_ref.code, '') AS work_mode_label,

        o.salary_min,
        o.salary_max,
        o.salary_currency_code,

        o.occupation_node_id::text AS occupation_node_id,
        occupation.preferred_label AS occupation_label,

        o.min_experience_months,
        o.diploma_ref_id::text AS diploma_ref_id,
        COALESCE(diploma_ref.label_fr, diploma_ref.label_en, diploma_ref.label, diploma_ref.code) AS diploma_label,

        o.specialty_ref_id::text AS specialty_ref_id,
        COALESCE(specialty_ref.label_fr, specialty_ref.label_en, specialty_ref.label, specialty_ref.code) AS specialty_label,

        o.created_at,
        o.updated_at,
        o.published_at,
        o.deadline_at,

        COALESCE(
            (
                SELECT array_agg(DISTINCT term)
                FROM (
                    SELECT COALESCE(
                        n.preferred_label,
                        rv.label_fr,
                        rv.label_en,
                        rv.label,
                        rv.code
                    ) AS term
                    FROM aneti.job_offer_requirement r
                    LEFT JOIN reference.ref_value rv_ct
                        ON rv_ct.id = r.criterion_type_ref_id
                    LEFT JOIN taxonomy.taxonomy_node n
                        ON n.id = r.taxonomy_node_id
                    LEFT JOIN reference.ref_value rv
                        ON rv.id = r.ref_value_id
                    WHERE r.offer_id = o.id
                    AND (
                            rv_ct.code IN ('SKILL', 'SOFT_SKILL')
                            OR n.node_type IN ('SKILL', 'SOFT_SKILL')
                    )
                    AND COALESCE(
                            n.preferred_label,
                            rv.label_fr,
                            rv.label_en,
                            rv.label,
                            rv.code
                        ) IS NOT NULL
                    AND TRIM(COALESCE(
                            n.preferred_label,
                            rv.label_fr,
                            rv.label_en,
                            rv.label,
                            rv.code
                        )) <> ''
                ) q
            ),
            ARRAY[]::text[]
        ) AS skills

        FROM aneti.job_offer o

    LEFT JOIN geo.country country
        ON country.id = o.country_id

    LEFT JOIN geo.admin_unit gov
        ON gov.id = o.governorate_unit_id

    LEFT JOIN geo.admin_unit del_unit
        ON del_unit.id = o.delegation_unit_id

    LEFT JOIN taxonomy.taxonomy_node occupation
        ON occupation.id = o.occupation_node_id

    LEFT JOIN reference.ref_value contract_ref
        ON contract_ref.id = o.contract_type_ref_id

    LEFT JOIN reference.ref_value work_ref
        ON work_ref.id = o.work_mode_ref_id

    LEFT JOIN reference.ref_value diploma_ref
        ON diploma_ref.id = o.diploma_ref_id

    LEFT JOIN reference.ref_value specialty_ref
        ON specialty_ref.id = o.specialty_ref_id

    WHERE o.id = %(offer_id)s::uuid
    LIMIT 1;
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
        skills=list(row.get("skills") or []),
        created_at=row["created_at"].isoformat() if row["created_at"] else None,
        updated_at=row["updated_at"].isoformat() if row["updated_at"] else None,
    )
