BEGIN;

-- =========================================================
-- 1. Schema ANETI
-- =========================================================
CREATE SCHEMA IF NOT EXISTS aneti;

-- =========================================================
-- 2. Table: aneti.aneti_agency
-- =========================================================
CREATE TABLE IF NOT EXISTS aneti.aneti_agency (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code TEXT NOT NULL,
    name TEXT NOT NULL,

    governorate TEXT NULL,
    delegation TEXT NULL,
    address TEXT NULL,

    active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_aneti_agency_code UNIQUE (code)
);

-- =========================================================
-- 3. Table: aneti.advisor_profile
-- =========================================================
CREATE TABLE IF NOT EXISTS aneti.advisor_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,
    agency_id UUID NULL,

    full_name TEXT NOT NULL,
    position TEXT NULL,

    active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_advisor_profile_user UNIQUE (user_id),

    CONSTRAINT fk_advisor_profile_user
        FOREIGN KEY (user_id)
        REFERENCES iam.auth_user (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_advisor_profile_agency
        FOREIGN KEY (agency_id)
        REFERENCES aneti.aneti_agency (id)
        ON DELETE SET NULL
);

-- =========================================================
-- 4. Index utiles
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_aneti_agency_active
    ON aneti.aneti_agency (active);

CREATE INDEX IF NOT EXISTS idx_aneti_agency_governorate
    ON aneti.aneti_agency (governorate);

CREATE INDEX IF NOT EXISTS idx_aneti_agency_delegation
    ON aneti.aneti_agency (delegation);

CREATE INDEX IF NOT EXISTS idx_advisor_profile_user_id
    ON aneti.advisor_profile (user_id);

CREATE INDEX IF NOT EXISTS idx_advisor_profile_agency_id
    ON aneti.advisor_profile (agency_id);

CREATE INDEX IF NOT EXISTS idx_advisor_profile_active
    ON aneti.advisor_profile (active);

-- =========================================================
-- 5. Trigger updated_at
-- =========================================================
CREATE OR REPLACE FUNCTION aneti.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_aneti_agency_updated_at
ON aneti.aneti_agency;

CREATE TRIGGER trg_aneti_agency_updated_at
BEFORE UPDATE ON aneti.aneti_agency
FOR EACH ROW
EXECUTE FUNCTION aneti.set_updated_at();

DROP TRIGGER IF EXISTS trg_advisor_profile_updated_at
ON aneti.advisor_profile;

CREATE TRIGGER trg_advisor_profile_updated_at
BEFORE UPDATE ON aneti.advisor_profile
FOR EACH ROW
EXECUTE FUNCTION aneti.set_updated_at();

COMMIT;