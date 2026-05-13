BEGIN;

-- =========================================================
-- 1. Schema ANETI
-- =========================================================
CREATE SCHEMA IF NOT EXISTS aneti;

-- =========================================================
-- 2. Function updated_at
-- =========================================================
CREATE OR REPLACE FUNCTION aneti.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- 3. Table: aneti.employer
-- =========================================================
CREATE TABLE IF NOT EXISTS aneti.employer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NULL,

    legal_name TEXT NOT NULL,
    commercial_name TEXT NULL,
    tax_identifier TEXT NULL,

    sector_code TEXT NULL,
    size_category TEXT NULL,

    status TEXT NOT NULL DEFAULT 'PENDING_REVIEW',

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_employer_user UNIQUE (user_id),
    CONSTRAINT uq_employer_tax_identifier UNIQUE (tax_identifier),

    CONSTRAINT fk_employer_user
        FOREIGN KEY (user_id)
        REFERENCES iam.auth_user (id)
        ON DELETE SET NULL,

    CONSTRAINT ck_employer_status CHECK (
        status IN (
            'DRAFT',
            'PENDING_REVIEW',
            'ACTIVE',
            'REJECTED',
            'SUSPENDED',
            'ARCHIVED',
            'DELETED'
        )
    ),

    CONSTRAINT ck_employer_size_category CHECK (
        size_category IS NULL OR size_category IN (
            'MICRO',
            'SMALL',
            'MEDIUM',
            'LARGE',
            'VERY_LARGE',
            'UNKNOWN'
        )
    )
);

-- =========================================================
-- 4. Table: aneti.employer_contact
-- =========================================================
CREATE TABLE IF NOT EXISTS aneti.employer_contact (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    employer_id UUID NOT NULL,

    contact_name TEXT NOT NULL,
    job_title TEXT NULL,

    email TEXT NULL,
    phone TEXT NULL,
    website TEXT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_employer_contact_employer
        FOREIGN KEY (employer_id)
        REFERENCES aneti.employer (id)
        ON DELETE CASCADE
);

-- =========================================================
-- 5. Table: aneti.employer_location
-- =========================================================
CREATE TABLE IF NOT EXISTS aneti.employer_location (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    employer_id UUID NOT NULL,

    address TEXT NULL,
    governorate TEXT NULL,
    delegation TEXT NULL,

    lat NUMERIC(10, 7) NULL,
    lon NUMERIC(10, 7) NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_employer_location_employer
        FOREIGN KEY (employer_id)
        REFERENCES aneti.employer (id)
        ON DELETE CASCADE
);

-- =========================================================
-- 6. Table: aneti.employer_status_history
-- =========================================================
CREATE TABLE IF NOT EXISTS aneti.employer_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    employer_id UUID NOT NULL,

    old_status TEXT NULL,
    new_status TEXT NOT NULL,

    changed_by_user_id UUID NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    reason TEXT NULL,

    CONSTRAINT fk_employer_status_history_employer
        FOREIGN KEY (employer_id)
        REFERENCES aneti.employer (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_employer_status_history_changed_by
        FOREIGN KEY (changed_by_user_id)
        REFERENCES iam.auth_user (id)
        ON DELETE SET NULL,

    CONSTRAINT ck_employer_status_history_old_status CHECK (
        old_status IS NULL OR old_status IN (
            'DRAFT',
            'PENDING_REVIEW',
            'ACTIVE',
            'REJECTED',
            'SUSPENDED',
            'ARCHIVED',
            'DELETED'
        )
    ),

    CONSTRAINT ck_employer_status_history_new_status CHECK (
        new_status IN (
            'DRAFT',
            'PENDING_REVIEW',
            'ACTIVE',
            'REJECTED',
            'SUSPENDED',
            'ARCHIVED',
            'DELETED'
        )
    )
);

-- =========================================================
-- 7. Indexes principaux
-- =========================================================

-- employer
CREATE INDEX IF NOT EXISTS idx_employer_user_id
    ON aneti.employer (user_id);

CREATE INDEX IF NOT EXISTS idx_employer_status
    ON aneti.employer (status);

CREATE INDEX IF NOT EXISTS idx_employer_tax_identifier
    ON aneti.employer (tax_identifier);

CREATE INDEX IF NOT EXISTS idx_employer_sector_code
    ON aneti.employer (sector_code);

CREATE INDEX IF NOT EXISTS idx_employer_size_category
    ON aneti.employer (size_category);

CREATE INDEX IF NOT EXISTS idx_employer_legal_name
    ON aneti.employer (legal_name);

-- contact
CREATE INDEX IF NOT EXISTS idx_employer_contact_employer_id
    ON aneti.employer_contact (employer_id);

CREATE INDEX IF NOT EXISTS idx_employer_contact_email
    ON aneti.employer_contact (email);

CREATE INDEX IF NOT EXISTS idx_employer_contact_phone
    ON aneti.employer_contact (phone);

-- location
CREATE INDEX IF NOT EXISTS idx_employer_location_employer_id
    ON aneti.employer_location (employer_id);

CREATE INDEX IF NOT EXISTS idx_employer_location_governorate
    ON aneti.employer_location (governorate);

CREATE INDEX IF NOT EXISTS idx_employer_location_delegation
    ON aneti.employer_location (delegation);

-- status history
CREATE INDEX IF NOT EXISTS idx_employer_status_history_employer_id
    ON aneti.employer_status_history (employer_id);

CREATE INDEX IF NOT EXISTS idx_employer_status_history_changed_by
    ON aneti.employer_status_history (changed_by_user_id);

CREATE INDEX IF NOT EXISTS idx_employer_status_history_changed_at
    ON aneti.employer_status_history (changed_at);

CREATE INDEX IF NOT EXISTS idx_employer_status_history_new_status
    ON aneti.employer_status_history (new_status);

-- =========================================================
-- 8. Triggers updated_at
-- =========================================================

DROP TRIGGER IF EXISTS trg_employer_updated_at
ON aneti.employer;

CREATE TRIGGER trg_employer_updated_at
BEFORE UPDATE ON aneti.employer
FOR EACH ROW
EXECUTE FUNCTION aneti.set_updated_at();


DROP TRIGGER IF EXISTS trg_employer_contact_updated_at
ON aneti.employer_contact;

CREATE TRIGGER trg_employer_contact_updated_at
BEFORE UPDATE ON aneti.employer_contact
FOR EACH ROW
EXECUTE FUNCTION aneti.set_updated_at();


DROP TRIGGER IF EXISTS trg_employer_location_updated_at
ON aneti.employer_location;

CREATE TRIGGER trg_employer_location_updated_at
BEFORE UPDATE ON aneti.employer_location
FOR EACH ROW
EXECUTE FUNCTION aneti.set_updated_at();

COMMIT;