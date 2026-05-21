#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine, text


SCRIPT_DIR = Path(__file__).parent.resolve()
DEFAULT_INPUT = SCRIPT_DIR.parent / "data" / "geo" / "tn_postal_codes.csv"
DEFAULT_UNMATCHED = SCRIPT_DIR.parent / "data" / "geo" / "tn_postal_codes_unmatched.csv"


# ─────────────────────────────────────────────────────────────
# Normalisation / alias
# ─────────────────────────────────────────────────────────────

def normalize(value: str | None) -> str:
    value = value or ""
    value = str(value).strip().upper()
    value = unicodedata.normalize("NFKD", value)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = value.replace("’", "'").replace("`", "'").replace("–", "-").replace("—", "-")
    value = value.replace("‘", "'").replace("ʿ", "'")
    value = re.sub(r"[^A-Z0-9]+", " ", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def compact(value: str | None) -> str:
    return normalize(value).replace(" ", "")


def strip_admin_words(key: str) -> str:
    key = normalize(key)
    patterns = [
        r"^GOUVERNORAT DE ",
        r"^GOUVERNORAT D ",
        r"^GOUVERNORAT DU ",
        r"^GOUVERNORAT DES ",
        r" GOVERNORATE$",
        r"^DELEGATION DE ",
        r"^DELEGATION D ",
        r"^DELEGATION DU ",
        r"^DELEGATION DES ",
        r"^MUTAMADIYAT ",
        r"^MUTAMADIYAT AN ",
        r"^MUTAMADIYAT EL ",
        r"^MUTAMADIYAT AL ",
    ]
    for p in patterns:
        key = re.sub(p, "", key).strip()
    key = re.sub(r"\s+", " ", key)
    return key


def without_articles(key: str) -> str:
    key = normalize(key)
    words = [w for w in key.split() if w not in {"EL", "LE", "LA", "LES", "L", "AL"}]
    return " ".join(words)


def phonetic_key(key: str) -> str:
    """
    Normalisation souple pour variantes fréquentes entre GeoNames et La Poste.
    Exemples :
    - KHADHRA / KHADRA
    - KALAA / KALÂA / KALAAT
    - JAOUHARA / JAWHARA
    - MOHAMADIA / MOHAMEDIA
    - SOUKRA / LA SOUKRA
    """
    key = normalize(key)
    key = strip_admin_words(key)

    replacements = [
        ("KHADH", "KHAD"),
        ("KADH", "KAD"),
        ("TH", "T"),
        ("DH", "D"),
        ("GH", "G"),
        ("OU", "U"),
        ("OO", "U"),
        ("EE", "I"),
        ("AA", "A"),
        ("KALAA", "KALA"),
        ("KALAAT", "KALA"),
        ("KALAA", "KALA"),
        ("JAOUHARA", "JAWHARA"),
        ("JAWAHRA", "JAWHARA"),
        ("MOHAMADIA", "MOHAMEDIA"),
        ("MUHAMADIA", "MOHAMEDIA"),
        ("SAYADA LAMTA BOU HAJAR", "SAYADA LAMTA BOUHAJAR"),
        ("BOU HAJAR", "BOUHAJAR"),
        ("BOU FICHA", "BOUFICHA"),
        ("BOU MHEL", "BOUMHEL"),
        ("SIDI BOU ZID", "SIDI BOUZID"),
        ("SIDI BOUZID", "SIDI BOUZID"),
        ("GAFSA NORD", "GAFSA NORTH"),
        ("GAFSA SUD", "GAFSA SOUTH"),
    ]

    for src, dst in replacements:
        key = key.replace(src, dst)

    key = without_articles(key)
    key = re.sub(r"\s+", " ", key).strip()
    return key


def alias_keys(value: str | None) -> set[str]:
    base = normalize(value)
    if not base:
        return set()

    keys = {
        base,
        strip_admin_words(base),
        without_articles(base),
        compact(base),
        compact(strip_admin_words(base)),
        compact(without_articles(base)),
        phonetic_key(base),
        compact(phonetic_key(base)),
    }

    # Variantes avec / sans CITE.
    if base.startswith("CITE "):
        keys.add(base.replace("CITE ", "", 1))
        keys.add(compact(base.replace("CITE ", "", 1)))

    # Variantes article en tête.
    for art in ("EL ", "LE ", "LA ", "L "):
        if base.startswith(art):
            stripped = base[len(art):]
            keys.add(stripped)
            keys.add(compact(stripped))
            keys.add(phonetic_key(stripped))
            keys.add(compact(phonetic_key(stripped)))

    # Variantes Sidi Bouzid.
    if "SIDI BOU ZID" in base:
        keys.add(base.replace("SIDI BOU ZID", "SIDI BOUZID"))
    if "SIDI BOUZID" in base:
        keys.add(base.replace("SIDI BOUZID", "SIDI BOU ZID"))

    return {k for k in keys if k}


# ─────────────────────────────────────────────────────────────
# DB / CSV
# ─────────────────────────────────────────────────────────────

def get_database_url() -> str:
    url = os.getenv("DATABASE_URL")
    if not url:
        print("ERREUR : variable DATABASE_URL absente.", file=sys.stderr)
        print("Exemple PowerShell :", file=sys.stderr)
        print('$env:DATABASE_URL="postgresql+psycopg2://user:password@localhost:5432/dbname"', file=sys.stderr)
        sys.exit(1)

    if url.startswith("postgres://"):
        url = "postgresql+psycopg2://" + url[len("postgres://"):]
    elif url.startswith("postgresql://"):
        url = "postgresql+psycopg2://" + url[len("postgresql://"):]
    return url


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))

    if not rows:
        return []

    required = {
        "country_iso2",
        "governorate_label",
        "delegation_label",
        "imada_label",
        "imada_label_ar",
        "postal_code",
        "post_office_label",
        "source",
        "source_url",
    }

    missing = required - set(rows[0].keys())
    if missing:
        raise ValueError(f"Colonnes manquantes dans le CSV : {sorted(missing)}")

    clean_rows: list[dict[str, str]] = []

    for row in rows:
        postal_code = str(row.get("postal_code") or "").strip()
        postal_code = re.sub(r"\D", "", postal_code)

        if not re.fullmatch(r"\d{4}", postal_code):
            continue

        clean_rows.append({
            "country_iso2": (row.get("country_iso2") or "TN").strip().upper(),
            "governorate_label": (row.get("governorate_label") or "").strip(),
            "delegation_label": (row.get("delegation_label") or "").strip(),
            "imada_label": (row.get("imada_label") or "").strip(),
            "imada_label_ar": (row.get("imada_label_ar") or "").strip(),
            "postal_code": postal_code,
            "post_office_label": (row.get("post_office_label") or "").strip(),
            "source": (row.get("source") or "POSTE_TN").strip(),
            "source_url": (row.get("source_url") or "https://www.poste.tn/codes.php").strip(),
        })

    return clean_rows


def load_country(conn, iso2: str) -> dict[str, Any]:
    row = conn.execute(
        text("""
            SELECT id::text AS id, iso2
            FROM geo.country
            WHERE iso2 = :iso2
            LIMIT 1
        """),
        {"iso2": iso2},
    ).mappings().first()

    if not row:
        raise ValueError(f"Pays introuvable dans geo.country : {iso2}")

    return dict(row)


def load_admin_units(conn, country_id: str) -> list[dict[str, Any]]:
    rows = conn.execute(
        text("""
            SELECT
                id::text AS id,
                parent_id::text AS parent_id,
                admin_level,
                code,
                label,
                label_fr,
                label_en,
                label_ar,
                unit_type
            FROM geo.admin_unit
            WHERE country_id = CAST(:country_id AS uuid)
              AND active = true
              AND admin_level IN (1, 2, 3)
            ORDER BY admin_level, label_fr NULLS LAST, label_en NULLS LAST, label
        """),
        {"country_id": country_id},
    ).mappings().all()

    return [dict(r) for r in rows]


def unit_keys(unit: dict[str, Any]) -> set[str]:
    keys: set[str] = set()

    for field in ("label_fr", "label_en", "label", "code"):
        keys |= alias_keys(unit.get(field))

    return {k for k in keys if k}


def build_geo_indexes(units: list[dict[str, Any]]):
    gov_by_key: dict[str, dict[str, Any]] = {}
    delegation_by_parent_key: dict[tuple[str, str], dict[str, Any]] = {}
    delegation_global: dict[str, list[dict[str, Any]]] = {}
    imada_by_parent_key: dict[tuple[str, str], dict[str, Any]] = {}

    gov_units: list[dict[str, Any]] = []
    delegation_by_parent: dict[str, list[dict[str, Any]]] = {}
    imada_by_parent: dict[str, list[dict[str, Any]]] = {}

    for u in units:
        level = int(u["admin_level"])
        keys = unit_keys(u)

        if level == 1:
            gov_units.append(u)
            for k in keys:
                gov_by_key[k] = u

        elif level == 2:
            parent_id = u.get("parent_id")
            if parent_id:
                delegation_by_parent.setdefault(parent_id, []).append(u)
                for k in keys:
                    delegation_by_parent_key[(parent_id, k)] = u
                    delegation_global.setdefault(k, []).append(u)

        elif level == 3:
            parent_id = u.get("parent_id")
            if parent_id:
                imada_by_parent.setdefault(parent_id, []).append(u)
                for k in keys:
                    imada_by_parent_key[(parent_id, k)] = u

    return {
        "gov_by_key": gov_by_key,
        "delegation_by_parent_key": delegation_by_parent_key,
        "delegation_global": delegation_global,
        "imada_by_parent_key": imada_by_parent_key,
        "gov_units": gov_units,
        "delegation_by_parent": delegation_by_parent,
        "imada_by_parent": imada_by_parent,
    }


def best_fuzzy_match(target: str, candidates: list[dict[str, Any]], min_score: float) -> tuple[dict[str, Any] | None, float]:
    target_keys = alias_keys(target)
    if not target_keys or not candidates:
        return None, 0.0

    best_unit = None
    best_score = 0.0

    for unit in candidates:
        for k1 in target_keys:
            for k2 in unit_keys(unit):
                score = SequenceMatcher(None, k1, k2).ratio()
                if score > best_score:
                    best_score = score
                    best_unit = unit

    if best_score >= min_score:
        return best_unit, best_score

    return None, best_score


# ─────────────────────────────────────────────────────────────
# Résolution admin unit
# ─────────────────────────────────────────────────────────────

def find_by_keys(index: dict[str, Any], value: str | None) -> Any | None:
    for k in alias_keys(value):
        if k in index:
            return index[k]
    return None


def resolve_existing_admin_unit(
    row: dict[str, str],
    indexes: dict[str, Any],
    strict_imada_only: bool,
    fuzzy: bool,
) -> tuple[str | None, str, dict[str, Any]]:
    gov_label = row["governorate_label"]
    delegation_label = row["delegation_label"]
    imada_label = row["imada_label"]

    metadata: dict[str, Any] = {
        "governorate_label": gov_label,
        "delegation_label": delegation_label,
        "imada_label": imada_label,
        "postal_code": row["postal_code"],
        "mapping_status": None,
        "matched_level": None,
        "strict_existing_admin_units": True,
        "created_admin_unit": False,
    }

    gov = find_by_keys(indexes["gov_by_key"], gov_label)

    if not gov and fuzzy:
        gov, score = best_fuzzy_match(gov_label, indexes["gov_units"], 0.88)
        metadata["governorate_fuzzy_score"] = round(score, 4)

    if not gov:
        metadata["mapping_status"] = "SKIPPED_GOVERNORATE_NOT_FOUND"
        return None, "SKIPPED_GOVERNORATE_NOT_FOUND", metadata

    metadata["matched_governorate"] = gov.get("label_fr") or gov.get("label") or gov.get("label_en")

    delegation = find_by_keys(
        {k: v for (parent, k), v in indexes["delegation_by_parent_key"].items() if parent == gov["id"]},
        delegation_label,
    )

    if not delegation:
        # global exact if unique.
        candidates = []
        for k in alias_keys(delegation_label):
            candidates.extend(indexes["delegation_global"].get(k, []))
        unique_by_id = {u["id"]: u for u in candidates}
        if len(unique_by_id) == 1:
            delegation = next(iter(unique_by_id.values()))

    if not delegation and fuzzy:
        delegation_candidates = indexes["delegation_by_parent"].get(gov["id"], [])
        delegation, score = best_fuzzy_match(delegation_label, delegation_candidates, 0.82)
        metadata["delegation_fuzzy_score"] = round(score, 4)

    if not delegation:
        metadata["mapping_status"] = "SKIPPED_DELEGATION_NOT_FOUND"
        return None, "SKIPPED_DELEGATION_NOT_FOUND", metadata

    metadata["matched_delegation"] = delegation.get("label_fr") or delegation.get("label") or delegation.get("label_en")

    imada = find_by_keys(
        {k: v for (parent, k), v in indexes["imada_by_parent_key"].items() if parent == delegation["id"]},
        imada_label,
    )

    if not imada and fuzzy:
        imada_candidates = indexes["imada_by_parent"].get(delegation["id"], [])
        imada, score = best_fuzzy_match(imada_label, imada_candidates, 0.90)
        metadata["imada_fuzzy_score"] = round(score, 4)

    if imada:
        metadata["mapping_status"] = "IMADA_MATCHED"
        metadata["matched_level"] = 3
        metadata["matched_imada"] = imada.get("label_fr") or imada.get("label") or imada.get("label_en")
        return imada["id"], "IMADA_MATCHED", metadata

    if strict_imada_only:
        metadata["mapping_status"] = "SKIPPED_IMADA_NOT_FOUND"
        return None, "SKIPPED_IMADA_NOT_FOUND", metadata

    # Mode pratique : ne crée rien dans admin_unit, mais rattache le code postal à la délégation existante.
    # La localité postale est conservée dans postal_code_admin_unit.locality_label.
    metadata["mapping_status"] = "DELEGATION_FALLBACK"
    metadata["matched_level"] = 2
    return delegation["id"], "DELEGATION_FALLBACK", metadata


# ─────────────────────────────────────────────────────────────
# Upserts
# ─────────────────────────────────────────────────────────────

def upsert_postal_code(conn, country_id: str, postal_code: str, label: str, metadata: dict[str, Any]) -> str:
    row = conn.execute(
        text("""
            INSERT INTO geo.postal_code (
                id,
                country_id,
                postal_code,
                label,
                active,
                metadata_json,
                created_at,
                updated_at
            )
            VALUES (
                gen_random_uuid(),
                CAST(:country_id AS uuid),
                :postal_code,
                :label,
                true,
                CAST(:metadata_json AS jsonb),
                now(),
                now()
            )
            ON CONFLICT (country_id, postal_code)
            DO UPDATE SET
                label = COALESCE(geo.postal_code.label, EXCLUDED.label),
                active = true,
                metadata_json = COALESCE(geo.postal_code.metadata_json, '{}'::jsonb)
                    || EXCLUDED.metadata_json,
                updated_at = now()
            RETURNING id::text AS id
        """),
        {
            "country_id": country_id,
            "postal_code": postal_code,
            "label": label,
            "metadata_json": json.dumps(metadata, ensure_ascii=False),
        },
    ).mappings().first()

    return row["id"]


def insert_mapping(
    conn,
    postal_code_id: str,
    admin_unit_id: str,
    row: dict[str, str],
    confidence: float,
    metadata: dict[str, Any],
):
    conn.execute(
        text("""
            INSERT INTO geo.postal_code_admin_unit (
                id,
                postal_code_id,
                admin_unit_id,
                locality_label,
                locality_label_ar,
                source,
                source_url,
                external_code,
                confidence,
                active,
                metadata_json,
                created_at,
                updated_at
            )
            VALUES (
                gen_random_uuid(),
                CAST(:postal_code_id AS uuid),
                CAST(:admin_unit_id AS uuid),
                :locality_label,
                :locality_label_ar,
                :source,
                :source_url,
                :external_code,
                :confidence,
                true,
                CAST(:metadata_json AS jsonb),
                now(),
                now()
            )
            ON CONFLICT DO NOTHING
        """),
        {
            "postal_code_id": postal_code_id,
            "admin_unit_id": admin_unit_id,
            "locality_label": row["imada_label"],
            "locality_label_ar": row["imada_label_ar"] or None,
            "source": row["source"] or "POSTE_TN",
            "source_url": row["source_url"],
            "external_code": f'{row["postal_code"]}|{row["governorate_label"]}|{row["delegation_label"]}|{row["imada_label"]}',
            "confidence": confidence,
            "metadata_json": json.dumps(metadata, ensure_ascii=False),
        },
    )


def update_unique_admin_unit_on_postal_code(conn):
    conn.execute(
        text("""
            WITH unique_unit AS (
                SELECT
                    pca.postal_code_id,
                    MIN(pca.admin_unit_id::text)::uuid AS admin_unit_id,
                    COUNT(DISTINCT pca.admin_unit_id) AS nb_units
                FROM geo.postal_code_admin_unit pca
                WHERE pca.active = true
                GROUP BY pca.postal_code_id
                HAVING COUNT(DISTINCT pca.admin_unit_id) = 1
            )
            UPDATE geo.postal_code pc
            SET
                admin_unit_id = u.admin_unit_id,
                updated_at = now()
            FROM unique_unit u
            WHERE pc.id = u.postal_code_id
              AND pc.admin_unit_id IS NULL
        """)
    )


def write_unmatched(path: Path, rows: list[dict[str, Any]]):
    path.parent.mkdir(parents=True, exist_ok=True)

    fieldnames = [
        "country_iso2",
        "governorate_label",
        "delegation_label",
        "imada_label",
        "postal_code",
        "post_office_label",
        "mapping_status",
    ]

    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in rows:
            writer.writerow({k: r.get(k, "") for k in fieldnames})


# ─────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Import des codes postaux tunisiens. "
            "Aucune ligne n'est ajoutée dans geo.admin_unit. "
            "Par défaut, le script accepte un fallback vers la délégation si la localité postale "
            "n'existe pas comme IMADA administrative."
        )
    )

    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--unmatched-output", type=Path, default=DEFAULT_UNMATCHED)
    parser.add_argument("--country", default="TN")
    parser.add_argument("--dry-run", action="store_true")

    parser.add_argument(
        "--strict-imada-only",
        action="store_true",
        help="Insérer seulement les lignes dont la localité correspond à une IMADA existante.",
    )
    parser.add_argument(
        "--no-fuzzy",
        action="store_true",
        help="Désactiver le matching fuzzy sur gouvernorat/délégation/imada.",
    )

    args = parser.parse_args()

    strict_imada_only = args.strict_imada_only
    fuzzy = not args.no_fuzzy

    print("=" * 86)
    print("Import codes postaux Tunisie — sans création admin_unit")
    print("=" * 86)
    print(f"Input                     : {args.input}")
    print(f"Country                   : {args.country}")
    print(f"Dry run                   : {'oui' if args.dry_run else 'non'}")
    print(f"Strict imada only          : {'oui' if strict_imada_only else 'non'}")
    print(f"Matching fuzzy             : {'oui' if fuzzy else 'non'}")
    print()

    rows = read_csv(args.input)
    print(f"Lignes CSV valides        : {len(rows)}")
    print(f"Codes distincts CSV       : {len({r['postal_code'] for r in rows})}")

    engine = create_engine(get_database_url(), future=True)

    unmatched: list[dict[str, Any]] = []
    stats: dict[str, int] = {
        "IMADA_MATCHED": 0,
        "DELEGATION_FALLBACK": 0,
        "SKIPPED_IMADA_NOT_FOUND": 0,
        "SKIPPED_DELEGATION_NOT_FOUND": 0,
        "SKIPPED_GOVERNORATE_NOT_FOUND": 0,
    }

    inserted_candidate_rows = 0
    inserted_postal_codes_seen: set[str] = set()

    with engine.connect() as conn:
        tx = conn.begin()

        try:
            country = load_country(conn, args.country)
            units = load_admin_units(conn, country["id"])
            indexes = build_geo_indexes(units)

            print(f"Unités geo actives chargées : {len(units)}")
            print()

            for row in rows:
                admin_unit_id, status, metadata = resolve_existing_admin_unit(
                    row,
                    indexes=indexes,
                    strict_imada_only=strict_imada_only,
                    fuzzy=fuzzy,
                )

                stats[status] = stats.get(status, 0) + 1

                if not admin_unit_id:
                    bad = dict(row)
                    bad["mapping_status"] = status
                    unmatched.append(bad)
                    continue

                postal_metadata = {
                    "source": row["source"],
                    "source_url": row["source_url"],
                    "country_iso2": row["country_iso2"],
                    "import_source": "tn_postal_codes.csv",
                    "created_admin_unit": False,
                    "strict_imada_only": strict_imada_only,
                    "fuzzy_matching": fuzzy,
                }

                postal_code_id = upsert_postal_code(
                    conn,
                    country_id=country["id"],
                    postal_code=row["postal_code"],
                    label=row["postal_code"],
                    metadata=postal_metadata,
                )

                confidence = {
                    "IMADA_MATCHED": 1.00,
                    "DELEGATION_FALLBACK": 0.80,
                }.get(status, 0.30)

                insert_mapping(
                    conn,
                    postal_code_id=postal_code_id,
                    admin_unit_id=admin_unit_id,
                    row=row,
                    confidence=confidence,
                    metadata=metadata,
                )

                inserted_candidate_rows += 1
                inserted_postal_codes_seen.add(row["postal_code"])

            update_unique_admin_unit_on_postal_code(conn)

            if args.dry_run:
                tx.rollback()
                print("\nDRY RUN : transaction annulée.")
            else:
                tx.commit()
                print("\nImport validé.")

        except Exception:
            tx.rollback()
            raise

    write_unmatched(args.unmatched_output, unmatched)

    print("\nStatistiques mapping :")
    for k, v in stats.items():
        print(f"  {k}: {v}")

    print()
    print(f"Lignes acceptées pour insertion : {inserted_candidate_rows}")
    print(f"Codes postaux acceptés          : {len(inserted_postal_codes_seen)}")
    print(f"Lignes ignorées                 : {len(unmatched)}")
    print(f"Rapport ignored/unmatched       : {args.unmatched_output}")

    print()
    print("Note : aucune ligne n'est ajoutée dans geo.admin_unit.")
    print("Les localités postales absentes de geo.admin_unit sont conservées dans postal_code_admin_unit.locality_label.")
    print("Si tu veux uniquement les IMADA exactes, relance avec --strict-imada-only.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
