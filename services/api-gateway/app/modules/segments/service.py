from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import repository
from .schemas import (
    SegmentCreateRequest,
    SegmentResponse,
    SegmentRuleCreateRequest,
    SegmentRuleResponse,
    SegmentRuleUpdateRequest,
    SegmentUpdateRequest,
)


def _normalize_optional_string(value: str | None) -> str | None:
    if value is None:
        return None

    value = value.strip()
    return value or None


def _raise_not_found(entity_name: str) -> None:
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"{entity_name} not found",
    )


def _raise_code_conflict(entity_name: str, code: str) -> None:
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=f"{entity_name} with code '{code}' already exists",
    )


def _handle_integrity_error(exc: IntegrityError) -> None:
    message = str(exc.orig) if exc.orig else str(exc)
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Database constraint violated: {message}",
    ) from exc


def _prepare_segment_payload(payload: SegmentCreateRequest | SegmentUpdateRequest) -> dict:
    data = payload.model_dump()
    data["macro_segment"] = _normalize_optional_string(data.get("macro_segment"))
    return data


def _prepare_rule_payload(
    payload: SegmentRuleCreateRequest | SegmentRuleUpdateRequest,
) -> dict:
    return payload.model_dump(mode="json")


def _build_segment_response(db: Session, segment_id: str) -> dict:
    segment = repository.get_segment_by_id(db, segment_id)
    if not segment:
        _raise_not_found("Segment")

    rules = repository.list_segment_rules(db, segment_id)
    segment["rules"] = [
        SegmentRuleResponse(
            id=rule["id"],
            target_type=rule["target_type"],
            attribute_path=rule["attribute_path"],
            operator=rule["operator"],
            value=rule["value"],
            logic=rule["logic"],
        ).model_dump(mode="json")
        for rule in rules
    ]
    return SegmentResponse(**segment).model_dump(mode="json")


def list_segments(
    db: Session,
    *,
    active: bool | None = None,
    macro_segment: str | None = None,
    q: str | None = None,
) -> list[dict]:
    return repository.list_segments(
        db,
        active=active,
        macro_segment=_normalize_optional_string(macro_segment),
        q=_normalize_optional_string(q),
    )


def get_segment(db: Session, segment_id: str) -> dict:
    return _build_segment_response(db, segment_id)


def create_segment(db: Session, payload: SegmentCreateRequest) -> dict:
    data = _prepare_segment_payload(payload)
    existing = repository.get_segment_by_code(db, data["code"])

    if existing:
        _raise_code_conflict("Segment", data["code"])

    try:
        created = repository.create_segment(db, data)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    return _build_segment_response(db, created["id"])


def update_segment(
    db: Session,
    segment_id: str,
    payload: SegmentUpdateRequest,
) -> dict:
    existing = repository.get_segment_by_id(db, segment_id)
    if not existing:
        _raise_not_found("Segment")

    data = _prepare_segment_payload(payload)
    duplicate = repository.get_segment_by_code(db, data["code"])
    if duplicate and duplicate["id"] != segment_id:
        _raise_code_conflict("Segment", data["code"])

    try:
        updated = repository.update_segment(db, segment_id, data)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    if not updated:
        _raise_not_found("Segment")

    return _build_segment_response(db, segment_id)


def deactivate_segment(db: Session, segment_id: str) -> dict:
    existing = repository.get_segment_by_id(db, segment_id)
    if not existing:
        _raise_not_found("Segment")

    updated = repository.deactivate_segment(db, segment_id)
    db.commit()

    if not updated:
        _raise_not_found("Segment")

    return _build_segment_response(db, segment_id)


def list_segment_rules(db: Session, segment_id: str) -> list[dict]:
    if not repository.get_segment_by_id(db, segment_id):
        _raise_not_found("Segment")

    rules = repository.list_segment_rules(db, segment_id)
    return [
        SegmentRuleResponse(
            id=rule["id"],
            target_type=rule["target_type"],
            attribute_path=rule["attribute_path"],
            operator=rule["operator"],
            value=rule["value"],
            logic=rule["logic"],
        ).model_dump(mode="json")
        for rule in rules
    ]


def create_segment_rule(
    db: Session,
    segment_id: str,
    payload: SegmentRuleCreateRequest,
) -> dict:
    if not repository.get_segment_by_id(db, segment_id):
        _raise_not_found("Segment")

    try:
        created = repository.create_segment_rule(
            db,
            segment_id,
            _prepare_rule_payload(payload),
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    return SegmentRuleResponse(
        id=created["id"],
        target_type=created["target_type"],
        attribute_path=created["attribute_path"],
        operator=created["operator"],
        value=created["value"],
        logic=created["logic"],
    ).model_dump(mode="json")


def update_segment_rule(
    db: Session,
    segment_id: str,
    rule_id: str,
    payload: SegmentRuleUpdateRequest,
) -> dict:
    if not repository.get_segment_by_id(db, segment_id):
        _raise_not_found("Segment")

    try:
        updated = repository.update_segment_rule(
            db,
            segment_id,
            rule_id,
            _prepare_rule_payload(payload),
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    if not updated:
        _raise_not_found("Segment rule")

    return SegmentRuleResponse(
        id=updated["id"],
        target_type=updated["target_type"],
        attribute_path=updated["attribute_path"],
        operator=updated["operator"],
        value=updated["value"],
        logic=updated["logic"],
    ).model_dump(mode="json")


def delete_segment_rule(db: Session, segment_id: str, rule_id: str) -> None:
    if not repository.get_segment_by_id(db, segment_id):
        _raise_not_found("Segment")

    deleted = repository.delete_segment_rule(db, segment_id, rule_id)
    if not deleted:
        db.rollback()
        _raise_not_found("Segment rule")

    db.commit()
