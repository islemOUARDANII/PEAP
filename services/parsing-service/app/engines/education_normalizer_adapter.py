from __future__ import annotations

import os
import re
import unicodedata
from difflib import SequenceMatcher
from typing import Any

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()


def normalize_text(value: str | None) -> str:
    value = value or ""
    value = value.lower().strip()
    value = unicodedata.normalize("NFKD", value)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = re.sub(r"[^a-z0-9\s/-]", " ", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def similarity(a: str | None, b: str | None) -> float:
    na = normalize_text(a)
    nb = normalize_text(b)

    if not na or not nb:
        return 0.0

    if na == nb:
        return 1.0

    if na in nb or nb in na:
        return 0.90

    return SequenceMatcher(None, na, nb).ratio()


def get_engine():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured")

    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+psycopg2://", 1)

    return create_engine(database_url, pool_pre_ping=True)


def infer_diploma_from_text(raw_degree: str, ref_diplomas: list[dict[str, Any]]) -> dict[str, Any] | None:
    normalized = normalize_text(raw_degree)

    # Règles fortes, parce que les libellés du référentiel sont génériques.
    rules = [
        ("doctorat", "12"),
        ("phd", "12"),
        ("ingenieur", "10"),
        ("ingénieur", "10"),
        ("mastere", "9"),
        ("mastère", "9"),
        ("master", "9"),
        ("maitrise", "8"),
        ("maîtrise", "8"),
        ("licence", "8"),
        ("bts", "7"),
        ("technicien superieur", "7"),
        ("technicien supérieur", "7"),
        ("bac", "5"),
        ("baccalaureat", "5"),
        ("baccalauréat", "5"),
    ]

    for keyword, code in rules:
        if normalize_text(keyword) in normalized:
            for diploma in ref_diplomas:
                if str(diploma["code_diplome"]) == code:
                    return diploma

    # Fallback similarité avec les labels.
    best = None
    best_score = 0.0

    for diploma in ref_diplomas:
        score = similarity(raw_degree, diploma["libelle_diplome"])
        if score > best_score:
            best_score = score
            best = diploma

    if best and best_score >= 0.70:
        return best

    return None


def infer_specialty_from_text(raw_degree: str, ref_specialties: list[dict[str, Any]]) -> dict[str, Any] | None:
    normalized = normalize_text(raw_degree)

    # On enlève les mots de diplôme pour isoler la spécialité.
    cleaned = normalized
    for token in [
        "licence",
        "master",
        "mastere",
        "mastère",
        "maitrise",
        "maîtrise",
        "diplome",
        "diplôme",
        "en",
        "de",
        "du",
        "des",
    ]:
        cleaned = re.sub(rf"\b{normalize_text(token)}\b", " ", cleaned)

    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    best = None
    best_score = 0.0

    for specialty in ref_specialties:
        label = specialty.get("libelle_specialite") or specialty.get("label") or ""
        normalized_label = normalize_text(label)

        score = max(
            similarity(cleaned, label),
            similarity(raw_degree, label),
        )

        if normalized_label and normalized_label in normalized:
            score = max(score, 0.95)

        if cleaned and cleaned in normalized_label:
            score = max(score, 0.90)

        if score > best_score:
            best_score = score
            best = specialty

    if best and best_score >= 0.70:
        return best

    return None


def normalize_education_entry(entry: dict[str, Any]) -> dict[str, Any]:
    raw_degree = (
        entry.get("degree")
        or entry.get("diploma_label")
        or entry.get("diploma")
        or ""
    )

    engine = get_engine()

    with engine.connect() as conn:
        ref_diplomas = [
            dict(row)
            for row in conn.execute(
                text(
                    """
                    SELECT
                        code_diplome,
                        libelle_diplome
                    FROM taxonomy.ref_diplomes
                    ORDER BY code_diplome
                    """
                )
            ).mappings().all()
        ]

        ref_specialties = [
            dict(row)
            for row in conn.execute(
                text(
                    """
                    SELECT *
                    FROM taxonomy.rtmc_savoir_faire_activites
                    """
                )
            ).mappings().all()
        ]

    diploma = infer_diploma_from_text(str(raw_degree), ref_diplomas)
    specialty = infer_specialty_from_text(str(raw_degree), ref_specialties)

    specialty_label = None
    specialty_code = None

    if specialty:
        specialty_label = (
            specialty.get("libelle_specialite")
            or specialty.get("label")
            or specialty.get("specialty")
        )
        specialty_code = (
            specialty.get("code_specialite")
            or specialty.get("code")
            or specialty.get("id")
        )

    return {
        **entry,
        "raw_degree": raw_degree,
        "level_code": str(diploma["code_diplome"]) if diploma else "",
        "diploma_label": diploma["libelle_diplome"] if diploma else str(raw_degree),
        "specialty": specialty_label or entry.get("field") or entry.get("specialty") or "",
        "specialty_code": str(specialty_code) if specialty_code else "",
        "institution": entry.get("institution") or "",
        "graduation_year": entry.get("graduation_year") or entry.get("end_date") or "",
        "normalization": {
            "diploma_matched": bool(diploma),
            "specialty_matched": bool(specialty),
            "source": "education_normalizer",
        },
    }


def normalize_education_entries(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [normalize_education_entry(entry) for entry in entries or []]