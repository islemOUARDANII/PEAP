import logging
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.clients.kafka_client import publish_event
from app.clients.parsing_client import parse_cv
from app.modules.auth.schemas import CurrentUserResponse
from app.modules.job_seekers.service import resolve_current_job_seeker

from . import repository, storage
from .schemas import CvParseResponse, CvRecordResponse

logger = logging.getLogger(__name__)


def _raise_not_found(entity_name: str) -> None:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{entity_name} not found")


def _handle_integrity_error(exc: IntegrityError) -> None:
    message = str(exc.orig) if exc.orig else str(exc)
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Database constraint violated: {message}",
    ) from exc


def list_my_cvs(db: Session, current_user: CurrentUserResponse) -> list[dict]:
    job_seeker = resolve_current_job_seeker(db, current_user)
    return [CvRecordResponse(**row).model_dump(mode="json") for row in repository.list_cvs(db, job_seeker["id"])]


def get_my_current_cv(db: Session, current_user: CurrentUserResponse) -> dict:
    job_seeker = resolve_current_job_seeker(db, current_user)
    cv = repository.get_current_cv(db, job_seeker["id"])
    if not cv:
        _raise_not_found("Current CV")
    return CvRecordResponse(**cv).model_dump(mode="json")


def get_current_cv_for_job_seeker(db: Session, job_seeker_id: str) -> dict:
    cv = repository.get_current_cv(db, job_seeker_id)
    if not cv:
        _raise_not_found("Current CV")
    return CvRecordResponse(**cv).model_dump(mode="json")


async def upload_my_cv(
    db: Session,
    current_user: CurrentUserResponse,
    file: UploadFile,
) -> dict:
    job_seeker = resolve_current_job_seeker(db, current_user)
    content = await file.read()
    safe_filename = storage.validate_upload(file, content)
    cv_id = storage.generate_cv_id()
    saved = storage.save_file(
        job_seeker_id=job_seeker["id"],
        cv_id=cv_id,
        filename=safe_filename,
        content=content,
        mime_type=file.content_type,
    )

    document_payload = {
        "owner_type": "JOB_SEEKER",
        "owner_id": job_seeker["id"],
        "storage_provider": storage.storage_provider(),
        "container_name": storage.container_name(),
        "blob_name": saved["blob_name"],
        "storage_key": saved["storage_key"],
        "original_filename": file.filename,
        "mime_type": file.content_type or "application/octet-stream",
        "file_size_bytes": len(content),
        "status": "ACTIVE",
        "uploaded_by_user_id": str(current_user.id),
        "metadata_json": repository._json_param({
            "cv_id": cv_id,
            "blob_url": saved.get("blob_url"),
        }),
    }

    try:
        repository.clear_current_flag(db, job_seeker["id"])

        document_file = repository.create_document_file(db, document_payload)

        created = repository.create_cv_record(
            db,
            {
                "job_seeker_id": job_seeker["id"],
                "document_file_id": document_file["id"],
                "status": "AVAILABLE",
                "is_current": True,
                "parsing_status": "NOT_PARSED",
            },
        )

        db.commit()
    except IntegrityError as exc:
        db.rollback()
        storage.cleanup_saved_file(saved)
        _handle_integrity_error(exc)

    cv = repository.get_cv_by_id(db, job_seeker["id"], created["id"])
    return CvRecordResponse(**cv).model_dump(mode="json")


def archive_my_cv(db: Session, current_user: CurrentUserResponse, cv_record_id: str) -> None:
    job_seeker = resolve_current_job_seeker(db, current_user)
    archived = repository.archive_cv(db, job_seeker["id"], cv_record_id)
    if not archived:
        db.rollback()
        _raise_not_found("CV record")
    db.commit()


def parse_my_cv(
    db: Session,
    current_user: CurrentUserResponse,
    cv_record_id: str,
    trace_id: str | None,
) -> dict:
    job_seeker = resolve_current_job_seeker(db, current_user)
    cv = repository.get_cv_by_id(db, job_seeker["id"], cv_record_id)
    if not cv:
        _raise_not_found("CV record")

    updated = repository.update_parsing_status(db, job_seeker["id"], cv_record_id, "PARSING")
    if not updated:
        db.rollback()
        _raise_not_found("CV record")
    db.commit()

    event_payload = {
        "cv_record_id": cv["id"],
        "job_seeker_id": job_seeker["id"],
        "storage_provider": cv["storage_provider"],
        "container_name": cv["container_name"],
        "blob_name": cv["blob_name"],
    }
    publish_event(
        event_type="cv.parsing.started.v1",
        trace_id=trace_id,
        causation_id=cv["id"],
        payload=event_payload,
    )

    try:
        result = parse_cv(
            {
                "cv_record_id": cv["id"],
                "job_seeker_id": job_seeker["id"],
                "storage_provider": cv["storage_provider"],
                "container_name": cv["container_name"],
                "blob_name": cv["blob_name"],
                "trace_id": trace_id,
            }
        )
    except Exception:
        _mark_cv_parsing_failed(
            db=db,
            job_seeker_id=job_seeker["id"],
            cv_record_id=cv["id"],
            trace_id=trace_id,
            event_payload=event_payload,
        )
        raise

    final_status = "PARSED" if result.get("parsing_status") == "PARSED" else "FAILED"
    updated = repository.update_parsing_status(db, job_seeker["id"], cv_record_id, final_status)
    if not updated:
        db.rollback()
        _raise_not_found("CV record")
    db.commit()

    publish_event(
        event_type="cv.parsed.v1" if final_status == "PARSED" else "cv.parsing.failed.v1",
        trace_id=trace_id,
        causation_id=cv["id"],
        payload={**event_payload, "parsing_status": final_status},
    )
    logger.info(
        "CV parsing flow completed for cv_record_id=%s job_seeker_id=%s parsing_status=%s",
        cv["id"],
        job_seeker["id"],
        final_status,
    )
    return CvParseResponse(**result).model_dump(mode="json")


def _mark_cv_parsing_failed(
    *,
    db: Session,
    job_seeker_id: str,
    cv_record_id: str,
    trace_id: str | None,
    event_payload: dict,
) -> None:
    try:
        repository.update_parsing_status(db, job_seeker_id, cv_record_id, "FAILED")
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Failed to persist FAILED parsing status for cv_record_id=%s", cv_record_id)

    publish_event(
        event_type="cv.parsing.failed.v1",
        trace_id=trace_id,
        causation_id=cv_record_id,
        payload={**event_payload, "parsing_status": "FAILED"},
    )


async def upload_cv_for_job_seeker(
    db: Session,
    job_seeker_id: str,
    file: UploadFile,
    uploader_user_id: str,
) -> dict:
    content = await file.read()
    safe_filename = storage.validate_upload(file, content)
    cv_id = storage.generate_cv_id()
    saved = storage.save_file(
        job_seeker_id=job_seeker_id,
        cv_id=cv_id,
        filename=safe_filename,
        content=content,
        mime_type=file.content_type,
    )

    document_payload = {
        "owner_type": "JOB_SEEKER",
        "owner_id": job_seeker_id,
        "storage_provider": storage.storage_provider(),
        "container_name": storage.container_name(),
        "blob_name": saved["blob_name"],
        "storage_key": saved["storage_key"],
        "original_filename": file.filename,
        "mime_type": file.content_type or "application/octet-stream",
        "file_size_bytes": len(content),
        "status": "ACTIVE",
        "uploaded_by_user_id": str(uploader_user_id),
        "metadata_json": repository._json_param({
            "cv_id": cv_id,
            "blob_url": saved.get("blob_url"),
        }),
    }

    try:
        repository.clear_current_flag(db, job_seeker_id)

        document_file = repository.create_document_file(db, document_payload)

        created = repository.create_cv_record(
            db,
            {
                "job_seeker_id": job_seeker_id,
                "document_file_id": document_file["id"],
                "status": "AVAILABLE",
                "is_current": True,
                "parsing_status": "NOT_PARSED",
            },
        )

        db.commit()
    except IntegrityError as exc:
        db.rollback()
        storage.cleanup_saved_file(saved)
        _handle_integrity_error(exc)

    cv = repository.get_cv_by_id(db, job_seeker_id, created["id"])
    return CvRecordResponse(**cv).model_dump(mode="json")


def get_current_cv_file(db: Session, job_seeker_id: str) -> tuple[Path, str]:
    cv = repository.get_current_cv(db, job_seeker_id)
    if not cv:
        _raise_not_found("Current CV")

    if cv["storage_provider"] != "LOCAL":
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Only LOCAL CV storage is implemented for now",
        )

    path = storage.resolve_local_path(cv["storage_key"])
    if not path.exists():
        _raise_not_found("Stored CV file")

    return path, cv["mime_type"]


def get_my_current_cv_file(db: Session, current_user: CurrentUserResponse) -> tuple[Path, str]:
    job_seeker = resolve_current_job_seeker(db, current_user)
    return get_current_cv_file(db, job_seeker["id"])
