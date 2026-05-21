BEGIN;

-- =========================================================
-- geo.postal_code  — codes postaux tous pays
-- geo.postal_code_admin_unit — lien N:N code postal ↔ unité admin
-- =========================================================

CREATE TABLE IF NOT EXISTS geo.postal_code (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),

    country_id       UUID         NOT NULL REFERENCES geo.country(id) ON DELETE CASCADE,

    -- Le code postal brut (ex : "1001", "75001")
    postal_code      TEXT         NOT NULL,

    -- Libellé du bureau de poste ou de la localité principale
    label            TEXT,
    locality_label   TEXT,
    locality_label_ar TEXT,

    active           BOOLEAN      NOT NULL DEFAULT TRUE,

    source           TEXT,
    source_url       TEXT,

    metadata_json    JSONB        NOT NULL DEFAULT '{}'::jsonb,

    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT uq_geo_postal_code UNIQUE(country_id, postal_code)
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_geo_postal_code_country
    ON geo.postal_code(country_id);

CREATE INDEX IF NOT EXISTS idx_geo_postal_code_code
    ON geo.postal_code(postal_code);

CREATE INDEX IF NOT EXISTS idx_geo_postal_code_label_trgm
    ON geo.postal_code USING gin(
        geo.normalize_text(coalesce(label,'') || ' ' || coalesce(locality_label,'')) gin_trgm_ops
    );


-- =========================================================
-- Liaison code postal ↔ unité administrative
-- Un code postal peut couvrir plusieurs unités (imadas),
-- une imada peut avoir plusieurs codes postaux.
-- =========================================================
CREATE TABLE IF NOT EXISTS geo.postal_code_admin_unit (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    postal_code_id  UUID        NOT NULL REFERENCES geo.postal_code(id) ON DELETE CASCADE,
    admin_unit_id   UUID        NOT NULL REFERENCES geo.admin_unit(id)  ON DELETE CASCADE,

    -- Niveau administratif de l'unité liée (1=gouvernorat, 2=délégation, 3=imada)
    admin_level     INTEGER,

    is_primary      BOOLEAN     NOT NULL DEFAULT TRUE,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_geo_postal_code_admin_unit UNIQUE(postal_code_id, admin_unit_id)
);

CREATE INDEX IF NOT EXISTS idx_geo_pc_admin_unit_pc
    ON geo.postal_code_admin_unit(postal_code_id);

CREATE INDEX IF NOT EXISTS idx_geo_pc_admin_unit_au
    ON geo.postal_code_admin_unit(admin_unit_id);


-- =========================================================
-- S'assurer que le type IMADA est déclaré dans country_admin_structure
-- (si la table existe)
-- =========================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'geo' AND table_name = 'country_admin_structure'
    ) THEN
        INSERT INTO geo.country_admin_structure (country_id, admin_level, unit_type, label_fr, label_en, label_ar)
        SELECT
            c.id, 3, 'IMADA', 'Imada', 'Imada', 'عمادة'
        FROM geo.country c
        WHERE c.iso2 = 'TN'
        ON CONFLICT DO NOTHING;
    END IF;
END;
$$;

COMMIT;
