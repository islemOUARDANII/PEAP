BEGIN;

-- =========================================================
-- 1. Taxonomy config
-- Defines how the mapper should use RTMC / ESCO / ONET
-- =========================================================
CREATE TABLE IF NOT EXISTS taxonomy.taxonomy_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    description TEXT,

    strategy TEXT NOT NULL,

    primary_model_code TEXT,
    active_model_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
    fallback_model_codes JSONB NOT NULL DEFAULT '[]'::jsonb,

    min_confidence NUMERIC(5,4) NOT NULL DEFAULT 0.7500,
    keep_alternatives BOOLEAN NOT NULL DEFAULT TRUE,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,

    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_taxonomy_config_strategy CHECK (
        strategy IN (
            'SINGLE',
            'CASCADE_FALLBACK',
            'PARALLEL_BEST',
            'PARALLEL_BOTH'
        )
    ),

    CONSTRAINT ck_taxonomy_config_min_confidence CHECK (
        min_confidence >= 0 AND min_confidence <= 1
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_taxonomy_config_default
ON taxonomy.taxonomy_config (is_default)
WHERE is_default = TRUE;

CREATE INDEX IF NOT EXISTS idx_taxonomy_config_active
ON taxonomy.taxonomy_config (is_active);

CREATE INDEX IF NOT EXISTS idx_taxonomy_config_strategy
ON taxonomy.taxonomy_config (strategy);


-- =========================================================
-- 2. Entity mapping
-- Stores mapping results for CV fields, offer fields, skills, requirements...
-- =========================================================
CREATE TABLE IF NOT EXISTS taxonomy.entity_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,

    field_name TEXT NOT NULL,
    raw_value TEXT NOT NULL,
    normalized_value TEXT NOT NULL,

    config_code TEXT,
    strategy TEXT,

    taxonomy_model_id UUID REFERENCES taxonomy.taxonomy_model(id) ON DELETE SET NULL,
    taxonomy_model_code TEXT NOT NULL,

    taxonomy_node_id UUID REFERENCES taxonomy.taxonomy_node(id) ON DELETE SET NULL,
    taxonomy_node_type TEXT,
    taxonomy_label TEXT,

    confidence NUMERIC(5,4),
    method TEXT,

    is_primary BOOLEAN NOT NULL DEFAULT TRUE,
    is_selected BOOLEAN NOT NULL DEFAULT TRUE,
    validated_by_user BOOLEAN NOT NULL DEFAULT FALSE,

    alternative_group_id UUID,
    candidates_json JSONB NOT NULL DEFAULT '[]'::jsonb,

    source TEXT NOT NULL DEFAULT 'MAPPER',
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_entity_mapping_confidence CHECK (
        confidence IS NULL OR (confidence >= 0 AND confidence <= 1)
    ),

    CONSTRAINT ck_entity_mapping_entity_type CHECK (
        entity_type IN (
            'JOB_OFFER',
            'JOB_OFFER_REQUIREMENT',
            'JOB_SEEKER',
            'JOB_SEEKER_EXPERIENCE',
            'JOB_SEEKER_SKILL',
            'JOB_SEEKER_EDUCATION',
            'JOB_SEEKER_LANGUAGE',
            'PARSED_CV_FIELD',
            'PARSED_OFFER_FIELD',
            'OTHER'
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_entity_mapping_entity
ON taxonomy.entity_mapping (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_entity_mapping_node
ON taxonomy.entity_mapping (taxonomy_node_id);

CREATE INDEX IF NOT EXISTS idx_entity_mapping_model
ON taxonomy.entity_mapping (taxonomy_model_code);

CREATE INDEX IF NOT EXISTS idx_entity_mapping_primary
ON taxonomy.entity_mapping (entity_type, entity_id, is_primary);

CREATE INDEX IF NOT EXISTS idx_entity_mapping_selected
ON taxonomy.entity_mapping (entity_type, entity_id, is_selected);

CREATE INDEX IF NOT EXISTS idx_entity_mapping_alternative_group
ON taxonomy.entity_mapping (alternative_group_id);

CREATE INDEX IF NOT EXISTS idx_entity_mapping_raw_trgm
ON taxonomy.entity_mapping USING gin (normalized_value gin_trgm_ops);


-- =========================================================
-- 3. Default mapping configs
-- =========================================================
INSERT INTO taxonomy.taxonomy_config (
    code,
    label,
    description,
    strategy,
    primary_model_code,
    active_model_codes,
    fallback_model_codes,
    min_confidence,
    keep_alternatives,
    is_active,
    is_default,
    metadata_json
)
VALUES
    (
        'RTMC_ONLY',
        'RTMC uniquement',
        'Utilise uniquement le référentiel RTMC. Adapté aux offres locales tunisiennes strictement ANETI.',
        'SINGLE',
        'RTMC',
        '["RTMC"]'::jsonb,
        '[]'::jsonb,
        0.7500,
        FALSE,
        TRUE,
        TRUE,
        '{"use_case":"local_tunisia"}'::jsonb
    ),
    (
        'ESCO_ONLY',
        'ESCO uniquement',
        'Utilise uniquement le référentiel ESCO. Adapté aux offres européennes ou internationales.',
        'SINGLE',
        'ESCO',
        '["ESCO"]'::jsonb,
        '[]'::jsonb,
        0.7500,
        FALSE,
        TRUE,
        FALSE,
        '{"use_case":"europe_international"}'::jsonb
    ),
    (
        'RTMC_THEN_ESCO',
        'RTMC puis ESCO',
        'Cherche d’abord dans RTMC. Si le score est insuffisant, utilise ESCO comme fallback.',
        'CASCADE_FALLBACK',
        'RTMC',
        '["RTMC","ESCO"]'::jsonb,
        '["ESCO"]'::jsonb,
        0.7500,
        TRUE,
        TRUE,
        FALSE,
        '{"use_case":"aneti_local_with_international_fallback"}'::jsonb
    ),
    (
        'ESCO_THEN_RTMC',
        'ESCO puis RTMC',
        'Cherche d’abord dans ESCO. Si le score est insuffisant, utilise RTMC comme fallback.',
        'CASCADE_FALLBACK',
        'ESCO',
        '["ESCO","RTMC"]'::jsonb,
        '["RTMC"]'::jsonb,
        0.7500,
        TRUE,
        TRUE,
        FALSE,
        '{"use_case":"international_with_local_fallback"}'::jsonb
    ),
    (
        'RTMC_AND_ESCO',
        'RTMC et ESCO',
        'Cherche dans RTMC et ESCO en parallèle et conserve le mapping principal plus les alternatives.',
        'PARALLEL_BOTH',
        'RTMC',
        '["RTMC","ESCO"]'::jsonb,
        '["ESCO"]'::jsonb,
        0.7000,
        TRUE,
        TRUE,
        FALSE,
        '{"use_case":"dual_mapping_governance"}'::jsonb
    ),
    (
        'GLOBAL_BEST',
        'Global meilleur résultat',
        'Cherche dans ESCO, O*NET et RTMC puis garde le meilleur résultat.',
        'PARALLEL_BEST',
        'ESCO',
        '["ESCO","ONET","RTMC"]'::jsonb,
        '["ONET","RTMC"]'::jsonb,
        0.7000,
        TRUE,
        TRUE,
        FALSE,
        '{"use_case":"ambiguous_or_global"}'::jsonb
    )
ON CONFLICT (code) DO NOTHING;

COMMIT;