import argparse
import os
import re
import sys
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values


SHEET_METIERS = "Métiers"
SHEET_APPELLATIONS = "Appellations"
SHEET_ACTIVITES = "Savoir faire (activités)"
SHEET_COMPETENCES = "Savoir (compétences)"
SHEET_ENVIRONNEMENTS = "Environnements"
SHEET_MOBILITES = "Mobilites"
SHEET_SAVOIR_ETRE = "Savoir être"

EXPECTED_SHEETS = [
    SHEET_METIERS,
    SHEET_APPELLATIONS,
    SHEET_ACTIVITES,
    SHEET_COMPETENCES,
    SHEET_ENVIRONNEMENTS,
    SHEET_MOBILITES,
    SHEET_SAVOIR_ETRE,
]


def normalize_col(name: str) -> str:
    s = str(name).strip().lower()
    s = s.replace("é", "e").replace("è", "e").replace("ê", "e").replace("à", "a")
    s = s.replace("ç", "c").replace("ù", "u").replace("î", "i").replace("ï", "i")
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_")


def clean_text(value: Any) -> Optional[str]:
    if pd.isna(value):
        return None
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    s = str(value).strip()
    if s == "" or s.lower() in {"nan", "none", "null"}:
        return None
    return s


def clean_code(value: Any) -> Optional[str]:
    s = clean_text(value)
    if s is None:
        return None
    if re.fullmatch(r"\d+\.0", s):
        return s[:-2]
    return s


def clean_bool(value: Any, default: bool = True) -> bool:
    if pd.isna(value):
        return default
    s = str(value).strip().upper()
    if s in {"O", "OUI", "Y", "YES", "TRUE", "1", "ACTIF"}:
        return True
    if s in {"N", "NON", "NO", "FALSE", "0", "INACTIF"}:
        return False
    return default


def read_sheet(excel_path: str, sheet_name: str) -> pd.DataFrame:
    df = pd.read_excel(excel_path, sheet_name=sheet_name, dtype=object)
    df = df.rename(columns={c: normalize_col(c) for c in df.columns})
    df = df.dropna(how="all")
    return df


def assert_columns(df: pd.DataFrame, sheet_name: str, required: Sequence[str]) -> None:
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(
            f"Feuille '{sheet_name}': colonnes manquantes: {missing}. "
            f"Colonnes trouvées: {list(df.columns)}"
        )


def rows_metiers(df: pd.DataFrame) -> List[Tuple[Any, ...]]:
    required = [
        "id", "code_metier", "libelle_metier", "libelle_up_metier",
        "code_grand_domaine_professionnel", "libelle_grand_domaine_professionnel",
        "code_domaine_professionnel", "libelle_domaine_professionnel", "actif",
    ]
    assert_columns(df, SHEET_METIERS, required)
    rows = []
    for _, r in df.iterrows():
        code_metier = clean_code(r["code_metier"])
        libelle = clean_text(r["libelle_metier"])
        if not code_metier or not libelle:
            continue
        rows.append((
            clean_code(r["id"]),
            code_metier,
            libelle,
            clean_text(r["libelle_up_metier"]),
            clean_code(r["code_grand_domaine_professionnel"]),
            clean_text(r["libelle_grand_domaine_professionnel"]),
            clean_code(r["code_domaine_professionnel"]),
            clean_text(r["libelle_domaine_professionnel"]),
            clean_bool(r["actif"]),
        ))
    return rows


def rows_appellations(df: pd.DataFrame) -> List[Tuple[Any, ...]]:
    required = ["id", "code_appellation", "libelle_appellation", "libelle_up_appellation", "code_metier", "actif"]
    assert_columns(df, SHEET_APPELLATIONS, required)
    rows = []
    for _, r in df.iterrows():
        code_appellation = clean_code(r["code_appellation"])
        code_metier = clean_code(r["code_metier"])
        libelle = clean_text(r["libelle_appellation"])
        if not code_appellation or not code_metier or not libelle:
            continue
        rows.append((
            clean_code(r["id"]),
            code_appellation,
            libelle,
            clean_text(r["libelle_up_appellation"]),
            code_metier,
            clean_bool(r["actif"]),
        ))
    return rows


def rows_activites(df: pd.DataFrame) -> List[Tuple[Any, ...]]:
    required = ["id", "code_metier", "code_activite", "libelle_activite", "libelle_up_activite", "type", "actif"]
    assert_columns(df, SHEET_ACTIVITES, required)
    rows = []
    for _, r in df.iterrows():
        code_metier = clean_code(r["code_metier"])
        code_activite = clean_code(r["code_activite"])
        libelle = clean_text(r["libelle_activite"])
        typ = clean_text(r["type"])
        if not code_metier or not code_activite or not libelle:
            continue
        rows.append((
            clean_code(r["id"]),
            code_metier,
            code_activite,
            libelle,
            clean_text(r["libelle_up_activite"]),
            typ,
            clean_bool(r["actif"]),
        ))
    return rows


def rows_competences(df: pd.DataFrame) -> List[Tuple[Any, ...]]:
    required = ["id", "code_metier", "code_competence", "libelle_competence", "libelle_up_competence", "type", "actif"]
    assert_columns(df, SHEET_COMPETENCES, required)
    rows = []
    for _, r in df.iterrows():
        code_metier = clean_code(r["code_metier"])
        code_competence = clean_code(r["code_competence"])
        libelle = clean_text(r["libelle_competence"])
        typ = clean_text(r["type"])
        if not code_metier or not code_competence or not libelle:
            continue
        rows.append((
            clean_code(r["id"]),
            code_metier,
            code_competence,
            libelle,
            clean_text(r["libelle_up_competence"]),
            typ,
            clean_bool(r["actif"]),
        ))
    return rows


def rows_environnements(df: pd.DataFrame) -> List[Tuple[Any, ...]]:
    required = ["id", "metier", "environnement", "libelle", "libelle_up", "type", "actif"]
    assert_columns(df, SHEET_ENVIRONNEMENTS, required)
    rows = []
    for _, r in df.iterrows():
        code_metier = clean_code(r["metier"])
        code_env = clean_code(r["environnement"])
        libelle = clean_text(r["libelle"])
        typ = clean_text(r["type"])
        if not code_metier or not code_env or not libelle:
            continue
        rows.append((
            clean_code(r["id"]),
            code_metier,
            code_env,
            libelle,
            clean_text(r["libelle_up"]),
            typ,
            clean_bool(r["actif"]),
        ))
    return rows


def rows_mobilites(df: pd.DataFrame) -> List[Tuple[Any, ...]]:
    col_cible = "code_metier_mobilte_professionnelle"
    if col_cible not in df.columns:
        candidates = [c for c in df.columns if c.startswith("code_metier_mobil")]
        if candidates:
            df = df.rename(columns={candidates[0]: col_cible})
    required = ["id", "code_metier", col_cible, "type", "used"]
    assert_columns(df, SHEET_MOBILITES, required)
    rows = []
    for _, r in df.iterrows():
        code_metier = clean_code(r["code_metier"])
        code_cible = clean_code(r[col_cible])
        typ = clean_text(r["type"])
        if not code_metier or not code_cible:
            continue
        rows.append((
            clean_code(r["id"]),
            code_metier,
            code_cible,
            typ,
            clean_bool(r["used"]),
        ))
    return rows


def rows_savoir_etre(df: pd.DataFrame) -> List[Tuple[Any, ...]]:
    required = ["id", "code_savoir_etre", "libelle_savoir_etre", "libelle_up_etre", "actif"]
    assert_columns(df, SHEET_SAVOIR_ETRE, required)
    rows = []
    for _, r in df.iterrows():
        code = clean_code(r["code_savoir_etre"])
        libelle = clean_text(r["libelle_savoir_etre"])
        if not code or not libelle:
            continue
        rows.append((
            clean_code(r["id"]),
            code,
            libelle,
            clean_text(r["libelle_up_etre"]),
            clean_bool(r["actif"]),
        ))
    return rows


def execute_upsert(conn, sql: str, rows: List[Tuple[Any, ...]], label: str, page_size: int = 1000) -> None:
    if not rows:
        print(f"{label}: 0 ligne à insérer")
        return
    with conn.cursor() as cur:
        execute_values(cur, sql, rows, page_size=page_size)
    print(f"{label}: {len(rows)} lignes traitées")


def truncate_rtmc(conn) -> None:
    with conn.cursor() as cur:
        cur.execute("""
            TRUNCATE TABLE
                taxonomy.rtmc_mobilites,
                taxonomy.rtmc_environnements,
                taxonomy.rtmc_savoir_competences,
                taxonomy.rtmc_savoir_faire_activites,
                taxonomy.rtmc_appellations,
                taxonomy.rtmc_savoir_etre,
                taxonomy.rtmc_metiers
            RESTART IDENTITY CASCADE;
        """)


def load_rtmc(excel_path: str, database_url: str, truncate: bool = False) -> None:
    xls = pd.ExcelFile(excel_path)
    missing_sheets = [s for s in EXPECTED_SHEETS if s not in xls.sheet_names]
    if missing_sheets:
        raise ValueError(f"Feuilles manquantes dans le fichier RTMC: {missing_sheets}. Feuilles trouvées: {xls.sheet_names}")

    conn = psycopg2.connect(database_url)
    try:
        conn.autocommit = False
        if truncate:
            truncate_rtmc(conn)
            print("Tables RTMC vidées avant import")

        metiers = rows_metiers(read_sheet(excel_path, SHEET_METIERS))
        execute_upsert(conn, """
            INSERT INTO taxonomy.rtmc_metiers (
                source_id, code_metier, libelle_metier, libelle_up_metier,
                code_grand_domaine_professionnel, libelle_grand_domaine_professionnel,
                code_domaine_professionnel, libelle_domaine_professionnel, actif
            ) VALUES %s
            ON CONFLICT (code_metier) DO UPDATE SET
                source_id = EXCLUDED.source_id,
                libelle_metier = EXCLUDED.libelle_metier,
                libelle_up_metier = EXCLUDED.libelle_up_metier,
                code_grand_domaine_professionnel = EXCLUDED.code_grand_domaine_professionnel,
                libelle_grand_domaine_professionnel = EXCLUDED.libelle_grand_domaine_professionnel,
                code_domaine_professionnel = EXCLUDED.code_domaine_professionnel,
                libelle_domaine_professionnel = EXCLUDED.libelle_domaine_professionnel,
                actif = EXCLUDED.actif,
                updated_at = now()
        """, metiers, "Métiers")

        appellations = rows_appellations(read_sheet(excel_path, SHEET_APPELLATIONS))
        execute_upsert(conn, """
            INSERT INTO taxonomy.rtmc_appellations (
                source_id, code_appellation, libelle_appellation,
                libelle_up_appellation, code_metier, actif
            ) VALUES %s
            ON CONFLICT (code_appellation) DO UPDATE SET
                source_id = EXCLUDED.source_id,
                libelle_appellation = EXCLUDED.libelle_appellation,
                libelle_up_appellation = EXCLUDED.libelle_up_appellation,
                code_metier = EXCLUDED.code_metier,
                actif = EXCLUDED.actif,
                updated_at = now()
        """, appellations, "Appellations")

        activites = rows_activites(read_sheet(excel_path, SHEET_ACTIVITES))
        execute_upsert(conn, """
            INSERT INTO taxonomy.rtmc_savoir_faire_activites (
                source_id, code_metier, code_activite, libelle_activite,
                libelle_up_activite, type, actif
            ) VALUES %s
            ON CONFLICT ON CONSTRAINT uq_rtmc_activites_metier_code_type DO UPDATE SET
                source_id = EXCLUDED.source_id,
                libelle_activite = EXCLUDED.libelle_activite,
                libelle_up_activite = EXCLUDED.libelle_up_activite,
                actif = EXCLUDED.actif,
                updated_at = now()
        """, activites, "Savoir-faire / activités")

        competences = rows_competences(read_sheet(excel_path, SHEET_COMPETENCES))
        execute_upsert(conn, """
            INSERT INTO taxonomy.rtmc_savoir_competences (
                source_id, code_metier, code_competence, libelle_competence,
                libelle_up_competence, type, actif
            ) VALUES %s
            ON CONFLICT ON CONSTRAINT uq_rtmc_competences_metier_code_type DO UPDATE SET
                source_id = EXCLUDED.source_id,
                libelle_competence = EXCLUDED.libelle_competence,
                libelle_up_competence = EXCLUDED.libelle_up_competence,
                actif = EXCLUDED.actif,
                updated_at = now()
        """, competences, "Savoir / compétences")

        environnements = rows_environnements(read_sheet(excel_path, SHEET_ENVIRONNEMENTS))
        execute_upsert(conn, """
            INSERT INTO taxonomy.rtmc_environnements (
                source_id, code_metier, code_environnement, libelle,
                libelle_up, type, actif
            ) VALUES %s
            ON CONFLICT ON CONSTRAINT uq_rtmc_environnements_metier_code_type DO UPDATE SET
                source_id = EXCLUDED.source_id,
                libelle = EXCLUDED.libelle,
                libelle_up = EXCLUDED.libelle_up,
                actif = EXCLUDED.actif,
                updated_at = now()
        """, environnements, "Environnements")

        mobilites = rows_mobilites(read_sheet(excel_path, SHEET_MOBILITES))
        execute_upsert(conn, """
            INSERT INTO taxonomy.rtmc_mobilites (
                source_id, code_metier, code_metier_mobilite_professionnelle,
                type, used
            ) VALUES %s
            ON CONFLICT ON CONSTRAINT uq_rtmc_mobilites_metier_cible_type DO UPDATE SET
                source_id = EXCLUDED.source_id,
                used = EXCLUDED.used,
                updated_at = now()
        """, mobilites, "Mobilités")

        savoir_etre = rows_savoir_etre(read_sheet(excel_path, SHEET_SAVOIR_ETRE))
        execute_upsert(conn, """
            INSERT INTO taxonomy.rtmc_savoir_etre (
                source_id, code_savoir_etre, libelle_savoir_etre,
                libelle_up_etre, actif
            ) VALUES %s
            ON CONFLICT (code_savoir_etre) DO UPDATE SET
                source_id = EXCLUDED.source_id,
                libelle_savoir_etre = EXCLUDED.libelle_savoir_etre,
                libelle_up_etre = EXCLUDED.libelle_up_etre,
                actif = EXCLUDED.actif,
                updated_at = now()
        """, savoir_etre, "Savoir-être")

        conn.commit()
        print("Import RTMC terminé avec succès")
    except Exception:
        conn.rollback()
        print("Erreur: import annulé, transaction rollback", file=sys.stderr)
        raise
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Importer RTMC.xlsx dans les tables taxonomy.rtmc_* PostgreSQL")
    parser.add_argument("--excel", required=True, help="Chemin vers RTMC.xlsx")
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL"), help="URL PostgreSQL. Sinon variable env DATABASE_URL")
    parser.add_argument("--truncate", action="store_true", help="Vider les tables RTMC avant import")
    args = parser.parse_args()

    if not args.database_url:
        raise SystemExit("DATABASE_URL manquant. Passe --database-url ou définis la variable d'environnement DATABASE_URL")

    load_rtmc(args.excel, args.database_url, args.truncate)


if __name__ == "__main__":
    main()
