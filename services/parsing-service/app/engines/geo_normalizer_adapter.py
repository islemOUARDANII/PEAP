from __future__ import annotations

import os
import re
import unicodedata
from difflib import SequenceMatcher
from typing import Any

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

COUNTRY_ALIASES: dict[str, str] = {
    # Tunisia
    "tn": "TN",
    "tun": "TN",
    "tunisia": "TN",
    "tunisie": "TN",
    "republique tunisienne": "TN",
    "république tunisienne": "TN",

    # United States
    "us": "US",
    "usa": "US",
    "u s": "US",
    "u s a": "US",
    "united states": "US",
    "united states of america": "US",
    "america": "US",
    "etats unis": "US",
    "états unis": "US",
    "etats-unis": "US",

    # Common countries
    "france": "FR",
    "fr": "FR",
    "canada": "CA",
    "ca": "CA",
    "germany": "DE",
    "allemagne": "DE",
    "deutschland": "DE",
    "italy": "IT",
    "italie": "IT",
    "spain": "ES",
    "espagne": "ES",
    "united kingdom": "GB",
    "uk": "GB",
    "great britain": "GB",
    "royaume uni": "GB",
    "royaume-uni": "GB",
    "morocco": "MA",
    "maroc": "MA",
    "algeria": "DZ",
    "algerie": "DZ",
    "algérie": "DZ",
}

REMOTE_LOCATION_TOKENS = {
    "remote",
    "remotely",
    "teletravail",
    "télétravail",
    "a distance",
    "à distance",
    "work from home",
    "wfh",
}

def _normalize_text(value: str | None) -> str:
    value = value or ""
    value = value.lower().strip()
    value = unicodedata.normalize("NFKD", value)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = re.sub(r"[^a-z0-9\s-]", " ", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def _similarity(a: str, b: str) -> float:
    na = _normalize_text(a)
    nb = _normalize_text(b)

    if not na or not nb:
        return 0.0

    if na == nb:
        return 1.0

    if na in nb or nb in na:
        return 0.95

    return SequenceMatcher(None, na, nb).ratio()


def _get_engine():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured")

    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+psycopg2://", 1)

    return create_engine(database_url, pool_pre_ping=True)


def _split_location_parts(raw_location: str) -> list[str]:
    cleaned = raw_location.replace("–", ",").replace("|", ",").replace("/", ",")
    cleaned = re.sub(r"\s+-\s+", ",", cleaned)
    parts = [_normalize_text(part) for part in cleaned.split(",")]
    return [part for part in parts if part]

def _fallback_countries() -> list[dict[str, Any]]:
    return [
        {"id": None, "iso2": "TN", "iso3": "TUN", "name_fr": "Tunisie", "name_en": "Tunisia", "name_ar": None},
        {"id": None, "iso2": "US", "iso3": "USA", "name_fr": "États-Unis", "name_en": "United States", "name_ar": None},
        {"id": None, "iso2": "FR", "iso3": "FRA", "name_fr": "France", "name_en": "France", "name_ar": None},
        {"id": None, "iso2": "CA", "iso3": "CAN", "name_fr": "Canada", "name_en": "Canada", "name_ar": None},
        {"id": None, "iso2": "DE", "iso3": "DEU", "name_fr": "Allemagne", "name_en": "Germany", "name_ar": None},
        {"id": None, "iso2": "IT", "iso3": "ITA", "name_fr": "Italie", "name_en": "Italy", "name_ar": None},
        {"id": None, "iso2": "ES", "iso3": "ESP", "name_fr": "Espagne", "name_en": "Spain", "name_ar": None},
        {"id": None, "iso2": "GB", "iso3": "GBR", "name_fr": "Royaume-Uni", "name_en": "United Kingdom", "name_ar": None},
        {"id": None, "iso2": "MA", "iso3": "MAR", "name_fr": "Maroc", "name_en": "Morocco", "name_ar": None},
        {"id": None, "iso2": "DZ", "iso3": "DZA", "name_fr": "Algérie", "name_en": "Algeria", "name_ar": None},
    ]


def _load_countries() -> list[dict[str, Any]]:
    try:
        engine = _get_engine()
        with engine.connect() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT
                        id::text AS id,
                        iso2::text AS iso2,
                        iso3::text AS iso3,
                        name_fr::text AS name_fr,
                        name_en::text AS name_en,
                        name_ar::text AS name_ar
                    FROM geo.country
                    WHERE COALESCE(active, true) = true
                    """
                )
            ).mappings().all()

        return [dict(row) for row in rows] or _fallback_countries()

    except Exception:
        return _fallback_countries()


def _country_label(country: dict[str, Any] | None) -> str | None:
    if not country:
        return None

    return country.get("name_fr") or country.get("name_en") or country.get("iso2")


def _country_payload(country: dict[str, Any] | None) -> dict[str, Any] | None:
    if not country:
        return None

    return {
        "id": country.get("id"),
        "iso2": country.get("iso2"),
        "iso3": country.get("iso3"),
        "label": _country_label(country),
    }


def _country_match_tokens(country: dict[str, Any]) -> set[str]:
    tokens = {
        _normalize_text(country.get("iso2")),
        _normalize_text(country.get("iso3")),
        _normalize_text(country.get("name_fr")),
        _normalize_text(country.get("name_en")),
        _normalize_text(country.get("name_ar")),
    }

    iso2 = country.get("iso2")

    for alias, alias_iso2 in COUNTRY_ALIASES.items():
        if iso2 and alias_iso2 == iso2:
            tokens.add(_normalize_text(alias))

    return {token for token in tokens if token}


def _match_country(location_parts: list[str], normalized_location: str) -> dict[str, Any] | None:
    countries = _load_countries()
    normalized_parts = [_normalize_text(part) for part in location_parts if part]
    full_text = _normalize_text(normalized_location)

    # 1. Match fort via alias : USA, United States, France, Canada, etc.
    for part in normalized_parts:
        if part in COUNTRY_ALIASES:
            iso2 = COUNTRY_ALIASES[part]
            for country in countries:
                if country.get("iso2") == iso2:
                    return country

    # 2. Match direct via iso2, iso3, nom FR, nom EN, nom AR.
    for country in countries:
        tokens = _country_match_tokens(country)
        for part in normalized_parts:
            if part in tokens:
                return country

    # 3. Match dans tout le texte, mais seulement pour les tokens assez longs.
    for country in countries:
        tokens = sorted(_country_match_tokens(country), key=len, reverse=True)
        for token in tokens:
            if len(token) < 3:
                continue

            if re.search(rf"(^|\s){re.escape(token)}($|\s)", full_text):
                return country

    return None


def _remove_country_parts(location_parts: list[str], country: dict[str, Any] | None) -> list[str]:
    if not country:
        return location_parts

    country_tokens = _country_match_tokens(country)

    return [
        part
        for part in location_parts
        if _normalize_text(part) not in country_tokens
    ]

def _fallback_delegations() -> list[dict[str, Any]]:
    return [
        {
            "code_delegation": "23.3151",
            "libelle_delegation": "Sousse Medina",
            "code_gouvernorat": "23",
            "libelle_gouvernorat": "Sousse",
        },
        {
            "code_delegation": "13.1351",
            "libelle_delegation": "Hammam Lif",
            "code_gouvernorat": "13",
            "libelle_gouvernorat": "Ben Arous",
        },
        {
            "code_delegation": "11.1151",
            "libelle_delegation": "Tunis",
            "code_gouvernorat": "11",
            "libelle_gouvernorat": "Tunis",
        },
        {
            "code_delegation": "34.3451",
            "libelle_delegation": "Sfax",
            "code_gouvernorat": "34",
            "libelle_gouvernorat": "Sfax",
        },
    ]


def _fallback_governorates() -> list[dict[str, Any]]:
    return [
        {"code_gouvernorat": "11", "libelle_gouvernorat": "Tunis"},
        {"code_gouvernorat": "13", "libelle_gouvernorat": "Ben Arous"},
        {"code_gouvernorat": "23", "libelle_gouvernorat": "Sousse"},
        {"code_gouvernorat": "34", "libelle_gouvernorat": "Sfax"},
    ]


def _load_geo_refs() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """
    Charge la géographie depuis le modèle actuel :
      geo.country + geo.admin_unit

    Ancien modèle supprimé :
      taxonomy.ref_n_delegat
      taxonomy.ref_n_gouvern
    """
    try:
        engine = _get_engine()

        with engine.connect() as conn:
            delegation_rows = [
                dict(row)
                for row in conn.execute(
                    text(
                        """
                        SELECT
                            d.code::text AS code_delegation,
                            COALESCE(
                                NULLIF(d.label_fr, ''),
                                NULLIF(d.label_en, ''),
                                NULLIF(d.label, ''),
                                d.code
                            )::text AS libelle_delegation,
                            g.code::text AS code_gouvernorat,
                            COALESCE(
                                NULLIF(g.label_fr, ''),
                                NULLIF(g.label_en, ''),
                                NULLIF(g.label, ''),
                                g.code
                            )::text AS libelle_gouvernorat
                        FROM geo.admin_unit d
                        JOIN geo.country c
                            ON c.id = d.country_id
                        LEFT JOIN geo.admin_unit g
                            ON g.id = d.parent_id
                        WHERE c.iso2 = 'TN'
                          AND COALESCE(d.active, true) = true
                          AND (
                                d.unit_type = 'DELEGATION'
                                OR d.admin_level = 2
                          )
                        ORDER BY libelle_gouvernorat ASC, libelle_delegation ASC;
                        """
                    )
                ).mappings().all()
            ]

            governorate_rows = [
                dict(row)
                for row in conn.execute(
                    text(
                        """
                        SELECT
                            g.code::text AS code_gouvernorat,
                            COALESCE(
                                NULLIF(g.label_fr, ''),
                                NULLIF(g.label_en, ''),
                                NULLIF(g.label, ''),
                                g.code
                            )::text AS libelle_gouvernorat
                        FROM geo.admin_unit g
                        JOIN geo.country c
                            ON c.id = g.country_id
                        WHERE c.iso2 = 'TN'
                          AND COALESCE(g.active, true) = true
                          AND (
                                g.unit_type = 'GOVERNORATE'
                                OR g.admin_level = 1
                          )
                        ORDER BY libelle_gouvernorat ASC;
                        """
                    )
                ).mappings().all()
            ]

        return (
            delegation_rows or _fallback_delegations(),
            governorate_rows or _fallback_governorates(),
        )

    except Exception:
        return _fallback_delegations(), _fallback_governorates()


def normalize_location(raw_location: str | None) -> dict[str, Any]:
    if not raw_location:
        return {
            "raw_location": raw_location,
            "normalized_location": None,
            "status": "EMPTY",
            "country": None,
            "country_ref": None,
            "country_id": None,
            "country_iso2": None,
            "governorate": None,
            "delegation": None,
            "city_raw": None,
            "region_raw": None,
            "is_foreign": False,
            "confidence": 0.0,
            "source": "geo_normalizer",
        }

    normalized_location = _normalize_text(raw_location)
    location_parts = _split_location_parts(raw_location)

    if normalized_location in REMOTE_LOCATION_TOKENS:
        return {
            "raw_location": raw_location,
            "normalized_location": normalized_location,
            "location_parts": location_parts,
            "status": "REMOTE",
            "country": None,
            "country_ref": None,
            "country_id": None,
            "country_iso2": None,
            "governorate": None,
            "delegation": None,
            "city_raw": None,
            "region_raw": None,
            "is_foreign": False,
            "confidence": 0.85,
            "source": "geo_normalizer",
        }


    matched_country = _match_country(location_parts, normalized_location)
    matched_country_iso2 = matched_country.get("iso2") if matched_country else None

    if matched_country and matched_country_iso2 != "TN":
        non_country_parts = _remove_country_parts(location_parts, matched_country)

        city_raw = non_country_parts[0].title() if non_country_parts else None
        region_raw = non_country_parts[1].upper() if len(non_country_parts) > 1 else None
        country_label = _country_label(matched_country)

        display_parts = [part for part in [city_raw, region_raw, country_label] if part]

        return {
            "raw_location": raw_location,
            "normalized_location": normalized_location,
            "location_parts": location_parts,
            "display_location": ", ".join(display_parts) if display_parts else country_label,
            "status": "MATCHED_FOREIGN_COUNTRY",
            "country": country_label,
            "country_ref": _country_payload(matched_country),
            "country_id": matched_country.get("id"),
            "country_iso2": matched_country_iso2,
            "governorate": None,
            "delegation": None,
            "city_raw": city_raw,
            "region_raw": region_raw,
            "is_foreign": True,
            "confidence": 0.9,
            "source": "geo_normalizer",
        }

    primary_part = location_parts[0] if location_parts else normalized_location
    secondary_parts = location_parts[1:] if len(location_parts) > 1 else []

    delegation_rows, governorate_rows = _load_geo_refs()

    best_delegation = None
    best_delegation_score = 0.0

    for row in delegation_rows:
        delegation_label = row.get("libelle_delegation") or ""
        governorate_label = row.get("libelle_gouvernorat") or ""

        normalized_delegation = _normalize_text(delegation_label)
        normalized_governorate = _normalize_text(governorate_label)

        primary_score = _similarity(primary_part, delegation_label)

        if normalized_delegation == primary_part:
            primary_score = 1.0
        elif normalized_delegation and normalized_delegation in primary_part:
            primary_score = max(primary_score, 0.95)
        elif primary_part and primary_part in normalized_delegation:
            primary_score = max(primary_score, 0.90)

        governorate_bonus = 0.0
        for part in secondary_parts:
            if normalized_governorate == part:
                governorate_bonus = max(governorate_bonus, 0.10)
            elif normalized_governorate and normalized_governorate in part:
                governorate_bonus = max(governorate_bonus, 0.08)
            elif part and part in normalized_governorate:
                governorate_bonus = max(governorate_bonus, 0.05)

        combined_score = min(1.0, primary_score + governorate_bonus)

        if primary_score < 0.75:
            continue

        if combined_score > best_delegation_score:
            best_delegation_score = combined_score
            best_delegation = row

    if best_delegation and best_delegation_score >= 0.75:
        return {
            "raw_location": raw_location,
            "normalized_location": normalized_location,
            "location_parts": location_parts,
            "display_location": (
                f"{str(best_delegation['libelle_delegation']).title()}, "
                f"{str(best_delegation['libelle_gouvernorat']).title()}, Tunisie"
            ),
            "status": "MATCHED_DELEGATION",
            "country": "Tunisie",
            "country_ref": _country_payload(matched_country) if matched_country else None,
            "country_id": (matched_country or {}).get("id"),
            "country_iso2": "TN",
            "governorate": {
                "code": best_delegation["code_gouvernorat"],
                "label": best_delegation["libelle_gouvernorat"],
            },
            "delegation": {
                "code": best_delegation["code_delegation"],
                "label": best_delegation["libelle_delegation"],
            },
            "city_raw": None,
            "region_raw": None,
            "is_foreign": False,
            "confidence": round(best_delegation_score, 4),
            "source": "geo_normalizer",
        }

    best_governorate = None
    best_governorate_score = 0.0

    for row in governorate_rows:
        governorate_label = row.get("libelle_gouvernorat") or ""
        normalized_governorate = _normalize_text(governorate_label)

        scores = [_similarity(part, governorate_label) for part in location_parts]
        scores.append(_similarity(raw_location, governorate_label))

        score = max(scores) if scores else 0.0

        if normalized_governorate and normalized_governorate in normalized_location:
            score = max(score, 0.95)

        if score > best_governorate_score:
            best_governorate_score = score
            best_governorate = row

    if best_governorate and best_governorate_score >= 0.75:
        return {
            "raw_location": raw_location,
            "normalized_location": normalized_location,
            "location_parts": location_parts,
            "status": "MATCHED_GOVERNORATE",
            "country": "Tunisie",
            "governorate": {
                "code": best_governorate["code_gouvernorat"],
                "label": best_governorate["libelle_gouvernorat"],
            },
            "delegation": None,
            "confidence": round(best_governorate_score, 4),
            "source": "geo_normalizer",
        }

    return {
        "raw_location": raw_location,
        "normalized_location": normalized_location,
        "location_parts": location_parts,
        "status": "UNRESOLVED",
        "country": _country_label(matched_country) if matched_country else None,
        "country_ref": _country_payload(matched_country) if matched_country else None,
        "country_id": matched_country.get("id") if matched_country else None,
        "country_iso2": matched_country_iso2,
        "governorate": None,
        "delegation": None,
        "city_raw": primary_part.title() if primary_part else None,
        "region_raw": None,
        "is_foreign": bool(matched_country_iso2 and matched_country_iso2 != "TN"),
        "confidence": 0.0,
        "source": "geo_normalizer",
    }


def enrich_cv_locations(parsed_payload: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(parsed_payload, dict):
        return parsed_payload

    cv_data = parsed_payload.get("cv_data")
    if not isinstance(cv_data, dict):
        cv_data = parsed_payload.get("raw_json")
    if not isinstance(cv_data, dict):
        cv_data = parsed_payload

    personal_info = cv_data.get("personal_info") or {}
    raw_location = personal_info.get("location")

    geo_normalization = {
        "candidate_location": normalize_location(raw_location),
    }

    return {
        **parsed_payload,
        "geo_normalization": geo_normalization,
    }


def enrich_offer_locations(parsed_offer: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(parsed_offer, dict):
        return parsed_offer

    offer = parsed_offer.get("offer") if isinstance(parsed_offer.get("offer"), dict) else parsed_offer

    raw_location = (
        offer.get("location")
        or offer.get("work_location")
        or offer.get("job_location")
        or parsed_offer.get("location")
        or parsed_offer.get("work_location")
        or parsed_offer.get("job_location")
    )

    geo_normalization = {
        "offer_location": normalize_location(raw_location),
    }

    return {
        **parsed_offer,
        "geo_normalization": geo_normalization,
    }
