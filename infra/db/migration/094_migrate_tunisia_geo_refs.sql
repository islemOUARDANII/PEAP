BEGIN;

-- =========================================================
-- Tunisia governorates from old taxonomy.ref_n_gouvern
-- =========================================================
INSERT INTO geo.admin_unit (
    country_id,
    parent_id,
    code,
    label,
    normalized_label,
    label_fr,
    admin_level,
    unit_type,
    source,
    external_code,
    metadata_json
)
SELECT
    c.id,
    NULL,
    g.code_gouvernorat::text,
    COALESCE(g.libelle_gouvernorat, g.code_gouvernorat::text),
    geo.normalize_text(COALESCE(g.libelle_gouvernorat, g.code_gouvernorat::text)),
    COALESCE(g.libelle_gouvernorat, g.code_gouvernorat::text),
    1,
    'GOVERNORATE',
    'taxonomy.ref_n_gouvern',
    g.code_gouvernorat::text,
    jsonb_build_object('old_row', to_jsonb(g))
FROM geo.country c
CROSS JOIN taxonomy.ref_n_gouvern g
WHERE c.iso2 = 'TN'
ON CONFLICT (country_id, code, unit_type) DO UPDATE
SET
    label = EXCLUDED.label,
    normalized_label = EXCLUDED.normalized_label,
    label_fr = EXCLUDED.label_fr,
    source = EXCLUDED.source,
    external_code = EXCLUDED.external_code,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = now();


-- =========================================================
-- Tunisia delegations from old taxonomy.ref_n_delegat
-- =========================================================
INSERT INTO geo.admin_unit (
    country_id,
    parent_id,
    code,
    label,
    normalized_label,
    label_fr,
    admin_level,
    unit_type,
    source,
    external_code,
    metadata_json
)
SELECT
    c.id,
    gov.id,
    d.code_delegation::text,
    COALESCE(d.libelle_delegation, d.code_delegation::text),
    geo.normalize_text(COALESCE(d.libelle_delegation, d.code_delegation::text)),
    COALESCE(d.libelle_delegation, d.code_delegation::text),
    2,
    'DELEGATION',
    'taxonomy.ref_n_delegat',
    d.code_delegation::text,
    jsonb_build_object('old_row', to_jsonb(d))
FROM geo.country c
JOIN taxonomy.ref_n_delegat d
    ON TRUE
LEFT JOIN geo.admin_unit gov
    ON gov.country_id = c.id
   AND gov.unit_type = 'GOVERNORATE'
   AND gov.code = d.code_gouvernorat::text
WHERE c.iso2 = 'TN'
ON CONFLICT (country_id, code, unit_type) DO UPDATE
SET
    parent_id = EXCLUDED.parent_id,
    label = EXCLUDED.label,
    normalized_label = EXCLUDED.normalized_label,
    label_fr = EXCLUDED.label_fr,
    source = EXCLUDED.source,
    external_code = EXCLUDED.external_code,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = now();

COMMIT;