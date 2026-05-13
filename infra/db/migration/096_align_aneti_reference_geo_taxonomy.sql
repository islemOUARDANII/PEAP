-- 090_align_aneti_reference_geo_taxonomy.sql
-- Objectif : aligner le modèle ANETI avec les schemas reference / geo / taxonomy
-- Stratégie : migration non destructive.
-- - On ajoute des colonnes FK propres.
-- - On garde les anciennes colonnes texte/code pour compatibilité temporaire.
-- - Les FK sont ajoutées en NOT VALID pour éviter de casser les données existantes.
-- - La validation stricte peut être faite après nettoyage/backfill complet.

BEGIN;

-- =========================================================
-- 0) Index/contraintes utiles pour lookup + ON CONFLICT
-- =========================================================

CREATE UNIQUE INDEX IF NOT EXISTS ux_reference_ref_group_code
ON reference.ref_group (code);

CREATE UNIQUE INDEX IF NOT EXISTS ux_reference_ref_value_group_code
ON reference.ref_value (group_id, code);

CREATE INDEX IF NOT EXISTS ix_reference_ref_value_group_active
ON reference.ref_value (group_id, active);

CREATE INDEX IF NOT EXISTS ix_reference_ref_value_normalized_label
ON reference.ref_value (group_id, normalized_label);

CREATE UNIQUE INDEX IF NOT EXISTS ux_geo_country_iso2
ON geo.country (iso2);

CREATE UNIQUE INDEX IF NOT EXISTS ux_geo_admin_unit_country_level_code
ON geo.admin_unit (country_id, admin_level, code);

CREATE INDEX IF NOT EXISTS ix_geo_admin_unit_country_code
ON geo.admin_unit (country_id, code);

CREATE INDEX IF NOT EXISTS ix_geo_admin_unit_parent
ON geo.admin_unit (parent_id);

CREATE INDEX IF NOT EXISTS ix_taxonomy_model_code_version
ON taxonomy.taxonomy_model (code, version);

CREATE INDEX IF NOT EXISTS ix_taxonomy_node_model_type_label
ON taxonomy.taxonomy_node (model_id, node_type, normalized_label);

CREATE INDEX IF NOT EXISTS ix_taxonomy_alias_normalized
ON taxonomy.taxonomy_alias (normalized_alias);

-- =========================================================
-- 1) Référentiels manquants pour les champs applicatifs
--    Les groupes déjà existants ne sont pas écrasés.
-- =========================================================

INSERT INTO reference.ref_group (code, label, description, domain, active, metadata_json)
VALUES
  ('EMPLOYER_STATUS', 'Statut employeur', 'Statuts de validation/suspension des employeurs', 'ANETI', true, '{"source":"migration_090"}'::jsonb),
  ('JOB_SEEKER_STATUS', 'Statut candidat', 'Statuts fonctionnels des candidats', 'ANETI', true, '{"source":"migration_090"}'::jsonb),
  ('CV_STATUS', 'Statut CV', 'Statut du fichier CV stocké', 'ANETI', true, '{"source":"migration_090"}'::jsonb),
  ('PARSING_STATUS', 'Statut parsing', 'Statut du parsing CV/offre', 'PARSING', true, '{"source":"migration_090"}'::jsonb),
  ('REQUIREMENT_CRITERION_TYPE', 'Type de critère offre', 'Types de critères dans job_offer_requirement', 'MATCHING', true, '{"source":"migration_090"}'::jsonb),
  ('SKILL_SOURCE', 'Source compétence', 'Origine des compétences candidat', 'ANETI', true, '{"source":"migration_090"}'::jsonb),
  ('SKILL_LEVEL', 'Niveau compétence', 'Niveau métier/technique déclaré ou inféré', 'ANETI', true, '{"source":"migration_090"}'::jsonb),
  ('COMPANY_SIZE', 'Taille entreprise', 'Catégorie de taille de l’employeur', 'ANETI', true, '{"source":"migration_090"}'::jsonb)
ON CONFLICT (code) DO UPDATE
SET label = EXCLUDED.label,
    description = COALESCE(reference.ref_group.description, EXCLUDED.description),
    domain = COALESCE(reference.ref_group.domain, EXCLUDED.domain),
    active = true,
    updated_at = now();

WITH values_to_seed(group_code, code, label, sort_order) AS (
  VALUES
    -- EMPLOYER_STATUS
    ('EMPLOYER_STATUS','PENDING_REVIEW','En attente de validation',1),
    ('EMPLOYER_STATUS','ACTIVE','Actif',2),
    ('EMPLOYER_STATUS','VERIFIED','Vérifié',3),
    ('EMPLOYER_STATUS','REJECTED','Rejeté',4),
    ('EMPLOYER_STATUS','SUSPENDED','Suspendu',5),

    -- JOB_SEEKER_STATUS
    ('JOB_SEEKER_STATUS','ACTIVE','Actif',1),
    ('JOB_SEEKER_STATUS','INACTIVE','Inactif',2),
    ('JOB_SEEKER_STATUS','SUSPENDED','Suspendu',3),
    ('JOB_SEEKER_STATUS','ARCHIVED','Archivé',4),

    -- CV_STATUS
    ('CV_STATUS','UPLOADED','Téléversé',1),
    ('CV_STATUS','STORED','Stocké',2),
    ('CV_STATUS','PARSED','Parsée',3),
    ('CV_STATUS','FAILED','Échec',4),
    ('CV_STATUS','ARCHIVED','Archivé',5),

    -- PARSING_STATUS
    ('PARSING_STATUS','PENDING','En attente',1),
    ('PARSING_STATUS','PROCESSING','En cours',2),
    ('PARSING_STATUS','SUCCESS','Réussi',3),
    ('PARSING_STATUS','FAILED','Échec',4),
    ('PARSING_STATUS','NEEDS_REVIEW','À vérifier',5),

    -- REQUIREMENT_CRITERION_TYPE
    ('REQUIREMENT_CRITERION_TYPE','SKILL','Compétence',1),
    ('REQUIREMENT_CRITERION_TYPE','SOFT_SKILL','Savoir-être',2),
    ('REQUIREMENT_CRITERION_TYPE','TASK','Activité / tâche',3),
    ('REQUIREMENT_CRITERION_TYPE','OCCUPATION','Métier',4),
    ('REQUIREMENT_CRITERION_TYPE','EXPERIENCE','Expérience',5),
    ('REQUIREMENT_CRITERION_TYPE','EDUCATION','Formation',6),
    ('REQUIREMENT_CRITERION_TYPE','DIPLOMA','Diplôme',7),
    ('REQUIREMENT_CRITERION_TYPE','SPECIALTY','Spécialité',8),
    ('REQUIREMENT_CRITERION_TYPE','CERTIFICATION','Certification',9),
    ('REQUIREMENT_CRITERION_TYPE','LANGUAGE','Langue',10),
    ('REQUIREMENT_CRITERION_TYPE','PERMIT','Permis',11),
    ('REQUIREMENT_CRITERION_TYPE','LOCATION','Localisation',12),
    ('REQUIREMENT_CRITERION_TYPE','CONTRACT_TYPE','Type de contrat',13),
    ('REQUIREMENT_CRITERION_TYPE','WORK_MODE','Mode de travail',14),
    ('REQUIREMENT_CRITERION_TYPE','OTHER','Autre',99),

    -- SKILL_SOURCE
    ('SKILL_SOURCE','CV','CV',1),
    ('SKILL_SOURCE','PARSING','Parsing',2),
    ('SKILL_SOURCE','MANUAL','Saisie manuelle',3),
    ('SKILL_SOURCE','ADVISOR','Conseiller',4),
    ('SKILL_SOURCE','IMPORT','Import',5),

    -- SKILL_LEVEL
    ('SKILL_LEVEL','BEGINNER','Débutant',1),
    ('SKILL_LEVEL','INTERMEDIATE','Intermédiaire',2),
    ('SKILL_LEVEL','ADVANCED','Avancé',3),
    ('SKILL_LEVEL','EXPERT','Expert',4),

    -- COMPANY_SIZE
    ('COMPANY_SIZE','MICRO','Micro-entreprise',1),
    ('COMPANY_SIZE','SMALL','Petite entreprise',2),
    ('COMPANY_SIZE','MEDIUM','Moyenne entreprise',3),
    ('COMPANY_SIZE','LARGE','Grande entreprise',4)
)
INSERT INTO reference.ref_value
  (group_id, code, label, normalized_label, label_fr, sort_order, active, source, metadata_json)
SELECT
  g.id,
  v.code,
  v.label,
  lower(trim(v.label)),
  v.label,
  v.sort_order,
  true,
  'migration_090',
  '{"source":"migration_090"}'::jsonb
FROM values_to_seed v
JOIN reference.ref_group g ON g.code = v.group_code
ON CONFLICT (group_id, code) DO UPDATE
SET label = EXCLUDED.label,
    normalized_label = EXCLUDED.normalized_label,
    label_fr = EXCLUDED.label_fr,
    active = true,
    updated_at = now();



-- 1.a) Nettoyage léger des doublons de dropdown déjà visibles dans all_ref.csv
--      Les lignes legacy restent dans reference.ref_value pour le backfill/mapping,
--      mais ne doivent pas apparaître comme choix actifs dans les dropdowns.

WITH alias_values(group_code, alias_code, canonical_code) AS (
  VALUES
    ('CONTRACT_TYPE','1','CDI'),
    ('CONTRACT_TYPE','2','CDD'),
    ('CONTRACT_TYPE','3','CIVP'),
    ('CONTRACT_TYPE','5','STAGE'),
    ('LANGUAGE_LEVEL','native','NATIVE'),
    ('LANGUAGE_LEVEL','beginner','A1'),
    ('LANGUAGE_LEVEL','intermediate','B1'),
    ('LANGUAGE_LEVEL','advanced','C1'),
    ('LANGUAGE_LEVEL','fluent','C1')
)
UPDATE reference.ref_value v
SET active = false,
    metadata_json = COALESCE(v.metadata_json, '{}'::jsonb)
      || jsonb_build_object(
           'display', false,
           'alias_of_code', av.canonical_code,
           'deactivated_reason', 'duplicate_or_alias_dropdown_value',
           'deactivated_by', 'migration_090'
         ),
    updated_at = now()
FROM alias_values av
JOIN reference.ref_group g ON g.code = av.group_code
WHERE v.group_id = g.id
  AND v.code = av.alias_code
  AND EXISTS (
    SELECT 1
    FROM reference.ref_value canonical
    WHERE canonical.group_id = g.id
      AND canonical.code = av.canonical_code
  );

-- =========================================================
-- 1.b) Pays + migration gouvernorats/délégations legacy vers geo.admin_unit
--      À garder même si la table geo est déjà alimentée : ON CONFLICT évite les doublons.
-- =========================================================

INSERT INTO geo.country
  (iso2, iso3, name_fr, name_en, default_language_code, phone_prefix, currency_code, active, metadata_json)
VALUES
  ('TN', 'TUN', 'Tunisie', 'Tunisia', 'fr', '+216', 'TND', true, '{"source":"migration_090"}'::jsonb),
  ('FR', 'FRA', 'France', 'France', 'fr', '+33', 'EUR', true, '{"source":"migration_090"}'::jsonb),
  ('IT', 'ITA', 'Italie', 'Italy', 'it', '+39', 'EUR', true, '{"source":"migration_090"}'::jsonb),
  ('CA', 'CAN', 'Canada', 'Canada', 'en', '+1', 'CAD', true, '{"source":"migration_090"}'::jsonb),
  ('US', 'USA', 'États-Unis', 'United States', 'en', '+1', 'USD', true, '{"source":"migration_090"}'::jsonb)
ON CONFLICT (iso2) DO UPDATE
SET iso3 = COALESCE(geo.country.iso3, EXCLUDED.iso3),
    name_fr = COALESCE(geo.country.name_fr, EXCLUDED.name_fr),
    name_en = COALESCE(geo.country.name_en, EXCLUDED.name_en),
    active = true,
    updated_at = now();

-- Gouvernorats Tunisie depuis taxonomy.ref_n_gouvern
INSERT INTO geo.admin_unit
  (country_id, parent_id, code, label, normalized_label, label_fr, admin_level, unit_type, active, source, external_code, metadata_json)
SELECT
  c.id,
  NULL,
  g.code_gouvernorat,
  g.libelle_gouvernorat,
  lower(trim(g.libelle_gouvernorat)),
  g.libelle_gouvernorat,
  1,
  'GOVERNORATE',
  true,
  'taxonomy.ref_n_gouvern',
  g.code_gouvernorat,
  jsonb_build_object('legacy_table', 'taxonomy.ref_n_gouvern')
FROM taxonomy.ref_n_gouvern g
JOIN geo.country c ON c.iso2 = 'TN'
WHERE g.code_gouvernorat IS NOT NULL
ON CONFLICT (country_id, admin_level, code) DO UPDATE
SET label = EXCLUDED.label,
    normalized_label = EXCLUDED.normalized_label,
    label_fr = EXCLUDED.label_fr,
    active = true,
    updated_at = now();

-- Délégations Tunisie depuis taxonomy.ref_n_delegat
INSERT INTO geo.admin_unit
  (country_id, parent_id, code, label, normalized_label, label_fr, admin_level, unit_type, active, source, external_code, metadata_json)
SELECT
  c.id,
  gov.id,
  d.code_delegation,
  d.libelle_delegation,
  lower(trim(d.libelle_delegation)),
  d.libelle_delegation,
  2,
  'DELEGATION',
  true,
  'taxonomy.ref_n_delegat',
  d.code_delegation,
  jsonb_build_object('legacy_table', 'taxonomy.ref_n_delegat', 'legacy_governorate_code', d.code_gouvernorat)
FROM taxonomy.ref_n_delegat d
JOIN geo.country c ON c.iso2 = 'TN'
JOIN geo.admin_unit gov
  ON gov.country_id = c.id
 AND gov.admin_level = 1
 AND gov.code = d.code_gouvernorat
WHERE d.code_delegation IS NOT NULL
ON CONFLICT (country_id, admin_level, code) DO UPDATE
SET parent_id = EXCLUDED.parent_id,
    label = EXCLUDED.label,
    normalized_label = EXCLUDED.normalized_label,
    label_fr = EXCLUDED.label_fr,
    active = true,
    updated_at = now();

-- =========================================================
-- 2) Colonnes FK propres dans aneti.*
-- =========================================================

-- Agences ANETI : géographie
ALTER TABLE aneti.aneti_agency
  ADD COLUMN IF NOT EXISTS country_id uuid,
  ADD COLUMN IF NOT EXISTS governorate_admin_unit_id uuid,
  ADD COLUMN IF NOT EXISTS delegation_admin_unit_id uuid;

-- Employeurs : référentiels administratifs
ALTER TABLE aneti.employer
  ADD COLUMN IF NOT EXISTS sector_ref_id uuid,
  ADD COLUMN IF NOT EXISTS status_ref_id uuid,
  ADD COLUMN IF NOT EXISTS size_category_ref_id uuid;

-- Localisations employeurs : géographie
ALTER TABLE aneti.employer_location
  ADD COLUMN IF NOT EXISTS country_id uuid,
  ADD COLUMN IF NOT EXISTS governorate_admin_unit_id uuid,
  ADD COLUMN IF NOT EXISTS delegation_admin_unit_id uuid;

-- Offres : taxonomy + reference + geo
ALTER TABLE aneti.job_offer
  ADD COLUMN IF NOT EXISTS occupation_node_id uuid,
  ADD COLUMN IF NOT EXISTS status_ref_id uuid,
  ADD COLUMN IF NOT EXISTS contract_type_ref_id uuid,
  ADD COLUMN IF NOT EXISTS work_mode_ref_id uuid,
  ADD COLUMN IF NOT EXISTS country_id uuid,
  ADD COLUMN IF NOT EXISTS governorate_admin_unit_id uuid,
  ADD COLUMN IF NOT EXISTS delegation_admin_unit_id uuid;

-- Exigences d'offres : type critère + node taxonomy canonique
ALTER TABLE aneti.job_offer_requirement
  ADD COLUMN IF NOT EXISTS criterion_type_ref_id uuid,
  ADD COLUMN IF NOT EXISTS taxonomy_node_id uuid,
  ADD COLUMN IF NOT EXISTS min_level_ref_id uuid;

-- Candidat : statut + langue principale
ALTER TABLE aneti.job_seeker
  ADD COLUMN IF NOT EXISTS status_ref_id uuid,
  ADD COLUMN IF NOT EXISTS primary_language_ref_id uuid;

-- Contact candidat : géographie
ALTER TABLE aneti.job_seeker_contact
  ADD COLUMN IF NOT EXISTS country_id uuid,
  ADD COLUMN IF NOT EXISTS governorate_admin_unit_id uuid,
  ADD COLUMN IF NOT EXISTS delegation_admin_unit_id uuid;

-- CV : statuts
ALTER TABLE aneti.job_seeker_cv
  ADD COLUMN IF NOT EXISTS status_ref_id uuid,
  ADD COLUMN IF NOT EXISTS parsing_status_ref_id uuid;

-- Formation : référentiels administratifs + éventuel node taxonomy
ALTER TABLE aneti.job_seeker_education
  ADD COLUMN IF NOT EXISTS diploma_ref_id uuid,
  ADD COLUMN IF NOT EXISTS specialty_ref_id uuid,
  ADD COLUMN IF NOT EXISTS education_node_id uuid;

-- Expérience : occupation canonique + secteur
ALTER TABLE aneti.job_seeker_experience
  ADD COLUMN IF NOT EXISTS occupation_node_id uuid,
  ADD COLUMN IF NOT EXISTS sector_ref_id uuid;

-- Identité : référentiels administratifs
ALTER TABLE aneti.job_seeker_identity
  ADD COLUMN IF NOT EXISTS gender_ref_id uuid,
  ADD COLUMN IF NOT EXISTS handicap_type_ref_id uuid,
  ADD COLUMN IF NOT EXISTS handicap_degree_ref_id uuid,
  ADD COLUMN IF NOT EXISTS nationality_country_id uuid;

-- Langues : FK vers reference
ALTER TABLE aneti.job_seeker_language
  ADD COLUMN IF NOT EXISTS language_ref_id uuid,
  ADD COLUMN IF NOT EXISTS level_ref_id uuid;

-- Préférences : contrat + localisation
ALTER TABLE aneti.job_seeker_preference
  ADD COLUMN IF NOT EXISTS preferred_contract_type_ref_id uuid,
  ADD COLUMN IF NOT EXISTS preferred_governorate_admin_unit_id uuid;

-- Compétences : node taxonomy + niveau/source
ALTER TABLE aneti.job_seeker_skill
  ADD COLUMN IF NOT EXISTS skill_node_id uuid,
  ADD COLUMN IF NOT EXISTS level_ref_id uuid,
  ADD COLUMN IF NOT EXISTS source_ref_id uuid;

-- Candidatures : statut
ALTER TABLE aneti.job_application
  ADD COLUMN IF NOT EXISTS status_ref_id uuid;

-- =========================================================
-- 3) Backfill générique reference / geo / taxonomy
-- =========================================================

-- 3.1 Pays par défaut TN lorsque country est vide
UPDATE aneti.aneti_agency a
SET country_id = c.id
FROM geo.country c
WHERE a.country_id IS NULL AND c.iso2 = 'TN';

UPDATE aneti.employer_location el
SET country_id = c.id
FROM geo.country c
WHERE el.country_id IS NULL
  AND c.iso2 = COALESCE(NULLIF(trim(el.country), ''), 'TN');

UPDATE aneti.job_offer jo
SET country_id = c.id
FROM geo.country c
WHERE jo.country_id IS NULL
  AND c.iso2 = COALESCE(NULLIF(trim(jo.country), ''), 'TN');

UPDATE aneti.job_seeker_contact jc
SET country_id = c.id
FROM geo.country c
WHERE jc.country_id IS NULL
  AND c.iso2 = COALESCE(NULLIF(trim(jc.country), ''), 'TN');

UPDATE aneti.job_seeker_identity ji
SET nationality_country_id = c.id
FROM geo.country c
WHERE ji.nationality_country_id IS NULL
  AND ji.nationality IS NOT NULL
  AND (c.iso2 = trim(ji.nationality) OR lower(c.name_fr) = lower(trim(ji.nationality)) OR lower(c.name_en) = lower(trim(ji.nationality)));

-- 3.2 Gouvernorat / délégation depuis codes existants
UPDATE aneti.employer_location el
SET governorate_admin_unit_id = au.id
FROM geo.admin_unit au
WHERE el.governorate_admin_unit_id IS NULL
  AND el.country_id = au.country_id
  AND au.admin_level = 1
  AND au.code = el.governorate_code;

UPDATE aneti.employer_location el
SET delegation_admin_unit_id = au.id
FROM geo.admin_unit au
WHERE el.delegation_admin_unit_id IS NULL
  AND el.country_id = au.country_id
  AND au.admin_level = 2
  AND au.code = el.delegation_code;

UPDATE aneti.job_offer jo
SET governorate_admin_unit_id = au.id
FROM geo.admin_unit au
WHERE jo.governorate_admin_unit_id IS NULL
  AND jo.country_id = au.country_id
  AND au.admin_level = 1
  AND au.code = jo.governorate_code;

UPDATE aneti.job_offer jo
SET delegation_admin_unit_id = au.id
FROM geo.admin_unit au
WHERE jo.delegation_admin_unit_id IS NULL
  AND jo.country_id = au.country_id
  AND au.admin_level = 2
  AND au.code = jo.delegation_code;

UPDATE aneti.job_seeker_contact jc
SET governorate_admin_unit_id = au.id
FROM geo.admin_unit au
WHERE jc.governorate_admin_unit_id IS NULL
  AND jc.country_id = au.country_id
  AND au.admin_level = 1
  AND au.code = jc.governorate_code;

UPDATE aneti.job_seeker_contact jc
SET delegation_admin_unit_id = au.id
FROM geo.admin_unit au
WHERE jc.delegation_admin_unit_id IS NULL
  AND jc.country_id = au.country_id
  AND au.admin_level = 2
  AND au.code = jc.delegation_code;

UPDATE aneti.job_seeker_preference jp
SET preferred_governorate_admin_unit_id = au.id
FROM geo.admin_unit au
JOIN geo.country c ON c.id = au.country_id AND c.iso2 = 'TN'
WHERE jp.preferred_governorate_admin_unit_id IS NULL
  AND au.admin_level = 1
  AND au.code = jp.preferred_governorate;

-- Agences : on tente code puis label normalisé
UPDATE aneti.aneti_agency a
SET governorate_admin_unit_id = au.id
FROM geo.admin_unit au
WHERE a.governorate_admin_unit_id IS NULL
  AND a.country_id = au.country_id
  AND au.admin_level = 1
  AND (au.code = a.governorate OR lower(au.normalized_label) = lower(trim(a.governorate)));

UPDATE aneti.aneti_agency a
SET delegation_admin_unit_id = au.id
FROM geo.admin_unit au
WHERE a.delegation_admin_unit_id IS NULL
  AND a.country_id = au.country_id
  AND au.admin_level = 2
  AND (au.code = a.delegation OR lower(au.normalized_label) = lower(trim(a.delegation)));

-- 3.3 Helper pattern pour reference.ref_value : code, external_code puis label normalisé

UPDATE aneti.job_offer jo
SET status_ref_id = rv.id
FROM reference.ref_value rv
JOIN reference.ref_group rg ON rg.id = rv.group_id
WHERE jo.status_ref_id IS NULL AND rg.code = 'OFFER_STATUS'
  AND (rv.code = jo.status OR rv.external_code = jo.status OR rv.normalized_label = lower(trim(jo.status)));

UPDATE aneti.job_offer jo
SET contract_type_ref_id = rv.id
FROM reference.ref_value rv
JOIN reference.ref_group rg ON rg.id = rv.group_id
WHERE jo.contract_type_ref_id IS NULL AND rg.code = 'CONTRACT_TYPE'
  AND (rv.code = jo.contract_type OR rv.external_code = jo.contract_type OR rv.normalized_label = lower(trim(jo.contract_type)));

UPDATE aneti.job_offer jo
SET work_mode_ref_id = rv.id
FROM reference.ref_value rv
JOIN reference.ref_group rg ON rg.id = rv.group_id
WHERE jo.work_mode_ref_id IS NULL AND rg.code = 'WORK_MODE'
  AND (rv.code = jo.work_mode OR rv.external_code = jo.work_mode OR rv.normalized_label = lower(trim(jo.work_mode)));

UPDATE aneti.job_offer_requirement r
SET criterion_type_ref_id = rv.id
FROM reference.ref_value rv
JOIN reference.ref_group rg ON rg.id = rv.group_id
WHERE r.criterion_type_ref_id IS NULL AND rg.code = 'REQUIREMENT_CRITERION_TYPE'
  AND (rv.code = r.criterion_type OR rv.normalized_label = lower(trim(r.criterion_type)));

UPDATE aneti.job_seeker js
SET status_ref_id = rv.id
FROM reference.ref_value rv
JOIN reference.ref_group rg ON rg.id = rv.group_id
WHERE js.status_ref_id IS NULL AND rg.code = 'JOB_SEEKER_STATUS'
  AND (rv.code = js.status OR rv.normalized_label = lower(trim(js.status)));

UPDATE aneti.job_seeker js
SET primary_language_ref_id = rv.id
FROM reference.ref_value rv
JOIN reference.ref_group rg ON rg.id = rv.group_id
WHERE js.primary_language_ref_id IS NULL AND rg.code = 'LANGUAGE'
  AND (rv.code = js.primary_language OR rv.external_code = js.primary_language OR rv.normalized_label = lower(trim(js.primary_language)));

UPDATE aneti.job_seeker_cv cv
SET status_ref_id = rv.id
FROM reference.ref_value rv
JOIN reference.ref_group rg ON rg.id = rv.group_id
WHERE cv.status_ref_id IS NULL AND rg.code = 'CV_STATUS'
  AND (rv.code = cv.status OR rv.normalized_label = lower(trim(cv.status)));

UPDATE aneti.job_seeker_cv cv
SET parsing_status_ref_id = rv.id
FROM reference.ref_value rv
JOIN reference.ref_group rg ON rg.id = rv.group_id
WHERE cv.parsing_status_ref_id IS NULL AND rg.code = 'PARSING_STATUS'
  AND (rv.code = cv.parsing_status OR rv.normalized_label = lower(trim(cv.parsing_status)));

UPDATE aneti.job_seeker_identity ji
SET gender_ref_id = rv.id
FROM reference.ref_value rv
JOIN reference.ref_group rg ON rg.id = rv.group_id
WHERE ji.gender_ref_id IS NULL AND rg.code = 'GENDER'
  AND (rv.code = ji.gender_code OR rv.external_code = ji.gender_code OR rv.normalized_label = lower(trim(ji.gender_code)));

UPDATE aneti.job_seeker_identity ji
SET handicap_type_ref_id = rv.id
FROM reference.ref_value rv
JOIN reference.ref_group rg ON rg.id = rv.group_id
WHERE ji.handicap_type_ref_id IS NULL AND rg.code = 'HANDICAP_TYPE'
  AND (rv.code = ji.code_handicap OR rv.external_code = ji.code_handicap OR rv.normalized_label = lower(trim(ji.code_handicap)));

UPDATE aneti.job_seeker_identity ji
SET handicap_degree_ref_id = rv.id
FROM reference.ref_value rv
JOIN reference.ref_group rg ON rg.id = rv.group_id
WHERE ji.handicap_degree_ref_id IS NULL AND rg.code = 'HANDICAP_DEGREE'
  AND (rv.code = ji.code_degre_handicap OR rv.external_code = ji.code_degre_handicap OR rv.normalized_label = lower(trim(ji.code_degre_handicap)));

UPDATE aneti.job_seeker_language jl
SET language_ref_id = rv.id
FROM reference.ref_value rv
JOIN reference.ref_group rg ON rg.id = rv.group_id
WHERE jl.language_ref_id IS NULL AND rg.code = 'LANGUAGE'
  AND (rv.code = jl.language_code OR rv.external_code = jl.language_code OR rv.normalized_label = lower(trim(jl.language_code)));

UPDATE aneti.job_seeker_language jl
SET level_ref_id = rv.id
FROM reference.ref_value rv
JOIN reference.ref_group rg ON rg.id = rv.group_id
WHERE jl.level_ref_id IS NULL AND rg.code = 'LANGUAGE_LEVEL'
  AND (rv.code = jl.level OR rv.external_code = jl.level OR rv.normalized_label = lower(trim(jl.level)));

UPDATE aneti.job_seeker_preference jp
SET preferred_contract_type_ref_id = rv.id
FROM reference.ref_value rv
JOIN reference.ref_group rg ON rg.id = rv.group_id
WHERE jp.preferred_contract_type_ref_id IS NULL AND rg.code = 'CONTRACT_TYPE'
  AND (rv.code = jp.preferred_contract_type OR rv.external_code = jp.preferred_contract_type OR rv.normalized_label = lower(trim(jp.preferred_contract_type)));

UPDATE aneti.job_seeker_education je
SET diploma_ref_id = rv.id
FROM reference.ref_value rv
JOIN reference.ref_group rg ON rg.id = rv.group_id
WHERE je.diploma_ref_id IS NULL AND rg.code = 'DIPLOMA'
  AND (rv.code = je.level_code OR rv.external_code = je.level_code OR rv.normalized_label = lower(trim(je.diploma_label)));

UPDATE aneti.job_seeker_education je
SET specialty_ref_id = rv.id
FROM reference.ref_value rv
JOIN reference.ref_group rg ON rg.id = rv.group_id
WHERE je.specialty_ref_id IS NULL AND rg.code = 'SPECIALTY'
  AND (rv.code = je.specialty OR rv.external_code = je.specialty OR rv.normalized_label = lower(trim(je.specialty)));

UPDATE aneti.job_application ja
SET status_ref_id = rv.id
FROM reference.ref_value rv
JOIN reference.ref_group rg ON rg.id = rv.group_id
WHERE ja.status_ref_id IS NULL AND rg.code = 'APPLICATION_STATUS'
  AND (rv.code = ja.status OR rv.external_code = ja.status OR rv.normalized_label = lower(trim(ja.status)));

UPDATE aneti.employer e
SET status_ref_id = rv.id
FROM reference.ref_value rv
JOIN reference.ref_group rg ON rg.id = rv.group_id
WHERE e.status_ref_id IS NULL AND rg.code = 'EMPLOYER_STATUS'
  AND (rv.code = e.status OR rv.normalized_label = lower(trim(e.status)));

UPDATE aneti.employer e
SET sector_ref_id = rv.id
FROM reference.ref_value rv
JOIN reference.ref_group rg ON rg.id = rv.group_id
WHERE e.sector_ref_id IS NULL AND rg.code IN ('ACTIVITY_SECTOR', 'ANETI_ACTIVITY')
  AND (rv.code = e.sector_code OR rv.external_code = e.sector_code OR rv.normalized_label = lower(trim(e.sector_code)));

UPDATE aneti.employer e
SET size_category_ref_id = rv.id
FROM reference.ref_value rv
JOIN reference.ref_group rg ON rg.id = rv.group_id
WHERE e.size_category_ref_id IS NULL AND rg.code = 'COMPANY_SIZE'
  AND (rv.code = e.size_category OR rv.normalized_label = lower(trim(e.size_category)));

UPDATE aneti.job_seeker_skill js
SET source_ref_id = rv.id
FROM reference.ref_value rv
JOIN reference.ref_group rg ON rg.id = rv.group_id
WHERE js.source_ref_id IS NULL AND rg.code = 'SKILL_SOURCE'
  AND (rv.code = js.source OR rv.normalized_label = lower(trim(js.source)));

UPDATE aneti.job_seeker_skill js
SET level_ref_id = rv.id
FROM reference.ref_value rv
JOIN reference.ref_group rg ON rg.id = rv.group_id
WHERE js.level_ref_id IS NULL AND rg.code = 'SKILL_LEVEL'
  AND (rv.code = js.level OR rv.normalized_label = lower(trim(js.level)));

UPDATE aneti.job_seeker_experience ex
SET sector_ref_id = rv.id
FROM reference.ref_value rv
JOIN reference.ref_group rg ON rg.id = rv.group_id
WHERE ex.sector_ref_id IS NULL AND rg.code IN ('ACTIVITY_SECTOR', 'ANETI_ACTIVITY')
  AND (rv.code = ex.sector OR rv.external_code = ex.sector OR rv.normalized_label = lower(trim(ex.sector)));

-- 3.4 Taxonomy node canonical : copie depuis anciennes colonnes UUID si elles pointent déjà vers taxonomy.taxonomy_node
UPDATE aneti.job_offer jo
SET occupation_node_id = jo.rtmc_occupation_id
WHERE jo.occupation_node_id IS NULL
  AND jo.rtmc_occupation_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM taxonomy.taxonomy_node tn WHERE tn.id = jo.rtmc_occupation_id);

UPDATE aneti.job_offer_requirement r
SET taxonomy_node_id = r.node_id
WHERE r.taxonomy_node_id IS NULL
  AND r.node_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM taxonomy.taxonomy_node tn WHERE tn.id = r.node_id);

UPDATE aneti.job_seeker_skill s
SET skill_node_id = s.skill_id
WHERE s.skill_node_id IS NULL
  AND s.skill_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM taxonomy.taxonomy_node tn WHERE tn.id = s.skill_id);

UPDATE aneti.job_seeker_experience e
SET occupation_node_id = e.occupation_id
WHERE e.occupation_node_id IS NULL
  AND e.occupation_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM taxonomy.taxonomy_node tn WHERE tn.id = e.occupation_id);

UPDATE aneti.job_seeker_education ed
SET education_node_id = ed.rtmc_education_node_id
WHERE ed.education_node_id IS NULL
  AND ed.rtmc_education_node_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM taxonomy.taxonomy_node tn WHERE tn.id = ed.rtmc_education_node_id);

-- =========================================================
-- 4) FK NOT VALID : sécurise le modèle sans casser l'existant
-- =========================================================

DO $$
BEGIN
  -- geo.country
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_aneti_agency_country') THEN
    ALTER TABLE aneti.aneti_agency ADD CONSTRAINT fk_aneti_agency_country FOREIGN KEY (country_id) REFERENCES geo.country(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_employer_location_country') THEN
    ALTER TABLE aneti.employer_location ADD CONSTRAINT fk_employer_location_country FOREIGN KEY (country_id) REFERENCES geo.country(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_job_offer_country') THEN
    ALTER TABLE aneti.job_offer ADD CONSTRAINT fk_job_offer_country FOREIGN KEY (country_id) REFERENCES geo.country(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_job_seeker_contact_country') THEN
    ALTER TABLE aneti.job_seeker_contact ADD CONSTRAINT fk_job_seeker_contact_country FOREIGN KEY (country_id) REFERENCES geo.country(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_job_seeker_identity_nationality_country') THEN
    ALTER TABLE aneti.job_seeker_identity ADD CONSTRAINT fk_job_seeker_identity_nationality_country FOREIGN KEY (nationality_country_id) REFERENCES geo.country(id) NOT VALID;
  END IF;

  -- geo.admin_unit
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_aneti_agency_governorate') THEN
    ALTER TABLE aneti.aneti_agency ADD CONSTRAINT fk_aneti_agency_governorate FOREIGN KEY (governorate_admin_unit_id) REFERENCES geo.admin_unit(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_aneti_agency_delegation') THEN
    ALTER TABLE aneti.aneti_agency ADD CONSTRAINT fk_aneti_agency_delegation FOREIGN KEY (delegation_admin_unit_id) REFERENCES geo.admin_unit(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_employer_location_governorate') THEN
    ALTER TABLE aneti.employer_location ADD CONSTRAINT fk_employer_location_governorate FOREIGN KEY (governorate_admin_unit_id) REFERENCES geo.admin_unit(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_employer_location_delegation') THEN
    ALTER TABLE aneti.employer_location ADD CONSTRAINT fk_employer_location_delegation FOREIGN KEY (delegation_admin_unit_id) REFERENCES geo.admin_unit(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_job_offer_governorate') THEN
    ALTER TABLE aneti.job_offer ADD CONSTRAINT fk_job_offer_governorate FOREIGN KEY (governorate_admin_unit_id) REFERENCES geo.admin_unit(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_job_offer_delegation') THEN
    ALTER TABLE aneti.job_offer ADD CONSTRAINT fk_job_offer_delegation FOREIGN KEY (delegation_admin_unit_id) REFERENCES geo.admin_unit(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_job_seeker_contact_governorate') THEN
    ALTER TABLE aneti.job_seeker_contact ADD CONSTRAINT fk_job_seeker_contact_governorate FOREIGN KEY (governorate_admin_unit_id) REFERENCES geo.admin_unit(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_job_seeker_contact_delegation') THEN
    ALTER TABLE aneti.job_seeker_contact ADD CONSTRAINT fk_job_seeker_contact_delegation FOREIGN KEY (delegation_admin_unit_id) REFERENCES geo.admin_unit(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_job_seeker_preference_governorate') THEN
    ALTER TABLE aneti.job_seeker_preference ADD CONSTRAINT fk_job_seeker_preference_governorate FOREIGN KEY (preferred_governorate_admin_unit_id) REFERENCES geo.admin_unit(id) NOT VALID;
  END IF;

  -- reference.ref_value
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_employer_sector_ref') THEN
    ALTER TABLE aneti.employer ADD CONSTRAINT fk_employer_sector_ref FOREIGN KEY (sector_ref_id) REFERENCES reference.ref_value(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_employer_status_ref') THEN
    ALTER TABLE aneti.employer ADD CONSTRAINT fk_employer_status_ref FOREIGN KEY (status_ref_id) REFERENCES reference.ref_value(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_employer_size_category_ref') THEN
    ALTER TABLE aneti.employer ADD CONSTRAINT fk_employer_size_category_ref FOREIGN KEY (size_category_ref_id) REFERENCES reference.ref_value(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_job_offer_status_ref') THEN
    ALTER TABLE aneti.job_offer ADD CONSTRAINT fk_job_offer_status_ref FOREIGN KEY (status_ref_id) REFERENCES reference.ref_value(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_job_offer_contract_type_ref') THEN
    ALTER TABLE aneti.job_offer ADD CONSTRAINT fk_job_offer_contract_type_ref FOREIGN KEY (contract_type_ref_id) REFERENCES reference.ref_value(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_job_offer_work_mode_ref') THEN
    ALTER TABLE aneti.job_offer ADD CONSTRAINT fk_job_offer_work_mode_ref FOREIGN KEY (work_mode_ref_id) REFERENCES reference.ref_value(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_job_offer_requirement_criterion_type_ref') THEN
    ALTER TABLE aneti.job_offer_requirement ADD CONSTRAINT fk_job_offer_requirement_criterion_type_ref FOREIGN KEY (criterion_type_ref_id) REFERENCES reference.ref_value(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_job_offer_requirement_min_level_ref') THEN
    ALTER TABLE aneti.job_offer_requirement ADD CONSTRAINT fk_job_offer_requirement_min_level_ref FOREIGN KEY (min_level_ref_id) REFERENCES reference.ref_value(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_job_seeker_status_ref') THEN
    ALTER TABLE aneti.job_seeker ADD CONSTRAINT fk_job_seeker_status_ref FOREIGN KEY (status_ref_id) REFERENCES reference.ref_value(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_job_seeker_primary_language_ref') THEN
    ALTER TABLE aneti.job_seeker ADD CONSTRAINT fk_job_seeker_primary_language_ref FOREIGN KEY (primary_language_ref_id) REFERENCES reference.ref_value(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_job_seeker_cv_status_ref') THEN
    ALTER TABLE aneti.job_seeker_cv ADD CONSTRAINT fk_job_seeker_cv_status_ref FOREIGN KEY (status_ref_id) REFERENCES reference.ref_value(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_job_seeker_cv_parsing_status_ref') THEN
    ALTER TABLE aneti.job_seeker_cv ADD CONSTRAINT fk_job_seeker_cv_parsing_status_ref FOREIGN KEY (parsing_status_ref_id) REFERENCES reference.ref_value(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_job_seeker_identity_gender_ref') THEN
    ALTER TABLE aneti.job_seeker_identity ADD CONSTRAINT fk_job_seeker_identity_gender_ref FOREIGN KEY (gender_ref_id) REFERENCES reference.ref_value(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_job_seeker_identity_handicap_type_ref') THEN
    ALTER TABLE aneti.job_seeker_identity ADD CONSTRAINT fk_job_seeker_identity_handicap_type_ref FOREIGN KEY (handicap_type_ref_id) REFERENCES reference.ref_value(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_job_seeker_identity_handicap_degree_ref') THEN
    ALTER TABLE aneti.job_seeker_identity ADD CONSTRAINT fk_job_seeker_identity_handicap_degree_ref FOREIGN KEY (handicap_degree_ref_id) REFERENCES reference.ref_value(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_job_seeker_language_language_ref') THEN
    ALTER TABLE aneti.job_seeker_language ADD CONSTRAINT fk_job_seeker_language_language_ref FOREIGN KEY (language_ref_id) REFERENCES reference.ref_value(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_job_seeker_language_level_ref') THEN
    ALTER TABLE aneti.job_seeker_language ADD CONSTRAINT fk_job_seeker_language_level_ref FOREIGN KEY (level_ref_id) REFERENCES reference.ref_value(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_job_seeker_education_diploma_ref') THEN
    ALTER TABLE aneti.job_seeker_education ADD CONSTRAINT fk_job_seeker_education_diploma_ref FOREIGN KEY (diploma_ref_id) REFERENCES reference.ref_value(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_job_seeker_education_specialty_ref') THEN
    ALTER TABLE aneti.job_seeker_education ADD CONSTRAINT fk_job_seeker_education_specialty_ref FOREIGN KEY (specialty_ref_id) REFERENCES reference.ref_value(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_job_seeker_preference_contract_ref') THEN
    ALTER TABLE aneti.job_seeker_preference ADD CONSTRAINT fk_job_seeker_preference_contract_ref FOREIGN KEY (preferred_contract_type_ref_id) REFERENCES reference.ref_value(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_job_seeker_skill_level_ref') THEN
    ALTER TABLE aneti.job_seeker_skill ADD CONSTRAINT fk_job_seeker_skill_level_ref FOREIGN KEY (level_ref_id) REFERENCES reference.ref_value(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_job_seeker_skill_source_ref') THEN
    ALTER TABLE aneti.job_seeker_skill ADD CONSTRAINT fk_job_seeker_skill_source_ref FOREIGN KEY (source_ref_id) REFERENCES reference.ref_value(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_job_seeker_experience_sector_ref') THEN
    ALTER TABLE aneti.job_seeker_experience ADD CONSTRAINT fk_job_seeker_experience_sector_ref FOREIGN KEY (sector_ref_id) REFERENCES reference.ref_value(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_job_application_status_ref') THEN
    ALTER TABLE aneti.job_application ADD CONSTRAINT fk_job_application_status_ref FOREIGN KEY (status_ref_id) REFERENCES reference.ref_value(id) NOT VALID;
  END IF;

  -- taxonomy.taxonomy_node
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_job_offer_occupation_node') THEN
    ALTER TABLE aneti.job_offer ADD CONSTRAINT fk_job_offer_occupation_node FOREIGN KEY (occupation_node_id) REFERENCES taxonomy.taxonomy_node(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_job_offer_requirement_taxonomy_node') THEN
    ALTER TABLE aneti.job_offer_requirement ADD CONSTRAINT fk_job_offer_requirement_taxonomy_node FOREIGN KEY (taxonomy_node_id) REFERENCES taxonomy.taxonomy_node(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_job_seeker_skill_taxonomy_node') THEN
    ALTER TABLE aneti.job_seeker_skill ADD CONSTRAINT fk_job_seeker_skill_taxonomy_node FOREIGN KEY (skill_node_id) REFERENCES taxonomy.taxonomy_node(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_job_seeker_experience_occupation_node') THEN
    ALTER TABLE aneti.job_seeker_experience ADD CONSTRAINT fk_job_seeker_experience_occupation_node FOREIGN KEY (occupation_node_id) REFERENCES taxonomy.taxonomy_node(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_job_seeker_education_taxonomy_node') THEN
    ALTER TABLE aneti.job_seeker_education ADD CONSTRAINT fk_job_seeker_education_taxonomy_node FOREIGN KEY (education_node_id) REFERENCES taxonomy.taxonomy_node(id) NOT VALID;
  END IF;
END $$;

-- =========================================================
-- 5) Index sur nouvelles colonnes FK pour performances API/matching
-- =========================================================

CREATE INDEX IF NOT EXISTS ix_aneti_job_offer_contract_type_ref ON aneti.job_offer(contract_type_ref_id);
CREATE INDEX IF NOT EXISTS ix_aneti_job_offer_work_mode_ref ON aneti.job_offer(work_mode_ref_id);
CREATE INDEX IF NOT EXISTS ix_aneti_job_offer_status_ref ON aneti.job_offer(status_ref_id);
CREATE INDEX IF NOT EXISTS ix_aneti_job_offer_geo ON aneti.job_offer(country_id, governorate_admin_unit_id, delegation_admin_unit_id);
CREATE INDEX IF NOT EXISTS ix_aneti_job_offer_occupation_node ON aneti.job_offer(occupation_node_id);

CREATE INDEX IF NOT EXISTS ix_aneti_job_offer_requirement_node ON aneti.job_offer_requirement(taxonomy_node_id);
CREATE INDEX IF NOT EXISTS ix_aneti_job_offer_requirement_criterion_ref ON aneti.job_offer_requirement(criterion_type_ref_id);

CREATE INDEX IF NOT EXISTS ix_aneti_job_seeker_contact_geo ON aneti.job_seeker_contact(country_id, governorate_admin_unit_id, delegation_admin_unit_id);
CREATE INDEX IF NOT EXISTS ix_aneti_job_seeker_skill_node ON aneti.job_seeker_skill(skill_node_id);
CREATE INDEX IF NOT EXISTS ix_aneti_job_seeker_language_refs ON aneti.job_seeker_language(language_ref_id, level_ref_id);
CREATE INDEX IF NOT EXISTS ix_aneti_job_seeker_education_refs ON aneti.job_seeker_education(diploma_ref_id, specialty_ref_id);
CREATE INDEX IF NOT EXISTS ix_aneti_job_application_status_ref ON aneti.job_application(status_ref_id);

-- =========================================================
-- 6) Vue pratique pour dropdowns front
-- =========================================================

CREATE OR REPLACE VIEW reference.v_active_ref_values AS
SELECT
  g.code AS group_code,
  g.label AS group_label,
  v.id,
  v.group_id,
  v.code,
  v.label,
  v.normalized_label,
  v.label_fr,
  v.label_en,
  v.label_ar,
  v.sort_order,
  v.source,
  v.external_code,
  v.metadata_json
FROM reference.ref_value v
JOIN reference.ref_group g ON g.id = v.group_id
WHERE g.active = true
  AND v.active = true
  AND (v.valid_from IS NULL OR v.valid_from <= CURRENT_DATE)
  AND (v.valid_to IS NULL OR v.valid_to >= CURRENT_DATE);

COMMIT;

-- =========================================================
-- 7) Requêtes de contrôle post-migration
-- =========================================================
-- -- Colonnes ajoutées :
-- SELECT table_schema, table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'aneti'
--   AND column_name LIKE '%_ref_id' OR column_name LIKE '%admin_unit_id' OR column_name LIKE '%node_id'
-- ORDER BY table_name, ordinal_position;
--
-- -- Champs non backfillés à corriger progressivement :
-- SELECT 'job_offer.contract_type' AS field, count(*) AS missing
-- FROM aneti.job_offer WHERE contract_type IS NOT NULL AND contract_type_ref_id IS NULL
-- UNION ALL
-- SELECT 'job_offer.geo', count(*)
-- FROM aneti.job_offer WHERE (governorate_code IS NOT NULL AND governorate_admin_unit_id IS NULL)
--    OR (delegation_code IS NOT NULL AND delegation_admin_unit_id IS NULL)
-- UNION ALL
-- SELECT 'job_seeker_language.language', count(*)
-- FROM aneti.job_seeker_language WHERE language_code IS NOT NULL AND language_ref_id IS NULL;
