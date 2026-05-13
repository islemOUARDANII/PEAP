WITH raw_candidates AS (
    SELECT
        rtmc.node_id AS source_node_id,
        esco.node_id AS target_node_id,

        'CLOSE_MATCH' AS mapping_type,
        LEAST(rtmc.term_weight, esco.term_weight, 0.95)::numeric AS confidence,
        'SAME_NORMALIZED_TERM' AS method,

        rtmc.term AS rtmc_term,
        esco.term AS esco_term,
        rtmc.term_source AS rtmc_term_source,
        esco.term_source AS esco_term_source,
        rtmc.node_type AS rtmc_node_type,
        esco.node_type AS esco_node_type,

        CASE
            WHEN rtmc.term_source = 'PREFERRED_LABEL'
             AND esco.term_source = 'PREFERRED_LABEL'
            THEN 3

            WHEN rtmc.term_source = 'PREFERRED_LABEL'
              OR esco.term_source = 'PREFERRED_LABEL'
            THEN 2

            ELSE 1
        END AS priority

    FROM taxonomy.v_taxonomy_search_terms rtmc
    JOIN taxonomy.v_taxonomy_search_terms esco
        ON esco.normalized_term = rtmc.normalized_term
    WHERE rtmc.model_code = 'RTMC'
      AND esco.model_code = 'ESCO'
      AND esco.model_version = '1.2.1'
      AND (
            (rtmc.node_type = 'OCCUPATION' AND esco.node_type = 'OCCUPATION')
            OR
            (rtmc.node_type = 'SKILL' AND esco.node_type IN ('SKILL', 'KNOWLEDGE'))
            OR
            (rtmc.node_type = 'SOFT_SKILL' AND esco.node_type = 'SOFT_SKILL')
          )
      AND rtmc.node_id <> esco.node_id
),

ranked_candidates AS (
    SELECT
        rc.*,
        row_number() OVER (
            PARTITION BY rc.source_node_id, rc.target_node_id
            ORDER BY
                rc.priority DESC,
                rc.confidence DESC,
                rc.rtmc_term_source,
                rc.esco_term_source
        ) AS rn
    FROM raw_candidates rc
)

INSERT INTO taxonomy.taxonomy_crosswalk (
    import_batch_id,
    source_node_id,
    target_node_id,
    mapping_type,
    confidence,
    method,
    validated,
    active,
    metadata_json
)
SELECT
    NULL::uuid AS import_batch_id,
    rc.source_node_id,
    rc.target_node_id,
    rc.mapping_type,
    rc.confidence,
    rc.method,
    false AS validated,
    true AS active,
    jsonb_build_object(
        'source', 'AUTO_GENERATED',
        'strategy', 'same_normalized_term',
        'direction', 'RTMC_TO_ESCO',
        'rtmc_term', rc.rtmc_term,
        'esco_term', rc.esco_term,
        'rtmc_term_source', rc.rtmc_term_source,
        'esco_term_source', rc.esco_term_source,
        'rtmc_node_type', rc.rtmc_node_type,
        'esco_node_type', rc.esco_node_type,
        'priority', rc.priority,
        'generated_at', now()
    ) AS metadata
FROM ranked_candidates rc
WHERE rc.rn = 1
  AND NOT EXISTS (
      SELECT 1
      FROM taxonomy.taxonomy_crosswalk cw
      WHERE cw.source_node_id = rc.source_node_id
        AND cw.target_node_id = rc.target_node_id
  );