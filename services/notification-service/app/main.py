from __future__ import annotations

import logging

from fastapi import FastAPI

from app.routers.notifications import router as notifications_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)

app = FastAPI(
    title="MatchCore Notification Service",
    version="1.0.0",
)


@app.get("/health")
def health():
    return {
        "status": "UP",
        "service": "notification-service",
    }


@app.get("/ready")
def ready():
    return {
        "status": "READY",
        "service": "notification-service",
    }


app.include_router(notifications_router)