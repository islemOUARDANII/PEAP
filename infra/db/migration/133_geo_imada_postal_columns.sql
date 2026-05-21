-- Migration 133 — Ajout des colonnes imada_unit_id et champs postaux manquants
-- sur les tables métier aneti (job_seeker_contact, employer_location, job_offer)

-- ── aneti.job_seeker_contact ─────────────────────────────────────────────────

ALTER TABLE aneti.job_seeker_contact
    ADD COLUMN IF NOT EXISTS imada_unit_id UUID NULL
        REFERENCES geo.admin_unit(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_jsc_imada_unit_id
    ON aneti.job_seeker_contact(imada_unit_id);

-- ── aneti.employer_location ──────────────────────────────────────────────────

ALTER TABLE aneti.employer_location
    ADD COLUMN IF NOT EXISTS imada_unit_id   UUID NULL
        REFERENCES geo.admin_unit(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS location_unit_id UUID NULL
        REFERENCES geo.admin_unit(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS postal_code_id  UUID NULL
        REFERENCES geo.postal_code(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS postal_code     TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_el_imada_unit_id
    ON aneti.employer_location(imada_unit_id);

-- ── aneti.job_offer ──────────────────────────────────────────────────────────

ALTER TABLE aneti.job_offer
    ADD COLUMN IF NOT EXISTS imada_unit_id  UUID NULL
        REFERENCES geo.admin_unit(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS postal_code_id UUID NULL
        REFERENCES geo.postal_code(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS postal_code    TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_jo_imada_unit_id
    ON aneti.job_offer(imada_unit_id);
