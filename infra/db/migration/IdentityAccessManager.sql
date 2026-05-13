BEGIN;

-- =========================================================
-- 1. Extensions utiles
-- =========================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- 2. Schema IAM
-- =========================================================
CREATE SCHEMA IF NOT EXISTS iam;

-- =========================================================
-- 3. Table: iam.auth_user
-- =========================================================
CREATE TABLE IF NOT EXISTS iam.auth_user (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    phone TEXT NULL,

    status TEXT NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_auth_user_email UNIQUE (email),

    CONSTRAINT ck_auth_user_status CHECK (
        status IN (
            'PENDING_VERIFICATION',
            'ACTIVE',
            'SUSPENDED',
            'DISABLED',
            'DELETED'
        )
    )
);

-- =========================================================
-- 4. Table: iam.auth_role
-- =========================================================
CREATE TABLE IF NOT EXISTS iam.auth_role (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code TEXT NOT NULL,
    label TEXT NOT NULL,

    CONSTRAINT uq_auth_role_code UNIQUE (code),

    CONSTRAINT ck_auth_role_code CHECK (
        code IN (
            'JOB_SEEKER',
            'EMPLOYER',
            'ANETI_ADVISOR',
            'FUNCTIONAL_ADMIN',
            'TECH_ADMIN'
        )
    )
);

-- =========================================================
-- 5. Table: iam.auth_user_role
-- =========================================================
CREATE TABLE IF NOT EXISTS iam.auth_user_role (
    user_id UUID NOT NULL,
    role_id UUID NOT NULL,

    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (user_id, role_id),

    CONSTRAINT fk_auth_user_role_user
        FOREIGN KEY (user_id)
        REFERENCES iam.auth_user (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_auth_user_role_role
        FOREIGN KEY (role_id)
        REFERENCES iam.auth_role (id)
        ON DELETE CASCADE
);

-- =========================================================
-- 6. Index utiles
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_auth_user_email
    ON iam.auth_user (email);

CREATE INDEX IF NOT EXISTS idx_auth_user_status
    ON iam.auth_user (status);

CREATE INDEX IF NOT EXISTS idx_auth_user_role_user_id
    ON iam.auth_user_role (user_id);

CREATE INDEX IF NOT EXISTS idx_auth_user_role_role_id
    ON iam.auth_user_role (role_id);

-- =========================================================
-- 7. Trigger updated_at
-- =========================================================
CREATE OR REPLACE FUNCTION iam.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auth_user_updated_at ON iam.auth_user;

CREATE TRIGGER trg_auth_user_updated_at
BEFORE UPDATE ON iam.auth_user
FOR EACH ROW
EXECUTE FUNCTION iam.set_updated_at();

-- =========================================================
-- 8. Seed des rôles ANETI
-- =========================================================
INSERT INTO iam.auth_role (code, label)
VALUES
    ('JOB_SEEKER', 'Chercheur d’emploi'),
    ('EMPLOYER', 'Employeur / Entreprise'),
    ('ANETI_ADVISOR', 'Conseiller ANETI'),
    ('FUNCTIONAL_ADMIN', 'Administrateur fonctionnel ANETI'),
    ('TECH_ADMIN', 'Administrateur technique')
ON CONFLICT (code) DO UPDATE
SET label = EXCLUDED.label;

COMMIT;