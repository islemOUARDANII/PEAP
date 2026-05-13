BEGIN;

-- 1. Mots-clés / centres d’intérêt du candidat
CREATE TABLE IF NOT EXISTS aneti.job_seeker_keyword (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_seeker_id   uuid NOT NULL REFERENCES aneti.job_seeker(id) ON DELETE CASCADE,
    keyword         text NOT NULL,
    keyword_type    text NOT NULL DEFAULT 'INTEREST',
    source          text NOT NULL DEFAULT 'MANUAL',
    weight          numeric(5,2) NOT NULL DEFAULT 1.00,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_job_seeker_keyword UNIQUE (job_seeker_id, keyword)
);

CREATE INDEX IF NOT EXISTS idx_job_seeker_keyword_job_seeker_id
ON aneti.job_seeker_keyword(job_seeker_id);

CREATE INDEX IF NOT EXISTS idx_job_seeker_keyword_keyword
ON aneti.job_seeker_keyword(keyword);


-- 2. Candidatures aux offres
CREATE TABLE IF NOT EXISTS aneti.job_application (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_seeker_id       uuid NOT NULL REFERENCES aneti.job_seeker(id) ON DELETE CASCADE,
    offer_id            uuid NOT NULL REFERENCES aneti.job_offer(id) ON DELETE CASCADE,
    matching_result_id  uuid NULL REFERENCES matching.matching_result(id) ON DELETE SET NULL,

    status              text NOT NULL DEFAULT 'APPLIED',
    cover_message       text NULL,

    applied_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_job_application_job_seeker_offer UNIQUE (job_seeker_id, offer_id),

    CONSTRAINT chk_job_application_status CHECK (
        status IN (
            'APPLIED',
            'VIEWED',
            'SHORTLISTED',
            'REJECTED',
            'ACCEPTED',
            'WITHDRAWN'
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_job_application_job_seeker_id
ON aneti.job_application(job_seeker_id);

CREATE INDEX IF NOT EXISTS idx_job_application_offer_id
ON aneti.job_application(offer_id);

CREATE INDEX IF NOT EXISTS idx_job_application_status
ON aneti.job_application(status);


-- 3. Seuil personnel du candidat pour afficher les offres compatibles
ALTER TABLE aneti.job_seeker_preference
ADD COLUMN IF NOT EXISTS min_offer_score_threshold numeric(5,2) NOT NULL DEFAULT 50.00;

ALTER TABLE aneti.job_seeker_preference
ADD CONSTRAINT chk_job_seeker_preference_min_offer_score_threshold
CHECK (
    min_offer_score_threshold >= 0
    AND min_offer_score_threshold <= 100
);

COMMIT;