from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, Request, UploadFile, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.clients.kafka_client import publish_event
from app.db.session import get_db, SessionLocal
from app.modules.audit.service import log_pipeline_event, log_user_activity
from app.modules.auth.dependencies import require_roles, get_current_user
from app.modules.auth.schemas import CurrentUserResponse
from app.modules.job_seekers.service import resolve_current_job_seeker
from app.clients.parsing_client import ParsingServiceError, parse_cv
from .schemas import CvParseResponse, CvRecordResponse, ParsedResumeSnapshotResponse
from .service import (
    archive_my_cv,
    get_current_cv_file,
    get_current_cv_for_job_seeker,
    get_my_current_cv,
    get_my_current_cv_file,
    list_my_cvs,
    upload_cv_for_job_seeker,
    upload_my_cv,
)
from . import repository
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["CV"])


@router.post("/candidates/me/cv")
@router.post("/job-seekers/me/cv", include_in_schema=False)
async def upload_candidate_cv(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    created = await upload_my_cv(db, current_user, file)
    job_seeker = resolve_current_job_seeker(db, current_user)
    trace_id = _extract_trace_id(request)
    publish_event(
        event_type="cv.uploaded.v1",
        trace_id=trace_id,
        payload={
            "cv_record_id": created["id"],
            "job_seeker_id": job_seeker["id"],
            "storage_provider": created["storage_provider"],
            "container_name": created["container_name"],
            "blob_name": created["blob_name"],
        },
    )
    log_pipeline_event(
        db,
        request=request,
        current_user=current_user,
        event_type="CV_UPLOADED",
        action="UPLOAD",
        status="SUCCESS",
        entity_type="CV_RECORD",
        entity_id=created["id"],
        message="Job seeker uploaded a CV",
        metadata={
            "cv_id": created["cv_id"],
            "original_filename": created["original_filename"],
            "mime_type": created["mime_type"],
            "file_size_bytes": created["file_size_bytes"],
            "parsing_status": created["parsing_status"],
        },
    )
    return created


@router.get("/candidates/me/cv", response_model=list[CvRecordResponse])
@router.get("/job-seekers/me/cv", response_model=list[CvRecordResponse], include_in_schema=False)
def list_my_cvs_endpoint(
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    return list_my_cvs(db, current_user)


@router.get("/candidates/me/cv/current", response_model=CvRecordResponse)
@router.get("/job-seekers/me/cv/current", response_model=CvRecordResponse, include_in_schema=False)
def get_my_current_cv_endpoint(
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    return get_my_current_cv(db, current_user)


@router.get("/candidates/me/cv/current/view")
@router.get("/job-seekers/me/cv/current/view", include_in_schema=False)
def view_current_cv(
    current_user=Depends(require_roles("JOB_SEEKER")),
    db=Depends(get_db),
):
    path, mime_type = get_my_current_cv_file(db, current_user)
    filename = path.name
    return FileResponse(
        path=str(path),
        media_type=mime_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.delete("/candidates/me/cv/{cv_record_id}")
@router.delete("/job-seekers/me/cv/{cv_record_id}", include_in_schema=False)
def archive_my_cv_endpoint(
    cv_record_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    archive_my_cv(db, current_user, str(cv_record_id))
    log_user_activity(
        db,
        request=request,
        current_user=current_user,
        event_type="CV_ARCHIVED",
        action="ARCHIVE",
        status="SUCCESS",
        entity_type="CV_RECORD",
        entity_id=str(cv_record_id),
        message="Job seeker archived a CV",
        metadata={
            "cv_record_id": str(cv_record_id),
        },
    )
    return {"status": "archived"}


def _normalize_snapshot_status(value: str | None) -> str:
    value = (value or "FAILED").upper()

    if value in {"PARSED", "FAILED", "PARTIAL"}:
        return value

    if value in {"SUCCESS", "OK", "DONE"}:
        return "PARSED"

    return "FAILED"


def _run_parse_in_background(cv_data: dict, cv_record_id: str) -> None:
    db = SessionLocal()

    result: dict = {}
    parsing_status = "FAILED"
    snapshot_id: str | None = None

    try:
        try:
            result = parse_cv(cv_data) or {}
            parsing_status = _normalize_snapshot_status(result.get("parsing_status"))
        except Exception as exc:
            logger.exception("Background CV parsing failed for cv_record_id=%s", cv_record_id)
            result = {
                "parsing_status": "FAILED",
                "parsed_payload": {},
                "mapped_payload": {},
                "extracted_profile_patch": {},
                "warnings": [],
                "errors": [
                    {
                        "type": exc.__class__.__name__,
                        "message": str(exc),
                    }
                ],
                "parser_version": None,
            }
            parsing_status = "FAILED"

        snapshot = repository.create_parsed_resume_snapshot(
            db,
            job_seeker_id=str(cv_data["job_seeker_id"]),
            cv_record_id=str(cv_record_id),
            parsing_status=parsing_status,
            parser_name=result.get("parser_name") or "parsing-service",
            parser_version=result.get("parser_version"),
            parsed_payload=result.get("parsed_payload") or {},
            mapped_payload=result.get("mapped_payload") or {},
            extracted_profile_patch=result.get("extracted_profile_patch") or {},
            warnings=result.get("warnings") or [],
            errors=result.get("errors") or [],
            created_by_user_id=cv_data.get("created_by_user_id"),
        )

        snapshot_id = snapshot["id"] if snapshot else None

        repository.attach_parsed_resume_snapshot(
            db,
            cv_record_id=str(cv_record_id),
            parsed_resume_id=snapshot_id,
            parsing_status=parsing_status,
        )

        db.commit()

        logger.info(
            "CV parsing snapshot persisted cv_record_id=%s snapshot_id=%s parsing_status=%s",
            cv_record_id,
            snapshot_id,
            parsing_status,
        )

    except Exception:
        db.rollback()
        logger.exception("Failed to persist parsing snapshot for cv_record_id=%s", cv_record_id)

        try:
            repository.attach_parsed_resume_snapshot(
                db,
                cv_record_id=str(cv_record_id),
                parsed_resume_id=None,
                parsing_status="FAILED",
            )
            db.commit()
        except Exception:
            db.rollback()
            logger.exception("Failed to mark CV parsing as FAILED for cv_record_id=%s", cv_record_id)

    finally:
        db.close()


@router.post("/candidates/me/cv/{cv_record_id}/parse", status_code=202)
@router.post("/job-seekers/me/cv/{cv_record_id}/parse", include_in_schema=False, status_code=202)
def parse_my_cv_endpoint(
    cv_record_id: UUID,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    from sqlalchemy import text
    from app.modules.job_seekers.service import resolve_current_job_seeker

    job_seeker = resolve_current_job_seeker(db, current_user)

    cv = db.execute(
        text("""
            SELECT
                cv.id::text AS id,
                cv.job_seeker_id::text AS job_seeker_id,

                df.storage_provider,
                df.container_name,
                df.blob_name,
                df.storage_key,
                df.original_filename,
                df.mime_type,
                df.file_size_bytes

            FROM aneti.job_seeker_cv cv
            LEFT JOIN aneti.document_file df
                ON df.id = cv.document_file_id

            WHERE cv.id = CAST(:cv_record_id AS uuid)
            AND cv.job_seeker_id = CAST(:job_seeker_id AS uuid)
            AND cv.status <> 'ARCHIVED'
        """),
        {
            "cv_record_id": str(cv_record_id),
            "job_seeker_id": str(job_seeker["id"]),
        },
    ).mappings().first()

    if not cv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CV record not found",
        )

    if not cv["storage_provider"] or not cv["blob_name"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CV file storage metadata is missing. document_file_id is null or document_file is incomplete.",
        )

    db.execute(
        text("""
            UPDATE aneti.job_seeker_cv
            SET parsing_status = 'PARSING',
                updated_at = now()
            WHERE id = :cv_record_id
        """),
        {"cv_record_id": str(cv_record_id)},
    )
    db.commit()

    cv_data = {
        "cv_record_id": str(cv["id"]),
        "job_seeker_id": str(cv["job_seeker_id"]),
        "storage_provider": cv["storage_provider"],
        "container_name": cv["container_name"],
        "blob_name": cv["blob_name"],
        "trace_id": f"parse-cv-{cv_record_id}",
        "created_by_user_id": str(current_user.id),
    }
    background_tasks.add_task(_run_parse_in_background, cv_data, str(cv_record_id))

    log_pipeline_event(
        db,
        request=request,
        current_user=current_user,
        event_type="CV_PARSE_REQUESTED",
        action="PARSE",
        status="PENDING",
        entity_type="CV_RECORD",
        entity_id=str(cv_record_id),
        message="CV parsing started in background",
        metadata={},
    )

    return {"parsing_status": "PARSING", "message": "Parsing en cours, veuillez patienter..."}

@router.get(
    "/candidates/me/cv/{cv_record_id}/parse-result",
    response_model=ParsedResumeSnapshotResponse,
)
@router.get(
    "/job-seekers/me/cv/{cv_record_id}/parse-result",
    response_model=ParsedResumeSnapshotResponse,
    include_in_schema=False,
)
def get_my_cv_parse_result_endpoint(
    cv_record_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    job_seeker = resolve_current_job_seeker(db, current_user)

    row = repository.get_parsed_resume_snapshot_by_cv(
        db,
        job_seeker_id=str(job_seeker["id"]),
        cv_record_id=str(cv_record_id),
    )

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CV parse result not found",
        )

    return row


@router.post("/candidates/me/cv/{cv_record_id}/apply-parsed-profile")
@router.post("/job-seekers/me/cv/{cv_record_id}/apply-parsed-profile", include_in_schema=False)
def apply_my_cv_parsed_profile_endpoint(
    cv_record_id: UUID,
    request: Request,
    dry_run: bool = True,
    replace: bool = False,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("JOB_SEEKER")),
):
    """
    Prépare l'application du dernier snapshot de parsing sur le profil candidat.

    Étape volontairement sûre : par défaut, dry_run=true ne modifie aucune table.
    L'écriture réelle sera activée après validation du plan généré.
    """
    job_seeker = resolve_current_job_seeker(db, current_user)

    snapshot = repository.get_parsed_resume_snapshot_by_cv(
        db,
        job_seeker_id=str(job_seeker["id"]),
        cv_record_id=str(cv_record_id),
    )

    if not snapshot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CV parse result not found",
        )

    parsing_status = str(snapshot.get("parsing_status") or "").upper()
    if parsing_status not in {"PARSED", "PARTIAL"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"CV parse result is not applicable because parsing_status={parsing_status or 'UNKNOWN'}",
        )

    plan = repository.build_apply_parsed_profile_plan(
        db,
        job_seeker_id=str(job_seeker["id"]),
        snapshot=snapshot,
        replace=replace,
    )

    if dry_run:
        return {
            "status": "DRY_RUN",
            "dry_run": True,
            "replace": replace,
            "cv_record_id": str(cv_record_id),
            "job_seeker_id": str(job_seeker["id"]),
            "snapshot_id": snapshot.get("id"),
            "plan": plan,
        }

    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=(
            "Real profile write is not enabled in this safe step yet. "
            "Call with dry_run=true, validate the plan, then enable the write step."
        ),
    )




@router.post("/advisor/candidates/{candidate_id}/cv", status_code=201)
async def advisor_upload_candidate_cv(
    candidate_id: UUID,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("ANETI_ADVISOR", "FUNCTIONAL_ADMIN")),
):
    created = await upload_cv_for_job_seeker(db, str(candidate_id), file, current_user.id)
    publish_event(
        event_type="cv.uploaded.v1",
        trace_id=_extract_trace_id(request),
        payload={
            "cv_record_id": created["id"],
            "job_seeker_id": str(candidate_id),
            "storage_provider": created["storage_provider"],
            "container_name": created["container_name"],
            "blob_name": created["blob_name"],
        },
    )
    return created


@router.post("/advisor/candidates/{candidate_id}/cv/{cv_record_id}/parse", status_code=202)
def advisor_parse_candidate_cv(
    candidate_id: UUID,
    cv_record_id: UUID,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: CurrentUserResponse = Depends(require_roles("ANETI_ADVISOR", "FUNCTIONAL_ADMIN")),
):
    cv = db.execute(
        text("""
            SELECT
                cv.id::text AS id,
                cv.job_seeker_id::text AS job_seeker_id,

                df.storage_provider,
                df.container_name,
                df.blob_name,
                df.storage_key,
                df.original_filename,
                df.mime_type,
                df.file_size_bytes

            FROM aneti.job_seeker_cv cv
            LEFT JOIN aneti.document_file df
                ON df.id = cv.document_file_id

            WHERE cv.id = CAST(:cv_record_id AS uuid)
            AND cv.job_seeker_id = CAST(:job_seeker_id AS uuid)
            AND cv.status <> 'ARCHIVED'
        """),
        {
            "cv_record_id": str(cv_record_id),
            "job_seeker_id": str(candidate_id),
        },
    ).mappings().first()

    if not cv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="CV record not found")

    if not cv["storage_provider"] or not cv["blob_name"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CV file storage metadata is missing. document_file_id is null or document_file is incomplete.",
        )
    
    db.execute(
        text("UPDATE aneti.job_seeker_cv SET parsing_status = 'PARSING', updated_at = now() WHERE id = CAST(:id AS uuid)"),
        {"id": str(cv_record_id)},
    )
    db.commit()

    cv_data = {
        "cv_record_id": str(cv["id"]),
        "job_seeker_id": str(cv["job_seeker_id"]),
        "storage_provider": cv["storage_provider"],
        "container_name": cv["container_name"],
        "blob_name": cv["blob_name"],
        "trace_id": f"advisor-parse-cv-{cv_record_id}",
        "created_by_user_id": str(current_user.id),
    }
    background_tasks.add_task(_run_parse_in_background, cv_data, str(cv_record_id))
    return {"parsing_status": "PARSING", "message": "Parsing en cours, veuillez patienter..."}

@router.get(
    "/advisor/candidates/{candidate_id}/cv/{cv_record_id}/parse-result",
    response_model=ParsedResumeSnapshotResponse,
)
def advisor_get_candidate_cv_parse_result_endpoint(
    candidate_id: UUID,
    cv_record_id: UUID,
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles("ANETI_ADVISOR", "FUNCTIONAL_ADMIN", "TECH_ADMIN")),
):
    row = repository.get_parsed_resume_snapshot_by_cv(
        db,
        job_seeker_id=str(candidate_id),
        cv_record_id=str(cv_record_id),
    )

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CV parse result not found",
        )

    return row

@router.get("/advisor/candidates/{candidate_id}/cv/current", response_model=CvRecordResponse)
@router.get("/advisor/job-seekers/{candidate_id}/cv/current", response_model=CvRecordResponse, include_in_schema=False)
def get_candidate_current_cv_endpoint(
    candidate_id: UUID,
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles("ANETI_ADVISOR", "FUNCTIONAL_ADMIN", "TECH_ADMIN")),
):
    return get_current_cv_for_job_seeker(db, str(candidate_id))


@router.get("/advisor/candidates/{candidate_id}/cv/current/view")
@router.get("/advisor/job-seekers/{candidate_id}/cv/current/view", include_in_schema=False)
def view_candidate_current_cv_endpoint(
    candidate_id: UUID,
    db: Session = Depends(get_db),
    _current_user=Depends(require_roles("ANETI_ADVISOR", "FUNCTIONAL_ADMIN", "TECH_ADMIN")),
):
    path, mime_type = get_current_cv_file(db, str(candidate_id))
    return FileResponse(path=path, media_type=mime_type, filename=path.name)


def _extract_trace_id(request: Request) -> str | None:
    return (
        request.headers.get("x-trace-id")
        or request.headers.get("trace-id")
        or request.headers.get("traceparent")
        or str(uuid4())
    )

