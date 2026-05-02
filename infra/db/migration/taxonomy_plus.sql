BEGIN;

-- =========================================================
-- TAXONOMY / REFERENTIELS ANETI - PARTIE 2
-- Version compacte : les codes métier servent de clés primaires
-- =========================================================

CREATE SCHEMA IF NOT EXISTS taxonomy;

-- =========================================================
-- Trigger updated_at générique
-- =========================================================
CREATE OR REPLACE FUNCTION taxonomy.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =========================================================
-- 1. Régime travail
-- =========================================================
CREATE TABLE IF NOT EXISTS taxonomy.ref_regime_travail (
    code TEXT PRIMARY KEY,
    libelle TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_ref_regime_travail_code_not_blank
        CHECK (btrim(code) <> ''),
    CONSTRAINT ck_ref_regime_travail_libelle_not_blank
        CHECK (btrim(libelle) <> '')
);

DROP TRIGGER IF EXISTS trg_ref_regime_travail_updated_at ON taxonomy.ref_regime_travail;
CREATE TRIGGER trg_ref_regime_travail_updated_at
BEFORE UPDATE ON taxonomy.ref_regime_travail
FOR EACH ROW
EXECUTE FUNCTION taxonomy.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_ref_regime_travail_libelle
    ON taxonomy.ref_regime_travail (libelle);


-- =========================================================
-- 2. Gouvernorats
-- =========================================================
CREATE TABLE IF NOT EXISTS taxonomy.ref_n_gouvern (
    code_gouvernorat TEXT PRIMARY KEY,
    libelle_gouvernorat TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_ref_n_gouvern_code_not_blank
        CHECK (btrim(code_gouvernorat) <> ''),
    CONSTRAINT ck_ref_n_gouvern_libelle_not_blank
        CHECK (btrim(libelle_gouvernorat) <> '')
);

DROP TRIGGER IF EXISTS trg_ref_n_gouvern_updated_at ON taxonomy.ref_n_gouvern;
CREATE TRIGGER trg_ref_n_gouvern_updated_at
BEFORE UPDATE ON taxonomy.ref_n_gouvern
FOR EACH ROW
EXECUTE FUNCTION taxonomy.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_ref_n_gouvern_libelle
    ON taxonomy.ref_n_gouvern (libelle_gouvernorat);


-- =========================================================
-- 3. Délégations
-- =========================================================
CREATE TABLE IF NOT EXISTS taxonomy.ref_n_delegat (
    code_delegation TEXT PRIMARY KEY,
    libelle_delegation TEXT NOT NULL,
    code_gouvernorat TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_ref_n_delegat_code_not_blank
        CHECK (btrim(code_delegation) <> ''),
    CONSTRAINT ck_ref_n_delegat_libelle_not_blank
        CHECK (btrim(libelle_delegation) <> ''),

    CONSTRAINT fk_ref_n_delegat_gouvern
        FOREIGN KEY (code_gouvernorat)
        REFERENCES taxonomy.ref_n_gouvern (code_gouvernorat)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

DROP TRIGGER IF EXISTS trg_ref_n_delegat_updated_at ON taxonomy.ref_n_delegat;
CREATE TRIGGER trg_ref_n_delegat_updated_at
BEFORE UPDATE ON taxonomy.ref_n_delegat
FOR EACH ROW
EXECUTE FUNCTION taxonomy.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_ref_n_delegat_gouvernorat
    ON taxonomy.ref_n_delegat (code_gouvernorat);

CREATE INDEX IF NOT EXISTS idx_ref_n_delegat_libelle
    ON taxonomy.ref_n_delegat (libelle_delegation);


-- =========================================================
-- 4. Type offre
-- =========================================================
CREATE TABLE IF NOT EXISTS taxonomy.ref_type_offre (
    code TEXT PRIMARY KEY,
    libelle TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_ref_type_offre_code_not_blank
        CHECK (btrim(code) <> ''),
    CONSTRAINT ck_ref_type_offre_libelle_not_blank
        CHECK (btrim(libelle) <> '')
);

DROP TRIGGER IF EXISTS trg_ref_type_offre_updated_at ON taxonomy.ref_type_offre;
CREATE TRIGGER trg_ref_type_offre_updated_at
BEFORE UPDATE ON taxonomy.ref_type_offre
FOR EACH ROW
EXECUTE FUNCTION taxonomy.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_ref_type_offre_libelle
    ON taxonomy.ref_type_offre (libelle);


-- =========================================================
-- 5. Situation offre
-- =========================================================
CREATE TABLE IF NOT EXISTS taxonomy.ref_situation_offre (
    code TEXT PRIMARY KEY,
    libelle TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_ref_situation_offre_code_not_blank
        CHECK (btrim(code) <> ''),
    CONSTRAINT ck_ref_situation_offre_libelle_not_blank
        CHECK (btrim(libelle) <> '')
);

DROP TRIGGER IF EXISTS trg_ref_situation_offre_updated_at ON taxonomy.ref_situation_offre;
CREATE TRIGGER trg_ref_situation_offre_updated_at
BEFORE UPDATE ON taxonomy.ref_situation_offre
FOR EACH ROW
EXECUTE FUNCTION taxonomy.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_ref_situation_offre_libelle
    ON taxonomy.ref_situation_offre (libelle);


-- =========================================================
-- 6. Diplômes
-- =========================================================
CREATE TABLE IF NOT EXISTS taxonomy.ref_diplomes (
    code_diplome TEXT PRIMARY KEY,
    libelle_diplome TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_ref_diplomes_code_not_blank
        CHECK (btrim(code_diplome) <> ''),
    CONSTRAINT ck_ref_diplomes_libelle_not_blank
        CHECK (btrim(libelle_diplome) <> '')
);

DROP TRIGGER IF EXISTS trg_ref_diplomes_updated_at ON taxonomy.ref_diplomes;
CREATE TRIGGER trg_ref_diplomes_updated_at
BEFORE UPDATE ON taxonomy.ref_diplomes
FOR EACH ROW
EXECUTE FUNCTION taxonomy.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_ref_diplomes_libelle
    ON taxonomy.ref_diplomes (libelle_diplome);


-- =========================================================
-- 7. Spécialités
-- =========================================================
CREATE TABLE IF NOT EXISTS taxonomy.ref_specialites (
    code_specialite TEXT PRIMARY KEY,
    libelle_specialite TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_ref_specialites_code_not_blank
        CHECK (btrim(code_specialite) <> ''),
    CONSTRAINT ck_ref_specialites_libelle_not_blank
        CHECK (btrim(libelle_specialite) <> '')
);

DROP TRIGGER IF EXISTS trg_ref_specialites_updated_at ON taxonomy.ref_specialites;
CREATE TRIGGER trg_ref_specialites_updated_at
BEFORE UPDATE ON taxonomy.ref_specialites
FOR EACH ROW
EXECUTE FUNCTION taxonomy.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_ref_specialites_libelle
    ON taxonomy.ref_specialites (libelle_specialite);


-- =========================================================
-- 8. Niveau instruction
-- =========================================================
CREATE TABLE IF NOT EXISTS taxonomy.ref_niveau_instruction (
    code_niveau_instruction TEXT PRIMARY KEY,
    libelle_niveau_instruction TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_ref_niveau_instruction_code_not_blank
        CHECK (btrim(code_niveau_instruction) <> ''),
    CONSTRAINT ck_ref_niveau_instruction_libelle_not_blank
        CHECK (btrim(libelle_niveau_instruction) <> '')
);

DROP TRIGGER IF EXISTS trg_ref_niveau_instruction_updated_at ON taxonomy.ref_niveau_instruction;
CREATE TRIGGER trg_ref_niveau_instruction_updated_at
BEFORE UPDATE ON taxonomy.ref_niveau_instruction
FOR EACH ROW
EXECUTE FUNCTION taxonomy.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_ref_niveau_instruction_libelle
    ON taxonomy.ref_niveau_instruction (libelle_niveau_instruction);


-- =========================================================
-- 9. Activité ANETI
-- =========================================================
CREATE TABLE IF NOT EXISTS taxonomy.ref_n_activit (
    code_activite TEXT PRIMARY KEY,
    libelle_activite TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_ref_n_activit_code_not_blank
        CHECK (btrim(code_activite) <> ''),
    CONSTRAINT ck_ref_n_activit_libelle_not_blank
        CHECK (btrim(libelle_activite) <> '')
);

DROP TRIGGER IF EXISTS trg_ref_n_activit_updated_at ON taxonomy.ref_n_activit;
CREATE TRIGGER trg_ref_n_activit_updated_at
BEFORE UPDATE ON taxonomy.ref_n_activit
FOR EACH ROW
EXECUTE FUNCTION taxonomy.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_ref_n_activit_libelle
    ON taxonomy.ref_n_activit (libelle_activite);


-- =========================================================
-- 10. Secteur activité
-- =========================================================
CREATE TABLE IF NOT EXISTS taxonomy.ref_v_sectact (
    code_secteur TEXT PRIMARY KEY,
    libelle_secteur TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_ref_v_sectact_code_not_blank
        CHECK (btrim(code_secteur) <> ''),
    CONSTRAINT ck_ref_v_sectact_libelle_not_blank
        CHECK (btrim(libelle_secteur) <> '')
);

DROP TRIGGER IF EXISTS trg_ref_v_sectact_updated_at ON taxonomy.ref_v_sectact;
CREATE TRIGGER trg_ref_v_sectact_updated_at
BEFORE UPDATE ON taxonomy.ref_v_sectact
FOR EACH ROW
EXECUTE FUNCTION taxonomy.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_ref_v_sectact_libelle
    ON taxonomy.ref_v_sectact (libelle_secteur);


-- =========================================================
-- 11. Type PAE
-- =========================================================
CREATE TABLE IF NOT EXISTS taxonomy.ref_type_pae (
    code TEXT PRIMARY KEY,
    libelle TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_ref_type_pae_code_not_blank
        CHECK (btrim(code) <> ''),
    CONSTRAINT ck_ref_type_pae_libelle_not_blank
        CHECK (btrim(libelle) <> '')
);

DROP TRIGGER IF EXISTS trg_ref_type_pae_updated_at ON taxonomy.ref_type_pae;
CREATE TRIGGER trg_ref_type_pae_updated_at
BEFORE UPDATE ON taxonomy.ref_type_pae
FOR EACH ROW
EXECUTE FUNCTION taxonomy.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_ref_type_pae_libelle
    ON taxonomy.ref_type_pae (libelle);


-- =========================================================
-- 12. Segmentation
-- =========================================================
CREATE TABLE IF NOT EXISTS taxonomy.ref_segmentation (
    code_segmentation TEXT PRIMARY KEY,
    libelle_segmentation TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_ref_segmentation_code_not_blank
        CHECK (btrim(code_segmentation) <> ''),
    CONSTRAINT ck_ref_segmentation_libelle_not_blank
        CHECK (btrim(libelle_segmentation) <> '')
);

DROP TRIGGER IF EXISTS trg_ref_segmentation_updated_at ON taxonomy.ref_segmentation;
CREATE TRIGGER trg_ref_segmentation_updated_at
BEFORE UPDATE ON taxonomy.ref_segmentation
FOR EACH ROW
EXECUTE FUNCTION taxonomy.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_ref_segmentation_libelle
    ON taxonomy.ref_segmentation (libelle_segmentation);


-- =========================================================
-- 13. Certifications
-- =========================================================
CREATE TABLE IF NOT EXISTS taxonomy.ref_certifications (
    code_certification TEXT PRIMARY KEY,
    libelle_certification TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_ref_certifications_code_not_blank
        CHECK (btrim(code_certification) <> ''),
    CONSTRAINT ck_ref_certifications_libelle_not_blank
        CHECK (btrim(libelle_certification) <> '')
);

DROP TRIGGER IF EXISTS trg_ref_certifications_updated_at ON taxonomy.ref_certifications;
CREATE TRIGGER trg_ref_certifications_updated_at
BEFORE UPDATE ON taxonomy.ref_certifications
FOR EACH ROW
EXECUTE FUNCTION taxonomy.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_ref_certifications_libelle
    ON taxonomy.ref_certifications (libelle_certification);


-- =========================================================
-- 14. Genre
-- =========================================================
CREATE TABLE IF NOT EXISTS taxonomy.ref_genre (
    code_genre TEXT PRIMARY KEY,
    libelle_genre TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_ref_genre_code_not_blank
        CHECK (btrim(code_genre) <> ''),
    CONSTRAINT ck_ref_genre_libelle_not_blank
        CHECK (btrim(libelle_genre) <> '')
);

DROP TRIGGER IF EXISTS trg_ref_genre_updated_at ON taxonomy.ref_genre;
CREATE TRIGGER trg_ref_genre_updated_at
BEFORE UPDATE ON taxonomy.ref_genre
FOR EACH ROW
EXECUTE FUNCTION taxonomy.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_ref_genre_libelle
    ON taxonomy.ref_genre (libelle_genre);


-- =========================================================
-- 15. Type permis
-- =========================================================
CREATE TABLE IF NOT EXISTS taxonomy.ref_type_permis (
    code_permis TEXT PRIMARY KEY,
    libelle_permis TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_ref_type_permis_code_not_blank
        CHECK (btrim(code_permis) <> ''),
    CONSTRAINT ck_ref_type_permis_libelle_not_blank
        CHECK (btrim(libelle_permis) <> '')
);

DROP TRIGGER IF EXISTS trg_ref_type_permis_updated_at ON taxonomy.ref_type_permis;
CREATE TRIGGER trg_ref_type_permis_updated_at
BEFORE UPDATE ON taxonomy.ref_type_permis
FOR EACH ROW
EXECUTE FUNCTION taxonomy.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_ref_type_permis_libelle
    ON taxonomy.ref_type_permis (libelle_permis);


-- =========================================================
-- 16. Type contrat
-- =========================================================
CREATE TABLE IF NOT EXISTS taxonomy.ref_type_contrat (
    code_contrat TEXT PRIMARY KEY,
    libelle_contrat TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_ref_type_contrat_code_not_blank
        CHECK (btrim(code_contrat) <> ''),
    CONSTRAINT ck_ref_type_contrat_libelle_not_blank
        CHECK (btrim(libelle_contrat) <> '')
);

DROP TRIGGER IF EXISTS trg_ref_type_contrat_updated_at ON taxonomy.ref_type_contrat;
CREATE TRIGGER trg_ref_type_contrat_updated_at
BEFORE UPDATE ON taxonomy.ref_type_contrat
FOR EACH ROW
EXECUTE FUNCTION taxonomy.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_ref_type_contrat_libelle
    ON taxonomy.ref_type_contrat (libelle_contrat);


-- =========================================================
-- 17. Type handicap
-- =========================================================
CREATE TABLE IF NOT EXISTS taxonomy.ref_type_handicap (
    code_handicap TEXT PRIMARY KEY,
    libelle_handicap TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_ref_type_handicap_code_not_blank
        CHECK (btrim(code_handicap) <> ''),
    CONSTRAINT ck_ref_type_handicap_libelle_not_blank
        CHECK (btrim(libelle_handicap) <> '')
);

DROP TRIGGER IF EXISTS trg_ref_type_handicap_updated_at ON taxonomy.ref_type_handicap;
CREATE TRIGGER trg_ref_type_handicap_updated_at
BEFORE UPDATE ON taxonomy.ref_type_handicap
FOR EACH ROW
EXECUTE FUNCTION taxonomy.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_ref_type_handicap_libelle
    ON taxonomy.ref_type_handicap (libelle_handicap);


-- =========================================================
-- 18. Degré handicap
-- =========================================================
CREATE TABLE IF NOT EXISTS taxonomy.ref_degre_handicap (
    code_degre_handicap TEXT PRIMARY KEY,
    libelle_degre_handicap TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_ref_degre_handicap_code_not_blank
        CHECK (btrim(code_degre_handicap) <> ''),
    CONSTRAINT ck_ref_degre_handicap_libelle_not_blank
        CHECK (btrim(libelle_degre_handicap) <> '')
);

DROP TRIGGER IF EXISTS trg_ref_degre_handicap_updated_at ON taxonomy.ref_degre_handicap;
CREATE TRIGGER trg_ref_degre_handicap_updated_at
BEFORE UPDATE ON taxonomy.ref_degre_handicap
FOR EACH ROW
EXECUTE FUNCTION taxonomy.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_ref_degre_handicap_libelle
    ON taxonomy.ref_degre_handicap (libelle_degre_handicap);


-- =========================================================
-- 19. Organisation temps travail
-- =========================================================
CREATE TABLE IF NOT EXISTS taxonomy.ref_organisation_temps_travail (
    code TEXT PRIMARY KEY,
    libelle TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_ref_organisation_temps_travail_code_not_blank
        CHECK (btrim(code) <> ''),
    CONSTRAINT ck_ref_organisation_temps_travail_libelle_not_blank
        CHECK (btrim(libelle) <> '')
);

DROP TRIGGER IF EXISTS trg_ref_organisation_temps_travail_updated_at ON taxonomy.ref_organisation_temps_travail;
CREATE TRIGGER trg_ref_organisation_temps_travail_updated_at
BEFORE UPDATE ON taxonomy.ref_organisation_temps_travail
FOR EACH ROW
EXECUTE FUNCTION taxonomy.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_ref_organisation_temps_travail_libelle
    ON taxonomy.ref_organisation_temps_travail (libelle);


COMMIT;
