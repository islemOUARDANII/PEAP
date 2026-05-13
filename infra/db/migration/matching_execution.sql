BEGIN;

-- =========================================================
-- H. MATCHING EXECUTION - ANETI
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS matching;

-- =========================================================
-- 1. matching_run
-- =========================================================
CREATE TABLE IF NOT EXISTS matching.matching_run (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    run_type TEXT NOT NULL,
    direction TEXT NOT NULL,

    model_version_id UUID NOT NULL,
    launched_by_user_id UUID NULL,

    source_entity_type TEXT NOT NULL,
    source_entity_id TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'PENDING',

    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ NULL,

    parameters_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message TEXT NULL,

    CONSTRAINT fk_matching_run_model_version
        FOREIGN KEY (model_version_id)
        REFERENCES matching.matching_model_version (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_matching_run_launched_by_user
        FOREIGN KEY (launched_by_user_id)
        REFERENCES iam.auth_user (id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT ck_matching_run_type
        CHECK (
            run_type IN (
                'MANUAL',
                'AUTOMATIC',
                'BATCH',
                'TEST'
            )
        ),

    CONSTRAINT ck_matching_run_direction
        CHECK (
            direction IN (
                'CANDIDATE_TO_OFFER',
                'OFFER_TO_CANDIDATE',
                'CANDIDATE_TO_OCCUPATION'
            )
        ),

    CONSTRAINT ck_matching_run_source_entity_type
        CHECK (
            source_entity_type IN (
                'JOB_SEEKER',
                'JOB_OFFER',
                'RTMC_OCCUPATION',
                'SEGMENT'
            )
        ),

    CONSTRAINT ck_matching_run_status
        CHECK (
            status IN (
                'PENDING',
                'RUNNING',
                'COMPLETED',
                'FAILED',
                'CANCELLED'
            )
        ),

    CONSTRAINT ck_matching_run_source_entity_id_not_empty
        CHECK (btrim(source_entity_id) <> '')
);

-- =========================================================
-- 2. matching_result
-- =========================================================
CREATE TABLE IF NOT EXISTS matching.matching_result (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    run_id UUID NOT NULL,

    candidate_id UUID NULL,
    offer_id UUID NULL,

    -- Pour CANDIDATE_TO_OCCUPATION.
    -- On garde TEXT car le RTMC utilise généralement code_metier comme identifiant métier.
    occupation_id TEXT NULL,

    score_global NUMERIC(7,4) NOT NULL DEFAULT 0,
    score_rule_based NUMERIC(7,4) NULL,
    score_semantic NUMERIC(7,4) NULL,

    rank INTEGER NOT NULL,

    eligibility_status TEXT NOT NULL DEFAULT 'ELIGIBLE',
    decision_status TEXT NOT NULL DEFAULT 'TEMPORARY',

    decision_by_user_id UUID NULL,
    decision_at TIMESTAMPTZ NULL,
    decision_reason TEXT NULL,

    explanation_short TEXT NULL,
    explanation_json JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_matching_result_run
        FOREIGN KEY (run_id)
        REFERENCES matching.matching_run (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_matching_result_decision_by_user
        FOREIGN KEY (decision_by_user_id)
        REFERENCES iam.auth_user (id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT ck_matching_result_score_global
        CHECK (score_global >= 0 AND score_global <= 100),

    CONSTRAINT ck_matching_result_score_rule_based
        CHECK (score_rule_based IS NULL OR (score_rule_based >= 0 AND score_rule_based <= 100)),

    CONSTRAINT ck_matching_result_score_semantic
        CHECK (score_semantic IS NULL OR (score_semantic >= 0 AND score_semantic <= 100)),

    CONSTRAINT ck_matching_result_rank_positive
        CHECK (rank > 0),

    CONSTRAINT ck_matching_result_eligibility_status
        CHECK (
            eligibility_status IN (
                'ELIGIBLE',
                'PARTIALLY_ELIGIBLE',
                'NOT_ELIGIBLE',
                'REJECTED_BY_HARD_FILTER'
            )
        ),

    CONSTRAINT ck_matching_result_decision_status
        CHECK (
            decision_status IN (
                'TEMPORARY',
                'RETAINED',
                'REJECTED',
                'EXPIRED'
            )
        ),

    -- Au moins une cible doit exister selon le type de matching.
    CONSTRAINT ck_matching_result_has_target
        CHECK (
            candidate_id IS NOT NULL
            OR offer_id IS NOT NULL
            OR occupation_id IS NOT NULL
        )
);

-- =========================================================
-- 3. Index matching_run
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_matching_run_direction
    ON matching.matching_run (direction);

CREATE INDEX IF NOT EXISTS idx_matching_run_status
    ON matching.matching_run (status);

CREATE INDEX IF NOT EXISTS idx_matching_run_model_version
    ON matching.matching_run (model_version_id);

CREATE INDEX IF NOT EXISTS idx_matching_run_launched_by
    ON matching.matching_run (launched_by_user_id);

CREATE INDEX IF NOT EXISTS idx_matching_run_source
    ON matching.matching_run (source_entity_type, source_entity_id);

CREATE INDEX IF NOT EXISTS idx_matching_run_started_at
    ON matching.matching_run (started_at DESC);

-- =========================================================
-- 4. Index matching_result
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_matching_result_run
    ON matching.matching_result (run_id);

CREATE INDEX IF NOT EXISTS idx_matching_result_candidate
    ON matching.matching_result (candidate_id);

CREATE INDEX IF NOT EXISTS idx_matching_result_offer
    ON matching.matching_result (offer_id);

CREATE INDEX IF NOT EXISTS idx_matching_result_occupation
    ON matching.matching_result (occupation_id);

CREATE INDEX IF NOT EXISTS idx_matching_result_rank
    ON matching.matching_result (run_id, rank);

CREATE INDEX IF NOT EXISTS idx_matching_result_score_global
    ON matching.matching_result (score_global DESC);

CREATE INDEX IF NOT EXISTS idx_matching_result_decision_status
    ON matching.matching_result (decision_status);

CREATE INDEX IF NOT EXISTS idx_matching_result_eligibility_status
    ON matching.matching_result (eligibility_status);

CREATE INDEX IF NOT EXISTS idx_matching_result_created_at
    ON matching.matching_result (created_at DESC);

-- Pour éviter deux résultats identiques dans le même run.
CREATE UNIQUE INDEX IF NOT EXISTS uq_matching_result_candidate_offer_per_run
    ON matching.matching_result (run_id, candidate_id, offer_id)
    WHERE candidate_id IS NOT NULL AND offer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_matching_result_candidate_occupation_per_run
    ON matching.matching_result (run_id, candidate_id, occupation_id)
    WHERE candidate_id IS NOT NULL AND occupation_id IS NOT NULL;

COMMIT;