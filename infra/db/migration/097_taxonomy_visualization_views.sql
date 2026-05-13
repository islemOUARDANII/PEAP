BEGIN;

-- ============================================================
-- Taxonomy visualization views
-- Used by admin UI / taxonomy browser
-- ============================================================


-- ------------------------------------------------------------
-- 1. Vue simple des nodes avec parent + nombre d'enfants
-- ------------------------------------------------------------

CREATE OR REPLACE VIEW taxonomy.v_taxonomy_tree AS
SELECT
    n.id,
    n.model_id,
    m.code AS model_code,
    m.version AS model_version,

    n.parent_id,
    p.preferred_label AS parent_label,

    n.external_code,
    n.node_type,
    n.preferred_label,
    n.normalized_label,
    n.language_code,
    n.active,

    CASE
        WHEN n.parent_id IS NULL THEN 1
        WHEN p.parent_id IS NULL THEN 2
        ELSE 3
    END AS display_level,

    (
        SELECT COUNT(*)
        FROM taxonomy.taxonomy_node child
        WHERE child.parent_id = n.id
    ) AS children_count,

    (
        SELECT COUNT(*)
        FROM taxonomy.taxonomy_alias a
        WHERE a.node_id = n.id
    ) AS aliases_count,

    (
        SELECT COUNT(*)
        FROM taxonomy.taxonomy_relation r
        WHERE r.source_node_id = n.id
    ) AS outgoing_relations_count,

    (
        SELECT COUNT(*)
        FROM taxonomy.taxonomy_relation r
        WHERE r.target_node_id = n.id
    ) AS incoming_relations_count,

    n.metadata_json,
    n.created_at,
    n.updated_at

FROM taxonomy.taxonomy_node n
JOIN taxonomy.taxonomy_model m
    ON m.id = n.model_id
LEFT JOIN taxonomy.taxonomy_node p
    ON p.id = n.parent_id;


-- ------------------------------------------------------------
-- 2. Vue résumé par modèle et type de node
-- ------------------------------------------------------------

CREATE OR REPLACE VIEW taxonomy.v_taxonomy_summary AS
SELECT
    m.id AS model_id,
    m.code AS model_code,
    m.version AS model_version,
    m.label AS model_label,
    n.node_type,
    COUNT(*) AS total_nodes,
    COUNT(*) FILTER (WHERE n.active = true) AS active_nodes,
    COUNT(*) FILTER (WHERE n.parent_id IS NULL) AS root_nodes
FROM taxonomy.taxonomy_model m
LEFT JOIN taxonomy.taxonomy_node n
    ON n.model_id = m.id
GROUP BY
    m.id,
    m.code,
    m.version,
    m.label,
    n.node_type;


-- ------------------------------------------------------------
-- 3. Vue des relations lisibles
-- ------------------------------------------------------------

CREATE OR REPLACE VIEW taxonomy.v_taxonomy_relations_readable AS
SELECT
    r.id AS relation_id,
    r.model_id,
    m.code AS model_code,
    m.version AS model_version,

    r.relation_type,
    r.weight,
    r.confidence,
    r.active,

    src.id AS source_node_id,
    src.external_code AS source_external_code,
    src.node_type AS source_node_type,
    src.preferred_label AS source_label,

    tgt.id AS target_node_id,
    tgt.external_code AS target_external_code,
    tgt.node_type AS target_node_type,
    tgt.preferred_label AS target_label,

    r.metadata_json,
    r.created_at

FROM taxonomy.taxonomy_relation r
JOIN taxonomy.taxonomy_model m
    ON m.id = r.model_id
JOIN taxonomy.taxonomy_node src
    ON src.id = r.source_node_id
JOIN taxonomy.taxonomy_node tgt
    ON tgt.id = r.target_node_id;


-- ------------------------------------------------------------
-- 4. Fonction pour récupérer les enfants d'un node
-- Si p_parent_id est NULL, retourne les racines.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION taxonomy.get_taxonomy_children(
    p_model_id UUID,
    p_parent_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    parent_id UUID,
    external_code TEXT,
    node_type TEXT,
    preferred_label TEXT,
    normalized_label TEXT,
    active BOOLEAN,
    children_count BIGINT,
    aliases_count BIGINT,
    outgoing_relations_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        t.id,
        t.parent_id,
        t.external_code,
        t.node_type,
        t.preferred_label,
        t.normalized_label,
        t.active,
        t.children_count,
        t.aliases_count,
        t.outgoing_relations_count
    FROM taxonomy.v_taxonomy_tree t
    WHERE t.model_id = p_model_id
      AND (
            (p_parent_id IS NULL AND t.parent_id IS NULL)
            OR
            (p_parent_id IS NOT NULL AND t.parent_id = p_parent_id)
          )
    ORDER BY
        t.node_type,
        t.preferred_label;
$$;


-- ------------------------------------------------------------
-- 5. Fonction pour récupérer les détails d'un node
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION taxonomy.get_taxonomy_node_relations(
    p_node_id UUID
)
RETURNS TABLE (
    relation_id UUID,
    relation_type TEXT,
    target_node_id UUID,
    target_node_type TEXT,
    target_label TEXT,
    target_external_code TEXT,
    confidence NUMERIC,
    weight NUMERIC,
    active BOOLEAN
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        r.relation_id,
        r.relation_type,
        r.target_node_id,
        r.target_node_type,
        r.target_label,
        r.target_external_code,
        r.confidence,
        r.weight,
        r.active
    FROM taxonomy.v_taxonomy_relations_readable r
    WHERE r.source_node_id = p_node_id
    ORDER BY
        r.relation_type,
        r.target_label;
$$;


COMMIT;