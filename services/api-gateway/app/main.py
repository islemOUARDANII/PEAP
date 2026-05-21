from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from app.modules.advisors.router import router as advisors_router
from app.modules.auth.router import router as auth_router
from app.modules.cv.router import router as cv_router
from app.modules.employers.router import router as employers_router
from app.modules.functional_admin.router import router as functional_admin_router
from app.modules.job_seekers.router import router as job_seekers_router
from app.modules.matching_config.router import router as matching_config_router
from app.modules.matching_runs.router import router as matching_runs_router
from app.modules.offers.router import router as offers_router
from app.modules.referentials.router import router as referentials_router
from app.modules.references.router import router as references_router
from app.modules.geo.router import router as geo_router
from app.modules.search.router import router as search_router
from app.modules.segments.router import router as segments_router
from app.modules.taxonomy.router import router as taxonomy_router
from app.modules.tech_admin.router import router as tech_admin_router
from app.modules.notifications.router import router as notifications_router
from app.modules.advisor_activity.router import router as advisor_activity_router

app = FastAPI(
    title="ANETI Matching API Gateway",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(job_seekers_router)
app.include_router(employers_router)
app.include_router(advisors_router)
app.include_router(functional_admin_router)
app.include_router(tech_admin_router)
app.include_router(referentials_router)
app.include_router(references_router)
app.include_router(geo_router)
app.include_router(taxonomy_router)
app.include_router(search_router)
app.include_router(cv_router)
app.include_router(offers_router)
app.include_router(segments_router)
app.include_router(matching_config_router)
app.include_router(matching_runs_router)
app.include_router(notifications_router)
app.include_router(advisor_activity_router)

Instrumentator().instrument(app).expose(app, endpoint="/metrics")

@app.get("/health")
def health():
    return {"status": "ok", "service": "api-gateway"}


@app.get("/ready")
def ready():
    return {"status": "READY", "service": "api-gateway"}
