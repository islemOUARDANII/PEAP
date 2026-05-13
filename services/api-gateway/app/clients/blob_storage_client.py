from __future__ import annotations

import logging
import os
from pathlib import Path

from azure.core.exceptions import ResourceExistsError
from azure.storage.blob import BlobServiceClient, ContentSettings

logger = logging.getLogger(__name__)


def _get_blob_service_client() -> BlobServiceClient:
    connection_string = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
    if not connection_string:
        raise RuntimeError("AZURE_STORAGE_CONNECTION_STRING is not set")

    return BlobServiceClient.from_connection_string(connection_string)


def upload_cv_to_azure_blob(
    *,
    file_bytes: bytes,
    cv_id: str,
    safe_filename: str,
    job_seeker_id: str,
    container_name: str,
    content_type: str | None,
) -> dict:
    blob_name = f"job_seekers/{job_seeker_id}/{cv_id}_{Path(safe_filename).name}"

    service_client = _get_blob_service_client()
    container_client = service_client.get_container_client(container_name)

    try:
        container_client.create_container()
    except ResourceExistsError:
        pass

    blob_client = container_client.get_blob_client(blob_name)

    try:
        blob_client.upload_blob(
            file_bytes,
            overwrite=True,
            content_settings=ContentSettings(
                content_type=content_type or "application/octet-stream"
            ),
        )
    except Exception:
        logger.exception(
            "Azure Blob upload failed for job_seeker_id=%s cv_id=%s container=%s blob_name=%s",
            job_seeker_id,
            cv_id,
            container_name,
            blob_name,
        )
        raise

    logger.info(
        "Azure Blob upload succeeded for job_seeker_id=%s cv_id=%s container=%s blob_name=%s size_bytes=%s",
        job_seeker_id,
        cv_id,
        container_name,
        blob_name,
        len(file_bytes),
    )

    return {
        "container_name": container_name,
        "blob_name": blob_name,
        "storage_key": blob_name,
        "blob_url": blob_client.url,
    }


def delete_cv_blob(*, container_name: str, blob_name: str) -> None:
    blob_client = _get_blob_service_client().get_blob_client(
        container=container_name,
        blob=blob_name,
    )
    blob_client.delete_blob(delete_snapshots="include")
    logger.info(
        "Azure Blob cleanup succeeded for container=%s blob_name=%s",
        container_name,
        blob_name,
    )
