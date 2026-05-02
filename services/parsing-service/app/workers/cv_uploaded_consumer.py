from __future__ import annotations

import json
import logging
import os
import signal
import sys
import uuid
from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv
from kafka import KafkaConsumer, KafkaProducer
from sqlalchemy import create_engine, text

from app.clients.storage_client import read_file_from_storage
from app.engines.cv_parser_adapter import parse_cv_file_to_payload

load_dotenv()

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)

logger = logging.getLogger("parsing-service.cv-worker")

RUNNING = True


def _stop_worker(signum, frame):
    global RUNNING
    RUNNING = False
    logger.info("Stopping worker...")


signal.signal(signal.SIGINT, _stop_worker)
signal.signal(signal.SIGTERM, _stop_worker)


def _json_deserializer(value: bytes) -> dict[str, Any]:
    return json.loads(value.decode("utf-8"))


def _json_serializer(value: dict[str, Any]) -> bytes:
    return json.dumps(value, default=str, ensure_ascii=False).encode("utf-8")


def _bootstrap_servers() -> list[str]:
    raw = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9094")
    return [item.strip() for item in raw.split(",") if item.strip()]


def _input_topic() -> str:
    return os.getenv("KAFKA_INPUT_TOPIC", "cv.uploaded.v1")


def _output_topic() -> str:
    return os.getenv("KAFKA_OUTPUT_TOPIC", "cv.parsed.v1")


def _group_id() -> str:
    return os.getenv("KAFKA_GROUP_ID", "parsing-service")


def _service_name() -> str:
    return os.getenv("SERVICE_NAME", "parsing-service")


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _make_event(
    *,
    event_type: str,
    trace_id: str | None,
    causation_id: str | None,
    payload: dict[str, Any],
) -> dict[str, Any]:
    return {
        "event_id": str(uuid.uuid4()),
        "trace_id": trace_id,
        "causation_id": causation_id,
        "event_type": event_type,
        "event_version": 1,
        "produced_at": _utc_now(),
        "producer": _service_name(),
        "payload": payload,
    }


def _get_engine():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        return None
    return create_engine(database_url, pool_pre_ping=True)


def _update_cv_status(engine, *, cv_record_id: str, status: str) -> None:
    if engine is None:
        return

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                UPDATE aneti.job_seeker_cv
                SET parsing_status = :status,
                    updated_at = now()
                WHERE id = CAST(:cv_record_id AS uuid)
                """
            ),
            {
                "status": status,
                "cv_record_id": cv_record_id,
            },
        )


def _extract_payload(event: dict[str, Any]) -> dict[str, Any]:
    payload = event.get("payload")
    if not isinstance(payload, dict):
        raise ValueError("Invalid event: payload must be an object")
    return payload


def _process_event(
    *,
    event: dict[str, Any],
    producer: KafkaProducer,
    db_engine,
) -> None:
    event_type = event.get("event_type")
    if event_type != "cv.uploaded.v1":
        logger.info("Skipping unsupported event_type=%s", event_type)
        return

    payload = _extract_payload(event)

    cv_record_id = str(payload["cv_record_id"])
    job_seeker_id = str(payload["job_seeker_id"])
    storage_provider = payload.get("storage_provider", "LOCAL")
    container_name = payload.get("container_name") or ""
    blob_name = payload["blob_name"]

    trace_id = event.get("trace_id") or f"cv-uploaded-{cv_record_id}"
    causation_id = event.get("event_id")

    logger.info(
        "Received cv.uploaded.v1 cv_record_id=%s job_seeker_id=%s blob_name=%s",
        cv_record_id,
        job_seeker_id,
        blob_name,
    )

    _update_cv_status(db_engine, cv_record_id=cv_record_id, status="PARSING")

    try:
        file_bytes = read_file_from_storage(
            storage_provider=storage_provider,
            container_name=container_name,
            blob_name=blob_name,
        )

        result = parse_cv_file_to_payload(
            file_bytes=file_bytes,
            original_filename=blob_name,
        )

        final_status = result.get("parsing_status", "FAILED")
        _update_cv_status(db_engine, cv_record_id=cv_record_id, status=final_status)

        output_payload = {
            "cv_record_id": cv_record_id,
            "job_seeker_id": job_seeker_id,
            "storage_provider": storage_provider,
            "container_name": container_name,
            "blob_name": blob_name,
            "parsing_status": final_status,
            "parsed_payload": result.get("parsed_payload", {}),
            "mapped_payload": result.get("mapped_payload", {}),
            "extracted_profile_patch": result.get("extracted_profile_patch", {}),
            "warnings": result.get("warnings", []),
            "parser_version": result.get("parser_version", "cv-parser-legacy-v1"),
        }

        output_event = _make_event(
            event_type="cv.parsed.v1" if final_status == "PARSED" else "cv.parsing.failed.v1",
            trace_id=trace_id,
            causation_id=causation_id,
            payload=output_payload,
        )

        producer.send(_output_topic(), output_event).get(timeout=20)
        producer.flush()

        logger.info(
            "Published %s for cv_record_id=%s",
            output_event["event_type"],
            cv_record_id,
        )

    except Exception as exc:
        logger.exception("Failed to parse CV cv_record_id=%s", cv_record_id)

        _update_cv_status(db_engine, cv_record_id=cv_record_id, status="FAILED")

        failed_event = _make_event(
            event_type="cv.parsing.failed.v1",
            trace_id=trace_id,
            causation_id=causation_id,
            payload={
                "cv_record_id": cv_record_id,
                "job_seeker_id": job_seeker_id,
                "storage_provider": storage_provider,
                "container_name": container_name,
                "blob_name": blob_name,
                "parsing_status": "FAILED",
                "error": str(exc),
            },
        )

        producer.send(_output_topic(), failed_event).get(timeout=20)
        producer.flush()


def main() -> None:
    bootstrap_servers = _bootstrap_servers()

    logger.info(
        "Starting CV Kafka worker bootstrap_servers=%s input_topic=%s output_topic=%s group_id=%s",
        bootstrap_servers,
        _input_topic(),
        _output_topic(),
        _group_id(),
    )

    consumer = KafkaConsumer(
        _input_topic(),
        bootstrap_servers=bootstrap_servers,
        group_id=_group_id(),
        value_deserializer=_json_deserializer,
        auto_offset_reset="earliest",
        enable_auto_commit=False,
    )

    producer = KafkaProducer(
        bootstrap_servers=bootstrap_servers,
        value_serializer=_json_serializer,
    )

    db_engine = _get_engine()

    try:
        while RUNNING:
            records = consumer.poll(timeout_ms=1000, max_records=1)

            for _, messages in records.items():
                for message in messages:
                    try:
                        _process_event(
                            event=message.value,
                            producer=producer,
                            db_engine=db_engine,
                        )
                        consumer.commit()
                    except Exception:
                        logger.exception("Message processing failed, offset not committed")

    finally:
        consumer.close()
        producer.close()
        logger.info("Worker stopped")


if __name__ == "__main__":
    main()