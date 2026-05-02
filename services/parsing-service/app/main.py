import hmac
import logging
import os

from fastapi import Depends, FastAPI, Header, HTTPException, status
from prometheus_fastapi_instrumentator import Instrumentator
from app.engines.offer_parser_adapter import parse_offer_text_to_payload
from app.clients.storage_client import read_file_from_storage
from app.engines.cv_parser_adapter import parse_cv_file_to_payload
from app.contracts.schemas import (
    CvParseRequest,
    CvParseResponse,
    OfferParseRequest,
    OfferParseResponse,
)

app = FastAPI(title="Parsing Service", version="0.1.0")
logger = logging.getLogger(__name__)

Instrumentator().instrument(app).expose(app, endpoint="/metrics")


@app.get("/health")
def health():
    return {"status": "UP", "service": "parsing-service"}


@app.get("/ready")
def ready():
    return {"status": "READY", "service": "parsing-service"}


def require_internal_api_key(
    x_internal_api_key: str | None = Header(default=None, alias="X-Internal-Api-Key"),
) -> None:
    expected_api_key = os.getenv("INTERNAL_API_KEY")
    if not expected_api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="INTERNAL_API_KEY is not configured",
        )

    if not x_internal_api_key or not hmac.compare_digest(x_internal_api_key, expected_api_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal API key",
        )


@app.post("/internal/parse/cv", response_model=CvParseResponse)
def parse_cv_endpoint(
    payload: CvParseRequest,
    _internal_api_key: None = Depends(require_internal_api_key),
):
    logger.info(
        "Starting internal CV parse for cv_record_id=%s job_seeker_id=%s storage_provider=%s blob_name=%s trace_id=%s",
        payload.cv_record_id,
        payload.job_seeker_id,
        payload.storage_provider,
        payload.blob_name,
        payload.trace_id,
    )

    try:
        file_bytes = read_file_from_storage(
            storage_provider=payload.storage_provider,
            container_name=payload.container_name,
            blob_name=payload.blob_name,
        )

        result = parse_cv_file_to_payload(
            file_bytes=file_bytes,
            original_filename=payload.blob_name,
        )
        response = CvParseResponse(
            cv_record_id=payload.cv_record_id,
            job_seeker_id=payload.job_seeker_id,
            parsing_status=result["parsing_status"],
            parsed_payload=result["parsed_payload"],
            mapped_payload=result["mapped_payload"],
            extracted_profile_patch=result["extracted_profile_patch"],
            warnings=result["warnings"],
            parser_version=result["parser_version"],
        )
    except Exception:
        logger.exception(
            "Internal CV parse failed for cv_record_id=%s job_seeker_id=%s",
            payload.cv_record_id,
            payload.job_seeker_id,
        )
        raise

    logger.info(
        "Internal CV parse completed for cv_record_id=%s parsing_status=%s warnings=%s",
        payload.cv_record_id,
        response.parsing_status,
        len(response.warnings),
    )
    return response


@app.post("/internal/parse/offer", response_model=OfferParseResponse)
def parse_offer_endpoint(
    payload: OfferParseRequest,
    _internal_api_key: None = Depends(require_internal_api_key),
):
    logger.info(
        "Starting internal offer parse for offer_id=%s trace_id=%s",
        payload.offer_id,
        payload.trace_id,
    )

    try:
        result = parse_offer_text_to_payload(
            offer_id=str(payload.offer_id),
            title=payload.title,
            description=payload.description,
        )
        response = OfferParseResponse(
            offer_id=payload.offer_id,
            parsing_status=result["parsing_status"],
            parsed_payload=result["parsed_payload"],
            mapped_payload=result["mapped_payload"],
            extracted_requirements=result["extracted_requirements"],
            warnings=result["warnings"],
            parser_version=result["parser_version"],
        )
    except Exception:
        logger.exception("Internal offer parse failed for offer_id=%s", payload.offer_id)
        raise

    logger.info(
        "Internal offer parse completed for offer_id=%s parsing_status=%s warnings=%s",
        payload.offer_id,
        response.parsing_status,
        len(response.warnings),
    )
    return response
