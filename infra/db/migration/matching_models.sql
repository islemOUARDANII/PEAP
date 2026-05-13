BEGIN;

-- =========================================================
-- MATCHING CONFIGURATION - ANETI
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS matching;

-- =========================================================
-- 1. matching_model
-- =========================================================
CREATE TABLE IF NOT EXISTS matching.matching_model (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code TEXT NOT NULL,
    label TEXT NOT NULL,
    direction TEXT NOT NULL,
    description TEXT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT uq_matching_model_code UNIQUE (code),

    CONSTRAINT ck_matching_model_code_not_empty
        CHECK (btrim(code) <> ''),

    CONSTRAINT ck_matching_model_label_not_empty
        CHECK (btrim(label) <> ''),

    CONSTRAINT ck_matching_model_direction
        CHECK (
            direction IN (
                'CANDIDATE_TO_OFFER',
                'OFFER_TO_CANDIDATE',
                'CANDIDATE_TO_OCCUPATION'
            )
        )
);

-- =========================================================
-- 2. matching_model_version
-- =========================================================
CREATE TABLE IF NOT EXISTS matching.matching_model_version (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    model_id UUID NOT NULL,
    version_number INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT',

    created_by_user_id UUID NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ NULL,

    CONSTRAINT fk_matching_model_version_model
        FOREIGN KEY (model_id)
        REFERENCES matching.matching_model (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_matching_model_version_created_by
        FOREIGN KEY (created_by_user_id)
        REFERENCES iam.auth_user (id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT uq_matching_model_version
        UNIQUE (model_id, version_number),

    CONSTRAINT ck_matching_model_version_number_positive
        CHECK (version_number > 0),

    CONSTRAINT ck_matching_model_version_status
        CHECK (
            status IN (
                'DRAFT',
                'ACTIVE',
                'ARCHIVED'
            )
        )
);

-- =========================================================
-- 3. matching_criterion
-- =========================================================
CREATE TABLE IF NOT EXISTS matching.matching_criterion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code TEXT NOT NULL,
    label TEXT NOT NULL,
    description TEXT NULL,
    data_type TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT uq_matching_criterion_code UNIQUE (code),

    CONSTRAINT ck_matching_criterion_code_not_empty
        CHECK (btrim(code) <> ''),

    CONSTRAINT ck_matching_criterion_label_not_empty
        CHECK (btrim(label) <> ''),

    CONSTRAINT ck_matching_criterion_data_type
        CHECK (
            data_type IN (
                'TEXT',
                'NUMBER',
                'BOOLEAN',
                'DATE',
                'CODE',
                'CODE_LIST',
                'GEO',
                'JSON'
            )
        )
);

-- =========================================================
-- 4. matching_model_criterion
-- =========================================================
CREATE TABLE IF NOT EXISTS matching.matching_model_criterion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    model_version_id UUID NOT NULL,
    criterion_id UUID NOT NULL,

    weight NUMERIC(6,2) NOT NULL DEFAULT 0,
    is_must BOOLEAN NOT NULL DEFAULT FALSE,
    min_threshold NUMERIC(6,2) NULL,
    logic_operator TEXT NOT NULL DEFAULT 'AND',

    CONSTRAINT fk_matching_model_criterion_version
        FOREIGN KEY (model_version_id)
        REFERENCES matching.matching_model_version (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_matching_model_criterion_criterion
        FOREIGN KEY (criterion_id)
        REFERENCES matching.matching_criterion (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT uq_matching_model_criterion
        UNIQUE (model_version_id, criterion_id),

    CONSTRAINT ck_matching_model_criterion_weight
        CHECK (weight >= 0),

    CONSTRAINT ck_matching_model_criterion_min_threshold
        CHECK (min_threshold IS NULL OR min_threshold >= 0),

    CONSTRAINT ck_matching_model_criterion_logic_operator
        CHECK (
            logic_operator IN (
                'AND',
                'OR'
            )
        )
);

-- =========================================================
-- 5. matching_hard_filter
-- =========================================================
CREATE TABLE IF NOT EXISTS matching.matching_hard_filter (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    model_version_id UUID NOT NULL,
    criterion_id UUID NOT NULL,

    rule_operator TEXT NOT NULL,
    rule_value TEXT NOT NULL,
    rejection_reason TEXT NULL,

    CONSTRAINT fk_matching_hard_filter_version
        FOREIGN KEY (model_version_id)
        REFERENCES matching.matching_model_version (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_matching_hard_filter_criterion
        FOREIGN KEY (criterion_id)
        REFERENCES matching.matching_criterion (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT ck_matching_hard_filter_operator
        CHECK (
            rule_operator IN (
                'EQ',
                'NEQ',
                'IN',
                'NOT_IN',
                'GT',
                'GTE',
                'LT',
                'LTE',
                'CONTAINS',
                'NOT_CONTAINS',
                'EXISTS',
                'NOT_EXISTS',
                'DISTANCE_LTE'
            )
        ),

    CONSTRAINT ck_matching_hard_filter_value_not_empty
        CHECK (btrim(rule_value) <> '')
);

-- =========================================================
-- 6. segment
-- =========================================================
CREATE TABLE IF NOT EXISTS matching.segment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code TEXT NOT NULL,
    label TEXT NOT NULL,
    macro_segment TEXT NULL,
    priority INTEGER NOT NULL DEFAULT 100,
    active BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT uq_segment_code UNIQUE (code),

    CONSTRAINT ck_segment_code_not_empty
        CHECK (btrim(code) <> ''),

    CONSTRAINT ck_segment_label_not_empty
        CHECK (btrim(label) <> ''),

    CONSTRAINT ck_segment_priority_positive
        CHECK (priority >= 0)
);

-- =========================================================
-- 7. segment_rule
-- =========================================================
CREATE TABLE IF NOT EXISTS matching.segment_rule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    segment_id UUID NOT NULL,

    target_type TEXT NOT NULL,
    attribute_path TEXT NOT NULL,
    operator TEXT NOT NULL,
    value TEXT NOT NULL,
    logic TEXT NOT NULL DEFAULT 'AND',

    CONSTRAINT fk_segment_rule_segment
        FOREIGN KEY (segment_id)
        REFERENCES matching.segment (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT ck_segment_rule_target_type
        CHECK (
            target_type IN (
                'JOB_SEEKER',
                'EMPLOYER',
                'JOB_OFFER'
            )
        ),

    CONSTRAINT ck_segment_rule_attribute_path_not_empty
        CHECK (btrim(attribute_path) <> ''),

    CONSTRAINT ck_segment_rule_operator
        CHECK (
            operator IN (
                'EQ',
                'NEQ',
                'IN',
                'NOT_IN',
                'GT',
                'GTE',
                'LT',
                'LTE',
                'CONTAINS',
                'NOT_CONTAINS',
                'EXISTS',
                'NOT_EXISTS'
            )
        ),

    CONSTRAINT ck_segment_rule_value_not_empty
        CHECK (btrim(value) <> ''),

    CONSTRAINT ck_segment_rule_logic
        CHECK (
            logic IN (
                'AND',
                'OR'
            )
        )
);

-- =========================================================
-- 8. Index utiles
-- =========================================================

-- matching_model
CREATE INDEX IF NOT EXISTS idx_matching_model_direction
    ON matching.matching_model (direction);

CREATE INDEX IF NOT EXISTS idx_matching_model_active
    ON matching.matching_model (active);

-- matching_model_version
CREATE INDEX IF NOT EXISTS idx_matching_model_version_model_id
    ON matching.matching_model_version (model_id);

CREATE INDEX IF NOT EXISTS idx_matching_model_version_status
    ON matching.matching_model_version (status);

CREATE INDEX IF NOT EXISTS idx_matching_model_version_created_by
    ON matching.matching_model_version (created_by_user_id);

-- Important : une seule version ACTIVE par modèle
CREATE UNIQUE INDEX IF NOT EXISTS uq_matching_model_one_active_version
    ON matching.matching_model_version (model_id)
    WHERE status = 'ACTIVE';

-- matching_criterion
CREATE INDEX IF NOT EXISTS idx_matching_criterion_active
    ON matching.matching_criterion (active);

CREATE INDEX IF NOT EXISTS idx_matching_criterion_data_type
    ON matching.matching_criterion (data_type);

-- matching_model_criterion
CREATE INDEX IF NOT EXISTS idx_matching_model_criterion_version
    ON matching.matching_model_criterion (model_version_id);

CREATE INDEX IF NOT EXISTS idx_matching_model_criterion_criterion
    ON matching.matching_model_criterion (criterion_id);

CREATE INDEX IF NOT EXISTS idx_matching_model_criterion_is_must
    ON matching.matching_model_criterion (is_must);

-- matching_hard_filter
CREATE INDEX IF NOT EXISTS idx_matching_hard_filter_version
    ON matching.matching_hard_filter (model_version_id);

CREATE INDEX IF NOT EXISTS idx_matching_hard_filter_criterion
    ON matching.matching_hard_filter (criterion_id);

CREATE INDEX IF NOT EXISTS idx_matching_hard_filter_operator
    ON matching.matching_hard_filter (rule_operator);

-- segment
CREATE INDEX IF NOT EXISTS idx_segment_active
    ON matching.segment (active);

CREATE INDEX IF NOT EXISTS idx_segment_macro_segment
    ON matching.segment (macro_segment);

CREATE INDEX IF NOT EXISTS idx_segment_priority
    ON matching.segment (priority);

-- segment_rule
CREATE INDEX IF NOT EXISTS idx_segment_rule_segment
    ON matching.segment_rule (segment_id);

CREATE INDEX IF NOT EXISTS idx_segment_rule_target_type
    ON matching.segment_rule (target_type);

CREATE INDEX IF NOT EXISTS idx_segment_rule_attribute_path
    ON matching.segment_rule (attribute_path);

COMMIT;









