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


def _fallback_diplomas() -> list[dict[str, Any]]:
    # Codes utilisés par tes règles existantes.
    return [
        {"code_diplome": "12", "libelle_diplome": "Doctorat ou équivalent"},
        {"code_diplome": "10", "libelle_diplome": "Ingénieur / Master professionnel ou équivalent"},
        {"code_diplome": "9", "libelle_diplome": "Mastère / Master ou équivalent"},
        {"code_diplome": "8", "libelle_diplome": "Licence/ Maitrise ou équivalent"},
        {"code_diplome": "7", "libelle_diplome": "BTS / Technicien supérieur ou équivalent"},
        {"code_diplome": "5", "libelle_diplome": "Baccalauréat ou équivalent"},
    ]


def _fallback_specialties() -> list[dict[str, Any]]:
    return [
        {"code_specialite": "INFO", "libelle_specialite": "Informatique", "label": "Informatique"},
        {"code_specialite": "GESTION", "libelle_specialite": "Gestion", "label": "Gestion"},
        {"code_specialite": "MEDICAL", "libelle_specialite": "Santé / médical", "label": "Santé / médical"},
        {"code_specialite": "ELECTRIQUE", "libelle_specialite": "Génie électrique", "label": "Génie électrique"},
    ]


def load_education_refs() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """
    Charge les référentiels selon le modèle actuel :
    reference.ref_group + reference.ref_value.

    IMPORTANT :
    Ancien modèle supprimé :
      - taxonomy.ref_diplomes
      - taxonomy.rtmc_savoir_faire_activites

    On retourne volontairement les anciens noms de colonnes
    code_diplome/libelle_diplome/code_specialite/libelle_specialite
    pour garder le reste du fichier compatible.
    """
    try:
        engine = get_engine()

        with engine.connect() as conn:
            ref_diplomas = [
                dict(row)
                for row in conn.execute(
                    text(
                        """
                        SELECT
                            rv.code::text AS code_diplome,
                            COALESCE(
                                NULLIF(rv.label_fr, ''),
                                NULLIF(rv.label_en, ''),
                                NULLIF(rv.label, ''),
                                rv.code
                            )::text AS libelle_diplome
                        FROM reference.ref_value rv
                        JOIN reference.ref_group rg
                            ON rg.id = rv.group_id
                        WHERE rg.code = 'DIPLOMA'
                          AND rv.active = true
                        ORDER BY rv.sort_order ASC NULLS LAST, rv.code ASC;
                        """
                    )
                ).mappings().all()
            ]

            ref_specialties = [
                dict(row)
                for row in conn.execute(
                    text(
                        """
                        SELECT
                            rv.id::text AS id,
                            rv.code::text AS code_specialite,
                            COALESCE(
                                NULLIF(rv.label_fr, ''),
                                NULLIF(rv.label_en, ''),
                                NULLIF(rv.label, ''),
                                rv.code
                            )::text AS libelle_specialite,
                            COALESCE(
                                NULLIF(rv.label_fr, ''),
                                NULLIF(rv.label_en, ''),
                                NULLIF(rv.label, ''),
                                rv.code
                            )::text AS label
                        FROM reference.ref_value rv
                        JOIN reference.ref_group rg
                            ON rg.id = rv.group_id
                        WHERE rg.code = 'SPECIALTY'
                          AND rv.active = true
                        ORDER BY rv.sort_order ASC NULLS LAST, rv.label_fr ASC NULLS LAST, rv.label ASC NULLS LAST;
                        """
                    )
                ).mappings().all()
            ]

        return ref_diplomas or _fallback_diplomas(), ref_specialties or _fallback_specialties()

    except Exception:
        # Le parsing ne doit jamais tomber juste parce qu'un référentiel est indisponible.
        return _fallback_diplomas(), _fallback_specialties()


def infer_diploma_from_text(raw_degree: str, ref_diplomas: list[dict[str, Any]]) -> dict[str, Any] | None:
    normalized = normalize_text(raw_degree)

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
                if str(diploma.get("code_diplome")) == code:
                    return diploma

    best = None
    best_score = 0.0

    for diploma in ref_diplomas:
        label = diploma.get("libelle_diplome") or ""
        score = similarity(raw_degree, label)
        if score > best_score:
            best_score = score
            best = diploma

    if best and best_score >= 0.70:
        return best

    return None


def infer_specialty_from_text(raw_degree: str, ref_specialties: list[dict[str, Any]]) -> dict[str, Any] | None:
    normalized = normalize_text(raw_degree)

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
        "ingenieur",
        "ingénieur",
        "bts",
        "bac",
        "en",
        "de",
        "du",
        "des",
    ]:
        cleaned = re.sub(rf"\b{normalize_text(token)}\b", " ", cleaned)

    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    # Règles rapides pour les cas fréquents.
    keyword_rules = [
        (["informatique", "computer", "software", "reseau", "réseau", "systeme", "système"], ["informatique", "réseau", "systeme"]),
        (["gestion", "management", "business", "commerce"], ["gestion", "management", "commerce"]),
        (["medical", "médical", "sante", "santé", "infirmier"], ["medical", "sante", "santé"]),
        (["electrique", "électrique", "electronique", "électronique"], ["electrique", "électrique", "electronique"]),
    ]

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

        for needles, label_needles in keyword_rules:
            if any(n in normalized for n in [normalize_text(x) for x in needles]):
                if any(n in normalized_label for n in [normalize_text(x) for x in label_needles]):
                    score = max(score, 0.92)

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

    ref_diplomas, ref_specialties = load_education_refs()

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
    normalized: list[dict[str, Any]] = []

    for entry in entries or []:
        if not isinstance(entry, dict):
            continue

        try:
            normalized.append(normalize_education_entry(entry))
        except Exception as exc:
            normalized.append(
                {
                    **entry,
                    "raw_degree": entry.get("degree") or entry.get("diploma_label") or entry.get("diploma") or "",
                    "level_code": "",
                    "diploma_label": entry.get("degree") or entry.get("diploma_label") or entry.get("diploma") or "",
                    "specialty": entry.get("field") or entry.get("specialty") or "",
                    "specialty_code": "",
                    "institution": entry.get("institution") or "",
                    "graduation_year": entry.get("graduation_year") or entry.get("end_date") or "",
                    "normalization": {
                        "diploma_matched": False,
                        "specialty_matched": False,
                        "source": "education_normalizer",
                        "error": str(exc),
                    },
                }
            )

    return normalized
