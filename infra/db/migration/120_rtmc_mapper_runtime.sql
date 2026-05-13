BEGIN;

CREATE SCHEMA IF NOT EXISTS taxonomy;

-- ============================================================
-- 1. Alias RTMC validés
-- ============================================================

CREATE TABLE IF NOT EXISTS taxonomy.rtmc_alias (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    alias_raw           text NOT NULL,
    alias_normalized    text NOT NULL,

    target_entity_type  text NOT NULL,
    target_code         text NOT NULL,
    target_label        text NULL,

    source              text NOT NULL DEFAULT 'manual',
    confidence          numeric(5,4) NOT NULL DEFAULT 1.0,

    active              boolean NOT NULL DEFAULT true,

    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT rtmc_alias_entity_type_chk
        CHECK (target_entity_type IN ('occupation', 'appellation', 'skill', 'activity'))
);

CREATE INDEX IF NOT EXISTS idx_rtmc_alias_normalized
    ON taxonomy.rtmc_alias(alias_normalized);

CREATE INDEX IF NOT EXISTS idx_rtmc_alias_target
    ON taxonomy.rtmc_alias(target_entity_type, target_code);

CREATE UNIQUE INDEX IF NOT EXISTS uq_rtmc_alias_unique_active
    ON taxonomy.rtmc_alias(alias_normalized, target_entity_type, target_code)
    WHERE active = true;


-- ============================================================
-- 2. Metadata des index générés
-- ============================================================

CREATE TABLE IF NOT EXISTS taxonomy.rtmc_index_metadata (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    index_name          text NOT NULL,
    index_type          text NOT NULL,
    taxonomy_name       text NOT NULL DEFAULT 'RTMC',

    source_tables       jsonb NOT NULL DEFAULT '[]'::jsonb,
    source_counts       jsonb NOT NULL DEFAULT '{}'::jsonb,

    output_path         text NULL,
    checksum            text NULL,

    generator_version   text NOT NULL,
    generated_at        timestamptz NOT NULL DEFAULT now(),

    active              boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_rtmc_index_metadata_name_active
    ON taxonomy.rtmc_index_metadata(index_name, active);


-- ============================================================
-- 3. Vue unifiée des entités RTMC pour le mapper
-- ============================================================

CREATE OR REPLACE VIEW taxonomy.v_rtmc_mapper_entities AS

SELECT
    'occupation'::text AS entity_type,
    m.code_metier::text AS code,
    m.libelle_metier::text AS label,
    m.libelle_up_metier::text AS label_up,
    m.code_metier::text AS occupation_code,
    m.libelle_metier::text AS occupation_label,
    NULL::text AS parent_code,
    'taxonomy.rtmc_metiers'::text AS source_table
FROM taxonomy.rtmc_metiers m
WHERE COALESCE(m.actif, true) = true

UNION ALL

SELECT
    'appellation'::text AS entity_type,
    a.code_appellation::text AS code,
    a.libelle_appellation::text AS label,
    a.libelle_up_appellation::text AS label_up,
    a.code_metier::text AS occupation_code,
    m.libelle_metier::text AS occupation_label,
    a.code_metier::text AS parent_code,
    'taxonomy.rtmc_appellations'::text AS source_table
FROM taxonomy.rtmc_appellations a
LEFT JOIN taxonomy.rtmc_metiers m
    ON m.code_metier = a.code_metier
WHERE COALESCE(a.actif, true) = true

UNION ALL

SELECT
    'skill'::text AS entity_type,
    c.code_competence::text AS code,
    c.libelle_competence::text AS label,
    c.libelle_up_competence::text AS label_up,
    c.code_metier::text AS occupation_code,
    m.libelle_metier::text AS occupation_label,
    c.code_metier::text AS parent_code,
    'taxonomy.rtmc_savoir_competences'::text AS source_table
FROM taxonomy.rtmc_savoir_competences c
LEFT JOIN taxonomy.rtmc_metiers m
    ON m.code_metier = c.code_metier
WHERE COALESCE(c.actif, true) = true

UNION ALL

SELECT
    'activity'::text AS entity_type,
    a.code_activite::text AS code,
    a.libelle_activite::text AS label,
    a.libelle_up_activite::text AS label_up,
    a.code_metier::text AS occupation_code,
    m.libelle_metier::text AS occupation_label,
    a.code_metier::text AS parent_code,
    'taxonomy.rtmc_savoir_faire_activites'::text AS source_table
FROM taxonomy.rtmc_savoir_faire_activites a
LEFT JOIN taxonomy.rtmc_metiers m
    ON m.code_metier = a.code_metier
WHERE COALESCE(a.actif, true) = true;


-- ============================================================
-- 4. Vue des alias actifs
-- ============================================================

CREATE OR REPLACE VIEW taxonomy.v_rtmc_mapper_aliases AS
SELECT
    alias_raw,
    alias_normalized,
    target_entity_type,
    target_code,
    target_label,
    confidence,
    source
FROM taxonomy.rtmc_alias
WHERE active = true;

COMMIT;