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
-- 3. Table: aneti.job_offer
-- =========================================================
CREATE TABLE IF NOT EXISTS aneti.job_offer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    employer_id UUID NOT NULL,

    rtmc_occupation_id UUID NULL,

    title TEXT NOT NULL,
    description TEXT NULL,

    number_of_positions INTEGER NOT NULL DEFAULT 1,

    status TEXT NOT NULL DEFAULT 'DRAFT',

    contract_type TEXT NULL,
    work_mode TEXT NULL,

    salary_min NUMERIC(12, 2) NULL,
    salary_max NUMERIC(12, 2) NULL,

    governorate TEXT NULL,
    delegation TEXT NULL,

    lat NUMERIC(10, 7) NULL,
    lon NUMERIC(10, 7) NULL,

    published_at TIMESTAMPTZ NULL,
    deadline_at TIMESTAMPTZ NULL,

    created_by_user_id UUID NULL,
    validated_by_user_id UUID NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_job_offer_employer
        FOREIGN KEY (employer_id)
        REFERENCES aneti.employer (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_job_offer_created_by
        FOREIGN KEY (created_by_user_id)
        REFERENCES iam.auth_user (id)
        ON DELETE SET NULL,

    CONSTRAINT fk_job_offer_validated_by
        FOREIGN KEY (validated_by_user_id)
        REFERENCES iam.auth_user (id)
        ON DELETE SET NULL,

    CONSTRAINT ck_job_offer_status CHECK (
        status IN (
            'DRAFT',
            'SUBMITTED',
            'UNDER_REVIEW',
            'APPROVED',
            'PUBLISHED',
            'REJECTED',
            'CLOSED',
            'ARCHIVED',
            'DELETED'
        )
    ),

    CONSTRAINT ck_job_offer_number_of_positions CHECK (
        number_of_positions > 0
    ),

    CONSTRAINT ck_job_offer_contract_type CHECK (
        contract_type IS NULL OR contract_type IN (
            'CDI',
            'CDD',
            'SIVP',
            'KARAMA',
            'STAGE',
            'APPRENTICESHIP',
            'FREELANCE',
            'PART_TIME',
            'SEASONAL',
            'OTHER'
        )
    ),

    CONSTRAINT ck_job_offer_work_mode CHECK (
        work_mode IS NULL OR work_mode IN (
            'ONSITE',
            'REMOTE',
            'HYBRID',
            'MOBILE',
            'UNKNOWN'
        )
    ),

    CONSTRAINT ck_job_offer_salary CHECK (
        salary_min IS NULL
        OR salary_max IS NULL
        OR salary_max >= salary_min
    ),

    CONSTRAINT ck_job_offer_deadline CHECK (
        deadline_at IS NULL
        OR published_at IS NULL
        OR deadline_at >= published_at
    )
);

-- =========================================================
-- 4. Table: aneti.job_offer_requirement
-- =========================================================
CREATE TABLE IF NOT EXISTS aneti.job_offer_requirement (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    offer_id UUID NOT NULL,

    criterion_type TEXT NOT NULL,

    node_id UUID NULL,
    raw_value TEXT NULL,

    min_level TEXT NULL,
    min_years NUMERIC(4, 1) NULL,

    is_must BOOLEAN NOT NULL DEFAULT FALSE,
    weight INTEGER NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_job_offer_requirement_offer
        FOREIGN KEY (offer_id)
        REFERENCES aneti.job_offer (id)
        ON DELETE CASCADE,

    CONSTRAINT ck_job_offer_requirement_criterion_type CHECK (
        criterion_type IN (
            'OCCUPATION',
            'APPELLATION',
            'SKILL',
            'SOFT_SKILL',
            'ACTIVITY',
            'LANGUAGE',
            'EDUCATION',
            'EXPERIENCE',
            'CERTIFICATION',
            'LOCATION',
            'CONTRACT',
            'WORK_MODE',
            'SALARY',
            'AVAILABILITY',
            'OTHER'
        )
    ),

    CONSTRAINT ck_job_offer_requirement_min_years CHECK (
        min_years IS NULL
        OR min_years >= 0
    ),

    CONSTRAINT ck_job_offer_requirement_weight CHECK (
        weight IS NULL
        OR weight BETWEEN 0 AND 100
    ),

    CONSTRAINT ck_job_offer_requirement_has_value CHECK (
        node_id IS NOT NULL
        OR raw_value IS NOT NULL
        OR min_level IS NOT NULL
        OR min_years IS NOT NULL
    )
);

-- =========================================================
-- 5. Indexes principaux - job_offer
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_job_offer_employer_id
    ON aneti.job_offer (employer_id);

CREATE INDEX IF NOT EXISTS idx_job_offer_rtmc_occupation_id
    ON aneti.job_offer (rtmc_occupation_id);

CREATE INDEX IF NOT EXISTS idx_job_offer_status
    ON aneti.job_offer (status);

CREATE INDEX IF NOT EXISTS idx_job_offer_contract_type
    ON aneti.job_offer (contract_type);

CREATE INDEX IF NOT EXISTS idx_job_offer_work_mode
    ON aneti.job_offer (work_mode);

CREATE INDEX IF NOT EXISTS idx_job_offer_governorate
    ON aneti.job_offer (governorate);

CREATE INDEX IF NOT EXISTS idx_job_offer_delegation
    ON aneti.job_offer (delegation);

CREATE INDEX IF NOT EXISTS idx_job_offer_published_at
    ON aneti.job_offer (published_at);

CREATE INDEX IF NOT EXISTS idx_job_offer_deadline_at
    ON aneti.job_offer (deadline_at);

CREATE INDEX IF NOT EXISTS idx_job_offer_created_by
    ON aneti.job_offer (created_by_user_id);

CREATE INDEX IF NOT EXISTS idx_job_offer_validated_by
    ON aneti.job_offer (validated_by_user_id);

-- =========================================================
-- 6. Indexes principaux - job_offer_requirement
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_job_offer_requirement_offer_id
    ON aneti.job_offer_requirement (offer_id);

CREATE INDEX IF NOT EXISTS idx_job_offer_requirement_criterion_type
    ON aneti.job_offer_requirement (criterion_type);

CREATE INDEX IF NOT EXISTS idx_job_offer_requirement_node_id
    ON aneti.job_offer_requirement (node_id);

CREATE INDEX IF NOT EXISTS idx_job_offer_requirement_is_must
    ON aneti.job_offer_requirement (is_must);

CREATE INDEX IF NOT EXISTS idx_job_offer_requirement_offer_type
    ON aneti.job_offer_requirement (offer_id, criterion_type);

-- =========================================================
-- 7. Triggers updated_at
-- =========================================================

DROP TRIGGER IF EXISTS trg_job_offer_updated_at
ON aneti.job_offer;

CREATE TRIGGER trg_job_offer_updated_at
BEFORE UPDATE ON aneti.job_offer
FOR EACH ROW
EXECUTE FUNCTION aneti.set_updated_at();


DROP TRIGGER IF EXISTS trg_job_offer_requirement_updated_at
ON aneti.job_offer_requirement;

CREATE TRIGGER trg_job_offer_requirement_updated_at
BEFORE UPDATE ON aneti.job_offer_requirement
FOR EACH ROW
EXECUTE FUNCTION aneti.set_updated_at();

COMMIT;