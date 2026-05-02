#!/usr/bin/env python3
"""
Load ANETI reference tables from data.xlsb into PostgreSQL.

Expected schemas/tables:
  taxonomy.ref_regime_travail
  taxonomy.ref_n_delegat
  taxonomy.ref_n_gouvern
  taxonomy.ref_type_offre
  taxonomy.ref_situation_offre
  taxonomy.ref_diplomes
  taxonomy.ref_specialites
  taxonomy.ref_niveau_instruction
  taxonomy.ref_n_activit
  taxonomy.ref_v_sectact
  taxonomy.ref_type_pae
  taxonomy.ref_segmentation
  taxonomy.ref_certifications
  taxonomy.ref_genre
  taxonomy.ref_type_permis
  taxonomy.ref_type_contrat
  taxonomy.ref_type_handicap
  taxonomy.ref_degre_handicap
  taxonomy.ref_organisation_temps_travail

Usage:
  python load_aneti_referentials.py --excel ./data.xlsb --database-url "postgresql://user:pass@host:5432/db"
  python load_aneti_referentials.py --excel ./data.xlsb --database-url "..." --truncate
"""

from __future__ import annotations

import argparse
import math
import sys
import unicodedata
from dataclasses import dataclass
from typing import Any, Iterable

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values


@dataclass(frozen=True)
class SheetMapping:
    sheet: str
    table: str
    code_col: str
    label_col: str
    excel_code_col: str | None = None
    excel_label_col: str | None = None
    extra_cols: tuple[str, ...] = ()


# Important: n_gouvern is loaded before n_delegat because n_delegat can reference it.
MAPPINGS: list[SheetMapping] = [
    SheetMapping("n_gouvern", "ref_n_gouvern", "code_gouvernorat", "libelle_gouvernorat"),
    SheetMapping("n_delegat", "ref_n_delegat", "code_delegation", "libelle_delegation", extra_cols=("code_gouvernorat",)),
    SheetMapping("régime travail", "ref_regime_travail", "code", "libelle"),
    SheetMapping("organisation temps travail", "ref_organisation_temps_travail", "code", "libelle"),
    SheetMapping("type offre", "ref_type_offre", "code", "libelle"),
    SheetMapping("situation offre", "ref_situation_offre", "code", "libelle"),
    SheetMapping("diplômes", "ref_diplomes", "code_diplome", "libelle_diplome"),
    SheetMapping("spécialités", "ref_specialites", "code_specialite", "libelle_specialite"),
    SheetMapping("niveau_instruction", "ref_niveau_instruction", "code_niveau_instruction", "libelle_niveau_instruction"),
    SheetMapping("n_activit", "ref_n_activit", "code_activite", "libelle_activite"),
    SheetMapping("v_sectact", "ref_v_sectact", "code_secteur", "libelle_secteur"),
    SheetMapping("Type PAE", "ref_type_pae", "code", "libelle", excel_code_col="CIVP", excel_label_col="CIVP"),
    SheetMapping("segmentation", "ref_segmentation", "code_segmentation", "libelle_segmentation"),
    SheetMapping("certifications", "ref_certifications", "code_certification", "libelle_certification"),
    SheetMapping("genre", "ref_genre", "code_genre", "libelle_genre"),
    SheetMapping("type permis", "ref_type_permis", "code_permis", "libelle_permis"),
    SheetMapping("type contrat", "ref_type_contrat", "code_contrat", "libelle_contrat"),
    SheetMapping("type handicap", "ref_type_handicap", "code_handicap", "libelle_handicap"),
    SheetMapping("degré handicap", "ref_degre_handicap", "code_degre_handicap", "libelle_degre_handicap"),
]

TRUNCATE_ORDER = [m.table for m in reversed(MAPPINGS)]


def normalize_header(value: Any) -> str:
    text = str(value).strip().lower()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.replace("’", "'").replace("`", "'")
    text = text.replace(" ", "_")
    return text


def clean_text(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    text = str(value).strip()
    if text == "" or text.lower() == "nan":
        return None
    # Excel sometimes gives numeric codes as 1.0. Keep 1 instead of 1.0.
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return text


def find_column(df: pd.DataFrame, preferred: str | None, fallback_names: Iterable[str]) -> str:
    normalized_to_original = {normalize_header(c): c for c in df.columns}

    if preferred:
        preferred_key = normalize_header(preferred)
        if preferred_key in normalized_to_original:
            return normalized_to_original[preferred_key]

    for name in fallback_names:
        key = normalize_header(name)
        if key in normalized_to_original:
            return normalized_to_original[key]

    raise KeyError(
        f"Column not found. Tried preferred={preferred!r}, fallbacks={list(fallback_names)!r}. "
        f"Available columns={list(df.columns)!r}"
    )


def get_existing_governorate_codes(conn) -> set[str]:
    with conn.cursor() as cur:
        cur.execute("SELECT code_gouvernorat FROM taxonomy.ref_n_gouvern")
        return {row[0] for row in cur.fetchall()}


def derive_governorate_code(delegation_code: str, governorate_codes: set[str]) -> str | None:
    """
    In n_delegat, Tunisian delegation codes look like 1111, 1251, 8358, etc.
    Governorate code is normally the first 2 characters: 11, 12, 83, etc.
    Foreign/special codes like 2, 3, 9999 do not necessarily map to a governorate.
    """
    if not delegation_code:
        return None
    candidate = delegation_code[:2]
    if candidate in governorate_codes:
        return candidate
    return None


def read_rows(excel_path: str, mapping: SheetMapping, conn) -> list[tuple[Any, ...]]:
    df = pd.read_excel(excel_path, sheet_name=mapping.sheet, engine="pyxlsb")
    df = df.dropna(how="all")

    code_excel_col = find_column(df, mapping.excel_code_col, ["code", "Code", mapping.code_col])
    label_excel_col = find_column(df, mapping.excel_label_col, ["libellé", "Libellé", "libelle", mapping.label_col])

    governorate_codes: set[str] = set()
    if mapping.table == "ref_n_delegat":
        governorate_codes = get_existing_governorate_codes(conn)

    rows: list[tuple[Any, ...]] = []
    skipped = 0

    for _, row in df.iterrows():
        code = clean_text(row.get(code_excel_col))
        label = clean_text(row.get(label_excel_col))

        if not code or not label:
            skipped += 1
            continue

        if mapping.table == "ref_n_delegat":
            code_gouvernorat = derive_governorate_code(code, governorate_codes)
            rows.append((code, label, code_gouvernorat))
        else:
            rows.append((code, label))

    rows = deduplicate(rows, key_indexes=[0], label=mapping.table)

    if skipped:
        print(f"{mapping.sheet}: {skipped} lignes ignorées (code/libellé manquant)")

    return rows


def deduplicate(rows: list[tuple[Any, ...]], key_indexes: list[int], label: str) -> list[tuple[Any, ...]]:
    seen: dict[tuple[Any, ...], tuple[Any, ...]] = {}
    duplicates = 0
    for row in rows:
        key = tuple(row[i] for i in key_indexes)
        if key in seen:
            duplicates += 1
        # Keep last occurrence; usually safest for corrected rows later in the sheet.
        seen[key] = row
    if duplicates:
        print(f"{label}: {duplicates} doublons supprimés avant upsert")
    return list(seen.values())


def upsert_rows(conn, mapping: SheetMapping, rows: list[tuple[Any, ...]], page_size: int = 1000) -> None:
    if not rows:
        print(f"{mapping.table}: 0 ligne à importer")
        return

    columns = [mapping.code_col, mapping.label_col, *mapping.extra_cols]
    quoted_cols = ", ".join(columns)
    update_cols = [c for c in columns if c != mapping.code_col]
    set_clause = ", ".join([f"{c} = EXCLUDED.{c}" for c in update_cols])
    set_clause += ", updated_at = now()"

    sql = f"""
        INSERT INTO taxonomy.{mapping.table} ({quoted_cols})
        VALUES %s
        ON CONFLICT ({mapping.code_col}) DO UPDATE
        SET {set_clause}
    """

    with conn.cursor() as cur:
        execute_values(cur, sql, rows, page_size=page_size)

    print(f"{mapping.sheet} -> taxonomy.{mapping.table}: {len(rows)} lignes importées / mises à jour")


def truncate_tables(conn) -> None:
    print("TRUNCATE des référentiels ANETI...")
    with conn.cursor() as cur:
        # CASCADE because n_delegat references n_gouvern.
        for table in TRUNCATE_ORDER:
            cur.execute(f"TRUNCATE TABLE taxonomy.{table} RESTART IDENTITY CASCADE")


def load_referentials(excel_path: str, database_url: str, truncate: bool = False) -> None:
    conn = psycopg2.connect(database_url)
    try:
        conn.autocommit = False
        if truncate:
            truncate_tables(conn)

        for mapping in MAPPINGS:
            rows = read_rows(excel_path, mapping, conn)
            upsert_rows(conn, mapping, rows)

        conn.commit()
        print("Import terminé avec succès.")
    except Exception:
        conn.rollback()
        print("Erreur: import annulé, transaction rollback", file=sys.stderr)
        raise
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Load ANETI reference tables from data.xlsb")
    parser.add_argument("--excel", required=True, help="Path to data.xlsb")
    parser.add_argument("--database-url", required=True, help="PostgreSQL DSN/URL")
    parser.add_argument("--truncate", action="store_true", help="Truncate target tables before import")
    args = parser.parse_args()

    load_referentials(args.excel, args.database_url, args.truncate)


if __name__ == "__main__":
    main()
