BEGIN;

-- =========================================================
-- 1. Make sure required schemas exist
-- =========================================================
CREATE SCHEMA IF NOT EXISTS reference;
CREATE SCHEMA IF NOT EXISTS geo;

-- =========================================================
-- 2. Ensure reference groups exist
-- =========================================================
INSERT INTO reference.ref_group (
    code,
    label,
    description,
    domain,
    metadata_json
)
VALUES
    ('GENDER', 'Genre', 'Référentiel des genres.', 'ADMIN', '{"source":"taxonomy.ref_genre"}'),
    ('HANDICAP_DEGREE', 'Degré de handicap', 'Référentiel des degrés de handicap.', 'ADMIN', '{"source":"taxonomy.ref_degre_handicap"}'),
    ('HANDICAP_TYPE', 'Type de handicap', 'Référentiel des types de handicap.', 'ADMIN', '{"source":"taxonomy.ref_type_handicap"}'),

    ('CONTRACT_TYPE', 'Type de contrat', 'Référentiel des types de contrat.', 'EMPLOYMENT', '{"source":"taxonomy.ref_type_contrat"}'),
    ('WORK_REGIME', 'Régime de travail', 'Référentiel des régimes de travail.', 'EMPLOYMENT', '{"source":"taxonomy.ref_regime_travail"}'),
    ('WORK_TIME_ORGANIZATION', 'Organisation du temps de travail', 'Référentiel de l’organisation du temps de travail.', 'EMPLOYMENT', '{"source":"taxonomy.ref_organisation_temps_travail"}'),
    ('OFFER_SITUATION', 'Situation de l’offre', 'Référentiel des situations d’offre.', 'EMPLOYMENT', '{"source":"taxonomy.ref_situation_offre"}'),
    ('OFFER_TYPE', 'Type d’offre', 'Référentiel des types d’offre.', 'EMPLOYMENT', '{"source":"taxonomy.ref_type_offre"}'),
    ('PAE_TYPE', 'Type PAE', 'Référentiel des types PAE.', 'EMPLOYMENT', '{"source":"taxonomy.ref_type_pae"}'),
    ('SEGMENTATION', 'Segmentation', 'Référentiel des segmentations.', 'EMPLOYMENT', '{"source":"taxonomy.ref_segmentation"}'),
    ('ANETI_ACTIVITY', 'Activité ANETI', 'Référentiel des activités ANETI.', 'EMPLOYMENT', '{"source":"taxonomy.ref_n_activit"}'),
    ('ACTIVITY_SECTOR', 'Secteur d’activité', 'Référentiel des secteurs d’activité.', 'EMPLOYMENT', '{"source":"taxonomy.ref_v_sectact"}'),

    ('LANGUAGE', 'Langue', 'Référentiel des langues.', 'LANGUAGE', '{"source":"taxonomy.ref_language"}'),
    ('LANGUAGE_LEVEL', 'Niveau de langue', 'Référentiel des niveaux de langue.', 'LANGUAGE', '{"source":"taxonomy.ref_language_level"}'),

    ('DIPLOMA', 'Diplôme', 'Référentiel des diplômes.', 'EDUCATION', '{"source":"taxonomy.ref_diplomes"}'),
    ('EDUCATION_LEVEL', 'Niveau d’instruction', 'Référentiel des niveaux d’instruction.', 'EDUCATION', '{"source":"taxonomy.ref_niveau_instruction"}'),
    ('SPECIALTY', 'Spécialité', 'Référentiel des spécialités.', 'EDUCATION', '{"source":"taxonomy.ref_specialites"}'),
    ('CERTIFICATION', 'Certification', 'Référentiel des certifications.', 'EDUCATION', '{"source":"taxonomy.ref_certifications"}'),

    ('PERMIT_TYPE', 'Type de permis', 'Référentiel des types de permis.', 'ADMIN', '{"source":"taxonomy.ref_type_permis"}')
ON CONFLICT (code) DO UPDATE
SET
    label = EXCLUDED.label,
    description = EXCLUDED.description,
    domain = EXCLUDED.domain,
    metadata_json = reference.ref_group.metadata_json || EXCLUDED.metadata_json,
    updated_at = now();


-- =========================================================
-- 3. Tunisia country
-- =========================================================
INSERT INTO geo.country (
    iso2,
    iso3,
    numeric_code,
    name_fr,
    name_en,
    name_ar,
    default_language_code,
    phone_prefix,
    currency_code,
    metadata_json
)
VALUES (
    'TN',
    'TUN',
    '788',
    'Tunisie',
    'Tunisia',
    'تونس',
    'fr',
    '+216',
    'TND',
    '{"source":"seed"}'
)
ON CONFLICT (iso2) DO UPDATE
SET
    iso3 = EXCLUDED.iso3,
    numeric_code = EXCLUDED.numeric_code,
    name_fr = EXCLUDED.name_fr,
    name_en = EXCLUDED.name_en,
    name_ar = EXCLUDED.name_ar,
    default_language_code = EXCLUDED.default_language_code,
    phone_prefix = EXCLUDED.phone_prefix,
    currency_code = EXCLUDED.currency_code,
    updated_at = now();


-- =========================================================
-- 4. Migrate governorates to geo.admin_unit
-- taxonomy.ref_n_gouvern:
-- code_gouvernorat, libelle_gouvernorat
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
    g.code_gouvernorat,
    g.libelle_gouvernorat,
    geo.normalize_text(g.libelle_gouvernorat),
    g.libelle_gouvernorat,
    1,
    'GOVERNORATE',
    'taxonomy.ref_n_gouvern',
    g.code_gouvernorat,
    jsonb_build_object('old_row', to_jsonb(g))
FROM geo.country c
JOIN taxonomy.ref_n_gouvern g
    ON c.iso2 = 'TN'
WHERE g.code_gouvernorat IS NOT NULL
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
-- 5. Migrate delegations to geo.admin_unit
-- taxonomy.ref_n_delegat:
-- code_delegation, libelle_delegation, code_gouvernorat
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
    d.code_delegation,
    d.libelle_delegation,
    geo.normalize_text(d.libelle_delegation),
    d.libelle_delegation,
    2,
    'DELEGATION',
    'taxonomy.ref_n_delegat',
    d.code_delegation,
    jsonb_build_object('old_row', to_jsonb(d))
FROM geo.country c
JOIN taxonomy.ref_n_delegat d
    ON c.iso2 = 'TN'
LEFT JOIN geo.admin_unit gov
    ON gov.country_id = c.id
   AND gov.unit_type = 'GOVERNORATE'
   AND gov.code = d.code_gouvernorat
WHERE d.code_delegation IS NOT NULL
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


-- =========================================================
-- Helper pattern:
-- Insert old taxonomy.ref_* rows into reference.ref_value
-- =========================================================

-- ref_certifications
WITH grp AS (
    SELECT id FROM reference.ref_group WHERE code = 'CERTIFICATION'
)
INSERT INTO reference.ref_value (
    group_id, code, label, normalized_label, label_fr, source, external_code, metadata_json
)
SELECT
    grp.id,
    r.code_certification,
    r.libelle_certification,
    reference.normalize_text(r.libelle_certification),
    r.libelle_certification,
    'taxonomy.ref_certifications',
    r.code_certification,
    jsonb_build_object('old_row', to_jsonb(r))
FROM grp
JOIN taxonomy.ref_certifications r ON TRUE
WHERE r.code_certification IS NOT NULL
ON CONFLICT (group_id, code) DO UPDATE
SET label = EXCLUDED.label,
    normalized_label = EXCLUDED.normalized_label,
    label_fr = EXCLUDED.label_fr,
    source = EXCLUDED.source,
    external_code = EXCLUDED.external_code,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = now();


-- ref_degre_handicap
WITH grp AS (
    SELECT id FROM reference.ref_group WHERE code = 'HANDICAP_DEGREE'
)
INSERT INTO reference.ref_value (
    group_id, code, label, normalized_label, label_fr, source, external_code, metadata_json
)
SELECT
    grp.id,
    r.code_degre_handicap,
    r.libelle_degre_handicap,
    reference.normalize_text(r.libelle_degre_handicap),
    r.libelle_degre_handicap,
    'taxonomy.ref_degre_handicap',
    r.code_degre_handicap,
    jsonb_build_object('old_row', to_jsonb(r))
FROM grp
JOIN taxonomy.ref_degre_handicap r ON TRUE
WHERE r.code_degre_handicap IS NOT NULL
ON CONFLICT (group_id, code) DO UPDATE
SET label = EXCLUDED.label,
    normalized_label = EXCLUDED.normalized_label,
    label_fr = EXCLUDED.label_fr,
    source = EXCLUDED.source,
    external_code = EXCLUDED.external_code,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = now();


-- ref_diplomes
WITH grp AS (
    SELECT id FROM reference.ref_group WHERE code = 'DIPLOMA'
)
INSERT INTO reference.ref_value (
    group_id, code, label, normalized_label, label_fr, source, external_code, metadata_json
)
SELECT
    grp.id,
    r.code_diplome,
    r.libelle_diplome,
    reference.normalize_text(r.libelle_diplome),
    r.libelle_diplome,
    'taxonomy.ref_diplomes',
    r.code_diplome,
    jsonb_build_object('old_row', to_jsonb(r))
FROM grp
JOIN taxonomy.ref_diplomes r ON TRUE
WHERE r.code_diplome IS NOT NULL
ON CONFLICT (group_id, code) DO UPDATE
SET label = EXCLUDED.label,
    normalized_label = EXCLUDED.normalized_label,
    label_fr = EXCLUDED.label_fr,
    source = EXCLUDED.source,
    external_code = EXCLUDED.external_code,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = now();


-- ref_genre
WITH grp AS (
    SELECT id FROM reference.ref_group WHERE code = 'GENDER'
)
INSERT INTO reference.ref_value (
    group_id, code, label, normalized_label, label_fr, source, external_code, metadata_json
)
SELECT
    grp.id,
    r.code_genre,
    r.libelle_genre,
    reference.normalize_text(r.libelle_genre),
    r.libelle_genre,
    'taxonomy.ref_genre',
    r.code_genre,
    jsonb_build_object('old_row', to_jsonb(r))
FROM grp
JOIN taxonomy.ref_genre r ON TRUE
WHERE r.code_genre IS NOT NULL
ON CONFLICT (group_id, code) DO UPDATE
SET label = EXCLUDED.label,
    normalized_label = EXCLUDED.normalized_label,
    label_fr = EXCLUDED.label_fr,
    source = EXCLUDED.source,
    external_code = EXCLUDED.external_code,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = now();


-- ref_language
WITH grp AS (
    SELECT id FROM reference.ref_group WHERE code = 'LANGUAGE'
)
INSERT INTO reference.ref_value (
    group_id, code, label, normalized_label, label_fr, label_en, source, external_code, metadata_json
)
SELECT
    grp.id,
    r.code,
    r.label_fr,
    reference.normalize_text(r.label_fr),
    r.label_fr,
    r.label_en,
    'taxonomy.ref_language',
    r.code,
    jsonb_build_object('old_row', to_jsonb(r), 'aliases', r.aliases)
FROM grp
JOIN taxonomy.ref_language r ON TRUE
WHERE r.code IS NOT NULL
ON CONFLICT (group_id, code) DO UPDATE
SET label = EXCLUDED.label,
    normalized_label = EXCLUDED.normalized_label,
    label_fr = EXCLUDED.label_fr,
    label_en = EXCLUDED.label_en,
    source = EXCLUDED.source,
    external_code = EXCLUDED.external_code,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = now();


-- ref_language_level
WITH grp AS (
    SELECT id FROM reference.ref_group WHERE code = 'LANGUAGE_LEVEL'
)
INSERT INTO reference.ref_value (
    group_id, code, label, normalized_label, label_fr, label_en, sort_order, source, external_code, metadata_json
)
SELECT
    grp.id,
    r.code,
    r.label_fr,
    reference.normalize_text(r.label_fr),
    r.label_fr,
    r.label_en,
    COALESCE(r.rank_order, 0),
    'taxonomy.ref_language_level',
    r.code,
    jsonb_build_object('old_row', to_jsonb(r), 'aliases', r.aliases, 'description', r.description)
FROM grp
JOIN taxonomy.ref_language_level r ON TRUE
WHERE r.code IS NOT NULL
ON CONFLICT (group_id, code) DO UPDATE
SET label = EXCLUDED.label,
    normalized_label = EXCLUDED.normalized_label,
    label_fr = EXCLUDED.label_fr,
    label_en = EXCLUDED.label_en,
    sort_order = EXCLUDED.sort_order,
    source = EXCLUDED.source,
    external_code = EXCLUDED.external_code,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = now();


-- ref_n_activit
WITH grp AS (
    SELECT id FROM reference.ref_group WHERE code = 'ANETI_ACTIVITY'
)
INSERT INTO reference.ref_value (
    group_id, code, label, normalized_label, label_fr, source, external_code, metadata_json
)
SELECT
    grp.id,
    r.code_activite,
    r.libelle_activite,
    reference.normalize_text(r.libelle_activite),
    r.libelle_activite,
    'taxonomy.ref_n_activit',
    r.code_activite,
    jsonb_build_object('old_row', to_jsonb(r))
FROM grp
JOIN taxonomy.ref_n_activit r ON TRUE
WHERE r.code_activite IS NOT NULL
ON CONFLICT (group_id, code) DO UPDATE
SET label = EXCLUDED.label,
    normalized_label = EXCLUDED.normalized_label,
    label_fr = EXCLUDED.label_fr,
    source = EXCLUDED.source,
    external_code = EXCLUDED.external_code,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = now();


-- ref_niveau_instruction
WITH grp AS (
    SELECT id FROM reference.ref_group WHERE code = 'EDUCATION_LEVEL'
)
INSERT INTO reference.ref_value (
    group_id, code, label, normalized_label, label_fr, source, external_code, metadata_json
)
SELECT
    grp.id,
    r.code_niveau_instruction,
    r.libelle_niveau_instruction,
    reference.normalize_text(r.libelle_niveau_instruction),
    r.libelle_niveau_instruction,
    'taxonomy.ref_niveau_instruction',
    r.code_niveau_instruction,
    jsonb_build_object('old_row', to_jsonb(r))
FROM grp
JOIN taxonomy.ref_niveau_instruction r ON TRUE
WHERE r.code_niveau_instruction IS NOT NULL
ON CONFLICT (group_id, code) DO UPDATE
SET label = EXCLUDED.label,
    normalized_label = EXCLUDED.normalized_label,
    label_fr = EXCLUDED.label_fr,
    source = EXCLUDED.source,
    external_code = EXCLUDED.external_code,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = now();


-- ref_organisation_temps_travail
WITH grp AS (
    SELECT id FROM reference.ref_group WHERE code = 'WORK_TIME_ORGANIZATION'
)
INSERT INTO reference.ref_value (
    group_id, code, label, normalized_label, label_fr, source, external_code, metadata_json
)
SELECT
    grp.id,
    r.code,
    r.libelle,
    reference.normalize_text(r.libelle),
    r.libelle,
    'taxonomy.ref_organisation_temps_travail',
    r.code,
    jsonb_build_object('old_row', to_jsonb(r))
FROM grp
JOIN taxonomy.ref_organisation_temps_travail r ON TRUE
WHERE r.code IS NOT NULL
ON CONFLICT (group_id, code) DO UPDATE
SET label = EXCLUDED.label,
    normalized_label = EXCLUDED.normalized_label,
    label_fr = EXCLUDED.label_fr,
    source = EXCLUDED.source,
    external_code = EXCLUDED.external_code,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = now();


-- ref_regime_travail
WITH grp AS (
    SELECT id FROM reference.ref_group WHERE code = 'WORK_REGIME'
)
INSERT INTO reference.ref_value (
    group_id, code, label, normalized_label, label_fr, source, external_code, metadata_json
)
SELECT
    grp.id,
    r.code,
    r.libelle,
    reference.normalize_text(r.libelle),
    r.libelle,
    'taxonomy.ref_regime_travail',
    r.code,
    jsonb_build_object('old_row', to_jsonb(r))
FROM grp
JOIN taxonomy.ref_regime_travail r ON TRUE
WHERE r.code IS NOT NULL
ON CONFLICT (group_id, code) DO UPDATE
SET label = EXCLUDED.label,
    normalized_label = EXCLUDED.normalized_label,
    label_fr = EXCLUDED.label_fr,
    source = EXCLUDED.source,
    external_code = EXCLUDED.external_code,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = now();


-- ref_segmentation
WITH grp AS (
    SELECT id FROM reference.ref_group WHERE code = 'SEGMENTATION'
)
INSERT INTO reference.ref_value (
    group_id, code, label, normalized_label, label_fr, source, external_code, metadata_json
)
SELECT
    grp.id,
    r.code_segmentation,
    r.libelle_segmentation,
    reference.normalize_text(r.libelle_segmentation),
    r.libelle_segmentation,
    'taxonomy.ref_segmentation',
    r.code_segmentation,
    jsonb_build_object('old_row', to_jsonb(r))
FROM grp
JOIN taxonomy.ref_segmentation r ON TRUE
WHERE r.code_segmentation IS NOT NULL
ON CONFLICT (group_id, code) DO UPDATE
SET label = EXCLUDED.label,
    normalized_label = EXCLUDED.normalized_label,
    label_fr = EXCLUDED.label_fr,
    source = EXCLUDED.source,
    external_code = EXCLUDED.external_code,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = now();


-- ref_situation_offre
WITH grp AS (
    SELECT id FROM reference.ref_group WHERE code = 'OFFER_SITUATION'
)
INSERT INTO reference.ref_value (
    group_id, code, label, normalized_label, label_fr, source, external_code, metadata_json
)
SELECT
    grp.id,
    r.code,
    r.libelle,
    reference.normalize_text(r.libelle),
    r.libelle,
    'taxonomy.ref_situation_offre',
    r.code,
    jsonb_build_object('old_row', to_jsonb(r))
FROM grp
JOIN taxonomy.ref_situation_offre r ON TRUE
WHERE r.code IS NOT NULL
ON CONFLICT (group_id, code) DO UPDATE
SET label = EXCLUDED.label,
    normalized_label = EXCLUDED.normalized_label,
    label_fr = EXCLUDED.label_fr,
    source = EXCLUDED.source,
    external_code = EXCLUDED.external_code,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = now();


-- ref_specialites
WITH grp AS (
    SELECT id FROM reference.ref_group WHERE code = 'SPECIALTY'
)
INSERT INTO reference.ref_value (
    group_id, code, label, normalized_label, label_fr, source, external_code, metadata_json
)
SELECT
    grp.id,
    r.code_specialite,
    r.libelle_specialite,
    reference.normalize_text(r.libelle_specialite),
    r.libelle_specialite,
    'taxonomy.ref_specialites',
    r.code_specialite,
    jsonb_build_object('old_row', to_jsonb(r))
FROM grp
JOIN taxonomy.ref_specialites r ON TRUE
WHERE r.code_specialite IS NOT NULL
ON CONFLICT (group_id, code) DO UPDATE
SET label = EXCLUDED.label,
    normalized_label = EXCLUDED.normalized_label,
    label_fr = EXCLUDED.label_fr,
    source = EXCLUDED.source,
    external_code = EXCLUDED.external_code,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = now();


-- ref_type_contrat
WITH grp AS (
    SELECT id FROM reference.ref_group WHERE code = 'CONTRACT_TYPE'
)
INSERT INTO reference.ref_value (
    group_id, code, label, normalized_label, label_fr, source, external_code, metadata_json
)
SELECT
    grp.id,
    r.code_contrat,
    r.libelle_contrat,
    reference.normalize_text(r.libelle_contrat),
    r.libelle_contrat,
    'taxonomy.ref_type_contrat',
    r.code_contrat,
    jsonb_build_object('old_row', to_jsonb(r))
FROM grp
JOIN taxonomy.ref_type_contrat r ON TRUE
WHERE r.code_contrat IS NOT NULL
ON CONFLICT (group_id, code) DO UPDATE
SET label = EXCLUDED.label,
    normalized_label = EXCLUDED.normalized_label,
    label_fr = EXCLUDED.label_fr,
    source = EXCLUDED.source,
    external_code = EXCLUDED.external_code,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = now();


-- ref_type_handicap
WITH grp AS (
    SELECT id FROM reference.ref_group WHERE code = 'HANDICAP_TYPE'
)
INSERT INTO reference.ref_value (
    group_id, code, label, normalized_label, label_fr, source, external_code, metadata_json
)
SELECT
    grp.id,
    r.code_handicap,
    r.libelle_handicap,
    reference.normalize_text(r.libelle_handicap),
    r.libelle_handicap,
    'taxonomy.ref_type_handicap',
    r.code_handicap,
    jsonb_build_object('old_row', to_jsonb(r))
FROM grp
JOIN taxonomy.ref_type_handicap r ON TRUE
WHERE r.code_handicap IS NOT NULL
ON CONFLICT (group_id, code) DO UPDATE
SET label = EXCLUDED.label,
    normalized_label = EXCLUDED.normalized_label,
    label_fr = EXCLUDED.label_fr,
    source = EXCLUDED.source,
    external_code = EXCLUDED.external_code,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = now();


-- ref_type_offre
WITH grp AS (
    SELECT id FROM reference.ref_group WHERE code = 'OFFER_TYPE'
)
INSERT INTO reference.ref_value (
    group_id, code, label, normalized_label, label_fr, source, external_code, metadata_json
)
SELECT
    grp.id,
    r.code,
    r.libelle,
    reference.normalize_text(r.libelle),
    r.libelle,
    'taxonomy.ref_type_offre',
    r.code,
    jsonb_build_object('old_row', to_jsonb(r))
FROM grp
JOIN taxonomy.ref_type_offre r ON TRUE
WHERE r.code IS NOT NULL
ON CONFLICT (group_id, code) DO UPDATE
SET label = EXCLUDED.label,
    normalized_label = EXCLUDED.normalized_label,
    label_fr = EXCLUDED.label_fr,
    source = EXCLUDED.source,
    external_code = EXCLUDED.external_code,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = now();


-- ref_type_pae
WITH grp AS (
    SELECT id FROM reference.ref_group WHERE code = 'PAE_TYPE'
)
INSERT INTO reference.ref_value (
    group_id, code, label, normalized_label, label_fr, source, external_code, metadata_json
)
SELECT
    grp.id,
    r.code,
    r.libelle,
    reference.normalize_text(r.libelle),
    r.libelle,
    'taxonomy.ref_type_pae',
    r.code,
    jsonb_build_object('old_row', to_jsonb(r))
FROM grp
JOIN taxonomy.ref_type_pae r ON TRUE
WHERE r.code IS NOT NULL
ON CONFLICT (group_id, code) DO UPDATE
SET label = EXCLUDED.label,
    normalized_label = EXCLUDED.normalized_label,
    label_fr = EXCLUDED.label_fr,
    source = EXCLUDED.source,
    external_code = EXCLUDED.external_code,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = now();


-- ref_type_permis
WITH grp AS (
    SELECT id FROM reference.ref_group WHERE code = 'PERMIT_TYPE'
)
INSERT INTO reference.ref_value (
    group_id, code, label, normalized_label, label_fr, source, external_code, metadata_json
)
SELECT
    grp.id,
    r.code_permis,
    r.libelle_permis,
    reference.normalize_text(r.libelle_permis),
    r.libelle_permis,
    'taxonomy.ref_type_permis',
    r.code_permis,
    jsonb_build_object('old_row', to_jsonb(r))
FROM grp
JOIN taxonomy.ref_type_permis r ON TRUE
WHERE r.code_permis IS NOT NULL
ON CONFLICT (group_id, code) DO UPDATE
SET label = EXCLUDED.label,
    normalized_label = EXCLUDED.normalized_label,
    label_fr = EXCLUDED.label_fr,
    source = EXCLUDED.source,
    external_code = EXCLUDED.external_code,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = now();


-- ref_v_sectact
WITH grp AS (
    SELECT id FROM reference.ref_group WHERE code = 'ACTIVITY_SECTOR'
)
INSERT INTO reference.ref_value (
    group_id, code, label, normalized_label, label_fr, source, external_code, metadata_json
)
SELECT
    grp.id,
    r.code_secteur,
    r.libelle_secteur,
    reference.normalize_text(r.libelle_secteur),
    r.libelle_secteur,
    'taxonomy.ref_v_sectact',
    r.code_secteur,
    jsonb_build_object('old_row', to_jsonb(r))
FROM grp
JOIN taxonomy.ref_v_sectact r ON TRUE
WHERE r.code_secteur IS NOT NULL
ON CONFLICT (group_id, code) DO UPDATE
SET label = EXCLUDED.label,
    normalized_label = EXCLUDED.normalized_label,
    label_fr = EXCLUDED.label_fr,
    source = EXCLUDED.source,
    external_code = EXCLUDED.external_code,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = now();

COMMIT;