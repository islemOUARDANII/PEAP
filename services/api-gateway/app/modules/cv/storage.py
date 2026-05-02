import os
import re
import logging
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status

from app.clients.blob_storage_client import delete_cv_blob, upload_cv_to_azure_blob


ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx"}
AZURE_STORAGE_PROVIDERS = {"AZURE_BLOB", "AZURE", "AZURE_BLOB_STORAGE"}
logger = logging.getLogger(__name__)


def _base_dir() -> Path:
    return Path(__file__).resolve().parents[3]


def storage_provider() -> str:
    configured = os.getenv("CV_STORAGE_PROVIDER", "LOCAL").strip().upper()
    if configured in AZURE_STORAGE_PROVIDERS:
        return "AZURE_BLOB"
    return "LOCAL"


def container_name() -> str:
    return os.getenv("CV_STORAGE_CONTAINER", "cv-files")


def local_storage_dir() -> Path:
    return _base_dir() / os.getenv("CV_STORAGE_LOCAL_DIR", "storage/cv-files")


def max_size_bytes() -> int:
    return int(os.getenv("CV_MAX_SIZE_MB", "10")) * 1024 * 1024


def _safe_filename(filename: str) -> str:
    name = Path(filename).name
    return re.sub(r"[^A-Za-z0-9._-]+", "_", name)


def generate_cv_id() -> str:
    return f"cv_{uuid4().hex}"


def validate_upload(file: UploadFile, content: bytes) -> str:
    filename = file.filename or "cv.pdf"
    extension = Path(filename).suffix.lower()
    mime_type = file.content_type or "application/octet-stream"

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported CV file extension",
        )

    if mime_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported CV MIME type",
        )

    if len(content) > max_size_bytes():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"CV file exceeds the configured size limit of {os.getenv('CV_MAX_SIZE_MB', '10')} MB",
        )

    return _safe_filename(filename)


def save_local_file(job_seeker_id: str, cv_id: str, filename: str, content: bytes) -> dict:
    directory = local_storage_dir() / "job_seekers" / job_seeker_id
    directory.mkdir(parents=True, exist_ok=True)
    blob_name = f"job_seekers/{job_seeker_id}/{cv_id}_{filename}"
    file_path = local_storage_dir() / blob_name
    file_path.write_bytes(content)
    return {
        "blob_name": blob_name.replace("\\", "/"),
        "storage_key": blob_name.replace("\\", "/"),
        "blob_url": None,
        "file_path": file_path,
    }


def save_file(
    *,
    job_seeker_id: str,
    cv_id: str,
    filename: str,
    content: bytes,
    mime_type: str | None,
) -> dict:
    provider = storage_provider()
    if provider == "AZURE_BLOB":
        saved = upload_cv_to_azure_blob(
            file_bytes=content,
            cv_id=cv_id,
            safe_filename=filename,
            job_seeker_id=job_seeker_id,
            container_name=container_name(),
            content_type=mime_type,
        )
        saved["storage_provider"] = provider
        return saved

    saved = save_local_file(job_seeker_id, cv_id, filename, content)
    saved["storage_provider"] = provider
    return saved


def cleanup_saved_file(saved: dict) -> None:
    try:
        if saved.get("storage_provider") == "AZURE_BLOB":
            delete_cv_blob(
                container_name=saved["container_name"],
                blob_name=saved["blob_name"],
            )
            return

        file_path = saved.get("file_path")
        if file_path:
            Path(file_path).unlink(missing_ok=True)
    except Exception:
        logger.exception("Failed to clean up saved CV artifact")


def resolve_local_path(storage_key: str) -> Path:
    return local_storage_dir() / storage_key
