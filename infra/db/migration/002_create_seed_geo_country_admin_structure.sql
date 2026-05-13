-- =====================================================================
-- 002_create_seed_geo_country_admin_structure.sql
-- Objectif : créer et remplir geo.country_admin_structure
-- Périmètre phase 1 : pays utiles pour ANETI / offres internationales
--   TN, FR, US, CA, IT
--
-- Remarque : cette table décrit la structure des formulaires géographiques.
-- Elle ne contient PAS les valeurs réelles (gouvernorats, délégations, etc.).
-- Les valeurs réelles restent dans geo.admin_unit.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS geo;

CREATE TABLE IF NOT EXISTS geo.country_admin_structure (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    country_id UUID NOT NULL REFERENCES geo.country(id),

    admin_level INTEGER NOT NULL,
    unit_type TEXT NOT NULL,

    label_fr TEXT NOT NULL,
    label_en TEXT,
    label_ar TEXT,

    required BOOLEAN NOT NULL DEFAULT false,
    active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,

    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_country_admin_structure_country_level
ON geo.country_admin_structure(country_id, admin_level);

CREATE INDEX IF NOT EXISTS ix_country_admin_structure_country
ON geo.country_admin_structure(country_id);

CREATE INDEX IF NOT EXISTS ix_country_admin_structure_active
ON geo.country_admin_structure(active);

-- =====================================================================
-- TUNISIE - TN
-- Source principale : République Tunisienne, Ministère de l'Intérieur,
-- Open Data : délégations par gouvernorats / nombre de délégations par gouvernorat.
-- Notes métier : pour ANETI, le formulaire attendu est généralement :
-- Pays -> Gouvernorat -> Délégation.
-- =====================================================================

INSERT INTO geo.country_admin_structure (
    country_id, admin_level, unit_type,
    label_fr, label_en, label_ar,
    required, active, sort_order, metadata_json
)
SELECT
    c.id, 1, 'GOVERNORATE',
    'Gouvernorat', 'Governorate', 'ولاية',
    true, true, 1,
    jsonb_build_object(
        'source_name', 'République Tunisienne - Ministère de l''Intérieur Open Data',
        'source_url', 'https://opendata.interieur.gov.tn/fr/catalog/delegations-par-gouvernorats-de-la-republique',
        'source_note', 'Découpage administratif tunisien : gouvernorats et délégations',
        'confidence', 'high'
    )
FROM geo.country c
WHERE c.iso2 = 'TN'
ON CONFLICT (country_id, admin_level) DO UPDATE SET
    unit_type = EXCLUDED.unit_type,
    label_fr = EXCLUDED.label_fr,
    label_en = EXCLUDED.label_en,
    label_ar = EXCLUDED.label_ar,
    required = EXCLUDED.required,
    active = EXCLUDED.active,
    sort_order = EXCLUDED.sort_order,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = now();

INSERT INTO geo.country_admin_structure (
    country_id, admin_level, unit_type,
    label_fr, label_en, label_ar,
    required, active, sort_order, metadata_json
)
SELECT
    c.id, 2, 'DELEGATION',
    'Délégation', 'Delegation', 'معتمدية',
    true, true, 2,
    jsonb_build_object(
        'source_name', 'République Tunisienne - Ministère de l''Intérieur Open Data',
        'source_url', 'https://opendata.interieur.gov.tn/fr/catalog/delegations-par-gouvernorats-de-la-republique',
        'source_note', 'Découpage administratif tunisien : gouvernorats et délégations',
        'confidence', 'high'
    )
FROM geo.country c
WHERE c.iso2 = 'TN'
ON CONFLICT (country_id, admin_level) DO UPDATE SET
    unit_type = EXCLUDED.unit_type,
    label_fr = EXCLUDED.label_fr,
    label_en = EXCLUDED.label_en,
    label_ar = EXCLUDED.label_ar,
    required = EXCLUDED.required,
    active = EXCLUDED.active,
    sort_order = EXCLUDED.sort_order,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = now();

-- =====================================================================
-- FRANCE - FR
-- Source principale : INSEE, Code officiel géographique (COG).
-- Le COG couvre les unités administratives françaises : régions,
-- départements, communes, etc.
-- =====================================================================

INSERT INTO geo.country_admin_structure (
    country_id, admin_level, unit_type,
    label_fr, label_en, label_ar,
    required, active, sort_order, metadata_json
)
SELECT
    c.id, 1, 'REGION',
    'Région', 'Region', 'جهة',
    true, true, 1,
    jsonb_build_object(
        'source_name', 'INSEE - Code officiel géographique',
        'source_url', 'https://www.insee.fr/en/metadonnees/source/serie/s2084',
        'source_note', 'Classification officielle des unités administratives françaises',
        'confidence', 'high'
    )
FROM geo.country c
WHERE c.iso2 = 'FR'
ON CONFLICT (country_id, admin_level) DO UPDATE SET
    unit_type = EXCLUDED.unit_type,
    label_fr = EXCLUDED.label_fr,
    label_en = EXCLUDED.label_en,
    label_ar = EXCLUDED.label_ar,
    required = EXCLUDED.required,
    active = EXCLUDED.active,
    sort_order = EXCLUDED.sort_order,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = now();

INSERT INTO geo.country_admin_structure (
    country_id, admin_level, unit_type,
    label_fr, label_en, label_ar,
    required, active, sort_order, metadata_json
)
SELECT
    c.id, 2, 'DEPARTMENT',
    'Département', 'Department', 'إقليم',
    true, true, 2,
    jsonb_build_object(
        'source_name', 'INSEE - Code officiel géographique',
        'source_url', 'https://www.insee.fr/en/metadonnees/source/serie/s2084',
        'source_note', 'Classification officielle des unités administratives françaises',
        'confidence', 'high'
    )
FROM geo.country c
WHERE c.iso2 = 'FR'
ON CONFLICT (country_id, admin_level) DO UPDATE SET
    unit_type = EXCLUDED.unit_type,
    label_fr = EXCLUDED.label_fr,
    label_en = EXCLUDED.label_en,
    label_ar = EXCLUDED.label_ar,
    required = EXCLUDED.required,
    active = EXCLUDED.active,
    sort_order = EXCLUDED.sort_order,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = now();

INSERT INTO geo.country_admin_structure (
    country_id, admin_level, unit_type,
    label_fr, label_en, label_ar,
    required, active, sort_order, metadata_json
)
SELECT
    c.id, 3, 'COMMUNE',
    'Commune', 'Municipality', 'بلدية',
    false, true, 3,
    jsonb_build_object(
        'source_name', 'INSEE - Code officiel géographique',
        'source_url', 'https://www.insee.fr/en/metadonnees/source/operation/s2085/bases-donnees-ligne',
        'source_note', 'Le COG fournit notamment les communes et leurs rattachements aux niveaux supérieurs',
        'confidence', 'high'
    )
FROM geo.country c
WHERE c.iso2 = 'FR'
ON CONFLICT (country_id, admin_level) DO UPDATE SET
    unit_type = EXCLUDED.unit_type,
    label_fr = EXCLUDED.label_fr,
    label_en = EXCLUDED.label_en,
    label_ar = EXCLUDED.label_ar,
    required = EXCLUDED.required,
    active = EXCLUDED.active,
    sort_order = EXCLUDED.sort_order,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = now();

-- =====================================================================
-- UNITED STATES - US
-- Source principale : U.S. Census Bureau.
-- Notes : les counties sont les divisions politiques/administratives
-- primaires des states. Les city/municipality sont gardées optionnelles.
-- =====================================================================

INSERT INTO geo.country_admin_structure (
    country_id, admin_level, unit_type,
    label_fr, label_en, label_ar,
    required, active, sort_order, metadata_json
)
SELECT
    c.id, 1, 'STATE',
    'État', 'State', 'ولاية',
    true, true, 1,
    jsonb_build_object(
        'source_name', 'U.S. Census Bureau - Geographic Levels',
        'source_url', 'https://www.census.gov/programs-surveys/economic-census/guidance-geographies/levels.html',
        'source_note', 'Structure géographique utilisée par le Census Bureau',
        'confidence', 'high'
    )
FROM geo.country c
WHERE c.iso2 = 'US'
ON CONFLICT (country_id, admin_level) DO UPDATE SET
    unit_type = EXCLUDED.unit_type,
    label_fr = EXCLUDED.label_fr,
    label_en = EXCLUDED.label_en,
    label_ar = EXCLUDED.label_ar,
    required = EXCLUDED.required,
    active = EXCLUDED.active,
    sort_order = EXCLUDED.sort_order,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = now();

INSERT INTO geo.country_admin_structure (
    country_id, admin_level, unit_type,
    label_fr, label_en, label_ar,
    required, active, sort_order, metadata_json
)
SELECT
    c.id, 2, 'COUNTY',
    'Comté', 'County', 'مقاطعة',
    false, true, 2,
    jsonb_build_object(
        'source_name', 'U.S. Census Bureau - Geographic Levels',
        'source_url', 'https://www.census.gov/programs-surveys/economic-census/guidance-geographies/levels.html',
        'source_note', 'Counties and county equivalents are primary political and administrative divisions of states',
        'confidence', 'high'
    )
FROM geo.country c
WHERE c.iso2 = 'US'
ON CONFLICT (country_id, admin_level) DO UPDATE SET
    unit_type = EXCLUDED.unit_type,
    label_fr = EXCLUDED.label_fr,
    label_en = EXCLUDED.label_en,
    label_ar = EXCLUDED.label_ar,
    required = EXCLUDED.required,
    active = EXCLUDED.active,
    sort_order = EXCLUDED.sort_order,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = now();

INSERT INTO geo.country_admin_structure (
    country_id, admin_level, unit_type,
    label_fr, label_en, label_ar,
    required, active, sort_order, metadata_json
)
SELECT
    c.id, 3, 'CITY',
    'Ville', 'City', 'مدينة',
    false, true, 3,
    jsonb_build_object(
        'source_name', 'U.S. Census Bureau - Geographic Levels',
        'source_url', 'https://www.census.gov/programs-surveys/economic-census/guidance-geographies/levels.html',
        'source_note', 'City/municipality level kept optional for forms',
        'confidence', 'medium'
    )
FROM geo.country c
WHERE c.iso2 = 'US'
ON CONFLICT (country_id, admin_level) DO UPDATE SET
    unit_type = EXCLUDED.unit_type,
    label_fr = EXCLUDED.label_fr,
    label_en = EXCLUDED.label_en,
    label_ar = EXCLUDED.label_ar,
    required = EXCLUDED.required,
    active = EXCLUDED.active,
    sort_order = EXCLUDED.sort_order,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = now();

-- =====================================================================
-- CANADA - CA
-- Source principale : Statistics Canada, Standard Geographical Classification.
-- La SGC couvre : provinces/territories, census divisions,
-- census subdivisions/municipalities.
-- =====================================================================

INSERT INTO geo.country_admin_structure (
    country_id, admin_level, unit_type,
    label_fr, label_en, label_ar,
    required, active, sort_order, metadata_json
)
SELECT
    c.id, 1, 'PROVINCE_TERRITORY',
    'Province / Territoire', 'Province / Territory', 'مقاطعة / إقليم',
    true, true, 1,
    jsonb_build_object(
        'source_name', 'Statistics Canada - Standard Geographical Classification',
        'source_url', 'https://www.statcan.gc.ca/en/subjects/standard/sgc/2016/introduction',
        'source_note', 'SGC covers provinces and territories, census divisions and census subdivisions',
        'confidence', 'high'
    )
FROM geo.country c
WHERE c.iso2 = 'CA'
ON CONFLICT (country_id, admin_level) DO UPDATE SET
    unit_type = EXCLUDED.unit_type,
    label_fr = EXCLUDED.label_fr,
    label_en = EXCLUDED.label_en,
    label_ar = EXCLUDED.label_ar,
    required = EXCLUDED.required,
    active = EXCLUDED.active,
    sort_order = EXCLUDED.sort_order,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = now();

INSERT INTO geo.country_admin_structure (
    country_id, admin_level, unit_type,
    label_fr, label_en, label_ar,
    required, active, sort_order, metadata_json
)
SELECT
    c.id, 2, 'CENSUS_DIVISION',
    'Division de recensement', 'Census division', 'قسم إحصائي',
    false, true, 2,
    jsonb_build_object(
        'source_name', 'Statistics Canada - Standard Geographical Classification',
        'source_url', 'https://www.statcan.gc.ca/en/subjects/standard/sgc/2016/introduction',
        'source_note', 'Census divisions include counties and regional municipalities depending on province/territory',
        'confidence', 'high'
    )
FROM geo.country c
WHERE c.iso2 = 'CA'
ON CONFLICT (country_id, admin_level) DO UPDATE SET
    unit_type = EXCLUDED.unit_type,
    label_fr = EXCLUDED.label_fr,
    label_en = EXCLUDED.label_en,
    label_ar = EXCLUDED.label_ar,
    required = EXCLUDED.required,
    active = EXCLUDED.active,
    sort_order = EXCLUDED.sort_order,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = now();

INSERT INTO geo.country_admin_structure (
    country_id, admin_level, unit_type,
    label_fr, label_en, label_ar,
    required, active, sort_order, metadata_json
)
SELECT
    c.id, 3, 'MUNICIPALITY',
    'Municipalité', 'Municipality', 'بلدية',
    false, true, 3,
    jsonb_build_object(
        'source_name', 'Statistics Canada - Standard Geographical Classification',
        'source_url', 'https://www.statcan.gc.ca/en/subjects/standard/sgc/2016/introduction',
        'source_note', 'Census subdivisions often correspond to municipalities',
        'confidence', 'high'
    )
FROM geo.country c
WHERE c.iso2 = 'CA'
ON CONFLICT (country_id, admin_level) DO UPDATE SET
    unit_type = EXCLUDED.unit_type,
    label_fr = EXCLUDED.label_fr,
    label_en = EXCLUDED.label_en,
    label_ar = EXCLUDED.label_ar,
    required = EXCLUDED.required,
    active = EXCLUDED.active,
    sort_order = EXCLUDED.sort_order,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = now();

-- =====================================================================
-- ITALIE - IT
-- Source principale : ISTAT, codes of Italian municipalities,
-- provinces and regions.
-- =====================================================================

INSERT INTO geo.country_admin_structure (
    country_id, admin_level, unit_type,
    label_fr, label_en, label_ar,
    required, active, sort_order, metadata_json
)
SELECT
    c.id, 1, 'REGION',
    'Région', 'Region', 'جهة',
    true, true, 1,
    jsonb_build_object(
        'source_name', 'ISTAT - Codes of Italian municipalities, provinces and regions',
        'source_url', 'https://www.istat.it/en/classification/codes-of-italian-municipalities-provinces-and-regions/',
        'source_note', 'ISTAT provides codes and names for Italian municipalities, provinces and regions',
        'confidence', 'high'
    )
FROM geo.country c
WHERE c.iso2 = 'IT'
ON CONFLICT (country_id, admin_level) DO UPDATE SET
    unit_type = EXCLUDED.unit_type,
    label_fr = EXCLUDED.label_fr,
    label_en = EXCLUDED.label_en,
    label_ar = EXCLUDED.label_ar,
    required = EXCLUDED.required,
    active = EXCLUDED.active,
    sort_order = EXCLUDED.sort_order,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = now();

INSERT INTO geo.country_admin_structure (
    country_id, admin_level, unit_type,
    label_fr, label_en, label_ar,
    required, active, sort_order, metadata_json
)
SELECT
    c.id, 2, 'PROVINCE_METRO_CITY',
    'Province / Ville métropolitaine', 'Province / Metropolitan city', 'مقاطعة / مدينة كبرى',
    false, true, 2,
    jsonb_build_object(
        'source_name', 'ISTAT - Codes of Italian municipalities, provinces and regions',
        'source_url', 'https://www.istat.it/en/classification/codes-of-italian-municipalities-provinces-and-regions/',
        'source_note', 'Intermediate level kept for addressing/search when data are imported',
        'confidence', 'high'
    )
FROM geo.country c
WHERE c.iso2 = 'IT'
ON CONFLICT (country_id, admin_level) DO UPDATE SET
    unit_type = EXCLUDED.unit_type,
    label_fr = EXCLUDED.label_fr,
    label_en = EXCLUDED.label_en,
    label_ar = EXCLUDED.label_ar,
    required = EXCLUDED.required,
    active = EXCLUDED.active,
    sort_order = EXCLUDED.sort_order,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = now();

INSERT INTO geo.country_admin_structure (
    country_id, admin_level, unit_type,
    label_fr, label_en, label_ar,
    required, active, sort_order, metadata_json
)
SELECT
    c.id, 3, 'MUNICIPALITY',
    'Commune', 'Municipality', 'بلدية',
    false, true, 3,
    jsonb_build_object(
        'source_name', 'ISTAT - Codes of Italian municipalities, provinces and regions',
        'source_url', 'https://www.istat.it/en/classification/codes-of-italian-municipalities-provinces-and-regions/',
        'source_note', 'Municipality/comune level kept optional for forms',
        'confidence', 'high'
    )
FROM geo.country c
WHERE c.iso2 = 'IT'
ON CONFLICT (country_id, admin_level) DO UPDATE SET
    unit_type = EXCLUDED.unit_type,
    label_fr = EXCLUDED.label_fr,
    label_en = EXCLUDED.label_en,
    label_ar = EXCLUDED.label_ar,
    required = EXCLUDED.required,
    active = EXCLUDED.active,
    sort_order = EXCLUDED.sort_order,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = now();

-- =====================================================================
-- Vérification rapide
-- =====================================================================

SELECT
    c.iso2,
    c.name_fr AS country_label,
    s.admin_level,
    s.unit_type,
    s.label_fr,
    s.label_en,
    s.label_ar,
    s.required,
    s.active,
    s.sort_order,
    s.metadata_json ->> 'source_name' AS source_name
FROM geo.country_admin_structure s
JOIN geo.country c ON c.id = s.country_id
WHERE c.iso2 IN ('TN', 'FR', 'US', 'CA', 'IT')
ORDER BY c.iso2, s.sort_order;
