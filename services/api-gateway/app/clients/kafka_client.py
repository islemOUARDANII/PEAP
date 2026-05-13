from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any

from kafka import KafkaProducer

logger = logging.getLogger(__name__)


def kafka_status() -> str:
    if os.getenv("KAFKA_ENABLED", "true").strip().lower() == "false":
        return "DISABLED"
    return "CONFIGURED" if os.getenv("KAFKA_BOOTSTRAP_SERVERS") else "NOT_CONFIGURED"


def _bootstrap_servers() -> list[str]:
    value = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "").strip()
    return [item.strip() for item in value.split(",") if item.strip()]


def _topic_name() -> str:
    return os.getenv("KAFKA_EVENTS_TOPIC", "cv.events")


@lru_cache(maxsize=1)
def _producer() -> KafkaProducer:
    bootstrap_servers = _bootstrap_servers()
    if not bootstrap_servers:
        raise RuntimeError("KAFKA_BOOTSTRAP_SERVERS is not configured")

    return KafkaProducer(
        bootstrap_servers=bootstrap_servers,
        value_serializer=lambda value: json.dumps(value, default=str).encode("utf-8"),
    )


def publish_event(
    *,
    event_type: str,
    payload: dict[str, Any],
    trace_id: str | None,
    causation_id: str | None = None,
    producer_name: str = "api-gateway",
) -> bool:
    if os.getenv("KAFKA_ENABLED", "true").strip().lower() == "false":
        logger.info("Kafka publishing skipped because KAFKA_ENABLED=false for event_type=%s", event_type)
        return False
    if not _bootstrap_servers():
        logger.warning(
            "Kafka publishing skipped because KAFKA_BOOTSTRAP_SERVERS is not configured for event_type=%s",
            event_type,
        )
        return False

    envelope = {
        "event_id": str(uuid.uuid4()),
        "trace_id": trace_id,
        "causation_id": causation_id,
        "event_type": event_type,
        "event_version": 1,
        "produced_at": datetime.now(timezone.utc).isoformat(),
        "producer": producer_name,
        "payload": payload,
    }

    try:
        future = _producer().send(_topic_name(), envelope)
        metadata = future.get(timeout=10)
        logger.info(
            "Kafka publish succeeded topic=%s partition=%s offset=%s event_type=%s",
            metadata.topic,
            metadata.partition,
            metadata.offset,
            event_type,
        )
        return True
    except Exception:
        logger.exception("Kafka publish failed for event_type=%s topic=%s", event_type, _topic_name())
        return False
