from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session


def load_run(db: Session, run_id: UUID) -> dict[str, Any]:
    row = db.execute(
        text("""
            SELECT
                id,
                run_type,
                direction,
                model_version_id,
                launched_by_user_id,
                source_entity_type,
                source_entity_id,
                status,
                parameters_json,
                search_id
            FROM matching.matching_run
            WHERE id = :run_id
        """),
        {"run_id": str(run_id)},
    ).mappings().first()

    if not row:
        raise ValueError(f"Matching run not found: {run_id}")

    return dict(row)


def mark_run_started(db: Session, run_id: UUID) -> None:
    db.execute(
        text("""
            UPDATE matching.matching_run
            SET status = 'RUNNING',
                started_at = now(),
                error_message = NULL
            WHERE id = :run_id
        """),
        {"run_id": str(run_id)},
    )


def mark_run_completed(db: Session, run_id: UUID) -> None:
    db.execute(
        text("""
            UPDATE matching.matching_run
            SET status = 'COMPLETED',
                finished_at = now()
            WHERE id = :run_id
        """),
        {"run_id": str(run_id)},
    )


def mark_run_failed(db: Session, run_id: UUID, error_message: str) -> None:
    db.execute(
        text("""
            UPDATE matching.matching_run
            SET status = 'FAILED',
                finished_at = now(),
                error_message = :error_message
            WHERE id = :run_id
        """),
        {"run_id": str(run_id), "error_message": error_message},
    )


def delete_existing_results_for_run(db: Session, run_id: UUID) -> None:
    db.execute(
        text("""
            DELETE FROM matching.matching_result
            WHERE run_id = :run_id
        """),
        {"run_id": str(run_id)},
    )


def insert_result(
    db: Session,
    run_id: UUID,
    candidate_id: UUID | None,
    offer_id: UUID | None,
    rank: int,
    scoring: dict[str, Any],
) -> UUID:
    result_id = db.execute(
        text("""
            INSERT INTO matching.matching_result (
                run_id,
                candidate_id,
                offer_id,
                occupation_id,
                score_global,
                score_rule_based,
                score_semantic,
                rank,
                eligibility_status,
                decision_status,
                explanation_short,
                explanation_json,
                created_at
            )
            VALUES (
                :run_id,
                :candidate_id,
                :offer_id,
                NULL,
                :score_global,
                :score_rule_based,
                :score_semantic,
                :rank,
                :eligibility_status,
                :decision_status,
                :explanation_short,
                CAST(:explanation_json AS jsonb),
                now()
            )
            RETURNING id
        """),
        {
            "run_id": str(run_id),
            "candidate_id": str(candidate_id) if candidate_id else None,
            "offer_id": str(offer_id) if offer_id else None,
            "score_global": scoring["score_global"] * 100,
            "score_rule_based": scoring.get("score_rule_based", 0) * 100,
            "score_semantic": scoring.get("score_semantic", 0) * 100,
            "rank": rank,
            "eligibility_status": scoring["eligibility_status"],
            "decision_status": scoring["decision_status"],
            "explanation_short": scoring.get("explanation_short"),
            "explanation_json": _to_json(scoring.get("explanation_json", {})),
        },
    ).scalar_one()

    for detail in scoring.get("details", []):
        insert_result_detail(db, result_id, detail)

    return result_id


def insert_result_detail(db: Session, result_id: UUID, detail: dict[str, Any]) -> None:
    db.execute(
        text("""
            INSERT INTO matching.matching_result_detail (
                result_id,
                criterion_code,
                criterion_label,
                score,
                weight,
                weighted_score,
                matched,
                is_gap,
                gap_type,
                gap_message,
                recommendation,
                metadata_json,
                created_at
            )
            VALUES (
                :result_id,
                :criterion_code,
                :criterion_label,
                :score,
                :weight,
                :weighted_score,
                :matched,
                :is_gap,
                :gap_type,
                :gap_message,
                :recommendation,
                CAST(:metadata_json AS jsonb),
                now()
            )
        """),
        {
            "result_id": str(result_id),
            "criterion_code": detail.get("criterion_code"),
            "criterion_label": detail.get("criterion_label"),
            "score": _percent(detail.get("score")),
            "weight": detail.get("weight"),
            "weighted_score": detail.get("weighted_score"),
            "matched": detail.get("matched"),
            "is_gap": detail.get("is_gap", False),
            "gap_type": detail.get("gap_type"),
            "gap_message": detail.get("gap_message"),
            "recommendation": detail.get("recommendation"),
            "metadata_json": _to_json(detail.get("metadata_json", {})),
        },
    )


def _percent(value: Any) -> float | None:
    if value is None:
        return None
    return float(value) * 100


def _to_json(value: Any) -> str:
    import json
    return json.dumps(value, ensure_ascii=False, default=str)