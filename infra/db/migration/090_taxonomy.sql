BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE SCHEMA IF NOT EXISTS taxonomy;

-- =========================================================
-- 1. Taxonomy model
-- RTMC 2026, ESCO 2024, ONET 30.2, CUSTOM...
-- =========================================================
CREATE TABLE IF NOT EXISTS taxonomy.taxonomy_model (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code TEXT NOT NULL,
    label TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT 'default',
    source TEXT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,

    released_at DATE,
    imported_at TIMESTAMPTZ,

    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_taxonomy_model_code_version UNIQUE (code, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_taxonomy_model_default
ON taxonomy.taxonomy_model (is_default)
WHERE is_default = TRUE;

CREATE INDEX IF NOT EXISTS idx_taxonomy_model_code
ON taxonomy.taxonomy_model (code);

CREATE INDEX IF NOT EXISTS idx_taxonomy_model_active
ON taxonomy.taxonomy_model (is_active);


-- =========================================================
-- 2. Import batch
-- Trace every import: source file, checksum, status, counts...
-- =========================================================
CREATE TABLE IF NOT EXISTS taxonomy.taxonomy_import_batch (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    model_id UUID NOT NULL REFERENCES taxonomy.taxonomy_model(id) ON DELETE CASCADE,

    source_name TEXT NOT NULL,
    source_file_name TEXT,
    source_checksum TEXT,

    import_status TEXT NOT NULL DEFAULT 'STARTED',

    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,

    imported_nodes_count INTEGER NOT NULL DEFAULT 0,
    imported_aliases_count INTEGER NOT NULL DEFAULT 0,
    imported_relations_count INTEGER NOT NULL DEFAULT 0,
    imported_crosswalks_count INTEGER NOT NULL DEFAULT 0,

    errors_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_by UUID,

    CONSTRAINT ck_taxonomy_import_batch_status CHECK (
        import_status IN ('STARTED', 'SUCCESS', 'FAILED', 'PARTIAL')
    )
);

CREATE INDEX IF NOT EXISTS idx_taxonomy_import_batch_model
ON taxonomy.taxonomy_import_batch (model_id);

CREATE INDEX IF NOT EXISTS idx_taxonomy_import_batch_status
ON taxonomy.taxonomy_import_batch (import_status);

CREATE INDEX IF NOT EXISTS idx_taxonomy_import_batch_started
ON taxonomy.taxonomy_import_batch (started_at DESC);


-- =========================================================
-- 3. Taxonomy node
-- Generic concepts: occupation, skill, task, knowledge, tool...
-- =========================================================
CREATE TABLE IF NOT EXISTS taxonomy.taxonomy_node (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    model_id UUID NOT NULL REFERENCES taxonomy.taxonomy_model(id) ON DELETE CASCADE,
    import_batch_id UUID REFERENCES taxonomy.taxonomy_import_batch(id) ON DELETE SET NULL,

    external_code TEXT,
    external_uri TEXT,

    node_type TEXT NOT NULL,

    preferred_label TEXT NOT NULL,
    normalized_label TEXT NOT NULL,

    description TEXT,
    language_code TEXT,

    parent_id UUID REFERENCES taxonomy.taxonomy_node(id) ON DELETE SET NULL,

    active BOOLEAN NOT NULL DEFAULT TRUE,
    deprecated BOOLEAN NOT NULL DEFAULT FALSE,
    replaced_by_node_id UUID REFERENCES taxonomy.taxonomy_node(id) ON DELETE SET NULL,

    valid_from DATE,
    valid_to DATE,

    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_taxonomy_node_type CHECK (
        node_type IN (
            'OCCUPATION',
            'SKILL',
            'SOFT_SKILL',
            'TASK',
            'KNOWLEDGE',
            'ABILITY',
            'TOOL',
            'TECHNOLOGY',
            'WORK_ACTIVITY',
            'WORK_CONTEXT',
            'DIPLOMA',
            'SPECIALTY',
            'SECTOR',
            'CERTIFICATION',
            'LANGUAGE',
            'JOB_ZONE',
            'OTHER'
        )
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_taxonomy_node_model_external_code
ON taxonomy.taxonomy_node (model_id, external_code)
WHERE external_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_taxonomy_node_model_external_uri
ON taxonomy.taxonomy_node (model_id, external_uri)
WHERE external_uri IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_taxonomy_node_model_type
ON taxonomy.taxonomy_node (model_id, node_type);

CREATE INDEX IF NOT EXISTS idx_taxonomy_node_label_trgm
ON taxonomy.taxonomy_node USING gin (normalized_label gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_taxonomy_node_active
ON taxonomy.taxonomy_node (active, deprecated);

CREATE INDEX IF NOT EXISTS idx_taxonomy_node_parent
ON taxonomy.taxonomy_node (parent_id);

CREATE INDEX IF NOT EXISTS idx_taxonomy_node_metadata
ON taxonomy.taxonomy_node USING gin (metadata_json);


-- =========================================================
-- 4. Taxonomy alias
-- Synonyms, alternative labels, appellations...
-- =========================================================
CREATE TABLE IF NOT EXISTS taxonomy.taxonomy_alias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    node_id UUID NOT NULL REFERENCES taxonomy.taxonomy_node(id) ON DELETE CASCADE,
    import_batch_id UUID REFERENCES taxonomy.taxonomy_import_batch(id) ON DELETE SET NULL,

    alias TEXT NOT NULL,
    normalized_alias TEXT NOT NULL,

    language_code TEXT,
    source TEXT,
    confidence NUMERIC(5,4) NOT NULL DEFAULT 1.0,

    active BOOLEAN NOT NULL DEFAULT TRUE,

    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_taxonomy_alias_confidence CHECK (
        confidence >= 0 AND confidence <= 1
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_taxonomy_alias_node_alias
ON taxonomy.taxonomy_alias (node_id, normalized_alias);

CREATE INDEX IF NOT EXISTS idx_taxonomy_alias_normalized_trgm
ON taxonomy.taxonomy_alias USING gin (normalized_alias gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_taxonomy_alias_node
ON taxonomy.taxonomy_alias (node_id);

CREATE INDEX IF NOT EXISTS idx_taxonomy_alias_active
ON taxonomy.taxonomy_alias (active);


-- =========================================================
-- 5. Taxonomy relation
-- Relations inside same model: occupation -> skill, occupation -> task...
-- =========================================================
CREATE TABLE IF NOT EXISTS taxonomy.taxonomy_relation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    model_id UUID NOT NULL REFERENCES taxonomy.taxonomy_model(id) ON DELETE CASCADE,
    import_batch_id UUID REFERENCES taxonomy.taxonomy_import_batch(id) ON DELETE SET NULL,

    source_node_id UUID NOT NULL REFERENCES taxonomy.taxonomy_node(id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES taxonomy.taxonomy_node(id) ON DELETE CASCADE,

    relation_type TEXT NOT NULL,

    weight NUMERIC(8,4) NOT NULL DEFAULT 1.0,
    confidence NUMERIC(5,4) NOT NULL DEFAULT 1.0,

    active BOOLEAN NOT NULL DEFAULT TRUE,

    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_taxonomy_relation_type CHECK (
        relation_type IN (
            'REQUIRES_SKILL',
            'ESSENTIAL_SKILL',
            'OPTIONAL_SKILL',
            'HAS_TASK',
            'REQUIRES_KNOWLEDGE',
            'REQUIRES_ABILITY',
            'USES_TOOL',
            'USES_TECHNOLOGY',
            'RELATED_OCCUPATION',
            'MOBILITY_TO',
            'BROADER',
            'NARROWER',
            'CLOSE_MATCH',
            'EXACT_MATCH',
            'RELATED_TO',
            'OTHER'
        )
    ),

    CONSTRAINT ck_taxonomy_relation_confidence CHECK (
        confidence >= 0 AND confidence <= 1
    ),

    CONSTRAINT ck_taxonomy_relation_not_self CHECK (
        source_node_id <> target_node_id
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_taxonomy_relation_unique
ON taxonomy.taxonomy_relation (
    model_id,
    source_node_id,
    target_node_id,
    relation_type
);

CREATE INDEX IF NOT EXISTS idx_taxonomy_relation_source
ON taxonomy.taxonomy_relation (source_node_id, relation_type);

CREATE INDEX IF NOT EXISTS idx_taxonomy_relation_target
ON taxonomy.taxonomy_relation (target_node_id, relation_type);

CREATE INDEX IF NOT EXISTS idx_taxonomy_relation_model_type
ON taxonomy.taxonomy_relation (model_id, relation_type);

CREATE INDEX IF NOT EXISTS idx_taxonomy_relation_active
ON taxonomy.taxonomy_relation (active);

CREATE INDEX IF NOT EXISTS idx_taxonomy_relation_metadata
ON taxonomy.taxonomy_relation USING gin (metadata_json);


-- =========================================================
-- 6. Crosswalk
-- Mapping between models: RTMC <-> ESCO <-> ONET
-- =========================================================
CREATE TABLE IF NOT EXISTS taxonomy.taxonomy_crosswalk (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    import_batch_id UUID REFERENCES taxonomy.taxonomy_import_batch(id) ON DELETE SET NULL,

    source_node_id UUID NOT NULL REFERENCES taxonomy.taxonomy_node(id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES taxonomy.taxonomy_node(id) ON DELETE CASCADE,

    mapping_type TEXT NOT NULL,

    confidence NUMERIC(5,4) NOT NULL DEFAULT 1.0,

    method TEXT,
    validated BOOLEAN NOT NULL DEFAULT FALSE,
    validated_by UUID,
    validated_at TIMESTAMPTZ,

    active BOOLEAN NOT NULL DEFAULT TRUE,

    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_taxonomy_crosswalk_type CHECK (
        mapping_type IN (
            'EXACT_MATCH',
            'CLOSE_MATCH',
            'BROAD_MATCH',
            'NARROW_MATCH',
            'MANUAL_MATCH',
            'AUTO_MATCH',
            'OTHER'
        )
    ),

    CONSTRAINT ck_taxonomy_crosswalk_confidence CHECK (
        confidence >= 0 AND confidence <= 1
    ),

    CONSTRAINT ck_taxonomy_crosswalk_not_self CHECK (
        source_node_id <> target_node_id
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_taxonomy_crosswalk_pair
ON taxonomy.taxonomy_crosswalk (
    source_node_id,
    target_node_id,
    mapping_type
);

CREATE INDEX IF NOT EXISTS idx_taxonomy_crosswalk_source
ON taxonomy.taxonomy_crosswalk (source_node_id);

CREATE INDEX IF NOT EXISTS idx_taxonomy_crosswalk_target
ON taxonomy.taxonomy_crosswalk (target_node_id);

CREATE INDEX IF NOT EXISTS idx_taxonomy_crosswalk_active
ON taxonomy.taxonomy_crosswalk (active, validated);

-- =========================================================
-- 7. Mapping audit
-- Trace mapper decisions
-- =========================================================
CREATE TABLE IF NOT EXISTS taxonomy.taxonomy_mapping_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    input_text TEXT NOT NULL,
    normalized_input TEXT NOT NULL,

    node_type TEXT,
    profile_code TEXT,
    strategy TEXT,

    selected_node_id UUID REFERENCES taxonomy.taxonomy_node(id) ON DELETE SET NULL,
    selected_model_code TEXT,
    selected_label TEXT,

    confidence NUMERIC(5,4),
    method TEXT,

    candidates_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_taxonomy_mapping_audit_input_trgm
ON taxonomy.taxonomy_mapping_audit USING gin (normalized_input gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_taxonomy_mapping_audit_node
ON taxonomy.taxonomy_mapping_audit (selected_node_id);

CREATE INDEX IF NOT EXISTS idx_taxonomy_mapping_audit_created
ON taxonomy.taxonomy_mapping_audit (created_at DESC);


-- =========================================================
-- 8. Helper function: normalize text
-- =========================================================
CREATE OR REPLACE FUNCTION taxonomy.normalize_text(input TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT lower(
        regexp_replace(
            unaccent(coalesce(input, '')),
            '\s+',
            ' ',
            'g'
        )
    );
$$;


-- =========================================================
-- 9. Default models
-- =========================================================
INSERT INTO taxonomy.taxonomy_model (
    code,
    label,
    version,
    source,
    is_active,
    is_default,
    imported_at,
    metadata_json
)
VALUES
    (
        'RTMC',
        'Référentiel Tunisien des Métiers et Compétences',
        'default',
        'ANETI / RTMC',
        TRUE,
        TRUE,
        now(),
        '{"country":"TN","scope":"local","status":"placeholder"}'
    ),
    (
        'ESCO',
        'European Skills, Competences, Qualifications and Occupations',
        'default',
        'European Commission',
        TRUE,
        FALSE,
        now(),
        '{"scope":"european","format":"RDF/SKOS","status":"placeholder"}'
    ),
    (
        'ONET',
        'Occupational Information Network',
        'default',
        'U.S. Department of Labor',
        TRUE,
        FALSE,
        now(),
        '{"country":"US","scope":"international","status":"placeholder"}'
    )
ON CONFLICT (code, version) DO NOTHING;

COMMIT;
