-- =========================================================
-- Raw taxonomy storage
-- Stores original source files and raw rows before canonical import
-- =========================================================
CREATE SCHEMA IF NOT EXISTS taxonomy_raw;

CREATE TABLE IF NOT EXISTS taxonomy_raw.source_file (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    source_code TEXT NOT NULL,          -- RTMC, ESCO, ONET
    source_version TEXT NOT NULL DEFAULT 'default',

    file_name TEXT NOT NULL,
    file_type TEXT,                     -- xlsx, csv, rdf, ttl, json
    file_path TEXT,
    file_checksum TEXT,

    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    imported_by UUID,

    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,

    CONSTRAINT uq_taxonomy_raw_source_file UNIQUE (
        source_code,
        source_version,
        file_name,
        file_checksum
    )
);

CREATE INDEX IF NOT EXISTS idx_taxonomy_raw_source_file_source
ON taxonomy_raw.source_file (source_code, source_version);

CREATE INDEX IF NOT EXISTS idx_taxonomy_raw_source_file_imported
ON taxonomy_raw.source_file (imported_at DESC);


CREATE TABLE IF NOT EXISTS taxonomy_raw.source_record (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    source_file_id UUID REFERENCES taxonomy_raw.source_file(id) ON DELETE CASCADE,

    source_code TEXT NOT NULL,          -- RTMC, ESCO, ONET
    source_version TEXT NOT NULL DEFAULT 'default',

    source_table TEXT NOT NULL,         -- metiers, skills, occupations, task_statements...
    external_key TEXT,                  -- code_metier, uri, onet_soc_code, etc.

    row_number INTEGER,

    raw_payload JSONB NOT NULL,         -- full original row/triple/object
    normalized_payload JSONB NOT NULL DEFAULT '{}'::jsonb,

    canonical_node_id UUID REFERENCES taxonomy.taxonomy_node(id) ON DELETE SET NULL,
    canonical_relation_id UUID REFERENCES taxonomy.taxonomy_relation(id) ON DELETE SET NULL,

    import_status TEXT NOT NULL DEFAULT 'PENDING',
    error_message TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,

    CONSTRAINT ck_taxonomy_raw_record_status CHECK (
        import_status IN (
            'PENDING',
            'PROCESSED',
            'FAILED',
            'SKIPPED'
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_taxonomy_raw_record_source
ON taxonomy_raw.source_record (source_code, source_version, source_table);

CREATE INDEX IF NOT EXISTS idx_taxonomy_raw_record_external_key
ON taxonomy_raw.source_record (external_key);

CREATE INDEX IF NOT EXISTS idx_taxonomy_raw_record_status
ON taxonomy_raw.source_record (import_status);

CREATE INDEX IF NOT EXISTS idx_taxonomy_raw_record_payload
ON taxonomy_raw.source_record USING gin (raw_payload);

CREATE INDEX IF NOT EXISTS idx_taxonomy_raw_record_canonical_node
ON taxonomy_raw.source_record (canonical_node_id);


