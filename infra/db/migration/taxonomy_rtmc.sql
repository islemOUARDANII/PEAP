BEGIN;

-- =========================================================
-- TAXONOMY ANETI / RTMC - V2
-- Objectif : une table claire par feuille RTMC et par référentiel ANETI.
-- Pas de modèle générique imposé au métier.
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS taxonomy;

-- =========================================================
-- Utility trigger for updated_at
-- =========================================================
CREATE OR REPLACE FUNCTION taxonomy.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- A. RTMC - Métiers
-- Excel: Métiers
-- Colonnes source:
-- id | code metier | libelle metier | libelle_up metier |
-- code grand domaine professionnel | libelle grand domaine professionnel |
-- code domaine professionnel | libelle domaine professionnel | actif
-- =========================================================
CREATE TABLE IF NOT EXISTS taxonomy.rtmc_metiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id TEXT NULL,

    code_metier TEXT NOT NULL,
    libelle_metier TEXT NOT NULL,
    libelle_up_metier TEXT NULL,

    code_grand_domaine_professionnel TEXT NULL,
    libelle_grand_domaine_professionnel TEXT NULL,

    code_domaine_professionnel TEXT NULL,
    libelle_domaine_professionnel TEXT NULL,

    actif BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_rtmc_metiers_code UNIQUE (code_metier)
);

CREATE INDEX IF NOT EXISTS idx_rtmc_metiers_grand_domaine
    ON taxonomy.rtmc_metiers (code_grand_domaine_professionnel);

CREATE INDEX IF NOT EXISTS idx_rtmc_metiers_domaine
    ON taxonomy.rtmc_metiers (code_domaine_professionnel);

CREATE INDEX IF NOT EXISTS idx_rtmc_metiers_actif
    ON taxonomy.rtmc_metiers (actif);

CREATE INDEX IF NOT EXISTS idx_rtmc_metiers_libelle_up
    ON taxonomy.rtmc_metiers (libelle_up_metier);

DROP TRIGGER IF EXISTS trg_rtmc_metiers_updated_at ON taxonomy.rtmc_metiers;
CREATE TRIGGER trg_rtmc_metiers_updated_at
BEFORE UPDATE ON taxonomy.rtmc_metiers
FOR EACH ROW EXECUTE FUNCTION taxonomy.set_updated_at();

-- =========================================================
-- B. RTMC - Appellations
-- Excel: Appellations
-- id | code appellation | libelle appellation | libelle_up appellation | code metier | actif
-- =========================================================
CREATE TABLE IF NOT EXISTS taxonomy.rtmc_appellations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id TEXT NULL,

    code_appellation TEXT NOT NULL,
    libelle_appellation TEXT NOT NULL,
    libelle_up_appellation TEXT NULL,

    code_metier TEXT NOT NULL,
    actif BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_rtmc_appellations_code UNIQUE (code_appellation),
    CONSTRAINT fk_rtmc_appellations_metier
        FOREIGN KEY (code_metier)
        REFERENCES taxonomy.rtmc_metiers (code_metier)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_rtmc_appellations_code_metier
    ON taxonomy.rtmc_appellations (code_metier);

CREATE INDEX IF NOT EXISTS idx_rtmc_appellations_actif
    ON taxonomy.rtmc_appellations (actif);

CREATE INDEX IF NOT EXISTS idx_rtmc_appellations_libelle_up
    ON taxonomy.rtmc_appellations (libelle_up_appellation);

DROP TRIGGER IF EXISTS trg_rtmc_appellations_updated_at ON taxonomy.rtmc_appellations;
CREATE TRIGGER trg_rtmc_appellations_updated_at
BEFORE UPDATE ON taxonomy.rtmc_appellations
FOR EACH ROW EXECUTE FUNCTION taxonomy.set_updated_at();

-- =========================================================
-- C. RTMC - Savoir faire / Activités
-- Excel: Savoir faire (activités)
-- id | code metier | code activite | libelle activite | libelle_up activite | type | actif
-- =========================================================
CREATE TABLE IF NOT EXISTS taxonomy.rtmc_savoir_faire_activites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id TEXT NULL,

    code_metier TEXT NOT NULL,
    code_activite TEXT NOT NULL,
    libelle_activite TEXT NOT NULL,
    libelle_up_activite TEXT NULL,
    type TEXT NULL,
    actif BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_rtmc_activites_metier_code_type UNIQUE (code_metier, code_activite, type),
    CONSTRAINT fk_rtmc_activites_metier
        FOREIGN KEY (code_metier)
        REFERENCES taxonomy.rtmc_metiers (code_metier)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_rtmc_activites_code_metier
    ON taxonomy.rtmc_savoir_faire_activites (code_metier);

CREATE INDEX IF NOT EXISTS idx_rtmc_activites_code
    ON taxonomy.rtmc_savoir_faire_activites (code_activite);

CREATE INDEX IF NOT EXISTS idx_rtmc_activites_type
    ON taxonomy.rtmc_savoir_faire_activites (type);

CREATE INDEX IF NOT EXISTS idx_rtmc_activites_actif
    ON taxonomy.rtmc_savoir_faire_activites (actif);

DROP TRIGGER IF EXISTS trg_rtmc_activites_updated_at ON taxonomy.rtmc_savoir_faire_activites;
CREATE TRIGGER trg_rtmc_activites_updated_at
BEFORE UPDATE ON taxonomy.rtmc_savoir_faire_activites
FOR EACH ROW EXECUTE FUNCTION taxonomy.set_updated_at();

-- =========================================================
-- D. RTMC - Savoir / Compétences
-- Excel: Savoir (compétences)
-- id | code metier | code competence | libelle competence | libelle_up competence | type | actif
-- =========================================================
CREATE TABLE IF NOT EXISTS taxonomy.rtmc_savoir_competences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id TEXT NULL,

    code_metier TEXT NOT NULL,
    code_competence TEXT NOT NULL,
    libelle_competence TEXT NOT NULL,
    libelle_up_competence TEXT NULL,
    type TEXT NULL,
    actif BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_rtmc_competences_metier_code_type UNIQUE (code_metier, code_competence, type),
    CONSTRAINT fk_rtmc_competences_metier
        FOREIGN KEY (code_metier)
        REFERENCES taxonomy.rtmc_metiers (code_metier)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_rtmc_competences_code_metier
    ON taxonomy.rtmc_savoir_competences (code_metier);

CREATE INDEX IF NOT EXISTS idx_rtmc_competences_code
    ON taxonomy.rtmc_savoir_competences (code_competence);

CREATE INDEX IF NOT EXISTS idx_rtmc_competences_type
    ON taxonomy.rtmc_savoir_competences (type);

CREATE INDEX IF NOT EXISTS idx_rtmc_competences_actif
    ON taxonomy.rtmc_savoir_competences (actif);

DROP TRIGGER IF EXISTS trg_rtmc_competences_updated_at ON taxonomy.rtmc_savoir_competences;
CREATE TRIGGER trg_rtmc_competences_updated_at
BEFORE UPDATE ON taxonomy.rtmc_savoir_competences
FOR EACH ROW EXECUTE FUNCTION taxonomy.set_updated_at();

-- =========================================================
-- E. RTMC - Environnements
-- Excel: Environnements
-- id | metier | environnement | libelle | libelle_up | type | actif
-- =========================================================
CREATE TABLE IF NOT EXISTS taxonomy.rtmc_environnements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id TEXT NULL,

    code_metier TEXT NOT NULL,
    code_environnement TEXT NOT NULL,
    libelle TEXT NOT NULL,
    libelle_up TEXT NULL,
    type TEXT NULL,
    actif BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_rtmc_environnements_metier_code_type UNIQUE (code_metier, code_environnement, type),
    CONSTRAINT fk_rtmc_environnements_metier
        FOREIGN KEY (code_metier)
        REFERENCES taxonomy.rtmc_metiers (code_metier)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_rtmc_environnements_code_metier
    ON taxonomy.rtmc_environnements (code_metier);

CREATE INDEX IF NOT EXISTS idx_rtmc_environnements_code
    ON taxonomy.rtmc_environnements (code_environnement);

CREATE INDEX IF NOT EXISTS idx_rtmc_environnements_type
    ON taxonomy.rtmc_environnements (type);

CREATE INDEX IF NOT EXISTS idx_rtmc_environnements_actif
    ON taxonomy.rtmc_environnements (actif);

DROP TRIGGER IF EXISTS trg_rtmc_environnements_updated_at ON taxonomy.rtmc_environnements;
CREATE TRIGGER trg_rtmc_environnements_updated_at
BEFORE UPDATE ON taxonomy.rtmc_environnements
FOR EACH ROW EXECUTE FUNCTION taxonomy.set_updated_at();

-- =========================================================
-- F. RTMC - Mobilités
-- Excel: Mobilites
-- id | code metier | code metier mobilité professionnelle | type | used
-- =========================================================
CREATE TABLE IF NOT EXISTS taxonomy.rtmc_mobilites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id TEXT NULL,

    code_metier TEXT NOT NULL,
    code_metier_mobilite_professionnelle TEXT NOT NULL,
    type TEXT NULL,
    used BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_rtmc_mobilites_metier_cible_type UNIQUE (
        code_metier,
        code_metier_mobilite_professionnelle,
        type
    ),
    CONSTRAINT fk_rtmc_mobilites_metier_source
        FOREIGN KEY (code_metier)
        REFERENCES taxonomy.rtmc_metiers (code_metier)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_rtmc_mobilites_metier_cible
        FOREIGN KEY (code_metier_mobilite_professionnelle)
        REFERENCES taxonomy.rtmc_metiers (code_metier)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_rtmc_mobilites_code_metier
    ON taxonomy.rtmc_mobilites (code_metier);

CREATE INDEX IF NOT EXISTS idx_rtmc_mobilites_code_metier_cible
    ON taxonomy.rtmc_mobilites (code_metier_mobilite_professionnelle);

CREATE INDEX IF NOT EXISTS idx_rtmc_mobilites_type
    ON taxonomy.rtmc_mobilites (type);

DROP TRIGGER IF EXISTS trg_rtmc_mobilites_updated_at ON taxonomy.rtmc_mobilites;
CREATE TRIGGER trg_rtmc_mobilites_updated_at
BEFORE UPDATE ON taxonomy.rtmc_mobilites
FOR EACH ROW EXECUTE FUNCTION taxonomy.set_updated_at();

-- =========================================================
-- G. RTMC - Savoir être
-- Excel: Savoir être
-- id | code savoir etre | libelle savoir etre | libelle_up etre | actif
-- =========================================================
CREATE TABLE IF NOT EXISTS taxonomy.rtmc_savoir_etre (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id TEXT NULL,

    code_savoir_etre TEXT NOT NULL,
    libelle_savoir_etre TEXT NOT NULL,
    libelle_up_etre TEXT NULL,
    actif BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_rtmc_savoir_etre_code UNIQUE (code_savoir_etre)
);

CREATE INDEX IF NOT EXISTS idx_rtmc_savoir_etre_actif
    ON taxonomy.rtmc_savoir_etre (actif);

CREATE INDEX IF NOT EXISTS idx_rtmc_savoir_etre_libelle_up
    ON taxonomy.rtmc_savoir_etre (libelle_up_etre);

DROP TRIGGER IF EXISTS trg_rtmc_savoir_etre_updated_at ON taxonomy.rtmc_savoir_etre;
CREATE TRIGGER trg_rtmc_savoir_etre_updated_at
BEFORE UPDATE ON taxonomy.rtmc_savoir_etre
FOR EACH ROW EXECUTE FUNCTION taxonomy.set_updated_at();


COMMIT;