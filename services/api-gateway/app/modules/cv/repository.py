from collections.abc import Mapping

from sqlalchemy import text
from sqlalchemy.orm import Session


def _fetch_one(db: Session, query: str, params: dict | None = None) -> dict | None:
    row = db.execute(text(query), params or {}).mappings().first()
    return dict(row) if row else None


def _fetch_all(db: Session, query: str, params: dict | None = None) -> list[dict]:
    rows = db.execute(text(query), params or {}).mappings().all()
    return [dict(row) for row in rows]


def list_cvs(db: Session, job_seeker_id: str) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            cv.id::text AS id,
            cv.cv_id,
            cv.storage_provider,
            cv.container_name,
            cv.blob_name,
            cv.storage_key,
            cv.blob_url,
            cv.original_filename,
            cv.mime_type,
            cv.file_size_bytes,
            cv.status,
            cv.is_current,
            cv.parsed_resume_id::text AS parsed_resume_id,
            cv.parsing_status,
            cv.uploaded_by_user_id::text AS uploaded_by_user_id,
            cv.uploaded_at,
            cv.created_at,
            cv.updated_at
        FROM aneti.job_seeker_cv cv
        WHERE cv.job_seeker_id = CAST(:job_seeker_id AS uuid)
        ORDER BY cv.uploaded_at DESC;
        """,
        {"job_seeker_id": job_seeker_id},
    )


def get_cv_by_id(db: Session, job_seeker_id: str, cv_record_id: str) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            cv.id::text AS id,
            cv.cv_id,
            cv.storage_provider,
            cv.container_name,
            cv.blob_name,
            cv.storage_key,
            cv.blob_url,
            cv.original_filename,
            cv.mime_type,
            cv.file_size_bytes,
            cv.status,
            cv.is_current,
            cv.parsed_resume_id::text AS parsed_resume_id,
            cv.parsing_status,
            cv.uploaded_by_user_id::text AS uploaded_by_user_id,
            cv.uploaded_at,
            cv.created_at,
            cv.updated_at
        FROM aneti.job_seeker_cv cv
        WHERE cv.job_seeker_id = CAST(:job_seeker_id AS uuid)
          AND cv.id = CAST(:cv_record_id AS uuid)
        LIMIT 1;
        """,
        {
            "job_seeker_id": job_seeker_id,
            "cv_record_id": cv_record_id,
        },
    )


def get_current_cv(db: Session, job_seeker_id: str) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            cv.id::text AS id,
            cv.cv_id,
            cv.storage_provider,
            cv.container_name,
            cv.blob_name,
            cv.storage_key,
            cv.blob_url,
            cv.original_filename,
            cv.mime_type,
            cv.file_size_bytes,
            cv.status,
            cv.is_current,
            cv.parsed_resume_id::text AS parsed_resume_id,
            cv.parsing_status,
            cv.uploaded_by_user_id::text AS uploaded_by_user_id,
            cv.uploaded_at,
            cv.created_at,
            cv.updated_at
        FROM aneti.job_seeker_cv cv
        WHERE cv.job_seeker_id = CAST(:job_seeker_id AS uuid)
          AND cv.is_current = TRUE
          AND cv.status <> 'ARCHIVED'
        ORDER BY cv.uploaded_at DESC
        LIMIT 1;
        """,
        {"job_seeker_id": job_seeker_id},
    )


def clear_current_flag(db: Session, job_seeker_id: str) -> None:
    db.execute(
        text("""
        UPDATE aneti.job_seeker_cv
        SET is_current = FALSE
        WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)
          AND is_current = TRUE;
        """),
        {"job_seeker_id": job_seeker_id},
    )


def create_cv_record(db: Session, payload: Mapping[str, object]) -> dict:
    return _fetch_one(
        db,
        """
        INSERT INTO aneti.job_seeker_cv (
            job_seeker_id,
            cv_id,
            storage_provider,
            container_name,
            blob_name,
            storage_key,
            blob_url,
            original_filename,
            mime_type,
            file_size_bytes,
            status,
            is_current,
            parsing_status,
            uploaded_by_user_id
        )
        VALUES (
            CAST(:job_seeker_id AS uuid),
            :cv_id,
            :storage_provider,
            :container_name,
            :blob_name,
            :storage_key,
            :blob_url,
            :original_filename,
            :mime_type,
            :file_size_bytes,
            :status,
            :is_current,
            :parsing_status,
            CAST(:uploaded_by_user_id AS uuid)
        )
        RETURNING id::text AS id;
        """,
        dict(payload),
    )


def archive_cv(db: Session, job_seeker_id: str, cv_record_id: str) -> dict | None:
    return _fetch_one(
        db,
        """
        UPDATE aneti.job_seeker_cv
        SET
            status = 'ARCHIVED',
            is_current = FALSE
        WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)
          AND id = CAST(:cv_record_id AS uuid)
        RETURNING id::text AS id;
        """,
        {
            "job_seeker_id": job_seeker_id,
            "cv_record_id": cv_record_id,
        },
    )


def update_parsing_status(
    db: Session,
    job_seeker_id: str,
    cv_record_id: str,
    parsing_status: str,
) -> dict | None:
    return _fetch_one(
        db,
        """
        UPDATE aneti.job_seeker_cv
        SET parsing_status = :parsing_status
        WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)
          AND id = CAST(:cv_record_id AS uuid)
        RETURNING id::text AS id, parsing_status;
        """,
        {
            "job_seeker_id": job_seeker_id,
            "cv_record_id": cv_record_id,
            "parsing_status": parsing_status,
        },
    )
