#!/usr/bin/env python3
"""
Import mondial des divisions administratives dans geo.admin_unit à partir de GeoNames.

Source principale : https://download.geonames.org/export/dump/
Fichiers utilisés : allCountries.zip, alternateNamesV2.zip optionnel.
Licence GeoNames : Creative Commons Attribution 4.0.

Usage rapide :
    pip install "psycopg[binary]"
    set DATABASE_URL=postgresql://user:password@host:5432/dbname   # Windows PowerShell: $env:DATABASE_URL="..."
    python 004_import_geo_admin_unit_geonames.py --max-level 3

Options utiles :
    --max-level 2                  importe ADM1 + ADM2 seulement
    --max-level 3                  importe ADM1 + ADM2 + ADM3, recommandé
    --max-level 4                  importe jusqu'à ADM4, plus lourd
    --with-alt-names               enrichit label_fr/label_en/label_ar si GeoNames fournit des noms alternatifs
    --countries TN FR US CA IT     limite l'import à certains pays
    --dry-run                      ne modifie pas la base
"""

from __future__ import annotations

import argparse
import csv
from html import parser
import json
import os
import re
import sys
import time
import traceback
import unicodedata
import urllib.request
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError as exc:
    print("Missing dependency: psycopg. Install it with: pip install 'psycopg[binary]'", file=sys.stderr)
    raise

GEONAMES_BASE_URL = "https://download.geonames.org/export/dump"
ALL_COUNTRIES_ZIP = "allCountries.zip"
ALL_COUNTRIES_TXT = "allCountries.txt"
ALTERNATE_NAMES_ZIP = "alternateNamesV2.zip"
ALTERNATE_NAMES_TXT = "alternateNamesV2.txt"

FEATURE_TO_LEVEL = {
    "ADM1": 1,
    "ADM2": 2,
    "ADM3": 3,
    "ADM4": 4,
}

# Fallback propre. Si geo.country_admin_structure existe et contient un unit_type
# pour le pays/niveau, il sera utilisé à la place.
DEFAULT_UNIT_TYPE_BY_LEVEL = {
    1: "ADM1",
    2: "ADM2",
    3: "ADM3",
    4: "ADM4",
}

SOURCE_METADATA = {
    "provider": "GeoNames",
    "provider_url": "https://www.geonames.org/",
    "download_url": f"{GEONAMES_BASE_URL}/{ALL_COUNTRIES_ZIP}",
    "feature_codes_url": "https://www.geonames.org/export/codes.html",
    "license": "Creative Commons Attribution 4.0",
    "license_url": "https://creativecommons.org/licenses/by/4.0/",
    "note": "GeoNames data is provided as-is without warranty of accuracy, timeliness or completeness.",
}


@dataclass(frozen=True)
class AdminUnitRecord:
    geoname_id: str
    country_iso2: str
    code: str
    parent_code: Optional[str]
    label: str
    ascii_label: str
    latitude: Optional[float]
    longitude: Optional[float]
    admin_level: int
    feature_code: str
    admin1_code: str
    admin2_code: str
    admin3_code: str
    admin4_code: str
    modification_date: str


def download_if_needed(url: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and destination.stat().st_size > 0:
        print(f"OK existing: {destination}")
        return
    print(f"Downloading {url} -> {destination}")
    urllib.request.urlretrieve(url, destination)


def extract_if_needed(zip_path: Path, member_name: str, destination_dir: Path) -> Path:
    destination = destination_dir / member_name
    if destination.exists() and destination.stat().st_size > 0:
        print(f"OK existing: {destination}")
        return destination
    print(f"Extracting {member_name} from {zip_path}")
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extract(member_name, destination_dir)
    return destination


def normalize_label(value: str) -> str:
    if not value:
        return ""
    value = unicodedata.normalize("NFKD", value)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = re.sub(r"\s+", " ", value).strip()
    return value.upper()


def parse_float(value: str) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except ValueError:
        return None


def build_code(country_iso2: str, level: int, admin1: str, admin2: str, admin3: str, admin4: str, geoname_id: str) -> str:
    parts = []
    if level >= 1:
        parts.append(admin1 or f"G{geoname_id}")
    if level >= 2:
        parts.append(admin2 or f"G{geoname_id}")
    if level >= 3:
        parts.append(admin3 or f"G{geoname_id}")
    if level >= 4:
        parts.append(admin4 or f"G{geoname_id}")
    return ".".join(parts)


def build_parent_code(level: int, admin1: str, admin2: str, admin3: str) -> Optional[str]:
    if level == 1:
        return None
    if level == 2:
        return admin1 or None
    if level == 3:
        if admin1 and admin2:
            return f"{admin1}.{admin2}"
        return None
    if level == 4:
        if admin1 and admin2 and admin3:
            return f"{admin1}.{admin2}.{admin3}"
        return None
    return None


def iter_admin_records(all_countries_txt: Path, max_level: int, countries: Optional[set[str]]) -> Iterable[AdminUnitRecord]:
    with all_countries_txt.open("r", encoding="utf-8", newline="") as f:
        reader = csv.reader(f, delimiter="\t")
        for row in reader:
            if len(row) < 19:
                continue
            (
                geoname_id,
                name,
                asciiname,
                alternatenames,
                latitude,
                longitude,
                feature_class,
                feature_code,
                country_code,
                cc2,
                admin1_code,
                admin2_code,
                admin3_code,
                admin4_code,
                population,
                elevation,
                dem,
                timezone,
                modification_date,
            ) = row[:19]

            if feature_class != "A" or feature_code not in FEATURE_TO_LEVEL:
                continue
            level = FEATURE_TO_LEVEL[feature_code]
            if level > max_level:
                continue
            country_iso2 = country_code.upper().strip()
            if not country_iso2:
                continue
            if countries and country_iso2 not in countries:
                continue

            code = build_code(country_iso2, level, admin1_code, admin2_code, admin3_code, admin4_code, geoname_id)
            parent_code = build_parent_code(level, admin1_code, admin2_code, admin3_code)

            yield AdminUnitRecord(
                geoname_id=geoname_id,
                country_iso2=country_iso2,
                code=code,
                parent_code=parent_code,
                label=name,
                ascii_label=asciiname or name,
                latitude=parse_float(latitude),
                longitude=parse_float(longitude),
                admin_level=level,
                feature_code=feature_code,
                admin1_code=admin1_code,
                admin2_code=admin2_code,
                admin3_code=admin3_code,
                admin4_code=admin4_code,
                modification_date=modification_date,
            )


def choose_better_alt(current: Optional[Tuple[str, int]], name: str, preferred: str, short: str, historic: str) -> Tuple[str, int]:
    # Score simple : preferred > short > ordinary; historic est évité.
    score = 0
    if historic == "1":
        score -= 100
    if preferred == "1":
        score += 20
    if short == "1":
        score += 10
    if current is None or score > current[1]:
        return (name, score)
    return current


def load_alternate_names(alternate_names_txt: Path, target_geoname_ids: set[str]) -> Dict[str, Dict[str, str]]:
    print("Loading alternate names for fr/en/ar. This can take several minutes...")
    selected: Dict[str, Dict[str, Tuple[str, int]]] = {}
    languages = {"fr", "en", "ar"}

    with alternate_names_txt.open("r", encoding="utf-8", newline="") as f:
        reader = csv.reader(f, delimiter="\t")
        for row in reader:
            if len(row) < 8:
                continue
            alt_id, geoname_id, language, alt_name, preferred, short, colloquial, historic = row[:8]
            language = (language or "").lower().strip()
            if geoname_id not in target_geoname_ids or language not in languages:
                continue
            if not alt_name:
                continue
            by_lang = selected.setdefault(geoname_id, {})
            by_lang[language] = choose_better_alt(by_lang.get(language), alt_name, preferred, short, historic)

    return {gid: {lang: val_score[0] for lang, val_score in langs.items()} for gid, langs in selected.items()}


def fetch_country_ids(conn) -> Dict[str, str]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT id::text AS id, upper(iso2) AS iso2 FROM geo.country WHERE active = true")
        return {row["iso2"]: row["id"] for row in cur.fetchall()}


def fetch_structure_unit_types(conn) -> Dict[Tuple[str, int], str]:
    # La table peut ne pas exister si tu n'as pas encore appliqué le script précédent.
    sql = """
    SELECT c.iso2, s.admin_level, s.unit_type
    FROM geo.country_admin_structure s
    JOIN geo.country c ON c.id = s.country_id
    WHERE s.active = true
    """
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(sql)
            return {(row["iso2"].upper(), int(row["admin_level"])): row["unit_type"] for row in cur.fetchall()}
    except Exception:
        conn.rollback()
        return {}


def ensure_indexes(conn, dry_run: bool) -> None:
    statements = [
        "CREATE INDEX IF NOT EXISTS ix_geo_admin_unit_country_level ON geo.admin_unit(country_id, admin_level)",
        "CREATE INDEX IF NOT EXISTS ix_geo_admin_unit_parent ON geo.admin_unit(parent_id)",
        "CREATE INDEX IF NOT EXISTS ix_geo_admin_unit_external_source ON geo.admin_unit(source, external_code)",
        "CREATE INDEX IF NOT EXISTS ix_geo_admin_unit_normalized_label ON geo.admin_unit(normalized_label)",
    ]
    unique_stmt = "CREATE UNIQUE INDEX IF NOT EXISTS ux_geo_admin_unit_country_code ON geo.admin_unit(country_id, code)"
    if dry_run:
        print("DRY RUN: indexes would be created if missing")
        return
    with conn.cursor() as cur:
        for stmt in statements:
            cur.execute(stmt)
        # Peut échouer si la base contient déjà des doublons country_id/code.
        # C'est volontaire : il vaut mieux nettoyer les doublons avant l'upsert.
        cur.execute(unique_stmt)
    conn.commit()


def upsert_records(
    conn,
    records: Sequence[AdminUnitRecord],
    country_ids: Dict[str, str],
    unit_types: Dict[Tuple[str, int], str],
    alt_names: Dict[str, Dict[str, str]],
    dry_run: bool,
    commit_every: int = 1000,
    progress_every: int = 500,
    resume_skip_existing: bool = False,
    max_new_rows: int = 0,
) -> int:
    known_records = [r for r in records if r.country_iso2 in country_ids]
    unknown_country_count = len(records) - len(known_records)

    if dry_run:
        print(f"DRY RUN: would upsert {len(known_records)} records")
        if unknown_country_count:
            print(f"DRY RUN: skipped {unknown_country_count} records because country ISO2 is missing in geo.country")
        return len(known_records)

    print("=" * 90)
    print("GeoNames import / upsert started")
    print(f"Total parsed records          : {len(records)}")
    print(f"Known-country records         : {len(known_records)}")
    print(f"Skipped unknown-country rows  : {unknown_country_count}")
    print(f"Commit every                  : {commit_every}")
    print(f"Progress every                : {progress_every}")
    print("=" * 90)

    # On traite par niveau pour insérer les parents avant les enfants.
    records_by_level = sorted(known_records, key=lambda r: (r.admin_level, r.country_iso2, r.code))

    counts_by_level: Dict[int, int] = {}
    for r in records_by_level:
        counts_by_level[r.admin_level] = counts_by_level.get(r.admin_level, 0) + 1

    print("Records by level:")
    for level in sorted(counts_by_level):
        print(f"  ADM{level}: {counts_by_level[level]}")

    inserted_or_updated = 0
    batch_counter = 0
    started_at = time.time()

    # cache local des IDs après insertion : (country_iso2, code) -> id
    id_cache: Dict[Tuple[str, str], str] = {}
    
    existing_geonames_keys: set[Tuple[str, str]] = set()
    print("Loading existing geo.admin_unit IDs into local cache...")
    
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("""
            SELECT
                c.iso2,
                au.code,
                au.id::text AS id,
                au.source
            FROM geo.admin_unit au
            JOIN geo.country c ON c.id = au.country_id
        """)

        for row in cur.fetchall():
            key = (row["iso2"].upper(), row["code"])
            id_cache[key] = row["id"]

            if row.get("source") == "GEONAMES":
                existing_geonames_keys.add(key)

    print(f"Existing ID cache loaded: {len(id_cache)} entries")

    sql = """
    INSERT INTO geo.admin_unit (
        country_id,
        parent_id,
        code,
        label,
        normalized_label,
        label_fr,
        label_en,
        label_ar,
        admin_level,
        unit_type,
        latitude,
        longitude,
        active,
        source,
        external_code,
        metadata_json
    )
    VALUES (
        %(country_id)s,
        %(parent_id)s,
        %(code)s,
        %(label)s,
        %(normalized_label)s,
        %(label_fr)s,
        %(label_en)s,
        %(label_ar)s,
        %(admin_level)s,
        %(unit_type)s,
        %(latitude)s,
        %(longitude)s,
        true,
        'GEONAMES',
        %(external_code)s,
        %(metadata_json)s::jsonb
    )
    ON CONFLICT (country_id, code) DO UPDATE SET
        parent_id = EXCLUDED.parent_id,
        label = EXCLUDED.label,
        normalized_label = EXCLUDED.normalized_label,
        label_fr = COALESCE(EXCLUDED.label_fr, geo.admin_unit.label_fr),
        label_en = COALESCE(EXCLUDED.label_en, geo.admin_unit.label_en),
        label_ar = COALESCE(EXCLUDED.label_ar, geo.admin_unit.label_ar),
        admin_level = EXCLUDED.admin_level,
        unit_type = EXCLUDED.unit_type,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        active = true,
        source = 'GEONAMES',
        external_code = EXCLUDED.external_code,
        metadata_json = COALESCE(geo.admin_unit.metadata_json, '{}'::jsonb) || EXCLUDED.metadata_json,
        updated_at = now()
    RETURNING id::text
    """

    last_record: Optional[AdminUnitRecord] = None

    try:
        with conn.cursor(row_factory=dict_row) as cur:
            current_level = None

            for idx, r in enumerate(records_by_level, start=1):
                last_record = r

                key = (r.country_iso2, r.code)
                if resume_skip_existing and key in existing_geonames_keys:
                    if idx % progress_every == 0:
                        print(
                            f"[SKIP] {idx}/{len(records_by_level)} already imported "
                            f"| ADM{r.admin_level} "
                            f"| country={r.country_iso2} "
                            f"| code={r.code} "
                            f"| geoname_id={r.geoname_id} "
                            f"| label={r.label}"
                        )
                    continue

                if current_level != r.admin_level:
                    current_level = r.admin_level
                    print()
                    print("-" * 90)
                    print(f"Starting ADM{current_level}")
                    print("-" * 90)

                country_id = country_ids.get(r.country_iso2)
                if not country_id:
                    continue

                parent_id = None
                if r.parent_code:
                    parent_id = id_cache.get((r.country_iso2, r.parent_code))

                unit_type = unit_types.get(
                    (r.country_iso2, r.admin_level),
                    DEFAULT_UNIT_TYPE_BY_LEVEL[r.admin_level]
                )

                alts = alt_names.get(r.geoname_id, {})
                label_en = alts.get("en") or r.ascii_label or r.label
                label_fr = alts.get("fr")
                label_ar = alts.get("ar")

                metadata = {
                    **SOURCE_METADATA,
                    "geoname_id": r.geoname_id,
                    "feature_code": r.feature_code,
                    "country_iso2": r.country_iso2,
                    "admin1_code": r.admin1_code,
                    "admin2_code": r.admin2_code,
                    "admin3_code": r.admin3_code,
                    "admin4_code": r.admin4_code,
                    "modification_date": r.modification_date,
                    "parent_code": r.parent_code,
                    "import_script": "004_import_geo_admin_unit_geonames.py",
                    "import_max_level_record": r.admin_level,
                }

                params = {
                    "country_id": country_id,
                    "parent_id": parent_id,
                    "code": r.code,
                    "label": r.label,
                    "normalized_label": normalize_label(r.label),
                    "label_fr": label_fr,
                    "label_en": label_en,
                    "label_ar": label_ar,
                    "admin_level": r.admin_level,
                    "unit_type": unit_type,
                    "latitude": r.latitude,
                    "longitude": r.longitude,
                    "external_code": r.geoname_id,
                    "metadata_json": json.dumps(metadata, ensure_ascii=False),
                }

                cur.execute(sql, params)
                new_id = cur.fetchone()["id"]

                id_cache[(r.country_iso2, r.code)] = new_id
                inserted_or_updated += 1
                batch_counter += 1

                existing_geonames_keys.add((r.country_iso2, r.code))

                if max_new_rows > 0 and inserted_or_updated >= max_new_rows:
                    conn.commit()
                    print(
                        f"[STOP] max_new_rows reached: {inserted_or_updated}. "
                        f"Committed and exiting cleanly."
                    )
                    return inserted_or_updated

                if inserted_or_updated % progress_every == 0:
                    elapsed = time.time() - started_at
                    rate = inserted_or_updated / elapsed if elapsed > 0 else 0
                    print(
                        f"[PROGRESS] {inserted_or_updated}/{len(records_by_level)} "
                        f"| ADM{r.admin_level} "
                        f"| country={r.country_iso2} "
                        f"| code={r.code} "
                        f"| geoname_id={r.geoname_id} "
                        f"| label={r.label} "
                        f"| rate={rate:.1f} rows/s"
                    )

                if batch_counter >= commit_every:
                    conn.commit()
                    print(
                        f"[COMMIT] committed {inserted_or_updated}/{len(records_by_level)} "
                        f"| last ADM{r.admin_level} "
                        f"| {r.country_iso2}/{r.code} "
                        f"| geoname_id={r.geoname_id} "
                        f"| label={r.label}"
                    )
                    batch_counter = 0

        conn.commit()
        print(f"[FINAL COMMIT] committed all records: {inserted_or_updated}")

    except Exception as exc:
        print()
        print("=" * 90)
        print("ERROR during GeoNames upsert")
        print("=" * 90)
        print(f"Inserted/updated before failure: {inserted_or_updated}")
        print(f"Exception type: {type(exc).__name__}")
        print(f"Exception message: {exc}")

        if last_record is not None:
            print("Last record being processed:")
            print(f"  geoname_id     : {last_record.geoname_id}")
            print(f"  country_iso2   : {last_record.country_iso2}")
            print(f"  admin_level    : {last_record.admin_level}")
            print(f"  feature_code   : {last_record.feature_code}")
            print(f"  code           : {last_record.code}")
            print(f"  parent_code    : {last_record.parent_code}")
            print(f"  label          : {last_record.label}")
            print(f"  admin1_code    : {last_record.admin1_code}")
            print(f"  admin2_code    : {last_record.admin2_code}")
            print(f"  admin3_code    : {last_record.admin3_code}")
            print(f"  admin4_code    : {last_record.admin4_code}")

        print("Traceback:")
        traceback.print_exc()

        try:
            conn.rollback()
        except Exception:
            pass

        raise

    return inserted_or_updated

def main() -> None:
    parser = argparse.ArgumentParser(description="Import GeoNames ADM1-ADM4 into geo.admin_unit")
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL"), help="PostgreSQL URL. Defaults to DATABASE_URL env var.")
    parser.add_argument("--data-dir", default="infra/db/data/geonames", help="Folder for downloaded GeoNames files")
    parser.add_argument("--max-level", type=int, default=3, choices=[1, 2, 3, 4], help="Maximum ADM level to import")
    parser.add_argument("--with-alt-names", action="store_true", help="Download and parse alternateNamesV2.zip to enrich fr/en/ar labels")
    parser.add_argument("--countries", nargs="*", help="Optional ISO2 country filter, e.g. TN FR US")
    parser.add_argument("--dry-run", action="store_true", help="Parse and count only, do not write to DB")
    parser.add_argument("--commit-every", type=int, default=1000, help="Commit every N upserted rows")
    parser.add_argument("--progress-every", type=int, default=500, help="Print progress every N upserted rows")
    parser.add_argument(
        "--resume-skip-existing",
        action="store_true",
        help="Skip rows already imported from GEONAMES using country/code. Useful after connection cuts."
    )
    parser.add_argument(
        "--max-new-rows",
        type=int,
        default=0,
        help="Stop after N new/upserted rows. 0 = no limit. Useful to import in safe chunks."
    )
    args = parser.parse_args()

    if not args.database_url:
        raise SystemExit("DATABASE_URL is missing. Set it or pass --database-url.")

    data_dir = Path(args.data_dir)
    all_zip = data_dir / ALL_COUNTRIES_ZIP
    download_if_needed(f"{GEONAMES_BASE_URL}/{ALL_COUNTRIES_ZIP}", all_zip)
    all_txt = extract_if_needed(all_zip, ALL_COUNTRIES_TXT, data_dir)

    countries = {c.upper() for c in args.countries} if args.countries else None
    records = list(iter_admin_records(all_txt, max_level=args.max_level, countries=countries))
    print(f"Parsed {len(records)} admin records from GeoNames up to ADM{args.max_level}")

    alt_names: Dict[str, Dict[str, str]] = {}
    if args.with_alt_names:
        alt_zip = data_dir / ALTERNATE_NAMES_ZIP
        download_if_needed(f"{GEONAMES_BASE_URL}/{ALTERNATE_NAMES_ZIP}", alt_zip)
        alt_txt = extract_if_needed(alt_zip, ALTERNATE_NAMES_TXT, data_dir)
        target_ids = {r.geoname_id for r in records}
        alt_names = load_alternate_names(alt_txt, target_ids)
        print(f"Loaded alternate names for {len(alt_names)} admin records")

    with psycopg.connect(args.database_url) as conn:
        ensure_indexes(conn, dry_run=args.dry_run)
        country_ids = fetch_country_ids(conn)
        unit_types = fetch_structure_unit_types(conn)
        count = upsert_records(
            conn=conn,
            records=records,
            country_ids=country_ids,
            unit_types=unit_types,
            alt_names=alt_names,
            dry_run=args.dry_run,
            commit_every=args.commit_every,
            progress_every=args.progress_every,
            resume_skip_existing=args.resume_skip_existing,
            max_new_rows=args.max_new_rows,
        )

    print(f"Done. Imported/upserted records: {count}")
    print("Attribution to keep in documentation: Data © GeoNames, licensed under CC BY 4.0, provided as-is.")


if __name__ == "__main__":
    main()
