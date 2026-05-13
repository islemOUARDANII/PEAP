from __future__ import annotations

from uuid import UUID

from app.db import fetch_all


def get_eligible_results_for_run(
    *,
    run_id: UUID,
    threshold: float,
    top_limit: int,
) -> list[dict]:
    return fetch_all(
        """
        SELECT
            mr.id AS result_id,
            mr.run_id,
            mr.candidate_id,
            mr.offer_id,
            mr.score_global,
            mr.eligibility_status,
            mr.decision_status,
            mr.explanation_json,

            jo.title AS offer_title,

            e.legal_name AS company_name,
            e.commercial_name AS company_commercial_name,

            jsi.first_name,
            jsi.last_name,

            jsc.email AS candidate_email

        FROM matching.matching_result mr

        LEFT JOIN aneti.job_offer jo
            ON jo.id = mr.offer_id

        LEFT JOIN aneti.employer e
            ON e.id = jo.employer_id

        LEFT JOIN aneti.job_seeker_identity jsi
            ON jsi.job_seeker_id = mr.candidate_id

        LEFT JOIN aneti.job_seeker_contact jsc
            ON jsc.job_seeker_id = mr.candidate_id

        WHERE mr.run_id = %(run_id)s
          AND mr.candidate_id IS NOT NULL
          AND mr.offer_id IS NOT NULL
          AND mr.score_global >= %(threshold)s
          AND UPPER(COALESCE(mr.decision_status, 'PENDING')) <> 'NOT_ELIGIBLE'
          AND UPPER(COALESCE(mr.eligibility_status, 'ELIGIBLE')) IN (
                'ELIGIBLE',
                'PARTIAL',
                'PARTIALLY_ELIGIBLE',
                'COMPATIBLE',
                'MATCHED'
          )

        ORDER BY mr.score_global DESC
        LIMIT %(top_limit)s
        """,
        {
            "run_id": str(run_id),
            "threshold": threshold,
            "top_limit": top_limit,
        },
    )