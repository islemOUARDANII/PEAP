BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE SCHEMA IF NOT EXISTS reference;
CREATE SCHEMA IF NOT EXISTS geo;

-- =========================================================
-- 1. Generic reference groups
-- Examples: GENDER, HANDICAP_DEGREE, CONTRACT_TYPE, LANGUAGE_LEVEL...
-- =========================================================
CREATE TABLE IF NOT EXISTS reference.ref_group (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    description TEXT,

    domain TEXT, -- ADMIN, EMPLOYMENT, EDUCATION, LANGUAGE, HEALTH_ADMIN, etc.

    active BOOLEAN NOT NULL DEFAULT TRUE,

    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ref_group_domain
ON reference.ref_group(domain);

CREATE INDEX IF NOT EXISTS idx_ref_group_active
ON reference.ref_group(active);


-- =========================================================
-- 2. Generic reference values
-- Instead of creating one table for every tiny reference list
-- =========================================================
CREATE TABLE IF NOT EXISTS reference.ref_value (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    group_id UUID NOT NULL REFERENCES reference.ref_group(id) ON DELETE CASCADE,

    code TEXT NOT NULL,
    label TEXT NOT NULL,
    normalized_label TEXT NOT NULL,

    label_fr TEXT,
    label_en TEXT,
    label_ar TEXT,

    sort_order INTEGER NOT NULL DEFAULT 0,

    active BOOLEAN NOT NULL DEFAULT TRUE,

    valid_from DATE,
    valid_to DATE,

    source TEXT,
    external_code TEXT,

    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_ref_value_group_code UNIQUE(group_id, code)
);

CREATE INDEX IF NOT EXISTS idx_ref_value_group
ON reference.ref_value(group_id);

CREATE INDEX IF NOT EXISTS idx_ref_value_code
ON reference.ref_value(code);

CREATE INDEX IF NOT EXISTS idx_ref_value_label_trgm
ON reference.ref_value USING gin(normalized_label gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_ref_value_active
ON reference.ref_value(active);


-- =========================================================
-- 3. Countries
-- =========================================================
CREATE TABLE IF NOT EXISTS geo.country (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    iso2 TEXT NOT NULL UNIQUE,       -- TN, FR, IT, CA...
    iso3 TEXT,                       -- TUN, FRA...
    numeric_code TEXT,

    name_fr TEXT NOT NULL,
    name_en TEXT,
    name_ar TEXT,

    default_language_code TEXT,
    phone_prefix TEXT,
    currency_code TEXT,

    active BOOLEAN NOT NULL DEFAULT TRUE,

    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geo_country_active
ON geo.country(active);


-- =========================================================
-- 4. Generic administrative units
-- Tunisia: GOVERNORATE -> DELEGATION
-- France: REGION -> DEPARTMENT -> COMMUNE
-- Italy: REGION -> PROVINCE -> COMUNE
-- Canada: PROVINCE -> CITY
-- =========================================================
CREATE TABLE IF NOT EXISTS geo.admin_unit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    country_id UUID NOT NULL REFERENCES geo.country(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES geo.admin_unit(id) ON DELETE SET NULL,

    code TEXT NOT NULL,
    label TEXT NOT NULL,
    normalized_label TEXT NOT NULL,

    label_fr TEXT,
    label_en TEXT,
    label_ar TEXT,

    admin_level INTEGER NOT NULL,
    unit_type TEXT NOT NULL,

    latitude NUMERIC(10,7),
    longitude NUMERIC(10,7),

    active BOOLEAN NOT NULL DEFAULT TRUE,

    source TEXT,
    external_code TEXT,

    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_geo_admin_unit UNIQUE(country_id, code, unit_type)
);

CREATE INDEX IF NOT EXISTS idx_geo_admin_unit_country
ON geo.admin_unit(country_id);

CREATE INDEX IF NOT EXISTS idx_geo_admin_unit_parent
ON geo.admin_unit(parent_id);

CREATE INDEX IF NOT EXISTS idx_geo_admin_unit_level
ON geo.admin_unit(country_id, admin_level);

CREATE INDEX IF NOT EXISTS idx_geo_admin_unit_type
ON geo.admin_unit(unit_type);

CREATE INDEX IF NOT EXISTS idx_geo_admin_unit_label_trgm
ON geo.admin_unit USING gin(normalized_label gin_trgm_ops);


-- =========================================================
-- 5. Normalization helper functions
-- =========================================================
CREATE OR REPLACE FUNCTION reference.normalize_text(input TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT lower(
        regexp_replace(
            unaccent(trim(coalesce(input, ''))),
            '\s+',
            ' ',
            'g'
        )
    );
$$;

CREATE OR REPLACE FUNCTION geo.normalize_text(input TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT lower(
        regexp_replace(
            unaccent(trim(coalesce(input, ''))),
            '\s+',
            ' ',
            'g'
        )
    );
$$;


-- =========================================================
-- 6. Seed basic countries
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
VALUES
    ('TN', 'TUN', '788', 'Tunisie', 'Tunisia', 'تونس', 'fr', '+216', 'TND', '{"source":"seed"}'),
    ('FR', 'FRA', '250', 'France', 'France', NULL, 'fr', '+33', 'EUR', '{"source":"seed"}'),
    ('IT', 'ITA', '380', 'Italie', 'Italy', NULL, 'it', '+39', 'EUR', '{"source":"seed"}'),
    ('CA', 'CAN', '124', 'Canada', 'Canada', NULL, 'en', '+1', 'CAD', '{"source":"seed"}'),
    ('US', 'USA', '840', 'États-Unis', 'United States', NULL, 'en', '+1', 'USD', '{"source":"seed"}')
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
-- 7. Seed reference groups
-- =========================================================
INSERT INTO reference.ref_group (
    code,
    label,
    description,
    domain,
    metadata_json
)
VALUES
    ('GENDER', 'Genre', 'Référentiel des genres utilisés dans les profils candidats.', 'ADMIN', '{"source":"seed"}'),
    ('HANDICAP_DEGREE', 'Degré de handicap', 'Référentiel des degrés de handicap.', 'ADMIN', '{"source":"seed"}'),
    ('HANDICAP_TYPE', 'Type de handicap', 'Référentiel des types de handicap.', 'ADMIN', '{"source":"seed"}'),
    ('CONTRACT_TYPE', 'Type de contrat', 'Référentiel des types de contrat.', 'EMPLOYMENT', '{"source":"seed"}'),
    ('WORK_MODE', 'Mode de travail', 'Sur site, hybride, à distance, mobile.', 'EMPLOYMENT', '{"source":"seed"}'),
    ('LANGUAGE', 'Langue', 'Référentiel des langues.', 'LANGUAGE', '{"source":"seed"}'),
    ('LANGUAGE_LEVEL', 'Niveau de langue', 'Niveaux de langue CEFR ou équivalents.', 'LANGUAGE', '{"source":"seed"}'),
    ('EDUCATION_LEVEL', 'Niveau d’étude', 'Niveaux de formation ou diplôme.', 'EDUCATION', '{"source":"seed"}'),
    ('APPLICATION_STATUS', 'Statut candidature', 'Statuts des candidatures.', 'EMPLOYMENT', '{"source":"seed"}'),
    ('OFFER_STATUS', 'Statut offre', 'Statuts des offres.', 'EMPLOYMENT', '{"source":"seed"}')
ON CONFLICT (code) DO UPDATE
SET
    label = EXCLUDED.label,
    description = EXCLUDED.description,
    domain = EXCLUDED.domain,
    updated_at = now();


-- =========================================================
-- 8. Seed some common values
-- =========================================================
WITH groups AS (
    SELECT id, code
    FROM reference.ref_group
)
INSERT INTO reference.ref_value (
    group_id,
    code,
    label,
    normalized_label,
    label_fr,
    label_en,
    sort_order,
    source,
    metadata_json
)
SELECT
    g.id,
    v.code,
    v.label,
    reference.normalize_text(v.label),
    v.label_fr,
    v.label_en,
    v.sort_order,
    'seed',
    '{"source":"seed"}'::jsonb
FROM groups g
JOIN (
    VALUES
        ('CONTRACT_TYPE', 'CDI', 'CDI', 'CDI', 'Permanent contract', 1),
        ('CONTRACT_TYPE', 'CDD', 'CDD', 'CDD', 'Fixed-term contract', 2),
        ('CONTRACT_TYPE', 'STAGE', 'Stage', 'Stage', 'Internship', 3),
        ('CONTRACT_TYPE', 'CIVP', 'CIVP', 'CIVP', 'CIVP', 4),
        ('CONTRACT_TYPE', 'SIVP', 'SIVP', 'SIVP', 'SIVP', 5),

        ('WORK_MODE', 'ONSITE', 'Sur site', 'Sur site', 'On site', 1),
        ('WORK_MODE', 'REMOTE', 'À distance', 'À distance', 'Remote', 2),
        ('WORK_MODE', 'HYBRID', 'Hybride', 'Hybride', 'Hybrid', 3),
        ('WORK_MODE', 'MOBILE', 'Mobile', 'Mobile', 'Mobile', 4),

        ('LANGUAGE', 'fr', 'Français', 'Français', 'French', 1),
        ('LANGUAGE', 'en', 'Anglais', 'Anglais', 'English', 2),
        ('LANGUAGE', 'ar', 'Arabe', 'Arabe', 'Arabic', 3),
        ('LANGUAGE', 'it', 'Italien', 'Italien', 'Italian', 4),

        ('LANGUAGE_LEVEL', 'A1', 'A1', 'A1', 'A1', 1),
        ('LANGUAGE_LEVEL', 'A2', 'A2', 'A2', 'A2', 2),
        ('LANGUAGE_LEVEL', 'B1', 'B1', 'B1', 'B1', 3),
        ('LANGUAGE_LEVEL', 'B2', 'B2', 'B2', 'B2', 4),
        ('LANGUAGE_LEVEL', 'C1', 'C1', 'C1', 'C1', 5),
        ('LANGUAGE_LEVEL', 'C2', 'C2', 'C2', 'C2', 6),
        ('LANGUAGE_LEVEL', 'NATIVE', 'Langue maternelle', 'Langue maternelle', 'Native', 7),

        ('APPLICATION_STATUS', 'APPLIED', 'Candidature envoyée', 'Candidature envoyée', 'Applied', 1),
        ('APPLICATION_STATUS', 'VIEWED', 'Vue', 'Vue', 'Viewed', 2),
        ('APPLICATION_STATUS', 'SHORTLISTED', 'Présélectionnée', 'Présélectionnée', 'Shortlisted', 3),
        ('APPLICATION_STATUS', 'REJECTED', 'Rejetée', 'Rejetée', 'Rejected', 4),

        ('OFFER_STATUS', 'DRAFT', 'Brouillon', 'Brouillon', 'Draft', 1),
        ('OFFER_STATUS', 'PUBLISHED', 'Publiée', 'Publiée', 'Published', 2),
        ('OFFER_STATUS', 'CLOSED', 'Clôturée', 'Clôturée', 'Closed', 3)
) AS v(group_code, code, label, label_fr, label_en, sort_order)
ON g.code = v.group_code
ON CONFLICT (group_id, code) DO UPDATE
SET
    label = EXCLUDED.label,
    normalized_label = EXCLUDED.normalized_label,
    label_fr = EXCLUDED.label_fr,
    label_en = EXCLUDED.label_en,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

COMMIT;