from __future__ import annotations

import logging
import os
from pathlib import Path

from azure.storage.blob import BlobServiceClient

logger = logging.getLogger(__name__)
AZURE_STORAGE_PROVIDERS = {"AZURE_BLOB", "AZURE", "AZURE_BLOB_STORAGE"}


def read_file_from_storage(
    *,
    storage_provider: str,
    container_name: str,
    blob_name: str,
) -> bytes:
    provider = (storage_provider or "LOCAL").upper()

    if provider in AZURE_STORAGE_PROVIDERS:
        return _read_azure_blob_file(
            container_name=container_name,
            blob_name=blob_name,
        )

    if provider == "LOCAL":
        return _read_local_file(
            container_name=container_name,
            blob_name=blob_name,
        )

    raise NotImplementedError(
        f"Storage provider {storage_provider} is not integrated yet"
    )


def _get_blob_service_client() -> BlobServiceClient:
    connection_string = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
    if not connection_string:
        raise RuntimeError("AZURE_STORAGE_CONNECTION_STRING is not set")
    return BlobServiceClient.from_connection_string(connection_string)


def _read_azure_blob_file(
    *,
    container_name: str,
    blob_name: str,
) -> bytes:
    resolved_container_name = container_name or os.getenv("CV_STORAGE_CONTAINER", "cv-files")
    blob_client = _get_blob_service_client().get_blob_client(
        container=resolved_container_name,
        blob=blob_name,
    )

    try:
        data = blob_client.download_blob().readall()
    except Exception:
        logger.exception(
            "Azure Blob download failed for container=%s blob_name=%s",
            resolved_container_name,
            blob_name,
        )
        raise

    logger.info(
        "Azure Blob download succeeded for container=%s blob_name=%s size_bytes=%s",
        resolved_container_name,
        blob_name,
        len(data),
    )
    return data


def _read_local_file(
    *,
    container_name: str,
    blob_name: str,
) -> bytes:
    base_dir = Path(os.getenv("CV_STORAGE_LOCAL_DIR", "storage/cv-files"))

    candidates = [
        base_dir / blob_name,
        base_dir / container_name / blob_name,
        Path("/app") / base_dir / blob_name,
        Path("/app") / base_dir / container_name / blob_name,
        Path("/app/storage/cv-files") / blob_name,
    ]

    for path in candidates:
        if path.exists() and path.is_file():
            return path.read_bytes()

    raise FileNotFoundError(
        "CV file not found in local storage. Tried: "
        + ", ".join(str(path) for path in candidates)
    )
