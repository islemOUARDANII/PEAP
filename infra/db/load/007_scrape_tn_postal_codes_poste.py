#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Scraper strict des codes postaux tunisiens depuis La Poste Tunisienne.

Source :
    https://www.poste.tn/codes.php

Logique réelle observée :
    1. codes.php contient select name="ville" pour les gouvernorats.
    2. codes_ajax.php?ville=<id>&do=delegation retourne les délégations.
    3. codes_ajax.php?ville=<id>&delegation=<label>&do=localite retourne les localités.
    4. codes_ajax.php?ville=<id>&delegation=<label>&localite=<label>&do=resultat retourne un tableau.

Important :
    L'étape résultat peut retourner plusieurs localités homonymes dans toute la Tunisie.
    Ce script filtre STRICTEMENT les lignes retournées par :
        gouvernorat retourné == gouvernorat courant
        délégation retournée == délégation courante
        localité retournée == localité courante
    Donc les cas "CITE ERRIADH" dans Sousse, Tunis, Ben Arous, etc. ne sont plus mélangés.

Usage :
    python infra/db/load/007_scrape_tn_postal_codes_poste.py --only-gov Tunis --delay 1 --insecure-ssl --debug-html
    python infra/db/load/007_scrape_tn_postal_codes_poste.py --only-gov Tunis --only-delegation "LA MARSA" --only-locality "CITE ERRIADH" --delay 1 --insecure-ssl --debug-html
    python infra/db/load/007_scrape_tn_postal_codes_poste.py --delay 1 --insecure-ssl
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import html
import html.parser
import json
import re
import ssl
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any

try:
    import certifi
except ImportError:
    certifi = None


BASE_URL = "https://www.poste.tn/codes.php"
AJAX_URL = "https://www.poste.tn/codes_ajax.php"
SOURCE_LABEL = "POSTE_TN"

SCRIPT_DIR = Path(__file__).parent.resolve()
DATA_DIR = SCRIPT_DIR.parent / "data" / "geo"
CACHE_DIR = DATA_DIR / "cache" / "poste_tn"
DEBUG_DIR = DATA_DIR / "debug" / "poste_tn"
DEFAULT_OUTPUT = DATA_DIR / "tn_postal_codes.csv"

CSV_FIELDNAMES = [
    "country_iso2",
    "governorate_label",
    "delegation_label",
    "imada_label",
    "imada_label_ar",
    "postal_code",
    "post_office_label",
    "source",
    "source_url",
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; PEAP-PostalScraper/3.0; +https://example.local/peap)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9,ar;q=0.8,en;q=0.5",
    "Connection": "keep-alive",
}

FALLBACK_GOVERNORATES = [
    ("ARIANA", "1"),
    ("BEJA", "2"),
    ("BEN AROUS", "3"),
    ("BIZERTE", "4"),
    ("GABES", "5"),
    ("GAFSA", "6"),
    ("JENDOUBA", "7"),
    ("KAIROUAN", "8"),
    ("KASSERINE", "9"),
    ("KEBILI", "10"),
    ("KEF", "11"),
    ("MAHDIA", "12"),
    ("MANOUBA", "13"),
    ("MEDENINE", "14"),
    ("MONASTIR", "15"),
    ("NABEUL", "16"),
    ("SFAX", "17"),
    ("SIDI BOUZID", "18"),
    ("SILIANA", "19"),
    ("SOUSSE", "20"),
    ("TATAOUINE", "21"),
    ("TOZEUR", "22"),
    ("TUNIS", "23"),
    ("ZAGHOUAN", "24"),
]


@dataclass
class Option:
    label: str
    value: str


@dataclass
class PostalRecord:
    country_iso2: str = "TN"
    governorate_label: str = ""
    delegation_label: str = ""
    imada_label: str = ""
    imada_label_ar: str = ""
    postal_code: str = ""
    post_office_label: str = ""
    source: str = SOURCE_LABEL
    source_url: str = BASE_URL


def clean_text(value: str | None) -> str:
    value = html.unescape(value or "")
    value = value.replace("\ufeff", "")
    value = value.replace("\xa0", " ")
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def norm(value: str | None) -> str:
    value = clean_text(value).upper()
    value = unicodedata.normalize("NFKD", value)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    for src, dst in {
        "’": "'", "‘": "'", "`": "'", "´": "'",
        "-": " ", "_": " ", ".": " ", ",": " ", "(": " ", ")": " ",
    }.items():
        value = value.replace(src, dst)
    value = re.sub(r"[^A-Z0-9'\s]+", " ", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def safe_name(value: str) -> str:
    out = norm(value).replace(" ", "_").replace("'", "")
    return re.sub(r"[^A-Z0-9_]+", "_", out) or "X"


def is_placeholder(label: str, value: str = "") -> bool:
    n = norm(label)
    v = norm(value)
    if not n and not v:
        return True
    return (
        n.startswith("SELECTIONNER")
        or n in {"0", "TOUS", "CHOISIR"}
        or v == "0"
    )


def build_ssl_context(verify_ssl: bool) -> ssl.SSLContext:
    if not verify_ssl:
        return ssl._create_unverified_context()
    if certifi is not None:
        return ssl.create_default_context(cafile=certifi.where())
    return ssl.create_default_context()


def cache_key(url: str, params: dict[str, Any] | None, method: str) -> str:
    raw = json.dumps({"url": url, "params": params or {}, "method": method}, sort_keys=True, ensure_ascii=False)
    return hashlib.md5(raw.encode("utf-8")).hexdigest()


def fetch_html(
    url: str,
    params: dict[str, Any] | None = None,
    method: str = "GET",
    *,
    delay: float = 1.0,
    use_cache: bool = True,
    verify_ssl: bool = True,
    debug_html: bool = False,
    debug_name: str | None = None,
) -> str:
    method = method.upper()
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    DEBUG_DIR.mkdir(parents=True, exist_ok=True)

    key = cache_key(url, params, method)
    cache_file = CACHE_DIR / f"{key}.html"

    if use_cache and cache_file.exists() and cache_file.stat().st_size > 0:
        content = cache_file.read_text(encoding="utf-8", errors="replace")
        print(f"    [cache] {method} {url} params={params}")
        if debug_html and debug_name:
            (DEBUG_DIR / f"{debug_name}.html").write_text(content, encoding="utf-8")
        return content

    time.sleep(delay)

    if method == "POST":
        data = urllib.parse.urlencode(params or {}).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=HEADERS, method="POST")
        req.add_header("Content-Type", "application/x-www-form-urlencoded")
    else:
        full_url = url
        if params:
            full_url += "?" + urllib.parse.urlencode(params)
        req = urllib.request.Request(full_url, headers=HEADERS, method="GET")

    print(f"    [fetch] {method} {url} params={params}")

    try:
        with urllib.request.urlopen(req, timeout=45, context=build_ssl_context(verify_ssl)) as resp:
            raw = resp.read()
            content_type = resp.headers.get("Content-Type", "")
    except Exception as exc:
        print(f"    [ERREUR] {url}: {exc}", file=sys.stderr)
        return ""

    encodings: list[str] = []
    m = re.search(r"charset=([A-Za-z0-9_\-]+)", content_type or "", re.I)
    if m:
        encodings.append(m.group(1))
    encodings.extend(["utf-8", "windows-1256", "iso-8859-1"])

    content = ""
    for enc in encodings:
        try:
            content = raw.decode(enc)
            break
        except Exception:
            continue
    if not content:
        content = raw.decode("utf-8", errors="replace")

    if use_cache:
        cache_file.write_text(content, encoding="utf-8")

    if debug_html and debug_name:
        (DEBUG_DIR / f"{debug_name}.html").write_text(content, encoding="utf-8")

    return content


class SelectParser(html.parser.HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.selects: list[tuple[str, list[Option]]] = []
        self._select_name = ""
        self._in_select = False
        self._in_option = False
        self._option_value = ""
        self._option_label = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        d = {k.lower(): (v or "") for k, v in attrs}
        if tag == "select":
            self._in_select = True
            self._select_name = d.get("name") or d.get("id") or ""
            self.selects.append((self._select_name, []))
        elif tag == "option" and self._in_select:
            self._in_option = True
            self._option_value = d.get("value", "")
            self._option_label = ""

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag == "option" and self._in_option:
            self._in_option = False
            label = clean_text(self._option_label)
            value = clean_text(self._option_value or label)
            if self.selects:
                self.selects[-1][1].append(Option(label=label, value=value))
        elif tag == "select":
            self._in_select = False
            self._select_name = ""

    def handle_data(self, data: str) -> None:
        if self._in_option:
            self._option_label += data


class TableParser(html.parser.HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.rows: list[list[str]] = []
        self._row: list[str] | None = None
        self._cell: list[str] = []
        self._in_cell = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if tag == "tr":
            self._row = []
        elif tag in {"td", "th"} and self._row is not None:
            self._in_cell = True
            self._cell = []

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in {"td", "th"} and self._in_cell:
            self._in_cell = False
            if self._row is not None:
                self._row.append(clean_text(" ".join(self._cell)))
        elif tag == "tr" and self._row is not None:
            if any(clean_text(c) for c in self._row):
                self.rows.append(self._row)
            self._row = None

    def handle_data(self, data: str) -> None:
        if self._in_cell:
            self._cell.append(data)

    def handle_entityref(self, name: str) -> None:
        if self._in_cell:
            self._cell.append(html.unescape(f"&{name};"))

    def handle_charref(self, name: str) -> None:
        if self._in_cell:
            self._cell.append(html.unescape(f"&#{name};"))


def extract_select_options(html_content: str, wanted_name: str | None = None) -> list[Option]:
    parser = SelectParser()
    parser.feed(html_content)

    if wanted_name:
        for name, options in parser.selects:
            if norm(name) == norm(wanted_name):
                return [o for o in options if not is_placeholder(o.label, o.value)]

    # fallback: first useful select
    for _name, options in parser.selects:
        useful = [o for o in options if not is_placeholder(o.label, o.value)]
        if useful:
            return useful

    return []


def extract_governorates(main_html: str) -> list[Option]:
    options = extract_select_options(main_html, "ville")
    if options:
        print(f"    Gouvernorats détectés via select ville : {len(options)}")
        return options

    print("    [AVERTISSEMENT] select ville non détecté — fallback utilisé")
    return [Option(label=label, value=value) for label, value in FALLBACK_GOVERNORATES]


def fetch_delegations(gov: Option, args: argparse.Namespace) -> list[Option]:
    attempts = [
        {"ville": gov.value, "do": "delegation"},
        {"ville": gov.value, "do": "deleg"},
        {"ville": gov.value, "do": "delegations"},
    ]

    for idx, params in enumerate(attempts, 1):
        content = fetch_html(
            AJAX_URL,
            params=params,
            method="POST",
            delay=args.delay,
            use_cache=not args.no_cache,
            verify_ssl=not args.insecure_ssl,
            debug_html=args.debug_html,
            debug_name=f"{safe_name(gov.label)}_delegations_attempt_{idx}",
        )
        options = extract_select_options(content, "delegation")
        if options:
            return options

    return []


def fetch_localities(gov: Option, delegation: Option, args: argparse.Namespace) -> list[Option]:
    attempts = [
        {"ville": gov.value, "delegation": delegation.value, "do": "localite"},
        {"ville": gov.value, "delegation": delegation.label, "do": "localite"},
        {"ville": gov.value, "delegation": delegation.value, "do": "localites"},
    ]

    for idx, params in enumerate(attempts, 1):
        content = fetch_html(
            AJAX_URL,
            params=params,
            method="POST",
            delay=args.delay,
            use_cache=not args.no_cache,
            verify_ssl=not args.insecure_ssl,
            debug_html=args.debug_html,
            debug_name=f"{safe_name(gov.label)}_{safe_name(delegation.label)}_localites_attempt_{idx}",
        )
        options = extract_select_options(content, "localite")
        if options:
            return options

    return []


def parse_result_rows(html_content: str) -> list[dict[str, str]]:
    parser = TableParser()
    parser.feed(html_content)

    rows = parser.rows
    result: list[dict[str, str]] = []

    for row in rows:
        if len(row) < 4:
            continue

        row_norm = [norm(c) for c in row]

        # Ignorer headers et lignes décoratives.
        if "GOUVERNORAT" in row_norm and "DELEGATION" in row_norm:
            continue
        if any("RESULTAT" in c for c in row_norm):
            continue
        if any("CODE POSTAL" in c for c in row_norm):
            continue
        if all(c in {"", "-"} for c in row_norm):
            continue

        # Structure réelle du tableau AJAX :
        # Gouvernorat | Délégation | Localité | Code Postal
        gov = clean_text(row[0])
        delegation = clean_text(row[1])
        locality = clean_text(row[2])
        postal_code = clean_text(row[3])

        m = re.search(r"\b(\d{4})\b", postal_code)
        if not m:
            continue

        result.append(
            {
                "governorate": gov,
                "delegation": delegation,
                "locality": locality,
                "postal_code": m.group(1),
            }
        )

    return result


def fetch_result_for_locality(gov: Option, delegation: Option, locality: Option, args: argparse.Namespace) -> list[PostalRecord]:
    attempts = [
        {"ville": gov.value, "delegation": delegation.value, "localite": locality.value, "do": "resultat"},
        {"ville": gov.value, "delegation": delegation.label, "localite": locality.value, "do": "resultat"},
        {"ville": gov.value, "delegation": delegation.value, "localite": locality.label, "do": "resultat"},
        {"ville": gov.value, "delegation": delegation.label, "localite": locality.label, "do": "resultat"},
    ]

    for idx, params in enumerate(attempts, 1):
        content = fetch_html(
            AJAX_URL,
            params=params,
            method="POST",
            delay=args.delay,
            use_cache=not args.no_cache,
            verify_ssl=not args.insecure_ssl,
            debug_html=args.debug_html,
            debug_name=f"{safe_name(gov.label)}_{safe_name(delegation.label)}_{safe_name(locality.label)}_result_attempt_{idx}",
        )
        rows = parse_result_rows(content)

        if not rows:
            continue

        filtered: list[PostalRecord] = []
        for r in rows:
            same_gov = norm(r["governorate"]) == norm(gov.label)
            same_delegation = norm(r["delegation"]) == norm(delegation.label)
            same_locality = norm(r["locality"]) == norm(locality.label)

            if same_gov and same_delegation and same_locality:
                filtered.append(
                    PostalRecord(
                        governorate_label=r["governorate"],
                        delegation_label=r["delegation"],
                        imada_label=r["locality"],
                        imada_label_ar="",
                        postal_code=r["postal_code"],
                        post_office_label=r["locality"],
                        source=SOURCE_LABEL,
                        source_url=BASE_URL,
                    )
                )

        # Très important : ne jamais retourner les lignes non filtrées.
        # Sinon "CITE ERRIADH" ramène toutes les "CITE ERRIADH" de Tunisie.
        if filtered:
            if len(rows) != len(filtered):
                print(
                    f"          [filtre strict] {locality.label}: "
                    f"{len(rows)} ligne(s) AJAX -> {len(filtered)} conservée(s)"
                )
            return filtered

        print(
            f"          [ignoré] {locality.label}: "
            f"{len(rows)} ligne(s) AJAX, 0 correspondance stricte "
            f"({gov.label}/{delegation.label}/{locality.label})"
        )

    return []


def deduplicate(records: list[PostalRecord]) -> list[PostalRecord]:
    seen: set[tuple[str, str, str, str]] = set()
    output: list[PostalRecord] = []
    for r in records:
        key = (
            norm(r.governorate_label),
            norm(r.delegation_label),
            norm(r.imada_label),
            r.postal_code,
        )
        if key in seen:
            continue
        seen.add(key)
        output.append(r)
    return output


def print_quality(records: list[PostalRecord]) -> None:
    by_gov: dict[str, int] = {}
    by_deleg: dict[tuple[str, str], int] = {}
    for r in records:
        by_gov[r.governorate_label] = by_gov.get(r.governorate_label, 0) + 1
        k = (r.governorate_label, r.delegation_label)
        by_deleg[k] = by_deleg.get(k, 0) + 1

    print("\nRapport qualité")
    print(f"  Total lignes : {len(records)}")
    print("  Lignes par gouvernorat :")
    for gov, n in sorted(by_gov.items()):
        print(f"    - {gov}: {n}")

    suspicious = [
        (gov, deleg, n)
        for (gov, deleg), n in by_deleg.items()
        if n > 80
    ]
    if suspicious:
        print("  Délégations avec volume élevé à vérifier :")
        for gov, deleg, n in sorted(suspicious):
            print(f"    - {gov} / {deleg}: {n}")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Scraper strict des codes postaux tunisiens depuis La Poste Tunisienne.")
    ap.add_argument("--output", "-o", type=Path, default=DEFAULT_OUTPUT)
    ap.add_argument("--delay", "-d", type=float, default=1.0)
    ap.add_argument("--no-cache", action="store_true")
    ap.add_argument("--insecure-ssl", action="store_true")
    ap.add_argument("--debug-html", action="store_true")
    ap.add_argument("--only-gov", default="")
    ap.add_argument("--only-delegation", default="")
    ap.add_argument("--only-locality", default="")
    ap.add_argument("--max-localities", type=int, default=0)
    args = ap.parse_args(argv)

    print("=" * 72)
    print("Scraper strict codes postaux — La Poste Tunisienne")
    print("=" * 72)
    print(f"  Source      : {BASE_URL}")
    print(f"  AJAX        : {AJAX_URL}")
    print(f"  Sortie      : {args.output}")
    print(f"  Cache       : {'désactivé' if args.no_cache else CACHE_DIR}")
    print(f"  SSL vérifié : {'non' if args.insecure_ssl else 'oui'}")
    print(f"  Debug HTML  : {'oui' if args.debug_html else 'non'}")
    print()

    main_html = fetch_html(
        BASE_URL,
        method="GET",
        delay=args.delay,
        use_cache=not args.no_cache,
        verify_ssl=not args.insecure_ssl,
        debug_html=args.debug_html,
        debug_name="main_page",
    )
    if not main_html:
        print("ERREUR : impossible de charger codes.php", file=sys.stderr)
        return 1

    governorates = extract_governorates(main_html)
    if args.only_gov:
        needle = norm(args.only_gov)
        governorates = [g for g in governorates if needle in norm(g.label) or needle in norm(g.value)]

    if not governorates:
        print("Aucun gouvernorat à traiter.", file=sys.stderr)
        return 1

    all_records: list[PostalRecord] = []

    for gov_idx, gov in enumerate(governorates, 1):
        print(f"\n[{gov_idx}/{len(governorates)}] Gouvernorat : {gov.label} value={gov.value}")

        delegations = fetch_delegations(gov, args)
        if args.only_delegation:
            needle = norm(args.only_delegation)
            delegations = [d for d in delegations if needle in norm(d.label) or needle in norm(d.value)]

        print(f"    Délégations : {len(delegations)}")

        for deleg_idx, delegation in enumerate(delegations, 1):
            print(f"    [{deleg_idx}/{len(delegations)}] Délégation : {delegation.label}")

            localities = fetch_localities(gov, delegation, args)
            if args.only_locality:
                needle = norm(args.only_locality)
                localities = [l for l in localities if needle in norm(l.label) or needle in norm(l.value)]

            if args.max_localities and len(localities) > args.max_localities:
                localities = localities[: args.max_localities]

            print(f"        Localités : {len(localities)}")

            for loc_idx, locality in enumerate(localities, 1):
                records = fetch_result_for_locality(gov, delegation, locality, args)
                all_records.extend(records)

                if records:
                    codes = ", ".join(sorted({r.postal_code for r in records}))
                    print(f"        [{loc_idx}/{len(localities)}] {locality.label} -> {codes}")
                else:
                    print(f"        [{loc_idx}/{len(localities)}] {locality.label} -> aucun résultat strict")

    records = deduplicate(all_records)
    removed = len(all_records) - len(records)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDNAMES)
        writer.writeheader()
        for rec in records:
            writer.writerow(asdict(rec))

    print("\n" + "=" * 72)
    print(f"Total brut      : {len(all_records)}")
    print(f"Doublons retirés: {removed}")
    print(f"Total exporté   : {len(records)}")
    print(f"Fichier         : {args.output}")
    print_quality(records)

    return 0 if records else 2


if __name__ == "__main__":
    sys.exit(main())
