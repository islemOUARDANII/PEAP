from __future__ import annotations

import os
import re
import unicodedata
from difflib import SequenceMatcher
from typing import Any

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()


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
    cleaned = raw_location.replace("–", ",").replace("-", ",").replace("|", ",")
    parts = [_normalize_text(part) for part in cleaned.split(",")]
    return [part for part in parts if part and part not in {"tunisie", "tunisia"}]


def normalize_location(raw_location: str | None) -> dict[str, Any]:
    if not raw_location:
        return {
            "raw_location": raw_location,
            "normalized_location": None,
            "status": "EMPTY",
            "country": "Tunisie",
            "governorate": None,
            "delegation": None,
            "confidence": 0.0,
            "source": "geo_normalizer",
        }

    normalized_location = _normalize_text(raw_location)
    location_parts = _split_location_parts(raw_location)

    # Dans "Hammam Lif, Ben Arous - Tunisie",
    # le premier morceau est prioritaire pour la délégation.
    primary_part = location_parts[0] if location_parts else normalized_location
    secondary_parts = location_parts[1:] if len(location_parts) > 1 else []

    engine = _get_engine()

    with engine.connect() as conn:
        delegation_rows = conn.execute(
            text(
                """
                SELECT
                    d.code_delegation,
                    d.libelle_delegation,
                    d.code_gouvernorat,
                    g.libelle_gouvernorat
                FROM taxonomy.ref_n_delegat d
                JOIN taxonomy.ref_n_gouvern g
                    ON g.code_gouvernorat = d.code_gouvernorat
                """
            )
        ).mappings().all()

        best_delegation = None
        best_delegation_score = 0.0

        for row in delegation_rows:
            delegation_label = row["libelle_delegation"]
            governorate_label = row["libelle_gouvernorat"]

            normalized_delegation = _normalize_text(delegation_label)
            normalized_governorate = _normalize_text(governorate_label)

            # 1. Score principal : la délégation doit matcher le premier morceau.
            primary_score = _similarity(primary_part, delegation_label)

            if normalized_delegation == primary_part:
                primary_score = 1.0
            elif normalized_delegation and normalized_delegation in primary_part:
                primary_score = max(primary_score, 0.95)
            elif primary_part and primary_part in normalized_delegation:
                primary_score = max(primary_score, 0.90)

            # 2. Bonus si le gouvernorat est présent dans les autres morceaux.
            governorate_bonus = 0.0
            for part in secondary_parts:
                if normalized_governorate == part:
                    governorate_bonus = max(governorate_bonus, 0.10)
                elif normalized_governorate and normalized_governorate in part:
                    governorate_bonus = max(governorate_bonus, 0.08)
                elif part and part in normalized_governorate:
                    governorate_bonus = max(governorate_bonus, 0.05)

            combined_score = min(1.0, primary_score + governorate_bonus)

            # Important :
            # si le premier morceau ne ressemble pas à cette délégation,
            # on ne doit pas accepter juste parce que le gouvernorat est présent.
            if primary_score < 0.75:
                continue

            if combined_score > best_delegation_score:
                best_delegation_score = combined_score
                best_delegation = dict(row)

        if best_delegation and best_delegation_score >= 0.75:
            return {
                "raw_location": raw_location,
                "normalized_location": normalized_location,
                "location_parts": location_parts,
                "status": "MATCHED_DELEGATION",
                "country": "Tunisie",
                "governorate": {
                    "code": best_delegation["code_gouvernorat"],
                    "label": best_delegation["libelle_gouvernorat"],
                },
                "delegation": {
                    "code": best_delegation["code_delegation"],
                    "label": best_delegation["libelle_delegation"],
                },
                "confidence": round(best_delegation_score, 4),
                "source": "geo_normalizer",
            }

        # Si aucune délégation n’est trouvée, on cherche un gouvernorat.
        governorate_rows = conn.execute(
            text(
                """
                SELECT
                    code_gouvernorat,
                    libelle_gouvernorat
                FROM taxonomy.ref_n_gouvern
                """
            )
        ).mappings().all()

        best_governorate = None
        best_governorate_score = 0.0

        for row in governorate_rows:
            governorate_label = row["libelle_gouvernorat"]
            normalized_governorate = _normalize_text(governorate_label)

            scores = [_similarity(part, governorate_label) for part in location_parts]
            scores.append(_similarity(raw_location, governorate_label))

            score = max(scores) if scores else 0.0

            if normalized_governorate and normalized_governorate in normalized_location:
                score = max(score, 0.95)

            if score > best_governorate_score:
                best_governorate_score = score
                best_governorate = dict(row)

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
        "country": "Tunisie",
        "governorate": None,
        "delegation": None,
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