from typing import Any
from uuid import UUID

from fastapi import FastAPI, Depends, HTTPException
from prometheus_fastapi_instrumentator import Instrumentator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from app.contracts.schemas import MatchingExecutionRequest, MatchingExecutionResponse
from app.engines.scoring_adapter import compute_matching_score
from app.repositories.candidate_repository import load_candidate_payload
from app.repositories.offer_repository import load_offer_payload
from app.repositories.model_config_repository import load_model_config
from app.repositories.matching_repository import (
    delete_existing_results_for_run,
    insert_result,
    load_run,
    mark_run_completed,
    mark_run_failed,
    mark_run_started,
)

from sqlalchemy.orm import Session
from app.db.session import get_db
import os
from fastapi import Header, HTTPException, status
import logging

app = FastAPI(title="Matching Service", version="0.1.0")

Instrumentator().instrument(app).expose(app, endpoint="/metrics")

def require_internal_api_key(
    x_internal_api_key: str | None = Header(default=None),
    x_api_key: str | None = Header(default=None),
):
    expected = os.getenv("INTERNAL_API_KEY")
    provided = x_internal_api_key or x_api_key

    if expected and provided != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal API key",
        )
    
@app.get("/health")
def health():
    return {"status": "UP", "service": "matching-service"}


@app.get("/ready")
def ready():
    return {"status": "READY", "service": "matching-service"}


@app.post("/internal/matching/runs/{run_id}/execute", response_model=MatchingExecutionResponse)
def execute_matching(
    run_id: UUID,
    payload: MatchingExecutionRequest,
    db: Session = Depends(get_db),
    _auth=Depends(require_internal_api_key),
):
    try:
        run = load_run(db, run_id)
        run_parameters = run.get("parameters_json") or {}
        mark_run_started(db, run_id)
        delete_existing_results_for_run(db, run_id)

        model_config = load_model_config(db, run["model_version_id"])

        direction = {
            "OFFER_TO_CANDIDATES": "OFFER_TO_CANDIDATE",
            "CANDIDATE_TO_OFFERS": "CANDIDATE_TO_OFFER",
        }.get(run["direction"], run["direction"])
        source_entity_type = run["source_entity_type"]
        source_entity_id = UUID(str(run["source_entity_id"]))

        results_count = 0

        if direction == "CANDIDATE_TO_OFFER":
            candidate = load_candidate_payload(db, source_entity_id)
            offers = _load_candidate_target_offers(db, run_parameters)

            scored = []
            for offer in offers:
                score = compute_matching_score(candidate, offer, model_config)
                scored.append((offer, score))

            scored.sort(key=lambda item: item[1]["score_global"], reverse=True)

            for rank, (offer, score) in enumerate(scored, start=1):
                insert_result(
                    db=db,
                    run_id=run_id,
                    candidate_id=source_entity_id,
                    offer_id=UUID(str(offer["id"])),
                    rank=rank,
                    scoring=score,
                )
                results_count += 1

        elif direction == "OFFER_TO_CANDIDATE":
            offer = load_offer_payload(db, source_entity_id)
            candidates = _load_offer_target_candidates(db, run_parameters)

            scored = []
            for candidate in candidates:
                score = compute_matching_score(candidate, offer, model_config)
                scored.append((candidate, score))

            scored.sort(key=lambda item: item[1]["score_global"], reverse=True)

            for rank, (candidate, score) in enumerate(scored, start=1):
                insert_result(
                    db=db,
                    run_id=run_id,
                    candidate_id=UUID(str(candidate["id"])),
                    offer_id=source_entity_id,
                    rank=rank,
                    scoring=score,
                )
                results_count += 1

        else:
            raise ValueError(f"Unsupported matching direction: {direction}")

        mark_run_completed(db, run_id)
        db.commit()

        return MatchingExecutionResponse(
            run_id=run_id,
            status="COMPLETED",
            results_count=results_count,
            results=[],
            warnings=[],
        )

    except ValueError as exc:
        db.rollback()
        try:
            mark_run_failed(db, run_id, str(exc))
            db.commit()
        except Exception:
            db.rollback()

        logger = logging.getLogger(__name__)
        logger.error("Matching entity not found for run_id=%s: %s", run_id, exc)
        raise HTTPException(status_code=422, detail=str(exc))

    except Exception as exc:
        db.rollback()
        try:
            mark_run_failed(db, run_id, str(exc))
            db.commit()
        except Exception:
            db.rollback()

        logger = logging.getLogger(__name__)
        logger.exception("Internal matching execution failed for run_id=%s", run_id)
        raise HTTPException(status_code=500, detail=str(exc))


def _normalize_uuid_list(value: Any) -> list[str]:
    if value is None:
        return []

    raw_values: list[Any]
    if isinstance(value, str):
        raw_values = [item.strip() for item in value.split(",")]
    elif isinstance(value, (list, tuple, set)):
        raw_values = list(value)
    else:
        return []

    normalized: list[str] = []
    seen: set[str] = set()
    for raw_value in raw_values:
        candidate = str(raw_value).strip()
        if not candidate:
            continue
        try:
            parsed = str(UUID(candidate))
        except ValueError:
            continue
        if parsed in seen:
            continue
        seen.add(parsed)
        normalized.append(parsed)
    return normalized


def _load_candidate_target_offers(
    db: Session,
    run_parameters: dict[str, Any] | None = None,
) -> list[dict]:
    from sqlalchemy import bindparam, text

    offer_ids = _normalize_uuid_list((run_parameters or {}).get("offer_ids"))
    if offer_ids:
        query = text("""
            SELECT id
            FROM aneti.job_offer
            WHERE id::text IN :offer_ids
            ORDER BY created_at DESC
        """).bindparams(bindparam("offer_ids", expanding=True))
        rows = db.execute(query, {"offer_ids": offer_ids}).mappings().all()
    else:
        rows = db.execute(
            text("""
                SELECT id
                FROM aneti.job_offer
                WHERE status IN ('PUBLISHED', 'ACTIVE')
                ORDER BY created_at DESC
                LIMIT 100
            """)
        ).mappings().all()

    return [load_offer_payload(db, row["id"]) for row in rows]


def _load_offer_target_candidates(
    db: Session,
    run_parameters: dict[str, Any] | None = None,
) -> list[dict]:
    from sqlalchemy import bindparam, text

    candidate_ids = _normalize_uuid_list((run_parameters or {}).get("candidate_ids"))
    if candidate_ids:
        query = text("""
            SELECT id
            FROM aneti.job_seeker
            WHERE id::text IN :candidate_ids
            ORDER BY created_at DESC
        """).bindparams(bindparam("candidate_ids", expanding=True))
        rows = db.execute(query, {"candidate_ids": candidate_ids}).mappings().all()
    else:
        rows = db.execute(
            text("""
                SELECT id
                FROM aneti.job_seeker
                WHERE status = 'ACTIVE'
                ORDER BY created_at DESC
                LIMIT 100
            """)
        ).mappings().all()

    return [load_candidate_payload(db, row["id"]) for row in rows]
