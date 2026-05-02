from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import repository
from .schemas import (
    MatchingCriterionCreateRequest,
    MatchingCriterionResponse,
    MatchingCriterionUpdateRequest,
    MatchingHardFilterCreateRequest,
    MatchingHardFilterResponse,
    MatchingHardFilterUpdateRequest,
    MatchingModelCreateRequest,
    MatchingModelCriterionCreateRequest,
    MatchingModelCriterionResponse,
    MatchingModelCriterionUpdateRequest,
    MatchingModelResponse,
    MatchingModelUpdateRequest,
    MatchingModelVersionCreateRequest,
    MatchingModelVersionResponse,
    MatchingModelVersionUpdateRequest,
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


def _raise_conflict(detail: str) -> None:
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=detail,
    )


def _raise_bad_request(detail: str) -> None:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=detail,
    )


def _handle_integrity_error(exc: IntegrityError) -> None:
    message = str(exc.orig) if exc.orig else str(exc)
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Database constraint violated: {message}",
    ) from exc


def _serialize_criterion(criterion: dict) -> dict:
    return MatchingCriterionResponse(**criterion).model_dump(mode="json")


def _serialize_model_criterion(model_criterion: dict) -> dict:
    return MatchingModelCriterionResponse(**model_criterion).model_dump(mode="json")


def _serialize_hard_filter(hard_filter: dict) -> dict:
    return MatchingHardFilterResponse(**hard_filter).model_dump(mode="json")


def _serialize_version(
    version: dict,
    *,
    criteria_by_version_id: dict[str, list[dict]],
    hard_filters_by_version_id: dict[str, list[dict]],
) -> dict:
    return MatchingModelVersionResponse(
        id=version["id"],
        version_number=version["version_number"],
        status=version["status"],
        created_at=version["created_at"],
        published_at=version["published_at"],
        criteria=criteria_by_version_id.get(version["id"], []),
        hard_filters=hard_filters_by_version_id.get(version["id"], []),
    ).model_dump(mode="json")


def _group_versions_for_response(
    versions: list[dict],
    criteria: list[dict],
    hard_filters: list[dict],
) -> dict[str, list[dict]]:
    criteria_by_version_id: dict[str, list[dict]] = {}
    for criterion in criteria:
        criteria_by_version_id.setdefault(criterion["model_version_id"], []).append(
            _serialize_model_criterion(criterion)
        )

    hard_filters_by_version_id: dict[str, list[dict]] = {}
    for hard_filter in hard_filters:
        hard_filters_by_version_id.setdefault(
            hard_filter["model_version_id"],
            [],
        ).append(_serialize_hard_filter(hard_filter))

    versions_by_model_id: dict[str, list[dict]] = {}
    for version in versions:
        versions_by_model_id.setdefault(version["model_id"], []).append(
            _serialize_version(
                version,
                criteria_by_version_id=criteria_by_version_id,
                hard_filters_by_version_id=hard_filters_by_version_id,
            )
        )

    return versions_by_model_id


def _build_model_response(
    model: dict,
    versions_by_model_id: dict[str, list[dict]],
) -> dict:
    return MatchingModelResponse(
        id=model["id"],
        code=model["code"],
        label=model["label"],
        direction=model["direction"],
        description=model["description"],
        active=model["active"],
        versions=versions_by_model_id.get(model["id"], []),
    ).model_dump(mode="json")


def _build_model_version_response(
    db: Session,
    model_id: str,
    version_id: str,
) -> dict:
    version = repository.get_model_version_for_model(db, model_id, version_id)
    if not version:
        _raise_not_found("Model version")

    criteria = repository.list_model_criteria(db, version_id)
    hard_filters = repository.list_hard_filters(db, version_id)
    versions_by_model_id = _group_versions_for_response([version], criteria, hard_filters)
    return versions_by_model_id[model_id][0]


def _prepare_criterion_payload(
    payload: MatchingCriterionCreateRequest | MatchingCriterionUpdateRequest,
) -> dict:
    data = payload.model_dump(mode="json")
    data["description"] = _normalize_optional_string(data.get("description"))
    return data


def _prepare_model_payload(
    payload: MatchingModelCreateRequest | MatchingModelUpdateRequest,
) -> dict:
    data = payload.model_dump(mode="json")
    data["description"] = _normalize_optional_string(data.get("description"))
    return data


def _prepare_model_criterion_payload(
    payload: MatchingModelCriterionCreateRequest | MatchingModelCriterionUpdateRequest,
) -> dict:
    return payload.model_dump(mode="json")


def _prepare_hard_filter_payload(
    payload: MatchingHardFilterCreateRequest | MatchingHardFilterUpdateRequest,
) -> dict:
    data = payload.model_dump(mode="json")
    data["rejection_reason"] = _normalize_optional_string(data.get("rejection_reason"))
    return data


def list_criteria(db: Session) -> list[dict]:
    return [_serialize_criterion(row) for row in repository.list_criteria(db)]


def get_criterion(db: Session, criterion_id: str) -> dict:
    criterion = repository.get_criterion_by_id(db, criterion_id)
    if not criterion:
        _raise_not_found("Matching criterion")
    return _serialize_criterion(criterion)


def create_criterion(db: Session, payload: MatchingCriterionCreateRequest) -> dict:
    data = _prepare_criterion_payload(payload)

    duplicate = repository.get_criterion_by_code(db, data["code"])
    if duplicate:
        _raise_conflict(f"Matching criterion with code '{data['code']}' already exists")

    try:
        created = repository.create_criterion(db, data)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    return _serialize_criterion(created)


def update_criterion(
    db: Session,
    criterion_id: str,
    payload: MatchingCriterionUpdateRequest,
) -> dict:
    if not repository.get_criterion_by_id(db, criterion_id):
        _raise_not_found("Matching criterion")

    data = _prepare_criterion_payload(payload)
    duplicate = repository.get_criterion_by_code(db, data["code"])
    if duplicate and duplicate["id"] != criterion_id:
        _raise_conflict(f"Matching criterion with code '{data['code']}' already exists")

    try:
        updated = repository.update_criterion(db, criterion_id, data)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    if not updated:
        _raise_not_found("Matching criterion")

    return _serialize_criterion(updated)


def deactivate_criterion(db: Session, criterion_id: str) -> dict:
    if not repository.get_criterion_by_id(db, criterion_id):
        _raise_not_found("Matching criterion")

    updated = repository.deactivate_criterion(db, criterion_id)
    db.commit()

    if not updated:
        _raise_not_found("Matching criterion")

    return _serialize_criterion(updated)


def list_models(db: Session) -> list[dict]:
    models = repository.list_models(db)
    versions = repository.list_model_versions(db)
    criteria = repository.list_model_criteria(db)
    hard_filters = repository.list_hard_filters(db)

    versions_by_model_id = _group_versions_for_response(versions, criteria, hard_filters)
    return [_build_model_response(model, versions_by_model_id) for model in models]


def get_model(db: Session, model_id: str) -> dict:
    model = repository.get_model_by_id(db, model_id)
    if not model:
        _raise_not_found("Matching model")

    versions = repository.list_model_versions(db, model_id)
    criteria = repository.list_model_criteria(db)
    hard_filters = repository.list_hard_filters(db)
    versions_by_model_id = _group_versions_for_response(versions, criteria, hard_filters)
    return _build_model_response(model, versions_by_model_id)


def create_model(db: Session, payload: MatchingModelCreateRequest) -> dict:
    data = _prepare_model_payload(payload)

    duplicate = repository.get_model_by_code(db, data["code"])
    if duplicate:
        _raise_conflict(f"Matching model with code '{data['code']}' already exists")

    try:
        created = repository.create_model(db, data)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    return MatchingModelResponse(
        id=created["id"],
        code=created["code"],
        label=created["label"],
        direction=created["direction"],
        description=created["description"],
        active=created["active"],
        versions=[],
    ).model_dump(mode="json")


def update_model(
    db: Session,
    model_id: str,
    payload: MatchingModelUpdateRequest,
) -> dict:
    if not repository.get_model_by_id(db, model_id):
        _raise_not_found("Matching model")

    data = _prepare_model_payload(payload)
    duplicate = repository.get_model_by_code(db, data["code"])
    if duplicate and duplicate["id"] != model_id:
        _raise_conflict(f"Matching model with code '{data['code']}' already exists")

    try:
        updated = repository.update_model(db, model_id, data)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    if not updated:
        _raise_not_found("Matching model")

    return get_model(db, model_id)


def deactivate_model(db: Session, model_id: str) -> dict:
    if not repository.get_model_by_id(db, model_id):
        _raise_not_found("Matching model")

    updated = repository.deactivate_model(db, model_id)
    db.commit()

    if not updated:
        _raise_not_found("Matching model")

    return get_model(db, model_id)


def list_model_versions(db: Session, model_id: str) -> list[dict]:
    if not repository.get_model_by_id(db, model_id):
        _raise_not_found("Matching model")

    versions = repository.list_model_versions(db, model_id)
    criteria = repository.list_model_criteria(db)
    hard_filters = repository.list_hard_filters(db)
    versions_by_model_id = _group_versions_for_response(versions, criteria, hard_filters)
    return versions_by_model_id.get(model_id, [])


def create_model_version(
    db: Session,
    model_id: str,
    payload: MatchingModelVersionCreateRequest,
    *,
    created_by_user_id: str,
) -> dict:
    if not repository.get_model_by_id(db, model_id):
        _raise_not_found("Matching model")

    version_number = payload.version_number or repository.get_next_model_version_number(db, model_id)
    duplicate = repository.get_model_version_by_number(db, model_id, version_number)
    if duplicate:
        _raise_conflict(
            f"Matching model version {version_number} already exists for this model"
        )

    try:
        created = repository.create_model_version(
            db,
            model_id,
            version_number=version_number,
            created_by_user_id=created_by_user_id,
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    return _build_model_version_response(db, model_id, created["id"])


def update_model_version(
    db: Session,
    model_id: str,
    version_id: str,
    payload: MatchingModelVersionUpdateRequest,
) -> dict:
    if not repository.get_model_version_for_model(db, model_id, version_id):
        _raise_not_found("Model version")

    duplicate = repository.get_model_version_by_number(db, model_id, payload.version_number)
    if duplicate and duplicate["id"] != version_id:
        _raise_conflict(
            f"Matching model version {payload.version_number} already exists for this model"
        )

    try:
        updated = repository.update_model_version_number(
            db,
            model_id,
            version_id,
            version_number=payload.version_number,
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    if not updated:
        _raise_not_found("Model version")

    return _build_model_version_response(db, model_id, version_id)


def publish_model_version(db: Session, model_id: str, version_id: str) -> dict:
    version = repository.get_model_version_for_model(db, model_id, version_id)
    if not version:
        _raise_not_found("Model version")

    summary = repository.get_model_version_weight_summary(db, version_id)
    criterion_count = int(summary["criterion_count"])
    total_weight = Decimal(str(summary["total_weight"]))

    if criterion_count < 1:
        _raise_bad_request("A model version must contain at least one criterion before publishing")

    if total_weight != Decimal("100"):
        _raise_bad_request("The sum of criterion weights must be exactly 100 before publishing")

    try:
        repository.archive_other_active_model_versions(db, model_id, version_id)
        published = repository.publish_model_version(db, model_id, version_id)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    if not published:
        _raise_not_found("Model version")

    return _build_model_version_response(db, model_id, version_id)


def archive_model_version(db: Session, model_id: str, version_id: str) -> dict:
    if not repository.get_model_version_for_model(db, model_id, version_id):
        _raise_not_found("Model version")

    updated = repository.archive_model_version(db, model_id, version_id)
    db.commit()

    if not updated:
        _raise_not_found("Model version")

    return _build_model_version_response(db, model_id, version_id)


def list_model_version_criteria(db: Session, version_id: str) -> list[dict]:
    if not repository.get_model_version_by_id(db, version_id):
        _raise_not_found("Model version")

    return [
        _serialize_model_criterion(row)
        for row in repository.list_model_criteria(db, version_id)
    ]


def create_model_version_criterion(
    db: Session,
    version_id: str,
    payload: MatchingModelCriterionCreateRequest,
) -> dict:
    if not repository.get_model_version_by_id(db, version_id):
        _raise_not_found("Model version")

    criterion_id = str(payload.criterion_id)
    if not repository.get_criterion_by_id(db, criterion_id):
        _raise_not_found("Matching criterion")

    duplicate = repository.get_model_criterion_by_version_and_criterion(
        db,
        version_id,
        criterion_id,
    )
    if duplicate:
        _raise_conflict("This criterion is already configured for the selected model version")

    try:
        created = repository.create_model_criterion(
            db,
            version_id,
            _prepare_model_criterion_payload(payload),
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    model_criterion = repository.get_model_criterion_by_id(db, version_id, created["id"])
    if not model_criterion:
        _raise_not_found("Model criterion")

    return _serialize_model_criterion(model_criterion)


def update_model_version_criterion(
    db: Session,
    version_id: str,
    model_criterion_id: str,
    payload: MatchingModelCriterionUpdateRequest,
) -> dict:
    existing = repository.get_model_criterion_by_id(db, version_id, model_criterion_id)
    if not existing:
        _raise_not_found("Model criterion")

    criterion_id = str(payload.criterion_id)
    if not repository.get_criterion_by_id(db, criterion_id):
        _raise_not_found("Matching criterion")

    duplicate = repository.get_model_criterion_by_version_and_criterion(
        db,
        version_id,
        criterion_id,
    )
    if duplicate and duplicate["id"] != model_criterion_id:
        _raise_conflict("This criterion is already configured for the selected model version")

    try:
        updated = repository.update_model_criterion(
            db,
            version_id,
            model_criterion_id,
            _prepare_model_criterion_payload(payload),
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    if not updated:
        _raise_not_found("Model criterion")

    model_criterion = repository.get_model_criterion_by_id(db, version_id, model_criterion_id)
    if not model_criterion:
        _raise_not_found("Model criterion")

    return _serialize_model_criterion(model_criterion)


def delete_model_version_criterion(
    db: Session,
    version_id: str,
    model_criterion_id: str,
) -> None:
    if not repository.get_model_version_by_id(db, version_id):
        _raise_not_found("Model version")

    deleted = repository.delete_model_criterion(db, version_id, model_criterion_id)
    if not deleted:
        db.rollback()
        _raise_not_found("Model criterion")

    db.commit()


def list_model_version_hard_filters(db: Session, version_id: str) -> list[dict]:
    if not repository.get_model_version_by_id(db, version_id):
        _raise_not_found("Model version")

    return [
        _serialize_hard_filter(row)
        for row in repository.list_hard_filters(db, version_id)
    ]


def create_model_version_hard_filter(
    db: Session,
    version_id: str,
    payload: MatchingHardFilterCreateRequest,
) -> dict:
    if not repository.get_model_version_by_id(db, version_id):
        _raise_not_found("Model version")

    criterion_id = str(payload.criterion_id)
    if not repository.get_criterion_by_id(db, criterion_id):
        _raise_not_found("Matching criterion")

    try:
        created = repository.create_hard_filter(
            db,
            version_id,
            _prepare_hard_filter_payload(payload),
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    hard_filter = repository.get_hard_filter_by_id(db, version_id, created["id"])
    if not hard_filter:
        _raise_not_found("Hard filter")

    return _serialize_hard_filter(hard_filter)


def update_model_version_hard_filter(
    db: Session,
    version_id: str,
    filter_id: str,
    payload: MatchingHardFilterUpdateRequest,
) -> dict:
    existing = repository.get_hard_filter_by_id(db, version_id, filter_id)
    if not existing:
        _raise_not_found("Hard filter")

    criterion_id = str(payload.criterion_id)
    if not repository.get_criterion_by_id(db, criterion_id):
        _raise_not_found("Matching criterion")

    try:
        updated = repository.update_hard_filter(
            db,
            version_id,
            filter_id,
            _prepare_hard_filter_payload(payload),
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        _handle_integrity_error(exc)

    if not updated:
        _raise_not_found("Hard filter")

    hard_filter = repository.get_hard_filter_by_id(db, version_id, filter_id)
    if not hard_filter:
        _raise_not_found("Hard filter")

    return _serialize_hard_filter(hard_filter)


def delete_model_version_hard_filter(
    db: Session,
    version_id: str,
    filter_id: str,
) -> None:
    if not repository.get_model_version_by_id(db, version_id):
        _raise_not_found("Model version")

    deleted = repository.delete_hard_filter(db, version_id, filter_id)
    if not deleted:
        db.rollback()
        _raise_not_found("Hard filter")

    db.commit()
