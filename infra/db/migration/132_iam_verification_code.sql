-- Migration 132 — Table générique de codes de vérification OTP
-- Remplace iam.email_verification_code par une table multi-canal (EMAIL, SMS, …)

CREATE TABLE IF NOT EXISTS iam.verification_code (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id             UUID        NULL,
    identifier          TEXT        NOT NULL,           -- email ou numéro de téléphone
    channel             TEXT        NOT NULL DEFAULT 'EMAIL',  -- 'EMAIL' | 'SMS'
    purpose             TEXT        NOT NULL,           -- ex. 'CANDIDATE_REGISTER'

    code_hash           TEXT        NOT NULL,
    expires_at          TIMESTAMPTZ NOT NULL,
    consumed_at         TIMESTAMPTZ NULL,

    attempts_count      INTEGER     NOT NULL DEFAULT 0,
    max_attempts        INTEGER     NOT NULL DEFAULT 5,

    resend_count        INTEGER     NOT NULL DEFAULT 0,
    last_sent_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    provider            TEXT        NOT NULL DEFAULT 'BREVO',
    provider_message_id TEXT        NULL,

    metadata_json       JSONB       NOT NULL DEFAULT '{}'::jsonb,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_code_identifier
    ON iam.verification_code(identifier);

CREATE INDEX IF NOT EXISTS idx_verification_code_user_id
    ON iam.verification_code(user_id);

CREATE INDEX IF NOT EXISTS idx_verification_code_active
    ON iam.verification_code(identifier, purpose, consumed_at, expires_at);
