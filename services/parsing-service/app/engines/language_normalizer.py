from __future__ import annotations

import os
import re
import unicodedata
from typing import Any, Dict, List, Optional, Tuple

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()


CEFR_PATTERN = re.compile(r"\b(A1|A2|B1|B2|C1|C2)\b", re.IGNORECASE)


def get_engine():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured")

    if database_url.startswith("postgresql://"):
        database_url = database_url.replace(
            "postgresql://",
            "postgresql+psycopg2://",
            1,
        )

    return create_engine(database_url, pool_pre_ping=True)


def normalize_text(value: str | None) -> str:
    value = value or ""
    value = value.lower().strip()

    value = unicodedata.normalize("NFKD", value)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))

    value = value.replace("’", "'")
    value = value.replace("–", "-")
    value = value.replace("—", "-")
    value = value.replace(":", " ")
    value = value.replace("/", " ")

    value = re.sub(r"[^a-z0-9\s/\-]+", " ", value)
    value = re.sub(r"\s+", " ", value)

    return value.strip()


def _item_to_text(value: Any) -> str:
    if isinstance(value, dict):
        keys = [
            "language",
            "name",
            "label",
            "level",
            "proficiency",
            "evidence",
            "value",
            "skill_label_raw",
            "raw",
        ]

        parts = []

        for key in keys:
            item_value = value.get(key)
            if item_value:
                parts.append(str(item_value))

        if parts:
            return " ".join(parts)

        return " ".join(str(v) for v in value.values() if v is not None)

    return str(value or "")


def split_language_segments(value: str) -> list[str]:
    text_value = str(value or "")

    text_value = re.sub(r"\blangues?\b", "", text_value, flags=re.IGNORECASE)
    text_value = re.sub(r"\blanguages?\b", "", text_value, flags=re.IGNORECASE)

    parts = re.split(r"[,;|\n•]+", text_value)
    cleaned = [part.strip(" :-\t") for part in parts if part.strip(" :-\t")]

    return cleaned or [text_value.strip()]


def load_language_refs() -> list[dict[str, Any]]:
    engine = get_engine()

    try:
        with engine.connect() as conn:
            rows = conn.execute(
                text("""
                    SELECT
                        rv.code,
                        rv.label_fr,
                        rv.label_en,
                        COALESCE(rv.metadata_json->'aliases', '[]'::jsonb) AS aliases
                    FROM reference.ref_value rv
                    JOIN reference.ref_group rg
                        ON rg.id = rv.group_id
                    WHERE rg.code = 'LANGUAGE'
                      AND rv.active = true
                    ORDER BY rv.sort_order ASC, rv.label_fr ASC;
                """)
            ).mappings().all()
    except Exception:
        # Fallback minimal pour ne pas faire planter tout le parsing
        rows = [
            {"code": "fr", "label_fr": "Français", "label_en": "French", "aliases": ["francais", "français", "french"]},
            {"code": "en", "label_fr": "Anglais", "label_en": "English", "aliases": ["anglais", "english"]},
            {"code": "ar", "label_fr": "Arabe", "label_en": "Arabic", "aliases": ["arabe", "arabic"]},
            {"code": "de", "label_fr": "Allemand", "label_en": "German", "aliases": ["allemand", "german"]},
            {"code": "es", "label_fr": "Espagnol", "label_en": "Spanish", "aliases": ["espagnol", "spanish", "español"]},
            {"code": "it", "label_fr": "Italien", "label_en": "Italian", "aliases": ["italien", "italian"]},
        ]

    refs: list[dict[str, Any]] = []

    for row in rows:
        aliases = row.get("aliases") or []

        if isinstance(aliases, str):
            aliases = [aliases]

        terms = [
            row.get("code"),
            row.get("label_fr"),
            row.get("label_en"),
            *aliases,
        ]

        refs.append({
            "code": row["code"],
            "terms": [
                normalize_text(str(term))
                for term in terms
                if term
            ],
        })

    return refs


def load_level_refs() -> list[dict[str, Any]]:
    engine = get_engine()

    try:
        with engine.connect() as conn:
            rows = conn.execute(
                text("""
                    SELECT
                        rv.code,
                        rv.label_fr,
                        rv.label_en,
                        COALESCE(rv.metadata_json->'aliases', '[]'::jsonb) AS aliases,
                        rv.sort_order AS rank_order
                    FROM reference.ref_value rv
                    JOIN reference.ref_group rg
                        ON rg.id = rv.group_id
                    WHERE rg.code = 'LANGUAGE_LEVEL'
                      AND rv.active = true
                    ORDER BY rv.sort_order DESC, rv.code DESC;
                """)
            ).mappings().all()
    except Exception:
        rows = [
            {"code": "C2", "label_fr": "Maîtrise", "label_en": "Proficient", "aliases": ["courant", "bilingue", "native", "proficient"], "rank_order": 6},
            {"code": "C1", "label_fr": "Avancé", "label_en": "Advanced", "aliases": ["avance", "avancé", "advanced"], "rank_order": 5},
            {"code": "B2", "label_fr": "Intermédiaire supérieur", "label_en": "Upper intermediate", "aliases": ["intermediaire superieur", "upper intermediate"], "rank_order": 4},
            {"code": "B1", "label_fr": "Intermédiaire", "label_en": "Intermediate", "aliases": ["intermediaire", "intermediate"], "rank_order": 3},
            {"code": "A2", "label_fr": "Élémentaire", "label_en": "Elementary", "aliases": ["elementaire", "élémentaire", "elementary"], "rank_order": 2},
            {"code": "A1", "label_fr": "Débutant", "label_en": "Beginner", "aliases": ["debutant", "débutant", "beginner"], "rank_order": 1},
        ]

    refs: list[dict[str, Any]] = []

    for row in rows:
        aliases = row.get("aliases") or []

        if isinstance(aliases, str):
            aliases = [aliases]

        terms = [
            row.get("code"),
            row.get("label_fr"),
            row.get("label_en"),
            *aliases,
        ]

        refs.append({
            "code": row["code"],
            "rank_order": row.get("rank_order"),
            "terms": [
                normalize_text(str(term))
                for term in terms
                if term
            ],
        })

    return refs


def detect_language_code(
    value: str,
    language_refs: list[dict[str, Any]],
) -> Optional[str]:
    normalized = normalize_text(value)

    if not normalized:
        return None

    for lang in language_refs:
        for term in lang["terms"]:
            if not term:
                continue

            if normalized == term:
                return lang["code"]

            if re.search(rf"\b{re.escape(term)}\b", normalized):
                return lang["code"]

    return None


def detect_language_level(
    value: str,
    level_refs: list[dict[str, Any]],
) -> Optional[str]:
    raw = str(value or "")

    cefr_match = CEFR_PATTERN.search(raw)
    if cefr_match:
        return cefr_match.group(1).upper()

    normalized = normalize_text(raw)

    if not normalized:
        return None

    for level in level_refs:
        for term in level["terms"]:
            if not term:
                continue

            if normalized == term:
                return level["code"]

            if re.search(rf"\b{re.escape(term)}\b", normalized):
                return level["code"]

    return None


def normalize_language_item(
    value: Any,
    language_refs: list[dict[str, Any]],
    level_refs: list[dict[str, Any]],
) -> Optional[Dict[str, Optional[str]]]:
    text_value = _item_to_text(value)

    language_code = detect_language_code(
        value=text_value,
        language_refs=language_refs,
    )

    if not language_code:
        return None

    level = detect_language_level(
        value=text_value,
        level_refs=level_refs,
    )

    if isinstance(value, dict):
        evidence = (
            value.get("evidence")
            or value.get("raw")
            or value.get("label")
            or value.get("name")
            or value.get("language")
            or text_value
        )
    else:
        evidence = text_value

    return {
        "language_code": language_code,
        "level": level,
        "evidence": str(evidence),
    }


def extract_languages_from_item(
    value: Any,
    language_refs: list[dict[str, Any]],
    level_refs: list[dict[str, Any]],
) -> list[Dict[str, Optional[str]]]:
    text_value = _item_to_text(value)

    languages: list[Dict[str, Optional[str]]] = []

    for segment in split_language_segments(text_value):
        normalized = normalize_language_item(
            value=segment,
            language_refs=language_refs,
            level_refs=level_refs,
        )

        if normalized:
            languages.append(normalized)

    return languages


def split_skills_and_languages(
    skills: List[Any],
    existing_languages: Optional[List[Any]] = None,
) -> Tuple[List[Any], List[Dict[str, Optional[str]]]]:
    language_refs = load_language_refs()
    level_refs = load_level_refs()

    clean_skills: list[Any] = []
    languages: list[Dict[str, Optional[str]]] = []

    seen_languages: set[str] = set()

    for item in skills or []:
        detected_languages = extract_languages_from_item(
            value=item,
            language_refs=language_refs,
            level_refs=level_refs,
        )

        if detected_languages:
            for lang in detected_languages:
                language_code = lang.get("language_code")

                if not language_code:
                    continue

                if language_code in seen_languages:
                    continue

                seen_languages.add(language_code)
                languages.append(lang)

            continue

        clean_skills.append(item)

    for item in existing_languages or []:
        detected_languages = extract_languages_from_item(
            value=item,
            language_refs=language_refs,
            level_refs=level_refs,
        )

        for lang in detected_languages:
            language_code = lang.get("language_code")

            if not language_code:
                continue

            if language_code in seen_languages:
                continue

            seen_languages.add(language_code)
            languages.append(lang)

    return clean_skills, languages