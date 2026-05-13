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
-- 3. Table: aneti.job_seeker
-- =========================================================
CREATE TABLE IF NOT EXISTS aneti.job_seeker (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NULL,
    aneti_identifier TEXT NULL,

    status TEXT NOT NULL DEFAULT 'ACTIVE',
    registration_date DATE NULL,
    primary_language TEXT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_job_seeker_user UNIQUE (user_id),
    CONSTRAINT uq_job_seeker_aneti_identifier UNIQUE (aneti_identifier),

    CONSTRAINT fk_job_seeker_user
        FOREIGN KEY (user_id)
        REFERENCES iam.auth_user (id)
        ON DELETE SET NULL,

    CONSTRAINT ck_job_seeker_status CHECK (
        status IN (
            'DRAFT',
            'ACTIVE',
            'INACTIVE',
            'PLACED',
            'SUSPENDED',
            'ARCHIVED',
            'DELETED'
        )
    )
);

-- =========================================================
-- 4. Table: aneti.job_seeker_identity
-- =========================================================
CREATE TABLE IF NOT EXISTS aneti.job_seeker_identity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    job_seeker_id UUID NOT NULL,

    cin TEXT NULL,
    passport_number TEXT NULL,

    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,

    birth_date DATE NULL,
    gender TEXT NULL,
    nationality TEXT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_job_seeker_identity_job_seeker UNIQUE (job_seeker_id),
    CONSTRAINT uq_job_seeker_identity_cin UNIQUE (cin),
    CONSTRAINT uq_job_seeker_identity_passport UNIQUE (passport_number),

    CONSTRAINT fk_job_seeker_identity_job_seeker
        FOREIGN KEY (job_seeker_id)
        REFERENCES aneti.job_seeker (id)
        ON DELETE CASCADE,

    CONSTRAINT ck_job_seeker_identity_gender CHECK (
        gender IS NULL OR gender IN (
            'MALE',
            'FEMALE'
        )
    )
);

-- =========================================================
-- 5. Table: aneti.job_seeker_contact
-- =========================================================
CREATE TABLE IF NOT EXISTS aneti.job_seeker_contact (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    job_seeker_id UUID NOT NULL,

    email TEXT NULL,
    phone TEXT NULL,

    address TEXT NULL,
    governorate TEXT NULL,
    delegation TEXT NULL,
    locality TEXT NULL,

    lat NUMERIC(10, 7) NULL,
    lon NUMERIC(10, 7) NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_job_seeker_contact_job_seeker UNIQUE (job_seeker_id),

    CONSTRAINT fk_job_seeker_contact_job_seeker
        FOREIGN KEY (job_seeker_id)
        REFERENCES aneti.job_seeker (id)
        ON DELETE CASCADE
);

-- =========================================================
-- 6. Table: aneti.job_seeker_education
-- =========================================================
CREATE TABLE IF NOT EXISTS aneti.job_seeker_education (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    job_seeker_id UUID NOT NULL,

    level_code TEXT NULL,
    diploma_label TEXT NULL,
    specialty TEXT NULL,
    institution TEXT NULL,
    graduation_year INTEGER NULL,

    rtmc_education_node_id UUID NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_job_seeker_education_job_seeker
        FOREIGN KEY (job_seeker_id)
        REFERENCES aneti.job_seeker (id)
        ON DELETE CASCADE,

    CONSTRAINT ck_job_seeker_education_graduation_year CHECK (
        graduation_year IS NULL
        OR graduation_year BETWEEN 1950 AND 2100
    )
);

-- =========================================================
-- 7. Table: aneti.job_seeker_experience
-- =========================================================
CREATE TABLE IF NOT EXISTS aneti.job_seeker_experience (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    job_seeker_id UUID NOT NULL,

    occupation_id UUID NULL,

    job_title_raw TEXT NULL,
    company_name TEXT NULL,
    sector TEXT NULL,

    start_date DATE NULL,
    end_date DATE NULL,
    duration_months INTEGER NULL,

    description TEXT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_job_seeker_experience_job_seeker
        FOREIGN KEY (job_seeker_id)
        REFERENCES aneti.job_seeker (id)
        ON DELETE CASCADE,

    CONSTRAINT ck_job_seeker_experience_dates CHECK (
        end_date IS NULL
        OR start_date IS NULL
        OR end_date >= start_date
    ),

    CONSTRAINT ck_job_seeker_experience_duration CHECK (
        duration_months IS NULL
        OR duration_months >= 0
    )
);

-- =========================================================
-- 8. Table: aneti.job_seeker_skill
-- =========================================================
CREATE TABLE IF NOT EXISTS aneti.job_seeker_skill (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    job_seeker_id UUID NOT NULL,

    skill_id UUID NULL,
    skill_label_raw TEXT NULL,

    level TEXT NULL,
    years NUMERIC(4, 1) NULL,

    evidence TEXT NULL,
    source TEXT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_job_seeker_skill_job_seeker
        FOREIGN KEY (job_seeker_id)
        REFERENCES aneti.job_seeker (id)
        ON DELETE CASCADE,

    CONSTRAINT ck_job_seeker_skill_years CHECK (
        years IS NULL
        OR years >= 0
    ),

    CONSTRAINT ck_job_seeker_skill_source CHECK (
        source IS NULL OR source IN (
            'CV',
            'MANUAL',
            'ADVISOR',
            'IMPORT',
            'PARSING'
        )
    )
);

-- =========================================================
-- 9. Table: aneti.job_seeker_language
-- =========================================================
CREATE TABLE IF NOT EXISTS aneti.job_seeker_language (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    job_seeker_id UUID NOT NULL,

    language_code TEXT NOT NULL,
    level TEXT NULL,
    evidence TEXT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_job_seeker_language_job_seeker
        FOREIGN KEY (job_seeker_id)
        REFERENCES aneti.job_seeker (id)
        ON DELETE CASCADE,

    CONSTRAINT uq_job_seeker_language UNIQUE (
        job_seeker_id,
        language_code
    )
);

-- =========================================================
-- 10. Table: aneti.job_seeker_preference
-- =========================================================
CREATE TABLE IF NOT EXISTS aneti.job_seeker_preference (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    job_seeker_id UUID NOT NULL,

    preferred_contract_type TEXT NULL,
    preferred_governorate TEXT NULL,

    mobility_radius_km NUMERIC(6, 2) NULL,
    accepts_relocation BOOLEAN NOT NULL DEFAULT FALSE,

    desired_salary_min NUMERIC(12, 2) NULL,
    desired_salary_max NUMERIC(12, 2) NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_job_seeker_preference_job_seeker UNIQUE (job_seeker_id),

    CONSTRAINT fk_job_seeker_preference_job_seeker
        FOREIGN KEY (job_seeker_id)
        REFERENCES aneti.job_seeker (id)
        ON DELETE CASCADE,

    CONSTRAINT ck_job_seeker_preference_mobility CHECK (
        mobility_radius_km IS NULL
        OR mobility_radius_km >= 0
    ),

    CONSTRAINT ck_job_seeker_preference_salary CHECK (
        desired_salary_min IS NULL
        OR desired_salary_max IS NULL
        OR desired_salary_max >= desired_salary_min
    )
);

-- =========================================================
-- 11. Indexes principaux
-- =========================================================

-- job_seeker
CREATE INDEX IF NOT EXISTS idx_job_seeker_user_id
    ON aneti.job_seeker (user_id);

CREATE INDEX IF NOT EXISTS idx_job_seeker_status
    ON aneti.job_seeker (status);

CREATE INDEX IF NOT EXISTS idx_job_seeker_registration_date
    ON aneti.job_seeker (registration_date);

-- identity
CREATE INDEX IF NOT EXISTS idx_job_seeker_identity_full_name
    ON aneti.job_seeker_identity (last_name, first_name);

CREATE INDEX IF NOT EXISTS idx_job_seeker_identity_cin
    ON aneti.job_seeker_identity (cin);

-- contact
CREATE INDEX IF NOT EXISTS idx_job_seeker_contact_governorate
    ON aneti.job_seeker_contact (governorate);

CREATE INDEX IF NOT EXISTS idx_job_seeker_contact_delegation
    ON aneti.job_seeker_contact (delegation);

-- education
CREATE INDEX IF NOT EXISTS idx_job_seeker_education_job_seeker_id
    ON aneti.job_seeker_education (job_seeker_id);

CREATE INDEX IF NOT EXISTS idx_job_seeker_education_level_code
    ON aneti.job_seeker_education (level_code);

CREATE INDEX IF NOT EXISTS idx_job_seeker_education_specialty
    ON aneti.job_seeker_education (specialty);

-- experience
CREATE INDEX IF NOT EXISTS idx_job_seeker_experience_job_seeker_id
    ON aneti.job_seeker_experience (job_seeker_id);

CREATE INDEX IF NOT EXISTS idx_job_seeker_experience_occupation_id
    ON aneti.job_seeker_experience (occupation_id);

CREATE INDEX IF NOT EXISTS idx_job_seeker_experience_sector
    ON aneti.job_seeker_experience (sector);

-- skills
CREATE INDEX IF NOT EXISTS idx_job_seeker_skill_job_seeker_id
    ON aneti.job_seeker_skill (job_seeker_id);

CREATE INDEX IF NOT EXISTS idx_job_seeker_skill_skill_id
    ON aneti.job_seeker_skill (skill_id);

CREATE INDEX IF NOT EXISTS idx_job_seeker_skill_raw
    ON aneti.job_seeker_skill (skill_label_raw);

-- languages
CREATE INDEX IF NOT EXISTS idx_job_seeker_language_job_seeker_id
    ON aneti.job_seeker_language (job_seeker_id);

CREATE INDEX IF NOT EXISTS idx_job_seeker_language_code
    ON aneti.job_seeker_language (language_code);

-- preferences
CREATE INDEX IF NOT EXISTS idx_job_seeker_preference_job_seeker_id
    ON aneti.job_seeker_preference (job_seeker_id);

CREATE INDEX IF NOT EXISTS idx_job_seeker_preference_governorate
    ON aneti.job_seeker_preference (preferred_governorate);

-- =========================================================
-- 12. Triggers updated_at
-- =========================================================

DROP TRIGGER IF EXISTS trg_job_seeker_updated_at
ON aneti.job_seeker;

CREATE TRIGGER trg_job_seeker_updated_at
BEFORE UPDATE ON aneti.job_seeker
FOR EACH ROW
EXECUTE FUNCTION aneti.set_updated_at();


DROP TRIGGER IF EXISTS trg_job_seeker_identity_updated_at
ON aneti.job_seeker_identity;

CREATE TRIGGER trg_job_seeker_identity_updated_at
BEFORE UPDATE ON aneti.job_seeker_identity
FOR EACH ROW
EXECUTE FUNCTION aneti.set_updated_at();


DROP TRIGGER IF EXISTS trg_job_seeker_contact_updated_at
ON aneti.job_seeker_contact;

CREATE TRIGGER trg_job_seeker_contact_updated_at
BEFORE UPDATE ON aneti.job_seeker_contact
FOR EACH ROW
EXECUTE FUNCTION aneti.set_updated_at();


DROP TRIGGER IF EXISTS trg_job_seeker_education_updated_at
ON aneti.job_seeker_education;

CREATE TRIGGER trg_job_seeker_education_updated_at
BEFORE UPDATE ON aneti.job_seeker_education
FOR EACH ROW
EXECUTE FUNCTION aneti.set_updated_at();


DROP TRIGGER IF EXISTS trg_job_seeker_experience_updated_at
ON aneti.job_seeker_experience;

CREATE TRIGGER trg_job_seeker_experience_updated_at
BEFORE UPDATE ON aneti.job_seeker_experience
FOR EACH ROW
EXECUTE FUNCTION aneti.set_updated_at();


DROP TRIGGER IF EXISTS trg_job_seeker_skill_updated_at
ON aneti.job_seeker_skill;

CREATE TRIGGER trg_job_seeker_skill_updated_at
BEFORE UPDATE ON aneti.job_seeker_skill
FOR EACH ROW
EXECUTE FUNCTION aneti.set_updated_at();


DROP TRIGGER IF EXISTS trg_job_seeker_language_updated_at
ON aneti.job_seeker_language;

CREATE TRIGGER trg_job_seeker_language_updated_at
BEFORE UPDATE ON aneti.job_seeker_language
FOR EACH ROW
EXECUTE FUNCTION aneti.set_updated_at();


DROP TRIGGER IF EXISTS trg_job_seeker_preference_updated_at
ON aneti.job_seeker_preference;

CREATE TRIGGER trg_job_seeker_preference_updated_at
BEFORE UPDATE ON aneti.job_seeker_preference
FOR EACH ROW
EXECUTE FUNCTION aneti.set_updated_at();

COMMIT;