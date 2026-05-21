from sqlalchemy import text
from sqlalchemy.orm import Session


def _fetch_one(db: Session, query: str, params: dict | None = None) -> dict | None:
    row = db.execute(text(query), params or {}).mappings().first()
    return dict(row) if row else None


def _fetch_all(db: Session, query: str, params: dict | None = None) -> list[dict]:
    rows = db.execute(text(query), params or {}).mappings().all()
    return [dict(row) for row in rows]


def create_matching_run(
    db: Session,
    *,
    run_type: str,
    direction: str,
    model_version_id: str,
    launched_by_user_id: str | None,
    source_entity_type: str,
    source_entity_id: str,
    parameters_json: dict,
) -> dict:
    return _fetch_one(
        db,
        """
        INSERT INTO matching.matching_run (
            run_type,
            direction,
            model_version_id,
            launched_by_user_id,
            source_entity_type,
            source_entity_id,
            status,
            parameters_json,
            started_at
        )
        VALUES (
            :run_type,
            :direction,
            CAST(:model_version_id AS uuid),
            CAST(:launched_by_user_id AS uuid),
            :source_entity_type,
            :source_entity_id,
            'PENDING',
            CAST(:parameters_json AS jsonb),
            now()
        )
        RETURNING
            id::text AS id,
            run_type,
            direction,
            model_version_id::text AS model_version_id,
            launched_by_user_id::text AS launched_by_user_id,
            source_entity_type,
            source_entity_id,
            status,
            parameters_json,
            started_at,
            finished_at,
            error_message;
        """,
        {
            "run_type": run_type,
            "direction": direction,
            "model_version_id": model_version_id,
            "launched_by_user_id": launched_by_user_id,
            "source_entity_type": source_entity_type,
            "source_entity_id": source_entity_id,
            "parameters_json": _to_json(parameters_json),
        },
    )


def get_matching_run_by_id(db: Session, run_id: str) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            id::text AS id,
            run_type,
            direction,
            model_version_id::text AS model_version_id,
            launched_by_user_id::text AS launched_by_user_id,
            source_entity_type,
            source_entity_id,
            status,
            parameters_json,
            started_at,
            finished_at,
            error_message
        FROM matching.matching_run
        WHERE id = CAST(:run_id AS uuid)
        LIMIT 1;
        """,
        {"run_id": run_id},
    )


def list_matching_results_by_run(db: Session, run_id: str) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            mr.id::text AS id,
            mr.run_id::text AS run_id,
            mr.candidate_id::text AS candidate_id,
            NULLIF(TRIM(COALESCE(jsi.first_name, '') || ' ' || COALESCE(jsi.last_name, '')), '') AS candidate_label,
            mr.offer_id::text AS offer_id,
            jo.title AS offer_title,
            jo.occupation_node_id::text AS occupation_id,
            mr.score_global::float8 AS score_global,
            mr.score_rule_based::float8 AS score_rule_based,
            mr.score_semantic::float8 AS score_semantic,
            mr.rank,
            mr.eligibility_status,
            mr.decision_status,
            mr.decision_reason,
            mr.decision_by_user_id::text AS decision_by_user_id,
            mr.decision_at,
            mr.explanation_short,
            mr.explanation_json,
            EXISTS (
                SELECT 1
                FROM matching.matching_result_detail mrd
                WHERE mrd.result_id = mr.id
                AND COALESCE(mrd.is_gap, FALSE) = TRUE
            ) AS has_gaps,
            mr.created_at
        FROM matching.matching_result mr
        LEFT JOIN aneti.job_seeker_identity jsi
            ON jsi.job_seeker_id = mr.candidate_id
        LEFT JOIN aneti.job_offer jo
            ON jo.id = mr.offer_id
        WHERE mr.run_id = CAST(:run_id AS uuid)
        ORDER BY mr.rank ASC, mr.created_at ASC;
        """,
        {"run_id": run_id},
    )


def get_matching_result_by_id(db: Session, result_id: str) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            mr.id::text AS id,
            mr.run_id::text AS run_id,
            mr.candidate_id::text AS candidate_id,
            NULLIF(TRIM(COALESCE(jsi.first_name, '') || ' ' || COALESCE(jsi.last_name, '')), '') AS candidate_label,
            mr.offer_id::text AS offer_id,
            jo.title AS offer_title,
            jo.occupation_node_id::text AS occupation_id,
            mr.score_global::float8 AS score_global,
            mr.score_rule_based::float8 AS score_rule_based,
            mr.score_semantic::float8 AS score_semantic,
            mr.rank,
            mr.eligibility_status,
            mr.decision_status,
            mr.decision_reason,
            mr.decision_by_user_id::text AS decision_by_user_id,
            mr.decision_at,
            mr.explanation_short,
            mr.explanation_json,
            EXISTS (
                SELECT 1
                FROM matching.matching_result_detail mrd
                WHERE mrd.result_id = mr.id
                  AND COALESCE(mrd.is_gap, FALSE) = TRUE
            ) AS has_gaps,
            mr.created_at
        FROM matching.matching_result mr
        LEFT JOIN aneti.job_seeker_identity jsi
            ON jsi.job_seeker_id = mr.candidate_id
        LEFT JOIN aneti.job_offer jo
            ON jo.id = mr.offer_id
        WHERE mr.id = CAST(:result_id AS uuid)
        LIMIT 1;
        """,
        {"result_id": result_id},
    )


def list_matching_result_details(db: Session, result_id: str) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            mrd.id::text AS id,
            mrd.result_id::text AS result_id,
            mrd.criterion_code,
            mrd.criterion_label,
            mrd.score::float8 AS score,
            mrd.weight::float8 AS weight,
            mrd.weighted_score::float8 AS weighted_score,
            mrd.matched,
            COALESCE(mrd.is_gap, FALSE) AS is_gap,
            mrd.gap_type,
            mrd.gap_message,
            mrd.recommendation,
            COALESCE(mrd.metadata_json, '{}'::jsonb) AS metadata_json,
            mrd.created_at
        FROM matching.matching_result_detail mrd
        WHERE mrd.result_id = CAST(:result_id AS uuid)
        ORDER BY mrd.is_gap DESC, mrd.weighted_score DESC NULLS LAST, mrd.criterion_code ASC;
        """,
        {"result_id": result_id},
    )


def update_matching_result_decision(
    db: Session,
    *,
    result_id: str,
    decision_status: str,
    decision_reason: str | None,
    decision_by_user_id: str | None,
) -> bool:
    params = {
        "result_id": result_id,
        "decision_status": decision_status,
        "decision_reason": decision_reason,
        "decision_by_user_id": decision_by_user_id,
    }

    result = db.execute(
        text(
            """
            UPDATE matching.matching_result
            SET
                decision_status = :decision_status,
                decision_reason = :decision_reason,
                decision_by_user_id = CAST(:decision_by_user_id AS uuid),
                decision_at = CASE
                    WHEN :decision_by_user_id IS NULL THEN NULL
                    ELSE now()
                END
            WHERE id = CAST(:result_id AS uuid);
            """
        ),
        params,
    )
    return result.rowcount > 0


def _to_json(value: dict) -> str:
    import json

    return json.dumps(value, ensure_ascii=False, default=str)

