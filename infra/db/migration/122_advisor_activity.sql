BEGIN;

CREATE TABLE IF NOT EXISTS audit.advisor_activity (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    activity_time timestamptz NOT NULL DEFAULT now(),

    actor_user_id uuid NULL,
    actor_email text NULL,
    actor_role text NULL,

    activity_type text NOT NULL,
    target_type text NOT NULL,
    direction text NULL,

    action_label text NOT NULL,

    query_text text NULL,
    filters_json jsonb NOT NULL DEFAULT '{}'::jsonb,

    model_id uuid NULL,
    model_version_id uuid NULL,
    model_code text NULL,
    model_label text NULL,

    source_entity_type text NULL,
    source_entity_id uuid NULL,

    run_id uuid NULL,
    result_count integer NULL,
    duration_ms integer NULL,

    status text NOT NULL DEFAULT 'SUCCESS',
    error_message text NULL,

    metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,

    CONSTRAINT ck_advisor_activity_type
        CHECK (activity_type IN ('SEARCH', 'MATCHING')),

    CONSTRAINT ck_advisor_activity_target
        CHECK (target_type IN ('CANDIDATE', 'OFFER')),

    CONSTRAINT ck_advisor_activity_direction
        CHECK (
            direction IS NULL OR direction IN (
                'CANDIDATE_TO_OFFERS',
                'OFFER_TO_CANDIDATES'
            )
        ),

    CONSTRAINT ck_advisor_activity_status
        CHECK (status IN ('SUCCESS', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_advisor_activity_time
    ON audit.advisor_activity (activity_time DESC);

CREATE INDEX IF NOT EXISTS idx_advisor_activity_actor
    ON audit.advisor_activity (actor_user_id, activity_time DESC);

CREATE INDEX IF NOT EXISTS idx_advisor_activity_type
    ON audit.advisor_activity (activity_type, target_type, activity_time DESC);

CREATE INDEX IF NOT EXISTS idx_advisor_activity_direction
    ON audit.advisor_activity (direction, activity_time DESC);

CREATE INDEX IF NOT EXISTS idx_advisor_activity_model_version
    ON audit.advisor_activity (model_version_id, activity_time DESC);

COMMIT;