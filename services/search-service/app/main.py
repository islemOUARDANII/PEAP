"""
FastAPI Search Service — point d'entrée principal.

Démarrage :
    uvicorn app.main:app --host 0.0.0.0 --port 8020 --reload

Endpoints exposés :
    POST /search/offers
    POST /search/candidates
    GET  /health
    POST /admin/sync          (déclenche sync manuelle)
"""

from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import Depends, FastAPI
from prometheus_fastapi_instrumentator import Instrumentator

from app.auth import verify_api_key
from app.config import settings
from app.es_client import bootstrap_indices
from app.pg_pool import close_pool
from app.rate_limit import rate_limit
from app.routers import candidates, offers
from app.sync.indexer import incremental_sync

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Scheduler APScheduler (cron sync incrémentale)
# ---------------------------------------------------------------------------

_scheduler = BackgroundScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Démarrage Search Service…")
    bootstrap_indices()

    _scheduler.add_job(
        incremental_sync,
        trigger="interval",
        seconds=settings.sync_interval_seconds,
        id="incremental_sync",
        replace_existing=True,
        max_instances=1,            # évite les runs parallèles
    )
    _scheduler.start()
    logger.info(
        "Cron sync lancé (interval=%ds)", settings.sync_interval_seconds
    )

    yield

    # Shutdown
    _scheduler.shutdown(wait=False)
    close_pool()
    logger.info("Search Service arrêté.")


# ---------------------------------------------------------------------------
# Application FastAPI
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Matching Platform — Search Service",
    version="1.0.0",
    description="Search Engine MVP : offres (hybride) + candidats (filtres)",
    lifespan=lifespan,
)

Instrumentator().instrument(app).expose(app, endpoint="/metrics")

secured_dependencies = [Depends(verify_api_key), Depends(rate_limit)]

app.include_router(offers.router, dependencies=secured_dependencies)
app.include_router(candidates.router, dependencies=secured_dependencies)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health", tags=["Ops"])
def health():
    return {"status": "ok", "service": "search-service"}


@app.get("/ready", tags=["Ops"])
def ready():
    return {"status": "READY", "service": "search-service"}


# ---------------------------------------------------------------------------
# Admin sync manuel (utile pour tests / forcer une sync)
# ---------------------------------------------------------------------------

@app.post("/admin/sync", tags=["Ops"], summary="Force une sync incrémentale immédiate")
def force_sync(
    _api_key: None = Depends(verify_api_key),
    _rate_limit: None = Depends(rate_limit),
):
    try:
        incremental_sync()
        return {"status": "done"}
    except Exception as exc:
        logger.error("Force sync error: %s", exc)
        return {"status": "error", "detail": str(exc)}
