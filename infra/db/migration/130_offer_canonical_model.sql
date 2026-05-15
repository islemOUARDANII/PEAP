BEGIN;

-- =========================================================
-- 130 – Offer canonical model alignment
-- Progressive migration: adds new columns without breaking
-- existing data. Old text columns (country, governorate_code,
-- delegation_code, rtmc_occupation_id) are kept for fallback
-- and will be cleaned up in a later migration.
-- =========================================================

-- ─────────────────────────────────────────────────────────
-- A. aneti.job_offer — new canonical columns
-- ─────────────────────────────────────────────────────────

-- A1. Occupation: canonical taxonomy node (replaces rtmc_occupation_id)
ALTER TABLE aneti.job_offer
    ADD COLUMN IF NOT EXISTS occupation_node_id UUID NULL;

-- A2. Geo: canonical references
ALTER TABLE aneti.job_offer
    ADD COLUMN IF NOT EXISTS country_id UUID NULL,
    ADD COLUMN IF NOT EXISTS location_unit_id UUID NULL,
    ADD COLUMN IF NOT EXISTS governorate_unit_id UUID NULL,
    ADD COLUMN IF NOT EXISTS delegation_unit_id UUID NULL;

-- A3. Salary currency
ALTER TABLE aneti.job_offer
    ADD COLUMN IF NOT EXISTS salary_currency_code TEXT NOT NULL DEFAULT 'TND';

-- A4. Contract / work mode via reference.ref_value
ALTER TABLE aneti.job_offer
    ADD COLUMN IF NOT EXISTS contract_type_ref_id UUID NULL,
    ADD COLUMN IF NOT EXISTS work_mode_ref_id UUID NULL;

-- A5. Experience requirements
ALTER TABLE aneti.job_offer
    ADD COLUMN IF NOT EXISTS min_experience_months INTEGER NULL
        CONSTRAINT ck_job_offer_min_experience_months CHECK (min_experience_months IS NULL OR min_experience_months >= 0),
    ADD COLUMN IF NOT EXISTS experience_level_ref_id UUID NULL;

-- A6. Education requirements
ALTER TABLE aneti.job_offer
    ADD COLUMN IF NOT EXISTS diploma_ref_id UUID NULL,
    ADD COLUMN IF NOT EXISTS specialty_ref_id UUID NULL;

-- A7. Accessibility
ALTER TABLE aneti.job_offer
    ADD COLUMN IF NOT EXISTS is_accessible_to_disabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS accessibility_notes TEXT NULL;

-- ─────────────────────────────────────────────────────────
-- B. aneti.job_offer_requirement — add ref_value_id
-- node_id is kept; taxonomy_node_id alias used in queries
-- ─────────────────────────────────────────────────────────

ALTER TABLE aneti.job_offer_requirement
    ADD COLUMN IF NOT EXISTS ref_value_id UUID NULL;

-- ─────────────────────────────────────────────────────────
-- C. aneti.job_offer_language_requirement (new table)
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS aneti.job_offer_language_requirement (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id        UUID NOT NULL,
    language_code   TEXT NULL,
    level_code      TEXT NULL,
    is_mandatory    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_lang_req_offer
        FOREIGN KEY (offer_id)
        REFERENCES aneti.job_offer (id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lang_req_offer_id
    ON aneti.job_offer_language_requirement (offer_id);

DROP TRIGGER IF EXISTS trg_lang_req_updated_at
    ON aneti.job_offer_language_requirement;

CREATE TRIGGER trg_lang_req_updated_at
BEFORE UPDATE ON aneti.job_offer_language_requirement
FOR EACH ROW EXECUTE FUNCTION aneti.set_updated_at();

-- ─────────────────────────────────────────────────────────
-- D. aneti.job_offer_handicap_type (new table)
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS aneti.job_offer_handicap_type (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id              UUID NOT NULL,
    handicap_type_code    TEXT NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_handicap_type_offer
        FOREIGN KEY (offer_id)
        REFERENCES aneti.job_offer (id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_handicap_type_offer_id
    ON aneti.job_offer_handicap_type (offer_id);

-- ─────────────────────────────────────────────────────────
-- E. Indexes for new columns on job_offer
-- ─────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_job_offer_occupation_node_id
    ON aneti.job_offer (occupation_node_id);

CREATE INDEX IF NOT EXISTS idx_job_offer_country_id
    ON aneti.job_offer (country_id);

CREATE INDEX IF NOT EXISTS idx_job_offer_location_unit_id
    ON aneti.job_offer (location_unit_id);

CREATE INDEX IF NOT EXISTS idx_job_offer_is_accessible
    ON aneti.job_offer (is_accessible_to_disabled);

COMMIT;
