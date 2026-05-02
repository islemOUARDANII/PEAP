# -*- coding: utf-8 -*-
import base64
import json
import re
import unicodedata
from datetime import date
from typing import Dict, List, Optional, Tuple

import cv2
from groq import Groq

from .config import Settings


TOP_LEVEL_SKILL_SECTION_HEADERS = {
    "skills", "skill", "compétences", "competences", "competencies",
    "compétences professionnelles", "competences professionnelles",
    "professional skills", "expertise",
    "logiciels", "software", "outils", "tools", "informatique",
    "savoir-faire", "know-how", "qualifications", "strengths",
    "computer skills", "digital skills",
}

REAL_SKILL_SUBCATEGORY_HEADERS = {
    "hard skills", "soft skills", "technical skills",
    "frameworks", "technologies", "programming languages",
    "languages techniques", "langages techniques",
    "stack", "tech stack",
}

SOFTWARE_SKILL_SECTION_HEADERS = {
    "logiciels", "software", "software tools", "outils", "tools",
    "informatique", "computer skills", "digital skills", "it",
}

SKILL_HEADERS = TOP_LEVEL_SKILL_SECTION_HEADERS | REAL_SKILL_SUBCATEGORY_HEADERS

STOP_HEADERS = {
    "experience", "expérience", "education", "formation", "formations",
    "languages", "langues", "certifications",
    "interests", "hobbies", "awards", "summary", "profil", "profile",
    "associations", "volunteer", "contact",
}


# =============================================================================
# EXPERIENCE DURATION
# =============================================================================


def _parse_cv_date_legacy(raw: str, is_end: bool = False) -> Tuple[Optional[date], Optional[str]]:
    if not raw or not isinstance(raw, str):
        return None, None
    s = raw.strip()
    s = s.replace("\u2019", "'").replace("\u2013", "-").replace("\u2014", "-")
    s = re.sub(r"\s+", " ", s).strip()
    CURRENT_KW = {
        "present", "current", "now", "en cours", "actuel", "actuelle",
        "aujourd'hui", "today", "ongoing", "maintenant", "présent",
    }
    if s.lower() in CURRENT_KW:
        return date.today(), None
    MONTHS = {
        
        "january": 1, "jan": 1, "janvier": 1,
        "february": 2, "feb": 2, "février": 2, "fevrier": 2,
        "march": 3, "mar": 3, "mars": 3,
        "april": 4, "apr": 4, "avril": 4,
        "may": 5, "mai": 5,
        "june": 6, "jun": 6, "juin": 6,
        "july": 7, "jul": 7, "juillet": 7,
        "august": 8, "aug": 8, "août": 8, "aout": 8,
        "september": 9, "sep": 9, "septembre": 9,
        "october": 10, "oct": 10, "octobre": 10,
        "november": 11, "nov": 11, "novembre": 11,
        "december": 12, "dec": 12, "décembre": 12, "decembre": 12,
    }
    m = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        try:
            return date(int(m.group(1)), int(m.group(2)), int(m.group(3))), None
        except ValueError:
            return None, f"Date invalide : {s!r}"
    m = re.fullmatch(r"(\d{1,2})[/-](\d{1,2})[/-](\d{4})", s)
    if m:
        try:
            return date(int(m.group(3)), int(m.group(2)), int(m.group(1))), None
        except ValueError:
            return None, f"Date invalide : {s!r}"
    m = re.fullmatch(r"(\d{4})[/-](\d{1,2})", s)
    if m:
        try:
            return date(int(m.group(1)), int(m.group(2)), 1), None
        except ValueError:
            return None, f"Date invalide : {s!r}"
    m = re.fullmatch(r"(\d{1,2})[/-](\d{4})", s)
    if m:
        try:
            return date(int(m.group(2)), int(m.group(1)), 1), None
        except ValueError:
            return None, f"Date invalide : {s!r}"
    m = re.fullmatch(
        r"([A-Za-z-]+\.?)\s+(\d{4})|(\d{4})\s+([A-Za-z-]+\.?)",
        s, re.IGNORECASE,
    )
    if m:
        if m.group(1):
            month_str, year_str = m.group(1).rstrip(".").lower(), m.group(2)
        else:
            month_str, year_str = m.group(4).rstrip(".").lower(), m.group(3)
        month = MONTHS.get(month_str)
        if month:
            try:
                return date(int(year_str), month, 1), None
            except ValueError:
                return None, f"Date invalide : {s!r}"
        return None, f"Mois inconnu : {month_str!r} dans {s!r}"
    m = re.fullmatch(r"(\d{1,2})\s+([A-Za-z-]+\.?)\s+(\d{4})", s, re.IGNORECASE)
    if m:
        day_str = m.group(1)
        month_str = m.group(2).rstrip(".").lower()
        year_str = m.group(3)
        month = MONTHS.get(month_str)
        if month:
            try:
                return date(int(year_str), month, int(day_str)), None
            except ValueError:
                return None, f"Date invalide : {s!r}"
        return None, f"Mois inconnu : {month_str!r} dans {s!r}"
    m = re.fullmatch(r"(\d{4})", s)
    if m:
        year = int(m.group(1))
        month = 12 if is_end else 1
        try:
            return date(year, month, 1), None
        except ValueError:
            return None, f"Année invalide : {s!r}"
    return None, f"Format de date non reconnu : {s!r}"


def _parse_cv_date(raw: str, is_end: bool = False) -> Tuple[Optional[date], Optional[str]]:
    if not raw or not isinstance(raw, str):
        return None, None
    s = raw.strip()
    s = s.replace("\u2019", "'").replace("\u2013", "-").replace("\u2014", "-")
    s = re.sub(r"\s+", " ", s).strip()
    CURRENT_KW = {
        "present", "current", "now", "en cours", "actuel", "actuelle",
        "aujourd'hui", "today", "ongoing", "maintenant", "présent",
    }
    if s.lower() in CURRENT_KW:
        return date.today(), None
    MONTHS = {
        "january": 1, "jan": 1, "janvier": 1,
        "february": 2, "feb": 2, "février": 2, "fevrier": 2,
        "march": 3, "mar": 3, "mars": 3,
        "april": 4, "apr": 4, "avril": 4,
        "may": 5, "mai": 5,
        "june": 6, "jun": 6, "juin": 6,
        "july": 7, "jul": 7, "juillet": 7,
        "august": 8, "aug": 8, "août": 8, "aout": 8,
        "september": 9, "sep": 9, "septembre": 9,
        "october": 10, "oct": 10, "octobre": 10,
        "november": 11, "nov": 11, "novembre": 11,
        "december": 12, "dec": 12, "décembre": 12, "decembre": 12,
    }
    m = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        try:
            return date(int(m.group(1)), int(m.group(2)), int(m.group(3))), None
        except ValueError:
            return None, f"Date invalide : {s!r}"
    m = re.fullmatch(r"(\d{1,2})[/-](\d{1,2})[/-](\d{4})", s)
    if m:
        try:
            return date(int(m.group(3)), int(m.group(2)), int(m.group(1))), None
        except ValueError:
            return None, f"Date invalide : {s!r}"
    m = re.fullmatch(r"(\d{4})[/-](\d{1,2})", s)
    if m:
        try:
            return date(int(m.group(1)), int(m.group(2)), 1), None
        except ValueError:
            return None, f"Date invalide : {s!r}"
    m = re.fullmatch(r"(\d{1,2})[/-](\d{4})", s)
    if m:
        try:
            return date(int(m.group(2)), int(m.group(1)), 1), None
        except ValueError:
            return None, f"Date invalide : {s!r}"
    m = re.fullmatch(
        r"([A-Za-z\u00c0-\u00ff]+\.?)\s+(\d{4})|(\d{4})\s+([A-Za-z\u00c0-\u00ff]+\.?)",
        s, re.IGNORECASE,
    )
    if m:
        if m.group(1):
            month_str, year_str = m.group(1).rstrip(".").lower(), m.group(2)
        else:
            month_str, year_str = m.group(4).rstrip(".").lower(), m.group(3)
        month = MONTHS.get(month_str)
        if month:
            try:
                return date(int(year_str), month, 1), None
            except ValueError:
                return None, f"Date invalide : {s!r}"
        return None, f"Mois inconnu : {month_str!r} dans {s!r}"
    m = re.fullmatch(r"(\d{1,2})\s+([A-Za-z\u00c0-\u00ff]+\.?)\s+(\d{4})", s, re.IGNORECASE)
    if m:
        day_str = m.group(1)
        month_str = m.group(2).rstrip(".").lower()
        year_str = m.group(3)
        month = MONTHS.get(month_str)
        if month:
            try:
                return date(int(year_str), month, int(day_str)), None
            except ValueError:
                return None, f"Date invalide : {s!r}"
        return None, f"Mois inconnu : {month_str!r} dans {s!r}"
    m = re.fullmatch(r"(\d{4})", s)
    if m:
        year = int(m.group(1))
        month = 12 if is_end else 1
        try:
            return date(year, month, 1), None
        except ValueError:
            return None, f"Année invalide : {s!r}"
    return None, f"Format de date non reconnu : {s!r}"


def _merge_intervals(intervals: List[Tuple[date, date]]) -> List[Tuple[date, date]]:
    if not intervals:
        return []
    merged = [intervals[0]]
    for start, end in intervals[1:]:
        prev_start, prev_end = merged[-1]
        if start <= prev_end:
            merged[-1] = (prev_start, max(prev_end, end))
        else:
            merged.append((start, end))
    return merged


def compute_experience(experiences: List[dict]) -> dict:
    warnings: List[str] = []
    intervals: List[Tuple[date, date]] = []
    today = date.today()

    for exp in (experiences or []):
        if not isinstance(exp, dict):
            continue

        label = f"{exp.get('job_title', '?')} @ {exp.get('company', '?')}"
        raw_start = exp.get("start_date")
        raw_end = exp.get("end_date")
        is_current = bool(exp.get("is_current", False))

        start, warn = _parse_cv_date(raw_start, is_end=False)
        if warn:
            warnings.append(f"[{label}] start_date {warn}")
        if start is None:
            continue

        if is_current:
            end = today
        elif not raw_end:
            continue
        else:
            end, warn = _parse_cv_date(raw_end, is_end=True)
            if warn:
                warnings.append(f"[{label}] end_date {warn}")
            if end is None:
                continue

        if end < start:
            continue

        intervals.append((start, end))

    intervals.sort(key=lambda t: t[0])
    merged = _merge_intervals(intervals)

    total_months = 0
    for start, end in merged:
        months = (end.year - start.year) * 12 + (end.month - start.month)
        total_months += max(months, 0) + 1

    return {
        "experience_years": round(total_months / 12, 1),
        "warnings": warnings,
    }


# =============================================================================
# INTERNSHIP / EXPERIENCE CLASSIFICATION
# =============================================================================

INTERNSHIP_KEYWORDS = {
    "stage", "stagiaire", "internship", "intern", "trainee",
    "pfe", "end-of-studies internship", "summer internship",
    "work placement", "training internship", "alternance",
    "apprentice", "apprenticeship",
}


def classify_career_entry(entry: dict) -> str:
    text = " ".join([
        str(entry.get("title") or ""),
        str(entry.get("job_title") or ""),
        str(entry.get("company") or ""),
        str(entry.get("description") or ""),
        str(entry.get("source_section") or ""),
    ]).lower()

    if any(keyword in text for keyword in INTERNSHIP_KEYWORDS):
        return "internship"

    return "professional_experience"


def split_experience_and_stages(result: dict) -> dict:
    all_entries = []

    for entry in result.get("experience", []) or []:
        if isinstance(entry, dict):
            all_entries.append(entry)

    for entry in result.get("stages", []) or []:
        if isinstance(entry, dict):
            all_entries.append(entry)

    experiences = []
    stages = []

    for entry in all_entries:
        entry_type = entry.get("entry_type") or classify_career_entry(entry)
        entry["entry_type"] = entry_type

        if entry_type == "internship":
            stages.append(entry)
        else:
            experiences.append(entry)

    result["experience"] = experiences
    result["stages"] = stages
    return result


def compute_entry_duration(entry: dict) -> dict:
    start_date = entry.get("start_date")
    end_date = entry.get("end_date")
    is_current = bool(entry.get("is_current", False))

    start, _ = _parse_cv_date(start_date, is_end=False)
    if not start:
        entry["duration_months"] = None
        entry["duration_years"] = None
        return entry

    if is_current:
        end = date.today()
    else:
        end, _ = _parse_cv_date(end_date, is_end=True)
        if not end:
            entry["duration_months"] = None
            entry["duration_years"] = None
            return entry

    if end < start:
        entry["duration_months"] = None
        entry["duration_years"] = None
        return entry

    months = (end.year - start.year) * 12 + (end.month - start.month) + 1
    entry["duration_months"] = months
    entry["duration_years"] = round(months / 12, 1)
    return entry


def compute_total_duration(entries: List[dict]) -> dict:
    intervals: List[Tuple[date, date]] = []
    today = date.today()

    for entry in entries or []:
        if not isinstance(entry, dict):
            continue
        start, _ = _parse_cv_date(entry.get("start_date"), is_end=False)
        if not start:
            continue

        if entry.get("is_current"):
            end = today
        else:
            end, _ = _parse_cv_date(entry.get("end_date"), is_end=True)
            if not end:
                continue

        if end >= start:
            intervals.append((start, end))

    intervals.sort(key=lambda x: x[0])
    merged = _merge_intervals(intervals)

    total_months = 0
    for start, end in merged:
        months = (end.year - start.year) * 12 + (end.month - start.month) + 1
        total_months += max(months, 0)

    return {
        "months": total_months,
        "years": round(total_months / 12, 1),
    }


# =============================================================================
# TECHNICAL SKILLS
# =============================================================================

TECHNICAL_SKILL_FIELDS = (
    "programming_languages",
    "frameworks_libraries",
    "databases",
    "devops_tools",
    "data_ai_tools",
    "web_technologies",
    "api_backend",
    "other_technical_tools",
)

PROGRAMMING_LANGUAGES = {
    "python", "java", "javascript", "typescript", "sql", "html", "css",
    "c", "c++", "c#", "php", "r", "scala", "kotlin", "swift",
    "go", "rust", "bash", "powershell", "node.js", "nodejs", "pl/sql",
}

FRAMEWORKS_LIBRARIES = {
    "fastapi", "django", "flask", "spring boot", "spring", "laravel",
    "angular", "react", "vue", "vue.js", "next.js", "nextjs",
    "express", "express.js", "pandas", "numpy", "scikit-learn",
    "scikit learn", "sklearn", "tensorflow", "pytorch",
}

DATABASES = {
    "postgresql", "postgres", "mysql", "mongodb", "sqlite",
    "oracle", "redis", "sql server", "sqlserver", "elasticsearch",
    "elastic search",
}

DEVOPS_TOOLS = {
    "docker", "docker compose", "docker-compose", "git", "github", "gitlab",
    "jenkins", "ci/cd", "cicd", "kubernetes", "ansible", "terraform",
    "aws", "azure", "gcp", "linux",
}

DATA_AI_TOOLS = {
    "power bi", "powerbi", "tableau", "excel", "scikit-learn", "scikit learn",
    "sklearn", "tensorflow", "pytorch", "llm", "nlp", "rag", "langchain",
}

WEB_TECHNOLOGIES = {
    "html", "css", "javascript", "typescript", "rest api",
    "rest apis", "api rest", "json", "xml",
}

API_BACKEND = {
    "rest api", "rest apis", "api rest", "backend development",
    "authentication flows", "fastapi endpoints", "api endpoints",
}

TECHNICAL_SKILL_VOCABULARY = {
    "programming_languages": PROGRAMMING_LANGUAGES,
    "frameworks_libraries": FRAMEWORKS_LIBRARIES,
    "databases": DATABASES,
    "devops_tools": DEVOPS_TOOLS,
    "data_ai_tools": DATA_AI_TOOLS,
    "web_technologies": WEB_TECHNOLOGIES,
    "api_backend": API_BACKEND,
}

TECHNICAL_SECTION_LABELS = {
    "technical skills",
    "compétences techniques",
    "competences techniques",
    "skills techniques",
    "tech skills",
    "software",
    "logiciels",
    "outils",
    "tools",
    "informatique",
    "programming languages",
    "frameworks",
    "libraries",
    "databases",
    "devops",
    "backend",
    "frontend",
    "web",
    "data",
    "ai",
    "cloud",
}

TECHNICAL_SECTION_KEYWORDS = {
    "technical", "tech", "software", "tool", "outils", "informatique",
    "programming", "framework", "database", "devops", "backend",
    "frontend", "cloud", "data", "api",
}

CATEGORY_PRIORITY = (
    "programming_languages",
    "frameworks_libraries",
    "databases",
    "devops_tools",
    "data_ai_tools",
    "web_technologies",
    "api_backend",
    "other_technical_tools",
)

MULTI_CATEGORY_TECH_ITEMS = {
    "rest api": ["web_technologies", "api_backend"],
    "rest apis": ["web_technologies", "api_backend"],
    "api rest": ["web_technologies", "api_backend"],
}

PREFERRED_CATEGORY_BY_ITEM = {
    "javascript": ["programming_languages"],
    "typescript": ["programming_languages"],
    "html": ["programming_languages"],
    "css": ["programming_languages"],
    "scikit-learn": ["data_ai_tools"],
    "scikit learn": ["data_ai_tools"],
    "sklearn": ["data_ai_tools"],
    "tensorflow": ["data_ai_tools"],
    "pytorch": ["data_ai_tools"],
    "llm": ["data_ai_tools"],
    "nlp": ["data_ai_tools"],
    "rag": ["data_ai_tools"],
    "langchain": ["data_ai_tools"],
}

BENIGN_TECH_MODIFIERS = {
    "basic", "basics", "advanced", "beginner", "intermediate", "expert",
    "junior", "senior", "fundamentals", "core", "essentials",
    "notions", "base", "bases", "avance", "avancé", "avancee",
    "intermediaire", "intermédiaire",
}

IGNORABLE_TECH_LEFTOVER_TOKENS = BENIGN_TECH_MODIFIERS | {
    "and", "or", "et", "ou", "with", "avec", "de", "des", "the",
}

PROTECTED_SLASH_SKILL_TERMS = (
    "CI/CD",
    "AI/ML",
    "ML/AI",
)


def _clean_technical_text(value) -> Optional[str]:
    if value is None:
        return None
    text = re.sub(r"\s+", " ", str(value)).strip()
    return text or None


def _normalize_technical_text(value) -> str:
    text = _clean_technical_text(value)
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.casefold().replace("\u00b7", " ")
    text = re.sub(r"[^a-z0-9+#/.\- ]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _blank_technical_skills() -> Dict[str, List[str]]:
    return {field_name: [] for field_name in TECHNICAL_SKILL_FIELDS}


def _build_technical_alias_pattern(alias: str) -> re.Pattern:
    escaped = re.escape(alias)
    escaped = escaped.replace(r"\ ", r"\s+")
    escaped = escaped.replace(r"\/", r"\s*/\s*")
    escaped = escaped.replace(r"\-", r"\s*-\s*")
    return re.compile(rf"(?<![A-Za-z0-9]){escaped}(?![A-Za-z0-9])", re.I)


def _build_technical_lookup():
    alias_to_categories: Dict[str, List[str]] = {}
    alias_patterns: Dict[str, re.Pattern] = {}

    for category, aliases in TECHNICAL_SKILL_VOCABULARY.items():
        for alias in aliases:
            norm_alias = _normalize_technical_text(alias)
            if not norm_alias:
                continue
            alias_to_categories.setdefault(norm_alias, [])
            if category not in alias_to_categories[norm_alias]:
                alias_to_categories[norm_alias].append(category)
            alias_patterns[norm_alias] = _build_technical_alias_pattern(alias)

    return alias_to_categories, alias_patterns


TECHNICAL_ALIAS_TO_CATEGORIES, TECHNICAL_ALIAS_PATTERNS = _build_technical_lookup()
TECHNICAL_SORTED_ALIASES = sorted(
    TECHNICAL_ALIAS_TO_CATEGORIES.keys(),
    key=lambda value: (-len(value), value),
)
TECHNICAL_SECTION_LABELS_NORM = {
    _normalize_technical_text(label) for label in TECHNICAL_SECTION_LABELS
}


def _is_technical_section_label(label: Optional[str]) -> bool:
    norm_label = _normalize_technical_text(label)
    if not norm_label:
        return False
    if norm_label in TECHNICAL_SECTION_LABELS_NORM:
        return True
    return any(keyword in norm_label for keyword in TECHNICAL_SECTION_KEYWORDS)


def _resolve_technical_categories(name: str, categories: List[str]) -> List[str]:
    norm_name = _normalize_technical_text(name)
    if norm_name in MULTI_CATEGORY_TECH_ITEMS:
        return MULTI_CATEGORY_TECH_ITEMS[norm_name]
    if norm_name in PREFERRED_CATEGORY_BY_ITEM:
        return PREFERRED_CATEGORY_BY_ITEM[norm_name]

    unique_categories = []
    seen = set()
    for category in categories or []:
        if category in TECHNICAL_SKILL_FIELDS and category not in seen:
            seen.add(category)
            unique_categories.append(category)

    for category in CATEGORY_PRIORITY:
        if category in unique_categories:
            return [category]
    return unique_categories


def split_skill_line(line: str) -> List[str]:
    """
    Sépare une ligne de skills par virgule, slash, pipe, point-virgule, bullet.
    Ne découpe pas certains termes techniques comme CI/CD.
    """
    text = _clean_technical_text(line)
    if not text:
        return []

    protected = text
    placeholders: Dict[str, str] = {}

    for idx, term in enumerate(PROTECTED_SLASH_SKILL_TERMS):
        placeholder = f"__TECH_TERM_{idx}__"
        updated = re.sub(re.escape(term), placeholder, protected, flags=re.I)
        if updated != protected:
            placeholders[placeholder] = term
            protected = updated

    chunks = re.split(r"\s*(?:,|;|\||•|·|▪|◦)\s*", protected)
    parts: List[str] = []

    for chunk in chunks:
        if not chunk:
            continue
        if "/" in chunk:
            parts.extend(re.split(r"\s*/\s*", chunk))
        else:
            parts.append(chunk)

    out: List[str] = []
    seen = set()

    for part in parts:
        for placeholder, term in placeholders.items():
            part = part.replace(placeholder, term)
        clean_part = _clean_technical_text(part)
        if not clean_part:
            continue
        key = _normalize_technical_text(clean_part)
        if key and key not in seen:
            seen.add(key)
            out.append(clean_part)

    return out


def _strip_skill_label_prefix(text: Optional[str]) -> Optional[str]:
    clean_text = _clean_technical_text(text)
    if not clean_text or ":" not in clean_text:
        return clean_text

    head, tail = clean_text.split(":", 1)
    head = _clean_technical_text(head)
    tail = _clean_technical_text(tail)

    if head and tail and len(head.split()) <= 4:
        return tail
    return clean_text


def _strip_fragment_connectors(text: Optional[str]) -> Optional[str]:
    clean_text = _clean_technical_text(text)
    if not clean_text:
        return None
    clean_text = re.sub(r"^(?:and|or|et|ou)\s+", "", clean_text, flags=re.I)
    clean_text = re.sub(r"\s*(?:and|or|et|ou)\s*$", "", clean_text, flags=re.I)
    clean_text = clean_text.strip(" ,.;:()[]{}")
    return clean_text or None


def _collect_technical_matches(fragment: str) -> List[dict]:
    matches: List[dict] = []
    occupied: List[Tuple[int, int]] = []

    for alias in TECHNICAL_SORTED_ALIASES:
        pattern = TECHNICAL_ALIAS_PATTERNS[alias]
        for match in pattern.finditer(fragment):
            span = match.span()
            if any(not (span[1] <= start or span[0] >= end) for start, end in occupied):
                continue
            occupied.append(span)
            matches.append(
                {
                    "span": span,
                    "text": _clean_technical_text(match.group(0)) or match.group(0),
                    "alias": alias,
                    "categories": TECHNICAL_ALIAS_TO_CATEGORIES[alias],
                }
            )

    matches.sort(key=lambda item: item["span"][0])
    return matches


def _leftover_tokens_after_matches(fragment: str, matches: List[dict]) -> List[str]:
    if not matches:
        return []

    chars = list(fragment)
    for match in matches:
        start, end = match["span"]
        for idx in range(start, end):
            chars[idx] = " "

    leftover = _normalize_technical_text("".join(chars))
    if not leftover:
        return []
    return [token for token in leftover.split() if token]


def _should_keep_full_fragment(fragment: str, match: dict) -> bool:
    norm_fragment = _normalize_technical_text(fragment)
    norm_match = _normalize_technical_text(match.get("text"))
    if not norm_fragment or not norm_match:
        return False
    if norm_fragment == norm_match:
        return True

    leftover_tokens = _leftover_tokens_after_matches(fragment, [match])
    return bool(leftover_tokens) and all(
        token in BENIGN_TECH_MODIFIERS for token in leftover_tokens
    )


def _fragment_is_fully_technical(fragment: str, matches: List[dict]) -> bool:
    if not matches:
        return False
    if len(matches) == 1 and _should_keep_full_fragment(fragment, matches[0]):
        return True

    leftover_tokens = _leftover_tokens_after_matches(fragment, matches)
    if not leftover_tokens:
        return True
    return all(token in IGNORABLE_TECH_LEFTOVER_TOKENS for token in leftover_tokens)


def _looks_like_other_technical_tool(fragment: str, section_label: Optional[str] = None) -> bool:
    clean_fragment = _clean_technical_text(fragment)
    candidate = clean_fragment.strip(".,:;()[]{}") if clean_fragment else None
    if not candidate or len(candidate.split()) > 4:
        return False

    if re.search(r"[+#/]", candidate):
        return True
    if re.search(r"[A-Za-z0-9]\.[A-Za-z0-9]", candidate):
        return True
    if re.search(r"[A-Za-z0-9]-[A-Za-z0-9]", candidate):
        return True
    if re.search(r"\d", candidate):
        return True
    if re.fullmatch(r"[A-Z]{2,10}", candidate):
        return True
    if re.search(r"[a-z][A-Z]", candidate):
        return True
    return False


def _extract_technical_mentions(text: str, section_label: Optional[str] = None) -> Tuple[List[dict], bool]:
    base_text = _strip_skill_label_prefix(text)
    if not base_text:
        return [], False

    fragments = split_skill_line(base_text) or [base_text]
    collected: List[dict] = []
    fully_consumed = bool(fragments)

    for fragment in fragments:
        fragment_matches = _collect_technical_matches(fragment)
        if not fragment_matches:
            if _looks_like_other_technical_tool(fragment, section_label=section_label):
                collected.append(
                    {
                        "name": _strip_fragment_connectors(fragment) or fragment,
                        "categories": ["other_technical_tools"],
                    }
                )
            else:
                fully_consumed = False
            continue

        if len(fragment_matches) == 1 and _should_keep_full_fragment(fragment, fragment_matches[0]):
            collected.append(
                {
                    "name": fragment,
                    "categories": fragment_matches[0]["categories"],
                }
            )
        else:
            for match in fragment_matches:
                collected.append(
                    {
                        "name": match["text"],
                        "categories": match["categories"],
                    }
                )

        if not _fragment_is_fully_technical(fragment, fragment_matches):
            fully_consumed = False

    deduped: List[dict] = []
    seen = set()
    for item in collected:
        name = _clean_technical_text(item.get("name"))
        if not name:
            continue
        key = _normalize_technical_text(name)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(
            {
                "name": name,
                "categories": _resolve_technical_categories(
                    name,
                    list(item.get("categories") or []),
                ),
            }
        )

    return deduped, fully_consumed


def extract_and_classify_technical_skills(result: dict) -> dict:
    """
    Détecte les compétences techniques présentes dans :
    - skills
    - skills_raw
    - experience[].technologies
    - stages[].technologies
    - projects[].technologies
    Puis les classe dans technical_skills.
    """
    if not isinstance(result, dict):
        return {"technical_skills": _blank_technical_skills()}

    technical_skills = _blank_technical_skills()
    seen_by_category = {field_name: set() for field_name in TECHNICAL_SKILL_FIELDS}

    def add_technical_item(category: str, value) -> None:
        if category not in technical_skills:
            return
        clean_value = _clean_technical_text(value)
        if not clean_value:
            return
        key = _normalize_technical_text(clean_value)
        if not key or key in seen_by_category[category]:
            return
        seen_by_category[category].add(key)
        technical_skills[category].append(clean_value)

    existing_technical = result.get("technical_skills")
    if isinstance(existing_technical, dict):
        for category in TECHNICAL_SKILL_FIELDS:
            for item in existing_technical.get(category) or []:
                add_technical_item(category, item)

    for section_name in ("skills_raw",):
        raw_sections = result.get(section_name) or []
        for entry in raw_sections:
            if isinstance(entry, dict):
                section_label = entry.get("section_title") or entry.get("title") or entry.get("category")
                for line in entry.get("lines") or []:
                    matches, _ = _extract_technical_mentions(line, section_label=section_label)
                    for match in matches:
                        for category in match["categories"]:
                            add_technical_item(category, match["name"])
            elif isinstance(entry, str):
                matches, _ = _extract_technical_mentions(entry)
                for match in matches:
                    for category in match["categories"]:
                        add_technical_item(category, match["name"])

    cleaned_skill_groups: List[dict] = []
    for group in result.get("skills") or []:
        if not isinstance(group, dict):
            continue

        section_label = group.get("category")
        kept_items = []

        for item in group.get("items") or []:
            if isinstance(item, dict):
                name = item.get("name")
            else:
                name = item

            matches, fully_consumed = _extract_technical_mentions(name, section_label=section_label)
            for match in matches:
                for category in match["categories"]:
                    add_technical_item(category, match["name"])

            if not fully_consumed:
                kept_items.append(item)

        if kept_items:
            new_group = dict(group)
            new_group["items"] = kept_items
            cleaned_skill_groups.append(new_group)

    result["skills"] = cleaned_skill_groups

    def extract_from_entry_content(entries, projects_key: bool = False) -> None:
        for entry in entries or []:
            if not isinstance(entry, dict):
                continue

            for text_value in (entry.get("description"),):
                matches, _ = _extract_technical_mentions(text_value)
                for match in matches:
                    for category in match["categories"]:
                        add_technical_item(category, match["name"])

            for bullet in entry.get("bullets") or []:
                matches, _ = _extract_technical_mentions(bullet)
                for match in matches:
                    for category in match["categories"]:
                        add_technical_item(category, match["name"])

            for responsibility in entry.get("responsibilities") or []:
                matches, _ = _extract_technical_mentions(responsibility)
                for match in matches:
                    for category in match["categories"]:
                        add_technical_item(category, match["name"])

            for tech_item in entry.get("technologies") or []:
                matches, _ = _extract_technical_mentions(tech_item)
                for match in matches:
                    for category in match["categories"]:
                        add_technical_item(category, match["name"])

            if projects_key:
                for project in entry.get("projects") or []:
                    if not isinstance(project, dict):
                        continue
                    for text_value in (project.get("description"),):
                        matches, _ = _extract_technical_mentions(text_value)
                        for match in matches:
                            for category in match["categories"]:
                                add_technical_item(category, match["name"])
                    for bullet in project.get("bullets") or []:
                        matches, _ = _extract_technical_mentions(bullet)
                        for match in matches:
                            for category in match["categories"]:
                                add_technical_item(category, match["name"])
                    for tech_item in project.get("technologies") or []:
                        matches, _ = _extract_technical_mentions(tech_item)
                        for match in matches:
                            for category in match["categories"]:
                                add_technical_item(category, match["name"])

    extract_from_entry_content(result.get("experience"), projects_key=True)
    extract_from_entry_content(result.get("stages"), projects_key=True)
    extract_from_entry_content(result.get("projects"))

    result["technical_skills"] = technical_skills
    return result


# =============================================================================
# LLAMA VISION EXTRACTOR
# =============================================================================

class LlamaVisionExtractor:

    _TEXT_LEVELS = {
        "native", "natif", "mother tongue", "bilingue", "bilingual",
        "fluent", "courant", "full", "advanced", "avancé", "avance",
        "intermediate", "intermédiaire", "intermediaire",
        "limited", "basic", "notions", "elementary", "débutant", "debutant",
        "beginner", "proficient", "familiar", "junior", "senior",
        "expert", "a1", "a2", "b1", "b2", "c1", "c2",
    }
    _HUMAN_LANGUAGE_LEVEL_HINTS = {
        "native", "natif", "mother tongue", "bilingue", "bilingual",
        "fluent", "courant", "a1", "a2", "b1", "b2", "c1", "c2",
    }
    _LANGUAGE_TEXT_LEVELS = {
        "native", "natif", "mother tongue", "bilingue", "bilingual",
        "fluent", "courant", "full", "advanced", "avancé", "avance",
        "intermediate", "intermédiaire", "intermediaire",
        "limited", "basic", "notions", "elementary", "débutant", "debutant",
        "a1", "a2", "b1", "b2", "c1", "c2",
        "langue maternelle", "maternelle", "très bien", "tres bien", "bien",
    }
    _ICON_NAME_MAP = {
        "word": "Microsoft Word",
        "excel": "Microsoft Excel",
        "outlook": "Microsoft Outlook",
        "powerpoint": "Microsoft PowerPoint",
        "power point": "Microsoft PowerPoint",
        "onenote": "Microsoft OneNote",
        "one note": "Microsoft OneNote",
    }
    _KNOWN_TOP_LEVEL_KEYS = {
        "personal_info", "summary", "education", "experience", "stages", "skills", "skills_raw",
        "languages", "certifications", "projects", "interests", "volunteer",
        "associations", "additional_info", "other_sections", "awards",
        "experience_years", "experience_warnings",
        "stage_months", "stage_years", "total_career_months", "total_career_years",
        "_error", "_raw",
    }
    _CERTIFICATION_KEYWORDS = {
        "certificate", "certification", "certificat", "certified",
        "accreditation", "accredited", "credential", "credentials",
        "license", "licence", "licensed", "microcredential",
        "micro credential", "badge", "professional certificate",
        "certified solutions expert",
    }
    _ACADEMIC_DEGREE_KEYWORDS = {
        "bachelor", "bachelor's", "bachelor degree", "bachelor's degree",
        "master", "master's", "master degree", "master's degree",
        "doctorate", "doctoral", "doctor of philosophy",
        "phd", "ph.d", "ph.d.",
        "associate degree", "graduate degree", "undergraduate",
        "engineering degree", "engineer degree",
        "bs", "b.s", "b.s.", "ba", "b.a", "b.a.",
        "bsc", "b.sc", "b.sc.",
        "ms", "m.s", "m.s.", "ma", "m.a", "m.a.",
        "msc", "m.sc", "m.sc.",
        "mba", "llm", "jd", "md",
        "licence", "licence universitaire", "licence fondamentale",
        "licence appliquee", "licence appliquée",
        "master 1", "master 2",
        "mastère", "mastere",
        "mastère spécialisé", "mastere specialise", "mastère specialise",
        "doctorat", "doctoral",
        "maîtrise", "maitrise",
        "diplôme d'ingénieur", "diplome d'ingenieur",
        "ingénieur", "ingenieur",
        "ingénieur d'état", "ingenieur d'etat",
        "cycle ingénieur", "cycle ingenieur",
        "bts", "dut", "deust", "cap", "bep",
        "bac", "baccalauréat", "baccalaureat",
        "bac+2", "bac+3", "bac+5", "bac+8",
        "diplôme national de licence", "diplome national de licence",
        "diplôme national de master", "diplome national de master",
        "ingéniorat", "ingeniorat",
    }
    _ACADEMIC_DEGREE_REGEX_PATTERNS = [
        r"\bbac\+\s*\d\b", r"\bmaster\s*[12]\b",
        r"\bbachelor\b", r"\bbachelor s\b", r"\bbachelor degree\b",
        r"\bmaster\b", r"\bmaster s\b", r"\bmaster degree\b",
        r"\bph\.?\s*d\b", r"\bdoctorat\b", r"\bdoctorate\b", r"\bdoctoral\b",
        r"\blicence\b", r"\bmaîtrise\b", r"\bmastere\b", r"\bmastere specialise\b",
        r"\bdiplôme d ingénieur\b", r"\bingénieur\b", r"\bingénieur d etat\b",
        r"\bcycle ingénieur\b", r"\bbaccalauréat\b",
        r"\bbts\b", r"\bdut\b", r"\bdeust\b", r"\bcap\b", r"\bbep\b",
        r"\bassociate degree\b", r"\bengineering degree\b", r"\bengineer degree\b",
    ]
    _LANGUAGE_CATEGORY_LABELS = {
        "languages", "langues", "langue", "language",
        "spoken languages", "langues parlées", "human languages",
        "langues humaines", "langues maternelles",
    }
    _PROGRAMMING_CATEGORY_LABELS = {
        "programming languages", "technical languages",
        "computer languages", "languages techniques",
        "langages de programmation",
    }
    _PASSION_CATEGORY_LABELS = {
        "passions", "passion", "hobbies", "hobby", "intérêts", "interests",
    }
    _PASSION_ITEM_KEYWORDS = {
        "traveling", "travelling", "travel", "photography", "music",
        "running", "reading", "cooking", "painting", "dancing",
        "yoga", "hiking", "cycling", "swimming", "sports",
        "gaming", "gardening", "writing", "food",
        "books", "reading books", "book reading",
    }
    _SKILL_PARENT_SECTION_LABELS = {
        "skills", "skill", "compétences", "competences", "competencies",
        "core competencies", "key competencies", "key skills",
        "expertise", "areas of expertise", "professional skills",
        "technical skills", "functional skills", "qualifications",
        "strengths", "know-how", "savoir-faire",
    }
    _HUMAN_LANGUAGES = {
        "english", "anglais", "french", "français", "francais",
        "arabic", "arabe", "spanish", "espagnol", "espanol",
        "german", "allemand", "italian", "italien",
        "portuguese", "portugais", "dutch", "néerlandais", "neerlandais", "hollandais",
        "turkish", "turc", "russian", "russe",
        "chinese", "chinois", "mandarin", "japanese", "japonais",
        "korean", "coréen", "coreen", "hindi", "urdu",
        "polish", "polonais", "romanian", "roumain",
        "swedish", "suédois", "suedois", "norwegian", "norvégien", "norvegien",
        "danish", "danois", "finnish", "finnois", "greek", "grec",
        "czech", "tchèque", "tcheque", "hungarian", "hongrois",
        "thai", "thaï", "vietnamese", "vietnamien",
        "indonesian", "indonésien", "indonesien", "malay", "malais",
        "tamil", "bengali", "persian", "farsi", "persan",
        "hebrew", "hébreu", "hebreu", "ukrainian", "ukrainien",
        "serbian", "serbe", "croatian", "croate", "bulgarian", "bulgare",
        "slovak", "slovaque", "slovenian", "slovène", "slovene",
        "catalan", "latvian", "letton", "lithuanian", "lituanien",
        "estonian", "estonien", "albanian", "albanais",
        "georgian", "géorgien", "georgien", "armenian", "arménien", "armenien",
        "swahili",
    }
    _TECH_SKILLS_BY_DOMAIN = {
        "programming_languages": {
            "python", "java", "javascript", "typescript", "sql",
            "html", "css", "xml", "json",
            "c", "c++", "c#", "go", "rust", "php", "ruby",
            "scala", "kotlin", "swift", "r", "matlab", "sas",
            "perl", "lua", "dart", "bash", "shell", "powershell",
            "vba", "pl/sql", "objective-c", "objective c",
            "assembly", "solidity", "groovy", ".net", "node.js", "nodejs"
        },
        "backend_frameworks": {
            "fastapi", "flask", "django", "spring", "spring boot",
            "laravel", "express", "nestjs"
        },
        "frontend": {"react", "angular", "vue", "next.js", "nextjs"},
        "data_ai": {
            "pandas", "numpy", "scikit-learn", "tensorflow", "pytorch",
            "llm", "nlp", "rag", "transformers", "langchain"
        },
        "cloud_devops": {
            "docker", "kubernetes", "aws", "azure", "gcp",
            "terraform", "jenkins", "linux", "git"
        },
        "databases": {
            "postgresql", "mysql", "mongodb", "redis", "sqlite", "oracle"
        },
    }
    _TECHNICAL_SECTION_LABELS = {
        "technical skills", "tech skills", "skills techniques",
        "tech stack", "stack technique", "technology stack",
        "tools", "outils", "outils et technologies",
        "frameworks", "libraries", "bibliothèques", "bibliotheques",
        "databases", "bases de données", "bases de donnees",
        "cloud", "devops", "software", "development tools",
        "technologies", "technologies & tools",
        "programming", "engineering tools",
        "ai", "ai/ml", "machine learning", "data science", "backend", "frontend",
    }
    _TECH_CONTEXT_HINTS = {
        "python", "sql", "javascript", "typescript", "java",
        "c", "c++", "c#", "go", "rust", "php", "ruby",
        "scala", "kotlin", "swift", "r", "matlab",
        "fastapi", "django", "flask", "spring", "laravel",
        "react", "angular", "vue", "node", "node.js",
        "docker", "kubernetes", "aws", "azure", "gcp",
        "git", "linux", "postgresql", "mysql", "mongodb",
        "redis", "pandas", "numpy", "tensorflow", "pytorch",
        "llm", "nlp", "rag", "transformers", "langchain"
    }

    def __init__(self, settings: Settings):
        if not settings.groq_api_key:
            raise ValueError("GROQ_API_KEY manquante.")
        self.settings = settings
        self.client = Groq(api_key=settings.groq_api_key)
        self.model = settings.vision_model
        self._text_levels_norm = {self._normalize_for_match(x) for x in self._TEXT_LEVELS}
        self._human_language_levels_norm = {self._normalize_for_match(x) for x in self._HUMAN_LANGUAGE_LEVEL_HINTS}
        self._language_text_levels_norm = {self._normalize_for_match(x) for x in self._LANGUAGE_TEXT_LEVELS}
        self._human_languages_norm = {self._normalize_for_match(x) for x in self._HUMAN_LANGUAGES}
        self._language_category_labels_norm = {self._normalize_for_match(x) for x in self._LANGUAGE_CATEGORY_LABELS}
        self._programming_category_labels_norm = {self._normalize_for_match(x) for x in self._PROGRAMMING_CATEGORY_LABELS}
        self._passion_category_labels_norm = {self._normalize_for_match(x) for x in self._PASSION_CATEGORY_LABELS}
        self._passion_item_keywords_norm = {self._normalize_for_match(x) for x in self._PASSION_ITEM_KEYWORDS}
        self._skill_parent_section_labels_norm = {self._normalize_for_match(x) for x in self._SKILL_PARENT_SECTION_LABELS}
        self._academic_degree_keywords_norm = {self._normalize_for_match(x) for x in self._ACADEMIC_DEGREE_KEYWORDS}
        self._certification_keywords_norm = {self._normalize_for_match(x) for x in self._CERTIFICATION_KEYWORDS}
        self._strong_certification_keywords_norm = self._certification_keywords_norm.copy()
        self._explicit_cert_words_norm = {
            self._normalize_for_match(x)
            for x in {"certificate", "certification", "certificat", "certified",
                      "license", "licence", "credential", "badge"}
        }
        all_tech_skills = set()
        for domain_skills in self._TECH_SKILLS_BY_DOMAIN.values():
            all_tech_skills.update(domain_skills)
        self._technical_language_skills_norm = {self._normalize_for_match(x) for x in all_tech_skills}
        self._technical_section_labels_norm = {self._normalize_for_match(x) for x in self._TECHNICAL_SECTION_LABELS}
        self._tech_context_hints_norm = {self._normalize_for_match(x) for x in self._TECH_CONTEXT_HINTS}

    # =========================================================================
    # Base helpers
    # =========================================================================

    def _normalize_for_match(self, value: str) -> str:
        if not value:
            return ""
        value = unicodedata.normalize("NFKD", value)
        value = "".join(ch for ch in value if not unicodedata.combining(ch))
        value = value.casefold()
        # CORRECTION: convertir · en espace avant de supprimer les autres caractères
        value = value.replace("\u00b7", " ")
        value = re.sub(r"[^a-z0-9+#/.\- ]+", " ", value)
        return re.sub(r"\s+", " ", value).strip()

    def _clean_text(self, value):
        if value is None:
            return None
        if isinstance(value, str):
            value = re.sub(r"\s+", " ", value).strip()
            if value.lower() in {"", "null", "none", "n/a", "{}", "[]"}:
                return None
        return value

    def _dedupe_str_list(self, values):
        out, seen = [], set()
        for v in values:
            if not isinstance(v, str):
                continue
            s = re.sub(r"\s+", " ", v).strip(" -\t\n\r")
            if not s:
                continue
            key = s.casefold()
            if key not in seen:
                seen.add(key)
                out.append(s)
        return out

    def _safe_json_loads(self, text: str):
        if not text or not isinstance(text, str):
            return None

        text = text.strip()

        # 1) JSON direct
        try:
            return json.loads(text)
        except Exception:
            pass

        # 2) bloc ```json ... ```
        fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
        if fenced:
            try:
                return json.loads(fenced.group(1))
            except Exception:
                pass

        # 3) premier objet JSON équilibré
        start = text.find("{")
        if start != -1:
            depth = 0
            for i in range(start, len(text)):
                ch = text[i]
                if ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        candidate = text[start:i+1]
                        try:
                            return json.loads(candidate)
                        except Exception:
                            break

        return None

    def _contains_keyword_phrase(self, norm_text: str, keywords_norm: set) -> bool:
        if not norm_text:
            return False
        for kw in keywords_norm:
            if not kw:
                continue
            pattern = rf"(?<![a-z0-9]){re.escape(kw)}(?![a-z0-9])"
            if re.search(pattern, norm_text):
                return True
        return False

    def _word_count(self, text: str) -> int:
        text = self._clean_text(text) or ""
        return len(text.split())

    def _humanize_section_key(self, key: str) -> str:
        key = self._clean_text(key) or ""
        key = re.sub(r"([a-z])([A-Z])", r"\1 \2", key)
        key = re.sub(r"[_\-]+", " ", key)
        key = re.sub(r"\s+", " ", key).strip()
        if not key:
            return "Additional Info"
        return key[:1].upper() + key[1:]

    def _section_alias_map(self) -> dict:
        return {
            "skills": {
                "skills", "skill", "compétences", "competences", "expertise",
                "savoir-faire", "know-how", "qualifications",
                "technical skills", "hard skills", "soft skills",
                "logiciels", "informatique", "outils", "software",
                "it", "computer skills", "digital skills",
            },
            "languages": {
                "languages", "language", "langues", "langue"
            },
            "software": {
                "logiciels", "software", "software tools", "outils"
            },
            "it": {
                "informatique", "it", "computer skills", "digital skills"
            },
            "education": {
                "education", "formation", "formations", "études", "etudes",
                "voie académique", "voie academique", "academic background",
                "diplômes et formations", "diplomes et formations"
            },
            "experience": {
                "experience", "expérience", "expériences professionnelles",
                "experiences professionnelles", "professional experience",
                "employment history", "work experience",
            },
            "stages": {
                "stage", "stages", "internship", "internships",
                "expérience de stage", "experiences de stage",
                "internship experience", "training",
            },
            "certifications": {
                "certifications", "certification", "certificat", "certificats"
            },
            "projects": {
                "projects", "projets",
                "projets académiques", "projets academiques",
                "projets académique", "projets academique",
                "academic projects", "projet académique",
                "projet academique",
                "selected project experience", "project experience",
                "selected projects", "key projects", "notable projects",
                "relevant projects", "personal projects", "side projects",
                "project highlights", "project work",
            },
            "associations": {
                "vie associative", "associations", "activities", "activités", "activites"
            }
        }

    def _map_section_title(self, title: Optional[str]) -> Optional[str]:
        title = self._clean_text(title)
        if not title:
            return None

        norm = self._normalize_for_match(title)

        for target, aliases in self._section_alias_map().items():
            aliases_norm = {self._normalize_for_match(x) for x in aliases}
            if norm in aliases_norm:
                return target

        return None

    def _coerce_personal_info_field(self, value) -> Optional[str]:
        if value is None:
            return None
        if isinstance(value, list):
            parts = [
                re.sub(r"\s+", " ", str(v)).strip()
                for v in value
                if v is not None and str(v).strip() not in {"", "null", "none", "n/a"}
            ]
            return " / ".join(parts) if parts else None
        return self._clean_text(value)

    def _normalize_bullet_or_label(self, text: Optional[str]) -> Optional[str]:
        text = self._clean_text(text)
        if not text:
            return None
        text = re.sub(r"^\s*[-*•▪◦·●?]+\s*", "", text).strip()
        text = re.sub(r"\s*:\s*$", "", text).strip()
        return text or None
    # =========================================================================
    # Text / fingerprint helpers
    # =========================================================================

    def _text_fingerprint(self, value) -> str:
        """
        Retourne une empreinte texte stable pour la déduplication.
        Accepte str, dict, list, etc.
        """
        if value is None:
            return ""

        if isinstance(value, (dict, list, tuple, set)):
            fragments = self._collect_text_fragments(value)
            if not fragments:
                return ""
            value = " ".join(fragments)

        if not isinstance(value, str):
            value = str(value)

        value = self._clean_text(value)
        if not value:
            return ""

        norm = self._normalize_for_match(value)
        norm = re.sub(
            r"^(mobile|phone|telephone|tel|email|website|address|linkedin|github|location|web)\s*:\s*",
            "",
            norm,
        ).strip()
        return norm

    def _is_already_known_content(self, value, known: set) -> bool:
        fp = self._text_fingerprint(value)
        if not fp:
            return True
        if fp in known:
            return True
        if len(fp) >= 12:
            for k in known:
                if len(k) >= 12 and (fp in k or k in fp):
                    return True
        return False

    def _normalize_additional_info_value_for_dedupe(self, value) -> str:
        fp = self._text_fingerprint(value)
        if not fp:
            return ""
        return re.sub(r"\s+", " ", fp).strip()

    def _is_additional_info_content_already_captured(self, value, known: set) -> bool:
        if self._is_already_known_content(value, known):
            return True
        norm_value = self._normalize_additional_info_value_for_dedupe(value)
        if not norm_value:
            return True
        if norm_value in known:
            return True
        if len(norm_value) >= 12:
            for k in known:
                if len(k) >= 12 and (norm_value in k or k in norm_value):
                    return True
        return False

    def _collect_known_content_fingerprints(self, result: dict) -> set:
        known = set()

        def add_any(value):
            for frag in self._collect_text_fragments(value):
                fp = self._text_fingerprint(frag)
                if fp:
                    known.add(fp)

        pi = result.get("personal_info", {}) or {}
        if isinstance(pi, dict):
            for key in [
                "full_name", "email", "phone", "location",
                "linkedin", "github", "website", "birth_date", "nationality",
            ]:
                add_any(pi.get(key))

        add_any(result.get("summary"))

        for row in result.get("education", []) or []:
            if isinstance(row, dict):
                for key in [
                    "degree", "field", "institution", "location",
                    "honors", "start_date", "end_date", "gpa",
                ]:
                    add_any(row.get(key))

        for section_key in ("experience", "stages"):
            for row in result.get(section_key, []) or []:
                if isinstance(row, dict):
                    for key in [
                        "job_title", "title", "company", "location",
                        "start_date", "end_date", "description",
                    ]:
                        add_any(row.get(key))
                    add_any(row.get("responsibilities"))
                    add_any(row.get("technologies"))
                    add_any(row.get("projects"))

        for group in result.get("skills", []) or []:
            if isinstance(group, dict):
                add_any(group.get("category"))
                add_any(group.get("items"))

        for row in result.get("languages", []) or []:
            if isinstance(row, dict):
                add_any(row.get("name"))
                add_any(row.get("level"))

        for row in result.get("certifications", []) or []:
            if isinstance(row, dict):
                add_any(row.get("name"))
                add_any(row.get("issuer"))
                add_any(row.get("date"))

        for row in result.get("projects", []) or []:
            if isinstance(row, dict):
                add_any(row.get("name"))
                add_any(row.get("role"))
                add_any(row.get("description"))
                add_any(row.get("bullets"))
                add_any(row.get("technologies"))

        for row in result.get("volunteer", []) or []:
            if isinstance(row, dict):
                add_any(row.get("role"))
                add_any(row.get("organization"))
                add_any(row.get("location"))
                add_any(row.get("start_date"))
                add_any(row.get("end_date"))
                add_any(row.get("description"))
                add_any(row.get("bullets"))

        for row in result.get("associations", []) or []:
            if isinstance(row, dict):
                add_any(row.get("role"))
                add_any(row.get("organization"))
                add_any(row.get("location"))
                add_any(row.get("start_date"))
                add_any(row.get("end_date"))
                add_any(row.get("description"))
                add_any(row.get("bullets"))

        for row in result.get("additional_info", []) or []:
            if isinstance(row, dict):
                add_any(row.get("title"))
                add_any(row.get("organization"))
                add_any(row.get("location"))
                add_any(row.get("start_date"))
                add_any(row.get("end_date"))
                add_any(row.get("description"))
                add_any(row.get("bullets"))
                add_any(row.get("items"))

        add_any(result.get("interests"))
        add_any(result.get("awards"))

        return known

    def _build_non_skill_fingerprints(self, data: dict) -> set:
        fps = set()

        def add_text(value):
            fp = self._text_fingerprint(value)
            if fp:
                fps.add(fp)

        add_text(data.get("summary"))

        for row in data.get("education", []) or []:
            if not isinstance(row, dict):
                continue
            for key in ("degree", "field", "institution", "honors", "location"):
                add_text(row.get(key))

        for section_key in ("experience", "stages"):
            for row in data.get(section_key, []) or []:
                if not isinstance(row, dict):
                    continue
                for key in ("job_title", "title", "company", "location", "description", "start_date", "end_date"):
                    add_text(row.get(key))
                for item in row.get("responsibilities", []) or []:
                    add_text(item)
                for item in row.get("projects", []) or []:
                    add_text(item)
                for item in row.get("technologies", []) or []:
                    add_text(item)

        for row in data.get("languages", []) or []:
            if not isinstance(row, dict):
                continue
            add_text(row.get("name"))
            add_text(row.get("level"))

        for row in data.get("certifications", []) or []:
            if not isinstance(row, dict):
                continue
            add_text(row.get("name"))
            add_text(row.get("issuer"))
            add_text(row.get("date"))

        for row in data.get("projects", []) or []:
            if isinstance(row, dict):
                add_text(row.get("name"))
                add_text(row.get("description"))
                for b in row.get("bullets", []) or []:
                    add_text(b)

        for row in data.get("additional_info", []) or []:
            if isinstance(row, dict):
                add_text(row.get("title"))
                add_text(row.get("description"))
                for b in row.get("items", []) or []:
                    add_text(b)
                for b in row.get("bullets", []) or []:
                    add_text(b)

        for item in data.get("interests", []) or []:
            add_text(item)

        for item in data.get("awards", []) or []:
            add_text(item)

        return fps

    # =========================================================================
    # Coerce helpers
    # =========================================================================

    def _dict_to_inline_text(self, row: dict) -> Optional[str]:
        if not isinstance(row, dict):
            return None
        preferred_order = [
            "name", "title", "role", "organization", "company", "institution",
            "email", "phone", "location", "date", "start_date", "end_date",
            "description", "details", "text", "content",
        ]
        parts = []
        used = set()
        for key in preferred_order + [k for k in row.keys() if k not in preferred_order]:
            if key in used or key not in row:
                continue
            used.add(key)
            value = row.get(key)
            if isinstance(value, str):
                txt = self._clean_text(value)
                if txt:
                    parts.append(txt)
            elif isinstance(value, list):
                vals = self._dedupe_str_list([str(x).strip() for x in value if x])
                if vals:
                    parts.append(" / ".join(vals))
            elif isinstance(value, dict):
                nested = self._dict_to_inline_text(value)
                if nested:
                    parts.append(nested)
            elif value is not None:
                txt = self._clean_text(str(value))
                if txt:
                    parts.append(txt)
        parts = self._dedupe_str_list(parts)
        return "  ".join(parts) if parts else None

    def _coerce_text_block(self, value) -> Optional[str]:
        if value is None:
            return None
        if isinstance(value, str):
            return self._clean_text(value)
        if isinstance(value, list):
            parts = []
            for item in value:
                if isinstance(item, str):
                    txt = self._clean_text(item)
                    if txt:
                        parts.append(txt)
                elif isinstance(item, dict):
                    txt = self._clean_text(
                        item.get("description") or item.get("text") or item.get("content")
                        or item.get("summary") or item.get("value") or item.get("body")
                    )
                    if txt:
                        parts.append(txt)
                elif item is not None:
                    txt = self._clean_text(str(item))
                    if txt:
                        parts.append(txt)
            parts = self._dedupe_str_list(parts)
            return " ".join(parts) if parts else None
        if isinstance(value, dict):
            return self._clean_text(
                value.get("description") or value.get("text") or value.get("content")
                or value.get("summary") or value.get("value") or value.get("body")
            )
        return self._clean_text(str(value))

    def _collect_text_fragments(self, value) -> List[str]:
        out = []
        if value is None:
            return out
        if isinstance(value, str):
            txt = self._clean_text(value)
            if txt:
                out.append(txt)
            return out
        if isinstance(value, list):
            for item in value:
                out.extend(self._collect_text_fragments(item))
            return out
        if isinstance(value, dict):
            preferred_order = [
                "description", "summary", "content", "text", "details", "body",
                "name", "title", "role", "organization", "company", "institution",
                "email", "phone", "location", "date", "start_date", "end_date",
                "bullets", "items", "entries", "activities", "responsibilities",
            ]
            used = set()
            for key in preferred_order + [k for k in value.keys() if k not in preferred_order]:
                if key in used or key not in value:
                    continue
                used.add(key)
                out.extend(self._collect_text_fragments(value.get(key)))
            return out
        txt = self._clean_text(str(value))
        if txt:
            out.append(txt)
        return out

    def _split_skill_name_and_level(self, text: Optional[str]) -> tuple[Optional[str], Optional[str]]:
        text = self._clean_text(text)
        if not text:
            return None, None

        words = text.split()
        if not words:
            return text, None

        known_levels = {
            "expert", "advanced", "intermediate", "beginner",
            "basic", "fluent", "native", "proficient",
            "avancé", "avance", "intermédiaire", "intermediaire",
            "débutant", "debutant", "courant", "bilingue", "natif",
        }
        known_levels_norm = {self._normalize_for_match(x) for x in known_levels}

        last = self._normalize_for_match(words[-1])
        if last in known_levels_norm:
            name = " ".join(words[:-1]).strip()
            level = words[-1].strip()
            if name:
                return name, level

        return text, None

    def _coerce_item_dict(self, item) -> Optional[dict]:
        if isinstance(item, str):
            name, inferred_level = self._split_skill_name_and_level(item)
            name = self._clean_text(name)
            if not name:
                return None

            out = {"name": name}
            if inferred_level and self._is_text_level(inferred_level):
                out["level"] = inferred_level
                out["source"] = "text"
            return out

        if not isinstance(item, dict):
            return None

        raw_name = self._clean_text(item.get("name"))
        raw_level = self._clean_text(item.get("level"))

        raw_name, inferred_level = self._split_skill_name_and_level(raw_name)
        name = self._clean_text(raw_name)
        level = raw_level or self._clean_text(inferred_level)

        if not name:
            return None

        out = {"name": name}

        if level and self._is_text_level(level):
            out["level"] = level
            out["source"] = "text"

        source = self._clean_text(item.get("source"))
        if source:
            out["source"] = source

        confidence = item.get("confidence")
        if confidence is not None:
            try:
                out["confidence"] = max(0.0, min(1.0, float(confidence)))
            except (TypeError, ValueError):
                pass

        return out

    def _coerce_other_section_entry(self, key: str, raw) -> Optional[dict]:
        title = self._humanize_section_key(key)
        if raw in (None, "", [], {}):
            return None

        description = None
        items = []

        if isinstance(raw, str):
            txt = self._clean_text(raw)
            if txt:
                if len(txt.split()) <= 15:
                    items.append(txt)
                else:
                    description = txt

        elif isinstance(raw, list):
            for item in raw:
                if isinstance(item, str):
                    txt = self._clean_text(item)
                    if txt:
                        items.append(txt)
                elif isinstance(item, dict):
                    line = self._dict_to_inline_text(item)
                    if line:
                        items.append(line)
                elif item is not None:
                    txt = self._clean_text(str(item))
                    if txt:
                        items.append(txt)

        elif isinstance(raw, dict):
            description = self._coerce_text_block(
                raw.get("description")
                or raw.get("summary")
                or raw.get("content")
                or raw.get("text")
                or raw.get("details")
                or raw.get("value")
                or raw.get("label")
                or raw.get("body")
            )

            raw_items = (
                raw.get("items")
                or raw.get("bullets")
                or raw.get("entries")
                or raw.get("activities")
                or raw.get("values")
                or raw.get("classes")
                or raw.get("licenses")
                or raw.get("links")
                or raw.get("list")
                or raw.get("data")
                or []
            )

            if isinstance(raw_items, str):
                raw_items = [raw_items]

            for item in raw_items:
                if isinstance(item, str):
                    txt = self._clean_text(item)
                    if txt:
                        items.append(txt)
                elif isinstance(item, dict):
                    line = self._dict_to_inline_text(item)
                    if line:
                        items.append(line)
                elif item is not None:
                    txt = self._clean_text(str(item))
                    if txt:
                        items.append(txt)

            remaining = {
                k: v for k, v in raw.items()
                if k not in {
                    "description", "summary", "content", "text", "details", "value", "label", "body",
                    "items", "bullets", "entries", "activities",
                    "values", "classes", "licenses", "links", "list", "data"
                }
            }

            remaining_line = self._dict_to_inline_text(remaining)
            if remaining_line:
                if not description:
                    description = remaining_line
                else:
                    items.append(remaining_line)

            if description and not items and len(description.split()) <= 15:
                items.append(description)
                description = None

        else:
            txt = self._clean_text(str(raw))
            if txt:
                if len(txt.split()) <= 15:
                    items.append(txt)
                else:
                    description = txt

        items = self._dedupe_str_list(items)

        if not description and not items:
            return None

        return {"title": title, "description": description, "items": items}
    # =========================================================================
    # Language / skill detection helpers
    # =========================================================================

    def _is_text_level(self, level: str) -> bool:
        return bool(level) and self._normalize_for_match(level) in self._text_levels_norm

    def _is_human_language_name(self, name: str) -> bool:
        return bool(name) and self._normalize_for_match(name) in self._human_languages_norm

    def _is_human_language_level_hint(self, level: Optional[str]) -> bool:
        return bool(level) and self._normalize_for_match(level) in self._human_language_levels_norm

    def _is_language_text_level(self, level: str) -> bool:
        return bool(level) and self._normalize_for_match(level) in self._language_text_levels_norm

    def _is_known_technical_language_or_skill(self, name: Optional[str]) -> bool:
        return bool(name) and self._normalize_for_match(name) in self._technical_language_skills_norm

    def _is_language_section(self, category: Optional[str]) -> bool:
        if not category:
            return False
        if self._map_section_title(category) == "languages":
            return True
        return self._normalize_for_match(category) in self._language_category_labels_norm

    def _is_technical_section(self, category: Optional[str]) -> bool:
        if not category:
            return False
        if self._map_section_title(category) in {"skills", "software", "it"}:
            return True
        norm = self._normalize_for_match(category)
        if norm in self._programming_category_labels_norm:
            return True
        if norm in self._technical_section_labels_norm:
            return True
        tech_words = ["tech", "technical", "technology", "programming",
                      "framework", "database", "tools", "stack",
                      "cloud", "devops", "software", "engineering"]
        return any(word in norm for word in tech_words)

    def _looks_like_technical_token(self, name: Optional[str]) -> bool:
        if not name:
            return False
        norm = self._normalize_for_match(name)
        raw = name.casefold()
        if norm in self._technical_language_skills_norm:
            return True
        if norm in self._tech_context_hints_norm:
            return True
        special_forms = {"c++", "c#", ".net", "node.js", "pl/sql", "objective-c"}
        if any(x in raw for x in special_forms):
            return True
        return False

    def _is_human_language(self, name: Optional[str], level: Optional[str] = None) -> bool:
        if not name:
            return False
        parsed_name, _ = self._extract_embedded_language_level(name)
        clean_name = self._clean_text(parsed_name) or self._clean_text(name)
        if not self._is_human_language_name(clean_name):
            return False
        return True

    def _is_certification_category(self, category: Optional[str]) -> bool:
        if not category:
            return False
        if self._map_section_title(category) == "certifications":
            return True
        norm = self._normalize_for_match(category)
        return self._contains_keyword_phrase(norm, self._certification_keywords_norm)

    def _is_passion_category(self, category: Optional[str]) -> bool:
        if not category:
            return False
        return self._normalize_for_match(category) in self._passion_category_labels_norm

    def _is_passion_item_name(self, name: Optional[str]) -> bool:
        if not name:
            return False
        return self._normalize_for_match(name) in self._passion_item_keywords_norm

    def _move_hobbies_from_skills_to_interests(self, result: dict) -> None:
        interests = result.get("interests") or []
        new_skill_groups = []

        for group in result.get("skills", []) or []:
            if not isinstance(group, dict):
                continue

            kept_items = []
            for item in group.get("items", []) or []:
                name = None
                if isinstance(item, dict):
                    name = self._clean_text(item.get("name"))
                elif isinstance(item, str):
                    name = self._clean_text(item)

                if not name:
                    continue

                if self._is_passion_item_name(name):
                    interests.append(name)
                else:
                    kept_items.append(item)

            if kept_items:
                group["items"] = kept_items
                new_skill_groups.append(group)

        result["skills"] = new_skill_groups
        result["interests"] = self._dedupe_str_list(interests)

    def _looks_like_academic_degree(self, text: Optional[str]) -> bool:
        norm = self._normalize_for_match(text or "")
        if not norm:
            return False

        if re.search(r"\bmaitrise\s+(?:de|des|du)\b", norm):
            if not re.search(r"\bmaitrise\s+(?:en|of)\b", norm):
                return False

        if self._contains_keyword_phrase(norm, self._academic_degree_keywords_norm):
            return True
        return any(re.search(pattern, norm) for pattern in self._ACADEMIC_DEGREE_REGEX_PATTERNS)

    def _looks_like_certification_entry(self, degree: str, field: str = None) -> bool:
        blob = " ".join(x for x in [degree, field] if x)
        norm = self._normalize_for_match(blob)
        if not norm:
            return False
        if len(blob.split()) > 6:
            return False
        if self._looks_like_academic_degree(blob):
            return False
        strong_cert_keywords = {
            "certificate", "certification", "certificat", "certified",
            "accreditation", "accredited", "credential", "credentials",
            "badge", "professional certificate", "microcredential",
            "micro credential", "certified solutions expert",
        }
        strong_cert_keywords_norm = {self._normalize_for_match(x) for x in strong_cert_keywords}
        return self._contains_keyword_phrase(norm, strong_cert_keywords_norm)

    def _looks_like_experience_intro(self, text: Optional[str], company: Optional[str] = None) -> bool:
        text = self._clean_text(text)
        if not text:
            return False
        norm = self._normalize_for_match(text)
        company_norm = self._normalize_for_match(company or "")
        if len(text.split()) < 6:
            return False
        if company_norm and company_norm in norm:
            return True
        strong_intro_patterns = [
            r"\bis a company\b",
            r"\bis an? (software|technology|tech|financial|consulting|rental|trading|data) (company|platform|firm|brokerage)\b",
            r"\bwas an? (software|technology|tech|financial|consulting|rental|trading|data) (company|platform|firm|brokerage)\b",
            r"\boffers\b", r"\bprovides\b", r"\bhas built\b",
            r"\bsoftware platform\b", r"\btech-enabled\b",
            r"\binternship\b", r"\bintern lasts\b",
        ]
        return any(re.search(p, norm) for p in strong_intro_patterns)

    def _looks_like_internship_role(self, job_title: Optional[str]) -> bool:
        norm = self._normalize_for_match(job_title or "")
        internship_keywords = [
            "stage", "intern", "internship", "trainee",
            "pfe", "end of study", "end-of-study",
            "stage d ingénieur", "stage d immersion", "stage de fin d etudes"
        ]
        return any(k in norm for k in internship_keywords)

    def _looks_like_short_mission_label(self, text: Optional[str]) -> bool:
        text = self._clean_text(text)
        if not text:
            return False
        norm = self._normalize_for_match(text)

        # Une phrase longue avec sujet/verbe n'est pas un label de mission.
        if len(text.split()) > 8:
            return False

        # Les connecteurs descriptifs signalent une phrase, pas un label.
        if re.search(r"\b(qui|que|dont|pour|avec|afin|permettant|destinée?|basée?)\b", norm):
            return False

        if text.count(".") >= 1 and len(text.split()) > 8:
            return False
        if "," in text and len(text.split()) <= 8:
            return False
        if text.endswith(":"):
            return True
        strong_patterns = [
            r"\bweb scraping\b", r"\bconception\b",
            r"\bdeveloppement\b", r"\bdéveloppement\b",
            r"\bclassification\b", r"\bsegmentation\b",
            r"\banalyse\b", r"\bmodelisation\b", r"\bmodélisation\b",
            r"\bpipeline\b", r"\bworkflow\b", r"\betl\b",
            r"\bdashboard\b", r"\bmatching\b", r"\baudit\b",
        ]
        return any(re.search(p, norm) for p in strong_patterns)

    def _extract_embedded_language_level(self, text: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
        text = self._clean_text(text)
        if not text:
            return None, None
        separators = [":", "-", "–", "—", "(", ")", "/", "|"]
        work = text
        for sep in separators:
            work = work.replace(sep, " | ")
        chunks = [self._clean_text(x) for x in work.split("|")]
        chunks = [x for x in chunks if x]
        if len(chunks) >= 2:
            first = chunks[0]
            rest = " ".join(chunks[1:])
            if self._is_human_language_name(first) and self._is_language_text_level(rest):
                return first, rest
        norm_text = self._normalize_for_match(text)
        for lvl in sorted(self._language_text_levels_norm, key=len, reverse=True):
            pattern = rf"(?<![a-z0-9]){re.escape(lvl)}(?![a-z0-9])"
            if re.search(pattern, norm_text):
                original_name = text
                for token in separators:
                    original_name = original_name.replace(token, " ")
                original_name = re.sub(r"\s+", " ", original_name).strip()
                original_name_norm = self._normalize_for_match(original_name)
                original_name_norm = re.sub(pattern, "", original_name_norm).strip(" -:;/,()")
                if not original_name_norm:
                    return text, lvl
                return original_name_norm, lvl
        return text, None

    def _count_neighbor_context(self, neighbors: List[str]) -> Tuple[int, int]:
        human_count = 0
        tech_count = 0
        for n in neighbors or []:
            n = self._clean_text(n)
            if not n:
                continue
            if self._is_human_language_name(n):
                human_count += 1
                continue
            if self._is_known_technical_language_or_skill(n) or self._looks_like_technical_token(n):
                tech_count += 1
        return human_count, tech_count

    def _classify_language_skill_candidate(
        self,
        name: Optional[str],
        level: Optional[str] = None,
        section_category: Optional[str] = None,
        neighbors: Optional[List[str]] = None,
    ) -> str:
        name = self._clean_text(name)
        level = self._clean_text(level)
        neighbors = neighbors or []
        if not name:
            return "ambiguous"
        parsed_name, inferred_level = self._extract_embedded_language_level(name)
        name = self._clean_text(parsed_name) or name
        level = level or inferred_level
        if self._is_human_language_name(name):
            return "language"
        if self._is_known_technical_language_or_skill(name):
            return "skill"
        human_neighbors, tech_neighbors = self._count_neighbor_context(neighbors)
        if self._is_language_section(section_category):
            if self._is_human_language_level_hint(level) and tech_neighbors == 0:
                return "language"
            if human_neighbors >= 1 and tech_neighbors == 0:
                return "language"
            if tech_neighbors >= 1:
                return "skill"
            return "ambiguous"
        if self._is_technical_section(section_category):
            return "skill"
        if self._looks_like_technical_token(name):
            return "skill"
        if tech_neighbors >= 2 and human_neighbors == 0:
            return "skill"
        if human_neighbors >= 2 and tech_neighbors == 0:
            return "language"
        if self._is_human_language_level_hint(level):
            return "ambiguous"
        return "ambiguous"
    # =========================================================================
    # Skill group helpers
    # =========================================================================

    def _generic_skill_category_labels_norm(self) -> set:
        labels = {
            "skills", "skill", "hard skills", "soft skills", "technical skills",
            "professional skills", "functional skills", "core competencies",
            "key skills", "competencies", "expertise", "industry expertise",
            "areas of expertise", "tools", "technologies", "technology stack",
            "frameworks", "libraries", "software", "software tools",
            "platforms", "methods", "methods & tools", "domains",
            "specialties", "specialisations", "specializations",
            "know-how", "savoir-faire", "strengths", "qualifications",
        }
        return {self._normalize_for_match(x) for x in labels}

    def _generic_skill_categories_norm(self) -> set:
        return self._generic_skill_category_labels_norm()

    def _should_split_skill_text(self, text: Optional[str]) -> bool:
        text = self._clean_text(text)
        if not text:
            return False

        # Une compétence métier avec une seule virgule reste un seul item.
        # Exemple: "Rigueur, précision et fiabilité administrative"
        if "," in text and text.count(",") == 1 and len(text.split()) <= 8:
            return False

        # Split direct si séparateurs typiques de liste visuelle.
        if any(sep in text for sep in ["|", "•", "·", ";"]):
            return True

        # Pour les virgules : seulement si tous les fragments sont courts,
        # ce qui ressemble à une liste d'outils/technologies.
        if "," in text:
            parts = [self._clean_text(p) for p in text.split(",") if self._clean_text(p)]
            if len(parts) >= 2 and all(len((p or "").split()) <= 3 for p in parts):
                return True

        return False

    def _explode_skill_line(self, text: Optional[str]) -> List[str]:
        text = self._clean_text(text)
        if not text:
            return []

        if not self._should_split_skill_text(text):
            return [text]

        parts = re.split(r"\s*(?:\||•|·|;)\s*|\s*,\s*", text)
        parts = [self._clean_text(p) for p in parts if self._clean_text(p)]

        if not parts:
            return []

        # Si le découpage produit des fragments trop descriptifs,
        # on revient à la ligne entière.
        if any(len(p.split()) > 4 for p in parts):
            return [text]

        return parts

    def _looks_like_skill_noise(self, text: Optional[str], section_context: Optional[str] = None) -> bool:
        text = self._clean_text(text)
        if not text:
            return True

        # Bruit évident.
        if "@" in text:
            return True
        if re.search(r"https?://|www\.", text, re.I):
            return True
        if re.search(r"\+?\d[\d\-\s()]{6,}", text):
            return True

        # Ligne purement date.
        if re.fullmatch(r"\d{4}([/-]\d{1,2})?([/-]\d{1,2})?", text):
            return True

        # Paragraphe très long = probablement description, pas compétence.
        if len(text.split()) > 18:
            return True

        return False

    def _looks_like_atomic_skill(self, text: Optional[str]) -> bool:
        text = self._clean_text(text)
        if not text:
            return False

        norm = self._normalize_for_match(text)
        if not norm:
            return False

        if norm in self._generic_skill_category_labels_norm():
            return False

        if self._is_human_language(text):
            return False

        if 1 <= len(text.split()) <= 3:
            return True

        if re.fullmatch(r"[a-z0-9+#/.\- ]{2,40}", norm) and len(text.split()) <= 4:
            return True

        return False

    def _looks_like_skill_item(self, text: Optional[str]) -> bool:
        text = self._clean_text(text)
        if not text:
            return False

        norm = self._normalize_for_match(text)
        if not norm:
            return False

        if self._is_human_language(text):
            return False

        # Trop long = probablement phrase descriptive.
        if len(text.split()) > 12:
            return False

        return True

    def _is_valid_skill_category(self, text: Optional[str]) -> bool:
        text = self._clean_text(text)
        if not text:
            return False

        norm = self._normalize_for_match(text)
        real_subcategories = {
            self._normalize_for_match(x)
            for x in REAL_SKILL_SUBCATEGORY_HEADERS
        }
        return norm in real_subcategories

    def _should_promote_skill_label_to_category(
        self,
        label: Optional[str],
        next_items_count: int = 0,
        is_visually_header: bool = False,
    ) -> bool:
        label = self._clean_text(label)
        if not label:
            return False

        if not self._is_valid_skill_category(label):
            return False

        # Une catégorie skills doit être courte et explicite.
        if len(label.split()) > 4:
            return False

        if not is_visually_header and next_items_count < 2:
            return False

        return True

    def _looks_like_skills_parent_label(self, category: Optional[str]) -> bool:
        return self._is_valid_skill_category(category)

    def _is_generic_skill_parent_category(self, category: Optional[str]) -> bool:
        if not category:
            return True
        return self._is_valid_skill_category(category)

    def _looks_like_explicit_skill_subgroup_label(self, text: Optional[str]) -> bool:
        text = self._clean_text(text)
        if not text:
            return False
        return self._is_valid_skill_category(text)

    def is_real_skill_category(self, label: Optional[str]) -> bool:
        return self._is_valid_skill_category(label)

    def _strip_skill_category_label(self, value: str) -> str:
        value = self._clean_text(value) or ""
        value = re.sub(r"\s*[:\-–—|]+\s*$", "", value).strip()
        return value or "Skills"

    def _normalize_skill_category_name(self, category: Optional[str], raw_text: Optional[str] = None) -> str:
        category = self._clean_text(category) or "Skills"
        norm = self._normalize_for_match(category)

        top_level = {
            self._normalize_for_match(x)
            for x in TOP_LEVEL_SKILL_SECTION_HEADERS
        }
        real_subcategories = {
            self._normalize_for_match(x)
            for x in REAL_SKILL_SUBCATEGORY_HEADERS
        }

        if norm in top_level:
            return "Skills"

        if norm in real_subcategories:
            explicit_map = {
                "hard skills": "Hard Skills",
                "soft skills": "Soft Skills",
                "technical skills": "Technical Skills",
                "frameworks": "Frameworks",
                "technologies": "Technologies",
                "programming languages": "Programming Languages",
                "languages techniques": "Technical Languages",
                "langages techniques": "Technical Languages",
                "stack": "Tech Stack",
                "tech stack": "Tech Stack",
            }
            return explicit_map[norm]

        return "Skills"

    def _skill_category_or_default(self, candidate_category: Optional[str], raw_text: Optional[str] = None) -> str:
        candidate_category = self._strip_skill_category_label(
            self._clean_text(candidate_category) or "Skills"
        )
        if not self.is_real_skill_category(candidate_category):
            candidate_category = "Skills"
        return self._normalize_skill_category_name(candidate_category, raw_text=raw_text)

    def _dedupe_skill_items_only(self, items: List[dict]) -> List[dict]:
        out = []
        seen = set()

        for item in items or []:
            item = self._coerce_item_dict(item)
            if not item:
                continue

            name = self._clean_text(item.get("name"))
            if not name:
                continue

            key = self._normalize_for_match(name)
            if key in seen:
                continue
            seen.add(key)

            row = {"name": name}
            level = self._clean_text(item.get("level"))
            if level and self._is_text_level(level):
                row["level"] = level
                row["source"] = "text"
            source = self._clean_text(item.get("source"))
            if source:
                row["source"] = source
            confidence = item.get("confidence")
            if confidence is not None:
                try:
                    row["confidence"] = max(0.0, min(1.0, float(confidence)))
                except (TypeError, ValueError):
                    pass

            out.append(row)

        return out

    def _is_obvious_non_skill_line(self, text: Optional[str]) -> bool:
        text = self._clean_text(text)
        if not text:
            return True
        if not re.search(r"[a-zA-Z\u00c0-\u00ff0-9]", text):
            return True
        if "@" in text:
            return True
        if re.search(r"https?://|www\.|linkedin\.com|github\.com", text, re.I):
            return True
        digits = re.sub(r"\D+", "", text)
        if len(digits) >= 7 and len(digits) >= max(1, len(text.replace(" ", "")) // 2):
            return True
        return False

    def _should_join_wrapped_skill_lines(self, previous: str, current: str) -> bool:
        previous = self._clean_text(previous) or ""
        current = self._clean_text(current) or ""
        if not previous or not current:
            return False
        if previous.endswith((".", ";", ":", "|", "•", "·")):
            return False
        if self._looks_like_explicit_skill_subgroup_label(previous):
            return False
        if self._looks_like_explicit_skill_subgroup_label(current):
            return False
        if re.search(r"[•·▪◦|;·▸\u00b7]", previous + current):
            return False

        prev_norm = self._normalize_for_match(previous)
        current_first = current.split()[0] if current.split() else ""
        current_starts_lower = bool(current_first) and current_first[:1].islower()
        wrapping_connectors = {
            "a", "à", "au", "aux", "de", "des", "du", "d", "la", "le", "les",
            "et", "ou", "en", "sur", "pour", "avec", "sans", "of", "and",
            "or", "to", "in", "for", "with",
        }
        prev_last = prev_norm.split()[-1] if prev_norm.split() else ""
        if prev_last in {self._normalize_for_match(x) for x in wrapping_connectors}:
            return True
        return current_starts_lower and len(previous.split()) >= 3

    def _join_wrapped_skill_lines(self, lines: List[str]) -> List[str]:
        joined: List[str] = []
        for raw_line in lines or []:
            line = self._clean_text(raw_line)
            if not line:
                continue
            if joined and self._should_join_wrapped_skill_lines(joined[-1], line):
                joined[-1] = f"{joined[-1]} {line}"
            else:
                joined.append(line)
        return joined

    def _add_skill_entry(self, bucket: List[dict], value, level=None, source=None):
        if value is None:
            return

        if isinstance(value, dict):
            raw_name = self._clean_text(value.get("name"))
            raw_level = self._clean_text(value.get("level")) or level
            raw_source = self._clean_text(value.get("source")) or source
            raw_confidence = value.get("confidence")
        else:
            raw_name = self._clean_text(value)
            raw_level = level
            raw_source = source
            raw_confidence = None

        if not raw_name:
            return

        split_name, inferred_level = self._split_skill_name_and_level(raw_name)
        raw_name = self._clean_text(split_name)
        raw_level = self._clean_text(raw_level) or self._clean_text(inferred_level)

        if not raw_name:
            return

        for piece in self._explode_skill_line(raw_name):
            piece = self._clean_text(piece)
            if not piece:
                continue

            item = {"name": piece}

            if raw_level and self._is_text_level(raw_level):
                item["level"] = raw_level
                item["source"] = "text"

            if raw_source:
                item["source"] = raw_source

            if raw_confidence is not None:
                try:
                    item["confidence"] = max(0.0, min(1.0, float(raw_confidence)))
                except (TypeError, ValueError):
                    pass

            bucket.append(item)

    def _merge_skill_group(self, groups: List[dict], category: str, items: List[dict], raw_text: Optional[str] = None) -> None:
        category = self._normalize_skill_category_name(
            self._strip_skill_category_label(self._clean_text(category) or "Skills"),
            raw_text=raw_text,
        )
        clean_items = [d for d in (self._coerce_item_dict(i) for i in (items or [])) if d]
        if not clean_items:
            return
        cat_norm = self._normalize_for_match(category)
        target = next(
            (g for g in groups if isinstance(g, dict)
             and self._normalize_for_match(g.get("category") or "") == cat_norm),
            None,
        )
        if target is None:
            target = {"category": category, "items": []}
            groups.append(target)
        existing = {
            self._normalize_for_match(x.get("name") or "")
            for x in target["items"] if isinstance(x, dict)
        }
        for item in clean_items:
            key = self._normalize_for_match(item.get("name") or "")
            if key and key not in existing:
                target["items"].append(item)
                existing.add(key)

    def _repair_skill_groups(self, groups: List[dict]) -> List[dict]:
        repaired = []

        for group in groups or []:
            if not isinstance(group, dict):
                continue

            category = self._strip_skill_category_label(
                self._clean_text(group.get("category")) or "Skills"
            )

            raw_items = [
                self._coerce_item_dict(item)
                for item in group.get("items", []) or []
            ]
            raw_items = [item for item in raw_items if item]
            item_names = [
                self._clean_text(item.get("name"))
                for item in raw_items
                if self._clean_text(item.get("name"))
            ]
            joined_names = self._join_wrapped_skill_lines(item_names)
            levels_by_name = {
                self._normalize_for_match(self._clean_text(item.get("name")) or ""):
                self._clean_text(item.get("level"))
                for item in raw_items
            }
            sources_by_name = {
                self._normalize_for_match(self._clean_text(item.get("name")) or ""):
                self._clean_text(item.get("source"))
                for item in raw_items
            }
            confidences_by_name = {
                self._normalize_for_match(self._clean_text(item.get("name")) or ""):
                item.get("confidence")
                for item in raw_items
            }

            clean_items = []
            seen = set()
            for name in joined_names:
                if self._is_obvious_non_skill_line(name):
                    continue
                key = self._normalize_for_match(name)
                if not key or key in seen:
                    continue
                seen.add(key)

                row = {"name": name}
                level = levels_by_name.get(key)
                if level and self._is_text_level(level):
                    row["level"] = level
                    row["source"] = "text"
                source = sources_by_name.get(key)
                if source:
                    row["source"] = source
                confidence = confidences_by_name.get(key)
                if confidence is not None:
                    try:
                        row["confidence"] = max(0.0, min(1.0, float(confidence)))
                    except (TypeError, ValueError):
                        pass
                clean_items.append(row)

            if clean_items:
                self._merge_skill_group(repaired, category, clean_items)

        return repaired

    def _normalize_skill_groups_generic(self, raw_skills) -> List[dict]:
        if not raw_skills:
            return []

        groups: List[dict] = []

        def add_group(category: Optional[str], values) -> None:
            category = self._strip_skill_category_label(category or "Skills")
            raw_items = []

            if values is None:
                return
            if isinstance(values, dict) and "lines" in values:
                values = values.get("lines") or []
            if isinstance(values, (str, dict)):
                values = [values]

            for value in values or []:
                if isinstance(value, dict):
                    name = self._clean_text(
                        value.get("name")
                        or value.get("text")
                        or value.get("label")
                        or value.get("value")
                    )
                    level = self._clean_text(value.get("level"))
                else:
                    name = self._clean_text(value)
                    level = None

                if not name:
                    continue
                raw_items.append({"name": name, **({"level": level} if level else {})})

            if not raw_items:
                return

            joined_names = self._join_wrapped_skill_lines([
                item["name"] for item in raw_items if item.get("name")
            ])
            level_lookup = {
                self._normalize_for_match(item.get("name") or ""): item.get("level")
                for item in raw_items
            }
            source_lookup = {
                self._normalize_for_match(item.get("name") or ""): item.get("source")
                for item in raw_items
            }
            confidence_lookup = {
                self._normalize_for_match(item.get("name") or ""): item.get("confidence")
                for item in raw_items
            }
            clean_items = []
            for name in joined_names:
                if self._is_obvious_non_skill_line(name):
                    continue
                for piece in self._explode_skill_line(name):
                    piece = self._clean_text(piece)
                    if not piece or self._is_obvious_non_skill_line(piece):
                        continue
                    row = {"name": piece}
                    level = level_lookup.get(self._normalize_for_match(piece))
                    if level and self._is_text_level(level):
                        row["level"] = level
                        row["source"] = "text"
                    source = source_lookup.get(self._normalize_for_match(piece))
                    if source:
                        row["source"] = source
                    confidence = confidence_lookup.get(self._normalize_for_match(piece))
                    if confidence is not None:
                        row["confidence"] = confidence
                    clean_items.append(row)

            clean_items = self._dedupe_skill_items_only(clean_items)
            if clean_items:
                self._merge_skill_group(groups, category, clean_items)

        if isinstance(raw_skills, dict):
            if "lines" in raw_skills:
                category = (
                    self._clean_text(raw_skills.get("section_title"))
                    or self._clean_text(raw_skills.get("title"))
                    or self._clean_text(raw_skills.get("category"))
                    or "Skills"
                )
                add_group(category, raw_skills.get("lines") or [])
                return self._repair_skill_groups(groups)

            for k, v in raw_skills.items():
                k_clean = self._clean_text(k)
                if k_clean in {"skills_raw", "raw"}:
                    for group in self._normalize_skill_groups_generic(v):
                        self._merge_skill_group(
                            groups,
                            group.get("category") or "Skills",
                            group.get("items") or [],
                        )
                else:
                    add_group(k_clean or "Skills", v)
            return self._repair_skill_groups(groups)

        if isinstance(raw_skills, list):
            for entry in raw_skills:
                if isinstance(entry, dict) and "lines" in entry:
                    category = (
                        self._clean_text(entry.get("section_title"))
                        or self._clean_text(entry.get("title"))
                        or self._clean_text(entry.get("category"))
                        or "Skills"
                    )
                    add_group(category, entry.get("lines") or [])
                elif isinstance(entry, dict) and "items" in entry:
                    category = self._clean_text(entry.get("category")) or "Skills"
                    add_group(category, entry.get("items") or [])
                elif isinstance(entry, dict):
                    add_group("Skills", [entry])
                elif isinstance(entry, str):
                    add_group("Skills", [entry])
            return self._repair_skill_groups(groups)

        if isinstance(raw_skills, str):
            add_group("Skills", [raw_skills])
            return self._repair_skill_groups(groups)

        return []

    def _append_additional_info_from_skill_item(self, data: dict, item: dict) -> None:
        if not isinstance(item, dict):
            return
        name = self._clean_text(item.get("name"))
        if not name:
            return
        if not isinstance(data.get("additional_info"), list):
            data["additional_info"] = []
        existing_titles = {
            (x.get("title") or "").casefold().strip()
            for x in data["additional_info"] if isinstance(x, dict)
        }
        key = name.casefold().strip()
        if key in existing_titles:
            return
        data["additional_info"].append({
            "title": name, "organization": None, "location": None,
            "start_date": None, "end_date": None, "description": None, "bullets": [],
        })

    # =========================================================================
    # Skill validation
    # =========================================================================

    def _looks_like_responsibility_sentence(self, text: Optional[str]) -> bool:
        text = self._clean_text(text)
        if not text:
            return True

        norm = self._normalize_for_match(text)
        words = norm.split()
        if not words:
            return True

        first = words[0]

        if norm.startswith("gestion efficace "):
            return False

        action_starters = {
            "participation", "suivi", "gestion", "preparation", "préparation",
            "observation", "analyse", "traitement", "classement", "extraction",
            "verification", "vérification", "collaboration", "accompagnement",
            "etablissement", "établissement", "recording", "prepared", "prepare",
            "handling", "handled", "issuing", "review", "reviewing",
        }
        action_starters_norm = {self._normalize_for_match(x) for x in action_starters}

        if first in action_starters_norm:
            return True

        if len(words) >= 9:
            return True

        if ":" in text or ";" in text:
            return True

        return False

    def _is_valid_skill_name(self, name: str, section_context: Optional[str] = None) -> bool:
        name = self._clean_text(name)
        if not name:
            return False

        if self._looks_like_skill_noise(name, section_context=section_context):
            return False

        if self._is_human_language(name):
            return False

        norm = self._normalize_for_match(name)
        if not norm:
            return False

        wc = len(name.split())
        if wc == 0:
            return False

        if wc > 10:
            return False

        blocked_patterns = [
            r"\bstage\b",
            r"\bintern(ship)?\b",
            r"\bdepartment\b",
            r"\bdépartement\b",
            r"\bdepartement\b",
            r"\bservice\b",
            r"\bprocess de recrutement\b",
            r"\bbulletins? de paie\b",
            r"\battestations? de salaire\b",
            r"\bdossiers? administratifs?\b",
            r"\bdemandes? clients?\b",
        ]
        for pattern in blocked_patterns:
            if re.search(pattern, norm):
                return False

        if self._looks_like_responsibility_sentence(name):
            return False

        return True

    def _clean_skills_noise(self, result: dict):
        blocked_titles = set()
        for aliases in self._section_alias_map().values():
            blocked_titles.update(self._normalize_for_match(x) for x in aliases)

        for g in result.get("skills") or []:
            if not isinstance(g, dict):
                continue

            category = self._normalize_skill_category_name(
                self._clean_text(g.get("category")) or "Skills"
            )
            g["category"] = category
            items = g.get("items") or []
            cleaned = []
            seen = set()

            for item in items:
                item = self._coerce_item_dict(item)
                if not item:
                    continue

                name = self._clean_text(item.get("name"))
                if not name:
                    continue

                norm = self._normalize_for_match(name)
                if not norm or norm in seen:
                    continue

                # Nettoyage volontairement minimal : on garde les lignes de la
                # section skills, sauf bruit évident ou titre de section seul.
                if norm in blocked_titles:
                    continue
                if self._is_obvious_non_skill_line(name):
                    continue

                clean_item = {"name": name}
                level = self._clean_text(item.get("level"))
                if level and self._is_text_level(level):
                    clean_item["level"] = level
                    clean_item["source"] = "text"
                source = self._clean_text(item.get("source"))
                if source:
                    clean_item["source"] = source
                confidence = item.get("confidence")
                if confidence is not None:
                    try:
                        clean_item["confidence"] = max(0.0, min(1.0, float(confidence)))
                    except (TypeError, ValueError):
                        pass
                cleaned.append(clean_item)
                seen.add(norm)

            g["items"] = cleaned

    def _remove_skill_items_overlapping_other_sections(self, data: dict) -> None:
        cleaned_groups = []

        for group in data.get("skills", []) or []:
            if not isinstance(group, dict):
                continue

            category = self._normalize_skill_category_name(
                self._clean_text(group.get("category")) or "Skills"
            )
            items = []
            seen = set()

            for item in group.get("items", []) or []:
                if isinstance(item, str):
                    item = {"name": self._clean_text(item)}
                elif not isinstance(item, dict):
                    continue

                name = self._clean_text(item.get("name"))
                if not name:
                    continue

                fp = self._text_fingerprint(name)
                if not fp:
                    continue

                if self._is_obvious_non_skill_line(name):
                    continue

                key = self._normalize_for_match(name)
                if key in seen:
                    continue
                seen.add(key)

                row = {"name": name}
                level = self._clean_text(item.get("level"))
                if level and self._is_text_level(level):
                    row["level"] = level
                source = self._clean_text(item.get("source"))
                if source:
                    row["source"] = source
                confidence = item.get("confidence")
                if confidence is not None:
                    try:
                        row["confidence"] = max(0.0, min(1.0, float(confidence)))
                    except (TypeError, ValueError):
                        pass

                items.append(row)

            if items:
                cleaned_groups.append({
                    "category": category,
                    "items": items,
                })

        data["skills"] = cleaned_groups

    def _looks_like_list_separator_payload(self, text: Optional[str]) -> bool:
        text = self._clean_text(text)
        if not text:
            return False

        # Utiliser le texte original (non normalisé) pour détecter · (U+00B7)
        if re.search(r"[•·▪◦|,/;·▸\u00b7]", text):
            return True

        # plusieurs blocs espacés
        if re.search(r"\s{2,}", text):
            return True

        return False

    def _split_skill_group_line(self, text: Optional[str], parent_section: Optional[str] = None) -> Optional[dict]:
        """
        Détecte une ligne du type:
          'Déploiement & APIs : API REST · FastAPI · Docker · Docker Compose'
          'Operating System: Windows, MacOS, Linux'
          'Database/Server: MySQL, PostgreSQL, SQL Server'
        et retourne:
          {"category": "...", "items": [{"name": ...}, ...], "_inline_skill_group": True}
        """
        text = self._clean_text(text)
        if not text:
            return None

        # CORRECTION: si parent_section est None ou non reconnu,
        # on tente quand même la détection (ne bloquer que si mappé vers
        # une section NON-skill explicitement)
        if parent_section:
            mapped_parent = self._map_section_title(parent_section)
            NON_SKILL_SECTIONS = {
                "languages", "certifications", "education",
                "experience", "projects", "associations", "volunteer"
            }
            if mapped_parent in NON_SKILL_SECTIONS:
                return None
            # Si mapped_parent est None ou "skills"/"software"/"it" -> on continue

        # format principal: Category : item1 · item2
        m = re.match(r"^\s*([^:]{2,80})\s*:\s*(.+?)\s*$", text)
        if not m:
            return None

        category = self._clean_text(m.group(1))
        tail = self._clean_text(m.group(2))
        if not category or not tail:
            return None

        # si le "header" mappe vers langues/certifs, ne pas traiter ici
        mapped_cat = self._map_section_title(category)
        if mapped_cat in {"languages", "certifications", "education", "experience", "projects"}:
            return None

        # le header doit ressembler à un vrai sous-titre, pas à une phrase longue
        if len(category.split()) > 6:
            return None

        # CORRECTION: vérifier la présence de séparateurs directement dans le texte original
        # sans passer par _normalize_for_match qui supprime ·
        HAS_SEPARATOR = bool(re.search(r"[•·▪◦|;·▸\u00b7]", tail))
        HAS_SPACES = bool(re.search(r"\s{2,}", tail))
        should_split = self._should_split_skill_text(tail)

        if not HAS_SEPARATOR and not HAS_SPACES and not should_split:
            category_norm = self._normalize_for_match(category)
            recognized_header = (
                category_norm in {
                    self._normalize_for_match(x)
                    for x in TOP_LEVEL_SKILL_SECTION_HEADERS | REAL_SKILL_SUBCATEGORY_HEADERS
                }
            )
            if recognized_header:
                return {
                    "category": self._normalize_skill_category_name(category),
                    "items": [{"name": tail}],
                    "_inline_skill_group": True,
                }
            return None

        # Split sur le texte original (pas normalisé), seulement si la ligne
        # ressemble vraiment à une liste. Une virgule dans une compétence métier
        # ne suffit pas à découper l'item.
        if should_split:
            parts = self._explode_skill_line(tail)
        elif HAS_SEPARATOR:
            parts = re.split(r"\s*[•·▪◦|;·▸\u00b7]\s*", tail)
        else:
            parts = re.split(r"\s{2,}", tail)

        parts = [self._clean_text(p) for p in parts if self._clean_text(p)]

        if len(parts) <= 1:
            if self._is_valid_skill_category(category) and parts:
                return {
                    "category": category,
                    "items": [{"name": parts[0]}],
                    "_inline_skill_group": True,
                }
            return None

        items = []
        seen = set()

        for p in parts:
            p = self._clean_text(p)
            if not p:
                continue

            # exclure niveaux de langue, labels vides, etc.
            if self._is_language_text_level(p):
                continue

            # CORRECTION: pour les items individuels (courts), utiliser _is_valid_skill_name
            # mais avec une validation allégée (pas de contrainte sur la casse)
            if len(p) < 2:
                continue
            if not re.search(r"[a-zA-Z\u00c0-\u00ff0-9]", p):
                continue

            key = self._normalize_for_match(p)
            if key in seen:
                continue
            seen.add(key)

            items.append({"name": p})

        if not items:
            return None

        return {
            "category": self._normalize_skill_category_name(category),
            "items": items,
            "_inline_skill_group": True,
        }

    def _promote_inline_skill_groups(self, result: dict) -> None:
        raw_groups = result.get("skills") or []
        if not isinstance(raw_groups, list):
            return

        promoted_groups = []
        fallback_items = []
        found_promoted = False

        for group in raw_groups:
            if not isinstance(group, dict):
                continue

            parent_category = self._clean_text(group.get("category")) or "Skills"
            items = group.get("items") or []

            # CAS B: la catégorie elle-même est une ligne inline "Cat: item1 · item2"
            cat_as_inline = self._split_skill_group_line(parent_category, parent_section=None)
            if cat_as_inline and not items:
                cat_as_inline["_inline_skill_group"] = True
                promoted_groups.append(cat_as_inline)
                found_promoted = True
                continue

            for item in items:
                if isinstance(item, str):
                    item = {"name": self._clean_text(item)}
                if not isinstance(item, dict):
                    continue

                name = self._clean_text(item.get("name"))
                if not name:
                    continue

                # CAS A: l'item est une ligne inline "Cat: item1 · item2"
                split_group = self._split_skill_group_line(name, parent_section=parent_category)
                if split_group:
                    split_group["_inline_skill_group"] = True
                    promoted_groups.append(split_group)
                    found_promoted = True
                else:
                    # Seulement pour les items NON-inline, on vérifie la validité
                    if (
                        not self._looks_like_skill_noise(name, section_context=parent_category)
                        and self._looks_like_skill_item(name)
                    ):
                        fallback_items.append({"name": name})
                    # SINON: ligne trop longue non-inline -> on la drop silencieusement

        rebuilt = []
        if fallback_items:
            rebuilt.append({"category": "Skills", "items": fallback_items})
        rebuilt.extend(promoted_groups)

        if found_promoted and rebuilt:
            result["skills"] = rebuilt
        elif found_promoted:
            result["skills"] = promoted_groups

    def _extract_languages_and_certification_from_skill_lines(self, result: dict) -> None:
        if not isinstance(result.get("languages"), list):
            result["languages"] = []
        if not isinstance(result.get("certifications"), list):
            result["certifications"] = []

        remaining_skill_groups = []
        existing_langs = {
            self._normalize_for_match((x.get("name") or ""))
            for x in result.get("languages", []) if isinstance(x, dict)
        }
        existing_certs = {
            self._normalize_for_match((x.get("name") or ""))
            for x in result.get("certifications", []) if isinstance(x, dict)
        }

        def split_inline_payload(text: Optional[str]) -> List[str]:
            text = self._clean_text(text)
            if not text:
                return []
            parts = re.split(r"\s*[•·▪◦|,/;]\s*", text)
            parts = [self._clean_text(p) for p in parts if self._clean_text(p)]
            if len(parts) <= 1:
                parts = re.split(r"\s{2,}", text)
                parts = [self._clean_text(p) for p in parts if self._clean_text(p)]
            return parts

        def add_language_text(text: Optional[str]) -> None:
            text = self._clean_text(text)
            if not text:
                return
            parsed_name, parsed_level = self._extract_embedded_language_level(text)
            if parsed_name:
                key = self._normalize_for_match(parsed_name)
                if key not in existing_langs:
                    row = {"name": parsed_name}
                    if parsed_level and self._is_language_text_level(parsed_level):
                        row["level"] = parsed_level
                    result["languages"].append(row)
                    existing_langs.add(key)

        def add_certification_text(name: Optional[str]) -> None:
            name = self._clean_text(name)
            if not name:
                return
            key = self._normalize_for_match(name)
            if key not in existing_certs:
                row = {"name": name}
                if "nvidia deep learning institute" in self._normalize_for_match(name):
                    row["issuer"] = "NVIDIA Deep Learning Institute"
                result["certifications"].append(row)
                existing_certs.add(key)

        for group in result.get("skills") or []:
            if not isinstance(group, dict):
                continue

            category = self._clean_text(group.get("category")) or "Skills"
            mapped = self._map_section_title(category)

            # si le groupe lui-même est LANGUES
            if mapped == "languages":
                for item in group.get("items", []) or []:
                    if not isinstance(item, dict):
                        continue
                    text = self._clean_text(item.get("name"))
                    if not text:
                        continue
                    add_language_text(text)
                continue

            # si le groupe lui-même est CERTIFICATION
            if mapped == "certifications":
                for item in group.get("items", []) or []:
                    if not isinstance(item, dict):
                        continue
                    add_certification_text(item.get("name"))
                continue

            remaining_items = []
            for item in group.get("items", []) or []:
                if not isinstance(item, dict):
                    continue
                name = self._clean_text(item.get("name"))
                if not name:
                    continue
                m = re.match(r"^\s*([^:]{2,80})\s*:\s*(.+?)\s*$", name)
                if m:
                    inline_category = self._clean_text(m.group(1))
                    tail = self._clean_text(m.group(2))
                    mapped_inline = self._map_section_title(inline_category)
                    if mapped_inline == "languages":
                        for part in split_inline_payload(tail):
                            add_language_text(part)
                        continue
                    if mapped_inline == "certifications":
                        for part in split_inline_payload(tail):
                            add_certification_text(part)
                        continue
                remaining_items.append(item)

            if remaining_items:
                group["items"] = remaining_items
                remaining_skill_groups.append(group)

        result["skills"] = remaining_skill_groups

    def _merge_sidebar_skill_sections(self, result: dict) -> None:
        """
        Fusionne les sections LOGICIELS / INFORMATIQUE / SOFTWARE / IT vers skills.
        """
        if not isinstance(result.get("skills"), list):
            result["skills"] = []

        skills_group = None
        for g in result["skills"]:
            if isinstance(g, dict) and self._normalize_for_match(g.get("category") or "") == "skills":
                skills_group = g
                break

        if skills_group is None:
            skills_group = {"category": "Skills", "items": []}
            result["skills"].append(skills_group)

        existing = {
            self._normalize_for_match((it.get("name") or ""))
            for it in skills_group.get("items", [])
            if isinstance(it, dict)
        }

        accepted_titles = {"skills", "software", "it"}

        def add_skill(name: Optional[str]):
            name = self._clean_text(name)
            if not name:
                return
            key = self._normalize_for_match(name)
            if key and key not in existing:
                skills_group["items"].append({"name": name})
                existing.add(key)

        def split_and_add(text: Optional[str]):
            text = self._clean_text(text)
            if not text:
                return
            parts = re.split(r"\s*[,/|·•]\s*", text)
            for p in parts:
                p = self._clean_text(p)
                if p:
                    add_skill(p)

        # depuis des clés top-level non standard
        for key, raw in list(result.items()):
            if self._normalize_for_match(str(key)) == "skills":
                continue
            mapped = self._map_section_title(key)
            if mapped not in accepted_titles:
                continue
            for frag in self._collect_text_fragments(raw):
                split_and_add(frag)

        # depuis other_sections
        for sec in result.get("other_sections", []) or []:
            if not isinstance(sec, dict):
                continue
            mapped = self._map_section_title(sec.get("title"))
            if mapped not in accepted_titles:
                continue

            for raw_item in sec.get("items", []) or []:
                split_and_add(raw_item)

        # depuis additional_info si les sections ont déjà été déplacées
        for sec in result.get("additional_info", []) or []:
            if not isinstance(sec, dict):
                continue
            mapped = self._map_section_title(sec.get("title"))
            if mapped not in accepted_titles:
                continue

            for raw_item in sec.get("bullets", []) or []:
                split_and_add(raw_item)

    def _inject_common_software_from_context(self, result: dict, raw_text: Optional[str] = None) -> None:
        """
        N'ajoute Word/Excel/Outlook/PowerPoint que si une vraie section IT/LOGICIELS
        est explicitement détectée. Ne pas déclencher juste parce que le CV est technique.
        """
        raw_text = raw_text or ""

        has_explicit_software_section = bool(result.pop("_software_section_seen", False))
        software_section_titles_norm = {
            self._normalize_for_match(x)
            for x in SOFTWARE_SKILL_SECTION_HEADERS
        }
        raw_lines_norm = {
            self._normalize_for_match(line)
            for line in raw_text.splitlines()
            if self._clean_text(line)
        }

        def is_software_section(title: Optional[str]) -> bool:
            mapped = self._map_section_title(title)
            title_norm = self._normalize_for_match(title or "")
            return mapped in {"software", "it"} or title_norm in software_section_titles_norm

        if not has_explicit_software_section:
            has_explicit_software_section = any(
                title and any(title == line or title in line for line in raw_lines_norm)
                for title in software_section_titles_norm
                if title != "it"
            )

        for group in result.get("skills", []) or []:
            if not isinstance(group, dict):
                continue
            if is_software_section(group.get("category")):
                has_explicit_software_section = True
                break

        for sec in result.get("other_sections", []) or []:
            if not isinstance(sec, dict):
                continue
            if is_software_section(sec.get("title")):
                has_explicit_software_section = True
                break

        for sec in result.get("additional_info", []) or []:
            if not isinstance(sec, dict):
                continue
            if is_software_section(sec.get("title")):
                has_explicit_software_section = True
                break

        if not has_explicit_software_section:
            return

        if not isinstance(result.get("skills"), list):
            result["skills"] = []

        skills_group = None
        for g in result["skills"]:
            if isinstance(g, dict) and self._normalize_for_match(g.get("category") or "") == "skills":
                skills_group = g
                break

        if skills_group is None:
            skills_group = {"category": "Skills", "items": []}
            result["skills"].append(skills_group)

        existing = {
            self._normalize_for_match((it.get("name") or ""))
            for it in skills_group.get("items", [])
            if isinstance(it, dict)
        }

        detected_tools = []
        for tool in ("EBP", "Divalto"):
            if self._raw_text_contains_software_name(tool, raw_text):
                detected_tools.append(tool)

        for tool in detected_tools:
            key = self._normalize_for_match(tool)
            if key not in existing:
                skills_group["items"].append({"name": tool})
                existing.add(key)

    def _normalize_common_software_names(self, result: dict) -> None:
        rename_map = {
            "word": "Microsoft Word",
            "excel": "Microsoft Excel",
            "outlook": "Microsoft Outlook",
            "powerpoint": "Microsoft PowerPoint",
            "power point": "Microsoft PowerPoint",
            "ebp": "EBP",
        }

        for g in result.get("skills") or []:
            if not isinstance(g, dict):
                continue

            for item in g.get("items", []) or []:
                if not isinstance(item, dict):
                    continue

                name = self._clean_text(item.get("name"))
                if not name:
                    continue

                norm = self._normalize_for_match(name)
                if norm in rename_map:
                    item["name"] = rename_map[norm]

    def _dedupe_skill_items_in_place(self, result: dict) -> None:
        cleaned_groups = []
        for g in result.get("skills") or []:
            if not isinstance(g, dict):
                continue
            seen = set()
            deduped = []
            for item in g.get("items") or []:
                if not isinstance(item, dict):
                    continue
                name = self._clean_text(item.get("name"))
                if not name:
                    continue
                key = self._normalize_for_match(name)
                if not key or key in seen:
                    continue
                seen.add(key)
                item["name"] = name
                deduped.append(item)
            g["items"] = deduped
            if deduped:
                cleaned_groups.append(g)
        result["skills"] = cleaned_groups

    def _normalize_software_name(self, name: Optional[str]) -> Optional[str]:
        name = self._clean_text(name)
        if not name:
            return None
        norm = self._normalize_for_match(name)
        canonical = {
            "microsoft word": "Microsoft Word",
            "word": "Microsoft Word",
            "ms word": "Microsoft Word",
            "microsoft excel": "Microsoft Excel",
            "excel": "Microsoft Excel",
            "ms excel": "Microsoft Excel",
            "microsoft outlook": "Microsoft Outlook",
            "outlook": "Microsoft Outlook",
            "ms outlook": "Microsoft Outlook",
            "microsoft powerpoint": "Microsoft PowerPoint",
            "microsoft power point": "Microsoft PowerPoint",
            "powerpoint": "Microsoft PowerPoint",
            "power point": "Microsoft PowerPoint",
            "ms powerpoint": "Microsoft PowerPoint",
            "ms power point": "Microsoft PowerPoint",
            "microsoft onenote": "Microsoft OneNote",
            "microsoft one note": "Microsoft OneNote",
            "onenote": "Microsoft OneNote",
            "one note": "Microsoft OneNote",
            "ebp": "EBP",
            "divalto": "Divalto",
        }
        return canonical.get(norm, name)

    def _software_aliases_for_name(self, name: str) -> List[str]:
        canonical = self._normalize_software_name(name)
        aliases = {
            "Microsoft Word": ["microsoft word", "ms word", "word"],
            "Microsoft Excel": ["microsoft excel", "ms excel", "excel"],
            "Microsoft Outlook": ["microsoft outlook", "ms outlook", "outlook"],
            "Microsoft PowerPoint": [
                "microsoft powerpoint", "microsoft power point",
                "ms powerpoint", "ms power point", "powerpoint", "power point",
            ],
            "Microsoft OneNote": [
                "microsoft onenote", "microsoft one note",
                "onenote", "one note",
            ],
            "EBP": ["ebp"],
            "Divalto": ["divalto"],
        }
        return aliases.get(canonical or "", [canonical or name])

    def _raw_text_contains_software_name(self, name: str, raw_text: str = "") -> bool:
        raw_norm = self._normalize_for_match(raw_text or "")
        if not raw_norm:
            return False
        for alias in self._software_aliases_for_name(name):
            alias_norm = self._normalize_for_match(alias)
            if not alias_norm:
                continue
            pattern = rf"(?<![a-z0-9]){re.escape(alias_norm)}(?![a-z0-9])"
            if re.search(pattern, raw_norm):
                return True
        return False

    def _accept_icon_detection(self, icon_name: str, confidence: float, raw_text: str = "") -> bool:
        try:
            confidence = float(confidence or 0.0)
        except (TypeError, ValueError):
            confidence = 0.0

        if confidence >= 0.85:
            return True
        if confidence >= 0.70 and self._raw_text_contains_software_name(icon_name, raw_text):
            return True
        return False

    def _merge_text_and_icon_skills(
        self,
        text_items: List[dict],
        icon_items: List[dict],
        raw_text: str = "",
    ) -> List[dict]:
        out = []
        seen = set()

        for item in text_items or []:
            raw_name = item.get("name") if isinstance(item, dict) else item
            name = self._normalize_software_name(raw_name) or self._clean_text(raw_name)
            if not name:
                continue
            key = self._normalize_for_match(name)
            if not key or key in seen:
                continue
            seen.add(key)
            row = {"name": name}
            if isinstance(item, dict):
                level = self._clean_text(item.get("level"))
                if level and self._is_text_level(level):
                    row["level"] = level
                source = self._clean_text(item.get("source"))
                if source:
                    row["source"] = source
                confidence = item.get("confidence")
                if confidence is not None:
                    row["confidence"] = confidence
            out.append(row)

        for icon in icon_items or []:
            if not isinstance(icon, dict):
                continue
            name = self._normalize_software_name(icon.get("name"))
            if not name:
                continue
            try:
                confidence = float(icon.get("confidence", 0.0))
            except (TypeError, ValueError):
                confidence = 0.0
            if not self._accept_icon_detection(name, confidence, raw_text=raw_text):
                continue

            key = self._normalize_for_match(name)
            if not key or key in seen:
                continue
            seen.add(key)
            out.append({
                "name": name,
                "source": "icon",
                "confidence": round(confidence, 3),
            })

        return out

    def _merge_detected_software_icons(
        self,
        result: dict,
        detected_software_icons: Optional[List[dict]] = None,
        raw_text: str = "",
    ) -> None:
        if not detected_software_icons:
            return
        if not isinstance(result.get("skills"), list):
            result["skills"] = []

        skills_group = None
        for group in result["skills"]:
            if (
                isinstance(group, dict)
                and self._normalize_for_match(group.get("category") or "") == "skills"
            ):
                skills_group = group
                break

        merged_items = self._merge_text_and_icon_skills(
            skills_group.get("items") if skills_group else [],
            detected_software_icons,
            raw_text=raw_text,
        )

        if not merged_items:
            return

        if skills_group is None:
            skills_group = {"category": "Skills", "items": []}
            result["skills"].append(skills_group)

        skills_group["items"] = merged_items

    def _payload_has_software_section(self, payload) -> bool:
        software_titles = {
            self._normalize_for_match(x)
            for x in SOFTWARE_SKILL_SECTION_HEADERS
        }

        def scan(value) -> bool:
            if isinstance(value, dict):
                for key in ("section_title", "category", "title", "name"):
                    label = self._clean_text(value.get(key))
                    if label and self._normalize_for_match(label) in software_titles:
                        return True
                return any(scan(v) for v in value.values())
            if isinstance(value, list):
                return any(scan(item) for item in value)
            return False

        return scan(payload)

    def _collapse_invented_skill_subcategories(self, result: dict, raw_text: Optional[str] = None) -> None:
        """
        Si des catégories comme Hard Skills / Soft Skills n'apparaissent PAS
        explicitement dans le texte brut du CV, on fusionne tout sous "Skills".
        """
        raw_norm = self._normalize_for_match(raw_text or "")

        invented_categories = {"hard skills", "soft skills", "technical skills", "general skills"}

        groups = result.get("skills") or []
        needs_collapse = False

        for group in groups:
            if not isinstance(group, dict):
                continue
            cat_norm = self._normalize_for_match(group.get("category") or "")
            if cat_norm in invented_categories and cat_norm not in raw_norm:
                needs_collapse = True
                break

        if not needs_collapse:
            return

        # Fusionner tous les items sous une seule catégorie "Skills"
        all_items = []
        seen = set()
        for group in groups:
            if not isinstance(group, dict):
                continue
            for item in group.get("items") or []:
                if not isinstance(item, dict):
                    continue
                name = self._clean_text(item.get("name"))
                if not name:
                    continue
                key = self._normalize_for_match(name)
                if key in seen:
                    continue
                seen.add(key)
                all_items.append(item)

        if all_items:
            result["skills"] = [{"category": "Skills", "items": all_items}]

    def _split_csv_skill_item(self, name: Optional[str], section_context: Optional[str] = None) -> Optional[List[str]]:
        """
        Si un item contient plusieurs valeurs séparées par virgules ou espaces multiples,
        les retourner comme liste. Ex: "Windows, MacOS, Linux" -> ["Windows", "MacOS", "Linux"]
        Retourne None si l'item n'est pas une liste.
        """
        name = self._clean_text(name)
        if not name:
            return None

        if not self._should_split_skill_text(name):
            return None

        parts = [p for p in self._explode_skill_line(name) if p and len(p) >= 2]
        if len(parts) <= 1:
            return None

        valid_parts = []
        for p in parts:
            if self._is_language_text_level(p):
                continue
            if not re.search(r"[a-zA-Z\u00c0-\u00ff0-9]", p):
                continue
            valid_parts.append(p)

        # Ne retourner que si on a au moins 2 parties valides
        return valid_parts if len(valid_parts) >= 2 else None

    def _split_inline_skill_items(self, result: dict) -> None:
        """
        Split les items du type "API REST · FastAPI · Docker"
        et "Windows, MacOS, Linux" en items individuels.
        """
        for group in result.get("skills") or []:
            if not isinstance(group, dict):
                continue
            category = self._clean_text(group.get("category")) or "Skills"
            new_items = []
            for item in group.get("items") or []:
                if not isinstance(item, dict):
                    continue
                name = self._clean_text(item.get("name"))
                if not name:
                    continue
                level = self._clean_text(item.get("level"))

                pieces = self._explode_skill_line(name)
                if len(pieces) > 1:
                    for piece in pieces:
                        if not self._is_obvious_non_skill_line(piece):
                            new_items.append({"name": piece})
                    continue

                if not self._is_obvious_non_skill_line(name):
                    clean_item = {"name": name}
                    if level and self._is_text_level(level):
                        clean_item["level"] = level
                        clean_item["source"] = "text"
                    source = self._clean_text(item.get("source"))
                    if source:
                        clean_item["source"] = source
                    confidence = item.get("confidence")
                    if confidence is not None:
                        try:
                            clean_item["confidence"] = max(0.0, min(1.0, float(confidence)))
                        except (TypeError, ValueError):
                            pass
                    new_items.append(clean_item)
            group["items"] = self._dedupe_skill_items_only(new_items)

    # =========================================================================
    # Skill group reconstruction
    # =========================================================================

    def _looks_like_skill_category_label(
        self,
        text: Optional[str],
        next_items: List[dict],
        parent_category: Optional[str] = None,
    ) -> bool:
        text = self._clean_text(text)
        if not text:
            return False
        # Phrases descriptives ne sont JAMAIS des headings de catégorie.
        # ex: "Recovering from a slide", "Maintaining control when a tire blows out",
        # "Driving in the rain", "Highly skilled in driving light and heavy vehicles"
        _descriptive_phrase_patterns = [
            r"^[A-Za-z\u00c0-\u00ff]+ing\s+\w",               # Recovering from, Maintaining, Driving
            r"^(?:Highly|Well|Very|Fully|Strong)\b",            # Highly skilled, Well-versed
            r"^(?:Aspiration|Ability|Experience|Knowledge|Talent)\b",
            r"^(?:Parallel|Performed|Performing|Managing|Operated)\b",
        ]
        for pattern in _descriptive_phrase_patterns:
            if re.match(pattern, text, re.IGNORECASE):
                return False
        clean = self._strip_skill_category_label(text)
        norm = self._normalize_for_match(clean)
        if not norm:
            return False
        if self._is_human_language(clean):
            return False
        if clean.casefold() == (self._clean_text(parent_category) or "").casefold():
            return False
        next_names = [
            self._clean_text(x.get("name"))
            for x in next_items or []
            if isinstance(x, dict) and self._clean_text(x.get("name"))
        ]
        is_visually_header = bool(re.search(r"[:\-–—|]\s*$", text)) or clean.isupper() or clean.istitle()
        return self._should_promote_skill_label_to_category(
            clean,
            next_items_count=len(next_names),
            is_visually_header=is_visually_header,
        )

    def _repair_misgrouped_skill_categories(self, result: dict) -> None:
        groups = result.get("skills") or []
        if not isinstance(groups, list):
            return
        repaired = []
        for group in groups:
            if not isinstance(group, dict):
                continue
            category = self._clean_text(group.get("category")) or "Skills"
            items = [x for x in (group.get("items") or []) if isinstance(x, dict)]
            if not items:
                repaired.append(group)
                continue
            if self._is_valid_skill_category(category):
                repaired.append(group)
                continue
            if (
                self._looks_like_atomic_skill(category)
                and not self._looks_like_explicit_skill_subgroup_label(category)
                and len(items) >= 2
            ):
                new_items = [{"name": category}]
                for item in items:
                    nm = self._clean_text(item.get("name"))
                    lvl = self._clean_text(item.get("level"))
                    if not nm:
                        continue
                    row = {"name": nm}
                    if lvl and self._is_text_level(lvl):
                        row["level"] = lvl
                        row["source"] = "text"
                    new_items.append(row)
                self._merge_skill_group(repaired, "Skills", new_items)
                continue
            repaired.append(group)
        result["skills"] = repaired

    def _rebuild_skill_groups(self, groups: List[dict]) -> List[dict]:
        rebuilt: List[dict] = []
        for group in groups or []:
            if not isinstance(group, dict):
                continue
            parent_category = self._clean_text(group.get("category")) or "Skills"

            # CORRECTION: si la catégorie se termine par ":", c'est un sous-titre
            # Ex: "Operating System:" -> category = "Operating System"
            parent_inline_group = bool(group.get("_inline_skill_group"))
            if parent_category.endswith(":"):
                parent_inline_group = True
            parent_category = re.sub(r"\s*:\s*$", "", parent_category).strip() or "Skills"

            raw_items = group.get("items") or []
            items = [d for d in (self._coerce_item_dict(i) for i in raw_items) if d]
            if not items:
                continue
            current_category = parent_category
            current_inline_group = parent_inline_group
            current_items: List[dict] = []
            saw_subcategory = False
            for idx, item in enumerate(items):
                next_items = items[idx + 1: idx + 4]
                name = self._clean_text(item.get("name"))

                # CORRECTION: détecter aussi les items qui se terminent par ":"
                # Ex: {"name": "Operating System:"} suivi de {"name": "Windows, MacOS, Linux"}
                if name and name.endswith(":"):
                    potential_category = name.rstrip(":").strip()
                    if potential_category and len(potential_category.split()) <= 5:
                        if current_items:
                            rebuilt.append({
                                "category": current_category,
                                "items": current_items,
                                **({"_inline_skill_group": True} if current_inline_group else {}),
                            })
                        current_category = potential_category
                        current_inline_group = True
                        current_items = []
                        saw_subcategory = True
                        continue

                if self._looks_like_skill_category_label(name, next_items, parent_category=current_category):
                    new_category = self._strip_skill_category_label(name)
                    if current_items:
                        rebuilt.append({
                            "category": current_category,
                            "items": current_items,
                            **({"_inline_skill_group": True} if current_inline_group else {}),
                        })
                    current_category = new_category
                    current_inline_group = False
                    current_items = []
                    saw_subcategory = True
                    continue
                current_items.append(item)
            if current_items:
                rebuilt.append({
                    "category": current_category,
                    "items": current_items,
                    **({"_inline_skill_group": True} if current_inline_group else {}),
                })
            elif not saw_subcategory:
                rebuilt.append({
                    "category": parent_category,
                    "items": items,
                    **({"_inline_skill_group": True} if parent_inline_group else {}),
                })
        merged: List[dict] = []
        for group in rebuilt:
            if group.get("_inline_skill_group"):
                category = self._clean_text(group.get("category")) or "Skills"
                target = next(
                    (g for g in merged if isinstance(g, dict)
                     and self._normalize_for_match(g.get("category") or "") == self._normalize_for_match(category)),
                    None,
                )
                if target is None:
                    target = {"category": category, "items": []}
                    merged.append(target)
                existing = {
                    self._normalize_for_match(item.get("name") or "")
                    for item in target.get("items") or [] if isinstance(item, dict)
                }
                for item in [d for d in (self._coerce_item_dict(i) for i in (group.get("items") or [])) if d]:
                    key = self._normalize_for_match(item.get("name") or "")
                    if key and key not in existing:
                        target["items"].append(item)
                        existing.add(key)
                continue
            self._merge_skill_group(merged, group.get("category"), group.get("items") or [])
        return merged

    def _flatten_all_atomic_groups(self, groups: List[dict]) -> List[dict]:
        if not isinstance(groups, list):
            return []
        if not groups:
            return groups
        all_atomic = all(
            isinstance(group, dict)
            and self._looks_like_atomic_skill(group.get("category"))
            and not self._looks_like_explicit_skill_subgroup_label(group.get("category"))
            and 1 <= len(group.get("items") or []) <= 2
            for group in groups
        )
        if not all_atomic:
            return groups
        flat_items = []
        for group in groups:
            flat_items.append({"name": group["category"]})
            flat_items.extend(group.get("items") or [])
        return [{"category": "Skills", "items": self._dedupe_skill_items_only(flat_items)}]

    def _flatten_false_singleton_skill_groups(self, groups: List[dict]) -> List[dict]:
        if not isinstance(groups, list):
            return []
        flat_parent_norms = {
            self._normalize_for_match("skills"),
            self._normalize_for_match("skill"),
        }
        has_generic_group = any(
            isinstance(g, dict)
            and self._normalize_for_match(g.get("category") or "") in flat_parent_norms
            and len(g.get("items") or []) >= 3
            for g in groups
        )
        flattened_generic_items = []
        preserved_groups = []
        for group in groups:
            if not isinstance(group, dict):
                continue
            category = self._normalize_skill_category_name(
                self._clean_text(group.get("category")) or "Skills"
            )
            category_norm = self._normalize_for_match(category)
            items = [d for d in (self._coerce_item_dict(i) for i in (group.get("items") or [])) if d]
            if not items:
                continue
            if category_norm in flat_parent_norms:
                flattened_generic_items.extend(items)
                continue
            if (
                has_generic_group
                and len(items) <= 2
                and self._looks_like_atomic_skill(category)
                and not self._looks_like_explicit_skill_subgroup_label(category)
                and all(self._looks_like_atomic_skill(item.get("name")) for item in items)
            ):
                flattened_generic_items.append({"name": category})
                flattened_generic_items.extend(items)
                continue
            preserved_groups.append({"category": category, "items": items})
        result = []
        if flattened_generic_items:
            result.append({
                "category": "Skills",
                "items": self._dedupe_skill_items_only(flattened_generic_items),
            })
        for group in preserved_groups:
            result.append({
                "category": group["category"],
                "items": self._dedupe_skill_items_only(group["items"]),
            })
        return self._flatten_all_atomic_groups(result)
    # =========================================================================
    # Language/skill split + LLM ambiguous resolver
    # =========================================================================

    def _build_ambiguous_language_skill_prompt(self, items: List[dict]) -> str:
        payload = []
        for row in items:
            payload.append({
                "id": row["id"], "section": row.get("section"),
                "item": row.get("item"), "level": row.get("level"),
                "neighbors": row.get("neighbors", []),
                "original_text": row.get("original_text"),
            })
        return "\n".join([
            "You classify ambiguous CV items as either a human spoken language or a technical skill.",
            "Use ONLY the provided context.",
            "Never invent facts.",
            "If unsure, return ambiguous.",
            "Return raw JSON only.",
            'Expected schema: {"items":[{"id":"a_0","label":"human_language"}]}',
            'Allowed labels: "human_language", "technical_skill", "ambiguous"',
            "",
            "ITEMS:",
            json.dumps(payload, ensure_ascii=False),
        ])

    def _resolve_ambiguous_language_skill_items(self, items: List[dict]) -> Dict[str, str]:
        if not items:
            return {}
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": (
                        "You classify ambiguous CV items using only the provided context. "
                        "Never invent. Return valid raw JSON only."
                    )},
                    {"role": "user", "content": self._build_ambiguous_language_skill_prompt(items)},
                ],
                temperature=0,
                max_tokens=1200,
            )
            data = self._safe_json_loads(response.choices[0].message.content or "")
            if not isinstance(data, dict):
                return {}
            out = {}
            for row in data.get("items", []) or []:
                if not isinstance(row, dict):
                    continue
                item_id = self._clean_text(row.get("id"))
                label = self._clean_text(row.get("label"))
                if not item_id:
                    continue
                if label not in {"human_language", "technical_skill", "ambiguous"}:
                    continue
                out[item_id] = label
            return out
        except Exception:
            return {}

    def _split_languages_and_skills(self, data: dict) -> Tuple[List[dict], List[dict]]:
        skills_out: List[dict] = []
        languages_out: List[dict] = []
        lang_seen: set = set()
        ambiguous_items: List[dict] = []

        def coerce_language_item_dict(item) -> Optional[dict]:
            if isinstance(item, str):
                name = self._clean_text(item)
                return {"name": name} if name else None
            if not isinstance(item, dict):
                return None
            name = self._clean_text(item.get("name"))
            if not name:
                return None
            out = {"name": name}
            level = self._clean_text(item.get("level"))
            if level and self._is_language_text_level(level):
                out["level"] = level
                out["source"] = "text"
            return out

        def collect_neighbor_names(raw_items, current_index: int) -> List[str]:
            names = []
            for j, raw in enumerate(raw_items or []):
                if j == current_index:
                    continue
                item_dict = self._coerce_item_dict(raw)
                if not item_dict:
                    continue
                nm = self._clean_text(item_dict.get("name"))
                if nm:
                    names.append(nm)
            return self._dedupe_str_list(names)[:4]

        def add_language(item_dict: dict, override: bool = False):
            raw_name = self._clean_text(item_dict.get("name"))
            raw_level = self._clean_text(item_dict.get("level"))
            raw_name, inferred_level = self._extract_embedded_language_level(raw_name)
            name = self._clean_text(raw_name)
            level = raw_level or inferred_level
            if not name:
                return
            key = name.casefold().strip()
            if key in lang_seen:
                return
            payload = {"name": name}
            if level and self._is_language_text_level(level):
                payload["level"] = level
                payload["source"] = "text"
            if override:
                payload["_classified_as_language"] = True
            languages_out.append(payload)
            lang_seen.add(key)

        def add_skill(item_dict: dict, category: str = "Skills"):
            self._merge_skill_group(skills_out, category, [item_dict])

        def queue_ambiguous(item_dict: dict, section_category: Optional[str],
                            neighbors: List[str], original_text: Optional[str] = None):
            raw_name = self._clean_text(item_dict.get("name"))
            raw_level = self._clean_text(item_dict.get("level"))
            raw_name, inferred_level = self._extract_embedded_language_level(raw_name)
            name = self._clean_text(raw_name)
            level = raw_level or inferred_level
            if not name:
                return
            ambiguous_items.append({
                "id": f"a_{len(ambiguous_items)}",
                "section": self._clean_text(section_category) or "Languages",
                "item": name, "level": level,
                "neighbors": self._dedupe_str_list(
                    [self._clean_text(x) for x in neighbors if self._clean_text(x)]
                )[:4],
                "original_text": self._clean_text(original_text) or name,
                "item_dict": {"name": name, **({"level": level} if level else {})},
            })

        raw_languages = data.get("languages") or []
        for idx, raw_lang in enumerate(raw_languages):
            item_dict = coerce_language_item_dict(raw_lang)
            if not item_dict:
                continue
            name = item_dict.get("name")
            level = item_dict.get("level")
            neighbors = collect_neighbor_names(raw_languages, idx)
            label = self._classify_language_skill_candidate(
                name=name, level=level, section_category="Languages", neighbors=neighbors,
            )
            if label == "language":
                add_language(item_dict)
            elif label == "skill":
                add_skill(item_dict, "Skills")
            else:
                queue_ambiguous(item_dict=item_dict, section_category="Languages",
                                neighbors=neighbors, original_text=name)

        for group in (data.get("skills") or []):
            if not isinstance(group, dict):
                continue
            category = self._clean_text(group.get("category")) or "Skills"
            raw_items = group.get("items") or []
            if not self._is_language_section(category):
                self._merge_skill_group(skills_out, category, raw_items)
                continue
            for idx, raw_item in enumerate(raw_items):
                item_dict = self._coerce_item_dict(raw_item)
                if not item_dict:
                    continue
                name = item_dict.get("name")
                level = item_dict.get("level")
                neighbors = collect_neighbor_names(raw_items, idx)
                label = self._classify_language_skill_candidate(
                    name=name, level=level, section_category=category, neighbors=neighbors,
                )
                if label == "language":
                    add_language(item_dict, override=True)
                elif label == "skill":
                    add_skill(item_dict, "Skills")
                else:
                    queue_ambiguous(item_dict=item_dict, section_category=category,
                                    neighbors=neighbors, original_text=name)

        resolved = self._resolve_ambiguous_language_skill_items(ambiguous_items)
        for row in ambiguous_items:
            llm_label = resolved.get(row["id"], "ambiguous")
            item_dict = row["item_dict"]
            if llm_label == "human_language":
                add_language(item_dict, override=True)
            else:
                add_skill(item_dict, "Skills")

        skills_out = self._rebuild_skill_groups(skills_out)
        skills_out = self._flatten_false_singleton_skill_groups(skills_out)
        return skills_out, languages_out
    # =========================================================================
    # Technology recovery
    # =========================================================================

    def _entry_has_textual_context(self, row: dict, text_keys: List[str], list_keys: List[str]) -> bool:
        if not isinstance(row, dict):
            return False
        for key in text_keys:
            if self._clean_text(row.get(key)):
                return True
        for key in list_keys:
            values = row.get(key) or []
            if isinstance(values, str):
                values = [values]
            if any(self._clean_text(x) for x in values if isinstance(x, str)):
                return True
        return False

    def _entry_has_descriptive_context(self, row: dict, text_keys: List[str], list_keys: List[str]) -> bool:
        return self._entry_has_textual_context(row, text_keys=text_keys, list_keys=list_keys)

    def _collect_missing_technology_targets(self, parsed: dict) -> dict:
        targets = {"experience": [], "projects": []}
        for idx, row in enumerate(parsed.get("experience") or []):
            if not isinstance(row, dict):
                continue
            if row.get("technologies"):
                continue
            if not self._entry_has_descriptive_context(row, text_keys=["description"], list_keys=["responsibilities"]):
                continue
            targets["experience"].append({
                "index": idx,
                "job_title": self._clean_text(row.get("job_title")),
                "company": self._clean_text(row.get("company")),
                "description": self._clean_text(row.get("description")),
                "responsibilities": self._dedupe_str_list(
                    [str(x).strip() for x in (row.get("responsibilities") or []) if x]
                ),
            })
        for idx, row in enumerate(parsed.get("projects") or []):
            if not isinstance(row, dict):
                continue
            if row.get("technologies"):
                continue
            if not self._entry_has_descriptive_context(row, text_keys=["description"], list_keys=["bullets"]):
                continue
            targets["projects"].append({
                "index": idx,
                "name": self._clean_text(row.get("name")),
                "role": self._clean_text(row.get("role")),
                "description": self._clean_text(row.get("description")),
                "bullets": self._dedupe_str_list(
                    [str(x).strip() for x in (row.get("bullets") or []) if x]
                ),
            })
        return targets

    def _build_missing_technologies_prompt(self, targets: dict) -> str:
        return "\n".join([
            "You receive already-parsed CV entries where the technologies field is still empty.",
            "Your task: recover ONLY technologies that are explicitly mentioned in the provided entry text.",
            "Rules:",
            "- Use only the text provided below.",
            "- Never invent technologies.",
            "- If an entry does not explicitly mention any technology, return an empty list for that entry.",
            "- Do not return human spoken languages as technologies.",
            "- Keep existing entry indexes unchanged.",
            "- Return raw JSON only.",
            'Expected JSON schema: {"experience":[{"index":0,"technologies":["Python"]}],"projects":[{"index":0,"technologies":["FastAPI"]}]}',
            "",
            "PROJECTS",
            '- Map "Projets Académique", "Projets Académiques", "Projet Académique" -> projects[]',
            "- One project = one entry",
            "",
            "ENTRIES:",
            json.dumps(targets, ensure_ascii=False),
        ])

    def _clean_recovered_technologies(self, values) -> List[str]:
        if isinstance(values, str):
            values = [values]
        if not isinstance(values, list):
            return []
        cleaned = []
        for value in values:
            if not isinstance(value, str):
                continue
            tech = self._clean_text(value)
            if not tech:
                continue
            if self._is_human_language_name(tech):
                continue
            cleaned.append(tech)
        return self._dedupe_str_list(cleaned)

    def _merge_recovered_technologies(self, parsed: dict, recovered: dict) -> None:
        for section in ("experience", "projects"):
            parsed_rows = parsed.get(section) or []
            recovered_rows = recovered.get(section) or []
            if not isinstance(parsed_rows, list) or not isinstance(recovered_rows, list):
                continue
            for row in recovered_rows:
                if not isinstance(row, dict):
                    continue
                index = row.get("index")
                if not isinstance(index, int):
                    continue
                if index < 0 or index >= len(parsed_rows):
                    continue
                target = parsed_rows[index]
                if not isinstance(target, dict) or target.get("technologies"):
                    continue
                technologies = self._clean_recovered_technologies(row.get("technologies"))
                if technologies:
                    target["technologies"] = technologies

    def _recover_missing_technologies(self, parsed: dict) -> dict:
        if not isinstance(parsed, dict) or parsed.get("_error"):
            return parsed
        targets = self._collect_missing_technology_targets(parsed)
        if not targets["experience"] and not targets["projects"]:
            return parsed
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": (
                        "You extract only explicitly written technologies from CV entries. "
                        "Never invent. Return valid raw JSON only."
                    )},
                    {"role": "user", "content": self._build_missing_technologies_prompt(targets)},
                ],
                temperature=0,
                max_tokens=1500,
            )
            recovered = self._safe_json_loads(response.choices[0].message.content or "")
            if isinstance(recovered, dict):
                self._merge_recovered_technologies(parsed, recovered)
        except Exception:
            return parsed
        return parsed

    # =========================================================================
    # Raw text recovery passes
    # =========================================================================

    def _recover_personal_info_from_raw_text(self, parsed: dict, raw_text: str = "") -> dict:
        if not isinstance(parsed, dict):
            return parsed
        raw_text = (raw_text or "").strip()
        if not raw_text:
            return parsed
        if not isinstance(parsed.get("personal_info"), dict):
            parsed["personal_info"] = {}
        pi = parsed["personal_info"]
        lines = [self._clean_text(x) for x in raw_text.splitlines()]
        lines = [x for x in lines if x]
        joined = "\n".join(lines)
        if not pi.get("full_name"):
            for line in lines[:8]:
                if re.fullmatch(r"[A-Z][A-Za-z''.\-]+(?:\s+[A-Z][A-Za-z''.\-]+){1,3}", line):
                    pi["full_name"] = line
                    break
        if not pi.get("website"):
            m = re.search(r"\b(?:https?://)?(?:www\.)?(twitter\.com/[^\s|]+)\b", joined, re.IGNORECASE)
            if m:
                pi["website"] = m.group(1)
        return parsed

    def _recover_missing_skill_sections_from_raw_text(self, parsed: dict, raw_text: str = "") -> dict:
        if not isinstance(parsed, dict) or not raw_text.strip():
            return parsed
        lines = [self._clean_text(x) for x in raw_text.splitlines()]
        lines = [x for x in lines if x]
        section_titles = [
            "hard skills", "soft skills", "technical skills", "general skills",
            "skills", "compétences", "competences", "personal skills"
        ]

        def norm(x: str) -> str:
            return self._normalize_for_match(x)

        normalized_titles = {norm(x) for x in section_titles}
        groups_found = []
        i = 0
        while i < len(lines):
            current = norm(lines[i])
            if current in normalized_titles:
                title = lines[i]
                block = []
                i += 1
                while i < len(lines):
                    cur = norm(lines[i])
                    if cur in normalized_titles:
                        break
                    if cur in {
                        "summary", "experience", "education", "awards",
                        "exhibitions", "commission", "personal info",
                        "personal information",
                    }:
                        break
                    block.append(lines[i])
                    i += 1
                groups_found.append((title, block))
                continue
            i += 1
        for title, block in groups_found:
            items = []
            j = 0
            while j < len(block):
                name = self._clean_text(block[j])
                if not name:
                    j += 1
                    continue
                level = None
                if j + 1 < len(block):
                    nxt = self._clean_text(block[j + 1])
                    if nxt and self._is_text_level(nxt):
                        level = nxt
                        j += 1
                row = {"name": name}
                if level:
                    row["level"] = level
                    row["source"] = "text"
                items.append(row)
                j += 1
            if items:
                self._merge_skill_group(parsed.setdefault("skills", []), title, items)
        return parsed

    def _recover_missing_language_items_from_raw_text(self, parsed: dict, raw_text: str = "") -> dict:
        if not isinstance(parsed, dict) or parsed.get("_error"):
            return parsed
        raw_text = (raw_text or "").strip()
        if not raw_text:
            return parsed
        lines = [self._clean_text(x) for x in raw_text.splitlines()]
        lines = [x for x in lines if x]
        start_idx = None
        for i, line in enumerate(lines):
            norm = self._normalize_for_match(line)
            if norm in {"langues", "languages", "language", "langue"}:
                start_idx = i + 1
                break
        if start_idx is None:
            return parsed
        block = []
        for line in lines[start_idx:]:
            norm = self._normalize_for_match(line)
            if (
                norm in {
                    "competences", "skills", "experience", "formation", "education",
                    "projects", "projets", "certifications", "profile", "profil",
                    "summary", "interests", "awards"
                }
                or (line.isupper() and len(line.split()) <= 6)
            ):
                break
            block.append(line)
        if not block:
            return parsed
        block_text = " ".join(block)
        candidates = re.split(r"[\u2022;\n]+", block_text)
        candidates = [self._clean_text(x) for x in candidates if self._clean_text(x)]
        if not candidates:
            return parsed
        existing_langs = {
            self._normalize_for_match(x.get("name") or "")
            for x in (parsed.get("languages") or [])
            if isinstance(x, dict)
        }
        existing_skills = set()
        for group in parsed.get("skills", []) or []:
            if not isinstance(group, dict):
                continue
            for item in group.get("items") or []:
                if isinstance(item, dict):
                    nm = self._clean_text(item.get("name"))
                    if nm:
                        existing_skills.add(self._normalize_for_match(nm))
        ambiguous_items = []
        for cand in candidates:
            name, inferred_level = self._extract_embedded_language_level(cand)
            name = self._clean_text(name)
            level = self._clean_text(inferred_level)
            if not name:
                continue
            norm_name = self._normalize_for_match(name)
            if norm_name in existing_langs or norm_name in existing_skills:
                continue
            label = self._classify_language_skill_candidate(
                name=name, level=level, section_category="Languages", neighbors=[],
            )
            if label == "language":
                parsed.setdefault("languages", []).append({
                    "name": name,
                    **({"level": level, "source": "text"} if level and self._is_language_text_level(level) else {}),
                    "_classified_as_language": True,
                })
                existing_langs.add(norm_name)
            elif label == "skill":
                self._merge_skill_group(
                    parsed.setdefault("skills", []),
                    "Skills",
                    [{"name": name, **({"level": level} if level else {})}]
                )
                existing_skills.add(norm_name)
            else:
                ambiguous_items.append({
                    "id": f"lang_raw_{len(ambiguous_items)}",
                    "section": "Languages", "item": name, "level": level,
                    "neighbors": [], "original_text": cand,
                    "item_dict": {"name": name, **({"level": level} if level else {})},
                })
        resolved = self._resolve_ambiguous_language_skill_items(ambiguous_items)
        for row in ambiguous_items:
            item_dict = row["item_dict"]
            name = self._clean_text(item_dict.get("name"))
            level = self._clean_text(item_dict.get("level"))
            norm_name = self._normalize_for_match(name or "")
            if not name or norm_name in existing_langs or norm_name in existing_skills:
                continue
            final_label = resolved.get(row["id"], "ambiguous")
            if final_label == "human_language":
                parsed.setdefault("languages", []).append({
                    "name": name,
                    **({"level": level, "source": "text"} if level and self._is_language_text_level(level) else {}),
                    "_classified_as_language": True,
                })
                existing_langs.add(norm_name)
            else:
                self._merge_skill_group(
                    parsed.setdefault("skills", []),
                    "Skills",
                    [{"name": name, **({"level": level} if level else {})}]
                )
                existing_skills.add(norm_name)
        return parsed
    # =========================================================================
    # Normalize sections
    # =========================================================================

    def _normalize_skills(self, data: dict):
        raw = data.get("skills", [])
        if not isinstance(raw, list):
            data["skills"] = []
            return
        certifications = data.get("certifications") or []
        cert_names = {(c.get("name") or "").casefold().strip() for c in certifications if isinstance(c, dict)}
        lang_names = {(l.get("name") or "").casefold().strip() for l in (data.get("languages") or []) if isinstance(l, dict)}
        out = []
        for group in raw:
            if not isinstance(group, dict):
                continue
            category = self._normalize_skill_category_name(
                self._clean_text(group.get("category")) or "Skills"
            )
            category_norm = self._normalize_for_match(category)
            if self._is_passion_category(category) or (
                category_norm == "skills"
                and group.get("items")
                and all(
                    self._is_passion_item_name(
                        self._clean_text(item.get("name") if isinstance(item, dict) else item)
                    )
                    for item in group.get("items")
                    if isinstance(item, (str, dict))
                )
            ):
                for raw_item in group.get("items") or []:
                    item_dict = self._coerce_item_dict(raw_item)
                    if not item_dict:
                        continue
                    self._append_additional_info_from_skill_item(data, item_dict)
                continue
            if self._is_certification_category(category):
                for raw_item in group.get("items") or []:
                    item_dict = self._coerce_item_dict(raw_item)
                    if not item_dict:
                        continue
                    normalized = (item_dict.get("name") or "").casefold().strip()
                    if not normalized or normalized in cert_names:
                        continue
                    cert_names.add(normalized)
                    certifications.append({"name": item_dict.get("name"), "issuer": None, "date": None})
                continue
            clean_items, seen = [], set()
            category_norm = self._normalize_for_match(category)
            for item in (group.get("items") or []):
                if isinstance(item, str):
                    name, level = self._clean_text(item), None
                elif isinstance(item, dict):
                    name = self._clean_text(item.get("name"))
                    level = self._clean_text(item.get("level"))
                else:
                    continue
                if not name:
                    continue
                normalized = name.casefold().strip(" :")
                if normalized in cert_names:
                    continue
                if self._looks_like_certification_entry(name, None):
                    cert_names.add(normalized)
                    certifications.append({"name": name, "issuer": None, "date": None})
                    continue
                if normalized in lang_names and category_norm not in self._programming_category_labels_norm:
                    continue
                if len(normalized) == 1 and normalized not in {"r", "c"}:
                    continue
                if normalized == category.casefold().strip():
                    continue
                key = name.casefold()
                if key in seen:
                    continue
                seen.add(key)
                item_dict = {"name": name}
                if level and self._is_text_level(level):
                    item_dict["level"] = level
                    item_dict["source"] = "text"
                if isinstance(item, dict):
                    source = self._clean_text(item.get("source"))
                    if source:
                        item_dict["source"] = source
                    confidence = item.get("confidence")
                    if confidence is not None:
                        try:
                            item_dict["confidence"] = max(0.0, min(1.0, float(confidence)))
                        except (TypeError, ValueError):
                            pass
                clean_items.append(item_dict)
            if clean_items:
                out.append({"category": category, "items": clean_items})
        data["skills"] = out
        data["certifications"] = certifications

    def _normalize_icon_names(self, data: dict) -> None:
        for group in data.get("skills", []):
            if not isinstance(group, dict):
                continue
            new_items, seen = [], set()
            for item in group.get("items", []):
                if not isinstance(item, dict):
                    continue
                name = self._clean_text(item.get("name"))
                if not name:
                    continue
                key = name.casefold().strip()
                if key in self._ICON_NAME_MAP:
                    name = self._ICON_NAME_MAP[key]
                norm = name.casefold()
                if norm in seen:
                    continue
                seen.add(norm)
                item["name"] = name
                new_items.append(item)
            group["items"] = new_items

    def _strip_non_text_levels(self, result: dict) -> None:
        for group in result.get("skills", []):
            if not isinstance(group, dict):
                continue
            for item in group.get("items", []):
                if not isinstance(item, dict):
                    continue
                if not self._is_text_level(item.get("level")):
                    item.pop("level", None)
                    item.pop("level_score", None)
                    item.pop("source", None)
                else:
                    item.pop("level_score", None)
                    item["source"] = "text"
        for lang in result.get("languages", []):
            if not isinstance(lang, dict):
                continue
            if not self._is_language_text_level(lang.get("level")):
                lang.pop("level", None)
                lang.pop("level_score", None)
                lang.pop("source", None)
            else:
                lang.pop("level_score", None)
                lang["source"] = "text"

    def _normalize_language_levels(self, result: dict) -> None:
        for row in result.get("languages", []) or []:
            if not isinstance(row, dict):
                continue

            name = self._clean_text(row.get("name"))
            level = self._clean_text(row.get("level"))

            # si le niveau n'est pas déjà séparé, essayer depuis le nom
            parsed_name, inferred_level = self._extract_embedded_language_level(name)
            if parsed_name:
                row["name"] = parsed_name

            if not level and inferred_level:
                level = inferred_level

            # garder les niveaux de langue, pas seulement les niveaux génériques
            if level and self._is_language_text_level(level):
                row["level"] = level
            else:
                row.pop("level", None)

    def _normalize_languages(self, data: dict):
        raw = data.get("languages", [])
        if not isinstance(raw, list):
            data["languages"] = []
            return
        out, seen = [], set()
        for l in raw:
            if isinstance(l, str):
                l = {"name": l}
            if not isinstance(l, dict):
                continue
            raw_name = self._clean_text(l.get("name"))
            raw_level = self._clean_text(l.get("level"))
            is_override = bool(l.get("_classified_as_language", False))
            raw_name, inferred_level = self._extract_embedded_language_level(raw_name)
            name = self._clean_text(raw_name)
            level = raw_level or inferred_level
            if not name:
                continue
            if not is_override and not self._is_human_language(name, level):
                continue
            key = name.casefold().strip()
            if key in seen:
                continue
            seen.add(key)
            lang_dict = {"name": name}
            if level and self._is_language_text_level(level):
                lang_dict["level"] = level
                lang_dict["source"] = "text"
            out.append(lang_dict)
        data["languages"] = out

    def _normalize_section_list(self, rows, keys):
        out = []
        for row in rows or []:
            if not isinstance(row, dict):
                continue
            clean, has_value = {}, False
            for k in keys:
                v = row.get(k)
                if isinstance(v, list):
                    v = self._dedupe_str_list(v)
                else:
                    v = self._clean_text(v)
                clean[k] = v
                if v not in (None, [], False):
                    has_value = True
            if "is_current" in keys:
                clean["is_current"] = bool(row.get("is_current", False))
                if clean["is_current"]:
                    has_value = True
            if has_value:
                out.append(clean)
        return out

    def _normalize_certifications(self, data: dict):
        raw = data.get("certifications", [])
        if not isinstance(raw, list):
            data["certifications"] = []
            return
        out, seen = [], set()
        for row in raw:
            if isinstance(row, str):
                row = {"name": row}
            if not isinstance(row, dict):
                continue
            clean = {
                "name": self._clean_text(row.get("name")),
                "issuer": self._clean_text(row.get("issuer") or row.get("institution")),
                "date": self._clean_text(row.get("date") or row.get("end_date")),
            }
            if not clean["name"]:
                continue
            key = (self._normalize_for_match(clean["name"]), self._normalize_for_match(clean["issuer"] or ""))
            if key in seen:
                continue
            seen.add(key)
            out.append(clean)
        data["certifications"] = out

    def _build_certification_name_from_education(self, edu: dict) -> Optional[str]:
        degree = self._clean_text(edu.get("degree"))
        field = self._clean_text(edu.get("field"))
        degree_norm = self._normalize_for_match(degree or "")
        if degree_norm in {"certificate", "certification", "certificat", "credential", "badge"} and field:
            return f"{field} {degree}"
        return degree or field

    def _append_certification(self, certifications: List[dict], seen: set, name: Optional[str],
                               issuer: Optional[str] = None, date_val: Optional[str] = None) -> None:
        name = self._clean_text(name)
        issuer = self._clean_text(issuer)
        date_v = self._clean_text(date_val)
        if not name:
            return
        key = (self._normalize_for_match(name), self._normalize_for_match(issuer or ""))
        if key in seen:
            return
        seen.add(key)
        certifications.append({"name": name, "issuer": issuer, "date": date_v})

    def _promote_education_certifications(self, result: dict) -> None:
        education = result.get("education", []) or []
        certifications = result.get("certifications", []) or []
        seen = {
            (self._normalize_for_match(c.get("name") or ""), self._normalize_for_match(c.get("issuer") or ""))
            for c in certifications if isinstance(c, dict)
        }
        kept = []
        for edu in education:
            if not isinstance(edu, dict):
                continue
            degree = self._clean_text(edu.get("degree"))
            field = self._clean_text(edu.get("field"))
            institution = self._clean_text(edu.get("institution"))
            end_date = self._clean_text(edu.get("end_date"))
            start_date = self._clean_text(edu.get("start_date"))
            if self._looks_like_certification_entry(degree, field):
                self._append_certification(
                    certifications, seen,
                    self._build_certification_name_from_education(edu),
                    institution, end_date or start_date,
                )
                continue
            kept.append(edu)
        result["education"] = kept
        result["certifications"] = certifications

    def _normalize_embedded_projects(self, raw) -> list:
        if not raw or not isinstance(raw, list):
            return []
        out, seen = [], set()
        for item in raw:
            if isinstance(item, dict):
                name = self._clean_text(item.get("name") or item.get("title"))
                desc = item.get("description") or item.get("details")
                if isinstance(desc, list):
                    desc = " ".join(str(d).strip() for d in desc if d)
                desc = self._clean_text(desc)

                raw_bullets = item.get("bullets") or item.get("responsibilities") or []
                if isinstance(raw_bullets, str):
                    raw_bullets = [raw_bullets]
                bullets = self._dedupe_str_list([str(b).strip() for b in raw_bullets if b])

                raw_technologies = item.get("technologies") or []
                if isinstance(raw_technologies, str):
                    raw_technologies = [raw_technologies]
                technologies = self._dedupe_str_list(
                    [str(t).strip() for t in raw_technologies if t]
                )

                if bullets and not desc:
                    desc = " ".join(bullets)

                if not name and not desc and not bullets and not technologies:
                    continue
                key = (name or "").casefold()
                if key and key in seen:
                    continue
                if key:
                    seen.add(key)
                out.append({
                    "name": name,
                    "description": desc,
                    "bullets": bullets,
                    "technologies": technologies,
                })
            elif isinstance(item, str) and item.strip():
                name = item.strip()
                key = name.casefold()
                if key in seen:
                    continue
                seen.add(key)
                out.append({
                    "name": name,
                    "description": None,
                    "bullets": [],
                    "technologies": [],
                })
        return out

    def _normalize_experience(self, data: dict):
        raw = data.get("experience", []) or []
        out = []
        for row in raw:
            if not isinstance(row, dict):
                continue
            job_title = self._clean_text(row.get("job_title"))
            company = self._clean_text(row.get("company"))
            is_internship = self._looks_like_internship_role(job_title)
            raw_description = []
            raw_responsibilities = []
            for key in (
                "description", "details", "summary", "text", "body",
                "overview", "intro", "company_description",
                "mission", "context", "scope", "objective",
                "role_summary", "project_description", "content", "paragraphs", "free_text"
            ):
                value = row.get(key)
                if isinstance(value, str):
                    raw_description.append(value)
                elif isinstance(value, list):
                    raw_description.extend([x for x in value if isinstance(x, str)])
            for key in (
                "responsibilities", "activities", "tasks", "duties",
                "highlights", "achievements", "missions", "work_items", "bullet_points"
            ):
                value = row.get(key)
                if isinstance(value, str):
                    raw_responsibilities.append(value)
                elif isinstance(value, list):
                    raw_responsibilities.extend([x for x in value if isinstance(x, str)])
            description_parts = self._dedupe_str_list(raw_description)
            responsibility_parts = self._dedupe_str_list(raw_responsibilities)
            cleaned_description = []
            cleaned_responsibilities = []
            for item in description_parts:
                norm_item = self._normalize_bullet_or_label(item)
                if not norm_item:
                    continue
                if self._looks_like_experience_intro(norm_item, company):
                    cleaned_description.append(norm_item)
                elif is_internship and self._looks_like_short_mission_label(norm_item):
                    if len(norm_item.split()) <= 6:
                        cleaned_responsibilities.append(norm_item)
                    else:
                        cleaned_description.append(norm_item)
                else:
                    cleaned_description.append(norm_item)
            for item in responsibility_parts:
                norm_item = self._normalize_bullet_or_label(item)
                if not norm_item:
                    continue
                if self._looks_like_experience_intro(norm_item, company):
                    cleaned_description.append(norm_item)
                else:
                    cleaned_responsibilities.append(norm_item)
            description = self._clean_text(" ".join(self._dedupe_str_list(cleaned_description))) if cleaned_description else None
            responsibilities = self._dedupe_str_list(cleaned_responsibilities)
            technologies = row.get("technologies") or []
            if isinstance(technologies, str):
                technologies = [technologies]
            technologies = self._dedupe_str_list(
                [self._clean_text(x) for x in technologies if isinstance(x, str) and self._clean_text(x)]
            )
            entry = {
                "job_title": job_title,
                "company": company,
                "location": self._clean_text(row.get("location")),
                "start_date": self._clean_text(row.get("start_date")),
                "end_date": self._clean_text(row.get("end_date")),
                "is_current": bool(row.get("is_current", False)),
                "description": description,
                "responsibilities": responsibilities,
                "technologies": technologies,
                "projects": self._normalize_embedded_projects(row.get("projects")),
                "source_section": row.get("source_section"),
                "entry_type": row.get("entry_type"),
                "confidence": row.get("confidence"),
            }
            has_value = any(v not in (None, [], False, "") for v in entry.values())
            if entry["is_current"]:
                has_value = True
            if has_value:
                out.append(entry)
        data["experience"] = out

    def _normalize_volunteer(self, data: dict):
        raw = data.get("volunteer", [])
        if not isinstance(raw, list):
            data["volunteer"] = []
            return
        out = []
        for row in raw:
            if isinstance(row, str):
                txt = self._clean_text(row)
                if txt:
                    out.append({"role": txt, "organization": None, "location": None,
                                "start_date": None, "end_date": None, "description": None})
                continue
            if not isinstance(row, dict):
                continue
            clean = {
                "role": self._clean_text(row.get("role") or row.get("title")),
                "organization": self._clean_text(row.get("organization") or row.get("company")),
                "location": self._clean_text(row.get("location")),
                "start_date": self._clean_text(row.get("start_date")),
                "end_date": self._clean_text(row.get("end_date")),
                "description": self._clean_text(row.get("description")),
            }
            if any(v is not None for v in clean.values()):
                out.append(clean)
        data["volunteer"] = out

    def _normalize_associations(self, data: dict):
        raw = data.get("associations", [])
        if not isinstance(raw, list):
            data["associations"] = []
            return
        out = []
        for row in raw:
            if isinstance(row, str):
                txt = self._clean_text(row)
                if txt:
                    out.append({"role": txt, "organization": None, "location": None,
                                "start_date": None, "end_date": None, "description": None})
                continue
            if not isinstance(row, dict):
                continue
            clean = {
                "role": self._clean_text(row.get("role") or row.get("title")),
                "organization": self._clean_text(row.get("organization") or row.get("club")),
                "location": self._clean_text(row.get("location")),
                "start_date": self._clean_text(row.get("start_date")),
                "end_date": self._clean_text(row.get("end_date")),
                "description": self._clean_text(row.get("description")),
            }
            if any(v is not None for v in clean.values()):
                out.append(clean)
        data["associations"] = out

    def _repair_experience_descriptions_and_technologies(self, result: dict) -> None:
        for exp in result.get("experience", []) or []:
            if not isinstance(exp, dict):
                continue

            techs = exp.get("technologies") or []
            if not isinstance(techs, list):
                techs = []

            cleaned_techs = []
            seen = set()

            for t in techs:
                tt = self._clean_text(t)
                if not tt:
                    continue
                key = self._normalize_for_match(tt)
                if key in seen:
                    continue
                seen.add(key)
                cleaned_techs.append(tt)

            exp["technologies"] = cleaned_techs

            # If a narrative sentence landed in responsibilities, expose it as
            # description too, but do not drop the original responsibilities.
            responsibilities = exp.get("responsibilities") or []
            if responsibilities and not exp.get("description"):
                joined = " ".join(
                    self._clean_text(x) for x in responsibilities
                    if self._clean_text(x)
                )
                if len(joined.split()) >= 5:
                    exp["description"] = joined

    def _experience_date_tokens_for_match(self, exp: dict) -> List[str]:
        tokens = []
        for key in ("start_date", "end_date"):
            value = self._clean_text(exp.get(key))
            if not value:
                continue
            norm = self._normalize_for_match(value)
            if norm:
                tokens.append(norm)
                tokens.append(re.sub(r"\s+", "", norm))
        return [x for x in self._dedupe_str_list(tokens) if x]

    def _experience_company_tokens_for_match(self, exp: dict) -> List[str]:
        company = self._normalize_for_match(self._clean_text(exp.get("company")) or "")
        blocked = {"siege", "headquarters", "company", "societe"}
        return [
            token for token in company.split()
            if len(token) >= 3 and token not in blocked
        ]

    def _experience_title_tokens_for_match(self, exp: dict) -> List[str]:
        title = self._normalize_for_match(self._clean_text(exp.get("job_title")) or "")
        blocked = {"stage", "internship", "intern", "d", "de", "du", "des"}
        return [
            token for token in title.split()
            if len(token) >= 3 and token not in blocked
        ]

    def _line_matches_experience_entry(self, line: str, exp: dict) -> bool:
        norm = self._normalize_for_match(line)
        if not norm:
            return False
        compact = re.sub(r"\s+", "", norm)

        company_tokens = self._experience_company_tokens_for_match(exp)
        title_tokens = self._experience_title_tokens_for_match(exp)
        date_tokens = self._experience_date_tokens_for_match(exp)

        company_hit = any(token in norm for token in company_tokens)
        title_hit_count = sum(1 for token in title_tokens if token in norm)
        title_hit = bool(title_tokens) and title_hit_count >= min(2, len(title_tokens))
        date_hit = any(token and (token in norm or token in compact) for token in date_tokens)

        return (company_hit and (title_hit or date_hit)) or (title_hit and date_hit)

    def _looks_like_raw_section_header(self, line: str) -> bool:
        norm = self._normalize_for_match(line)
        if not norm:
            return False
        compact = re.sub(r"\s+", "", norm)
        stop_headers = {
            "formation", "formations", "education", "profil", "profile",
            "competences", "skills", "langues", "languages", "certification",
            "certifications", "associations", "vie associative", "interests",
            "hobbies", "awards", "projets", "projects", "projets academique",
            "projets academiques", "academic projects", "selected project experience",
            "project experience", "selected projects", "key projects",
        }
        stop_compact = {re.sub(r"\s+", "", x) for x in stop_headers}
        if norm in stop_headers or compact in stop_compact:
            return True
        return compact.startswith((
            "projetsacad", "competences", "formation", "experiencesprofessionnelles",
            "certification", "langues", "languages", "education",
        ))

    def _looks_like_experience_technology_line(self, line: str, exp: dict) -> bool:
        text = self._clean_text(line)
        if not text:
            return True
        norm = self._normalize_for_match(text)
        words = norm.split()
        has_list_marker = bool(re.search(r"[•·▪◦●]", text)) or bool(
            re.search(r"(^|\s)\?(\s|$)", text)
        )
        has_list_shape = has_list_marker or len(re.split(r"\s{2,}", text)) > 1

        technologies = exp.get("technologies") or []
        if isinstance(technologies, str):
            technologies = [technologies]
        tech_hits = 0
        for tech in technologies:
            tech_norm = self._normalize_for_match(self._clean_text(tech) or "")
            if tech_norm and tech_norm in norm:
                tech_hits += 1

        if tech_hits and (has_list_shape or len(words) <= 8):
            return True
        if has_list_marker and len(words) <= 16 and tech_hits:
            return True
        if re.search(r"\b(methodologie|methodology|modele ml|ml model)\b", norm) and len(words) <= 10:
            return True
        return False

    def _recover_experience_descriptions_from_raw_text(
        self,
        result: dict,
        raw_text: Optional[str] = None,
    ) -> None:
        if not isinstance(result.get("experience"), list) or not self._clean_text(raw_text):
            return

        lines = [self._clean_text(x) for x in str(raw_text).replace("\r", "\n").split("\n")]
        lines = [x for x in lines if x]
        if not lines:
            return

        experiences = [x for x in result.get("experience", []) if isinstance(x, dict)]
        for exp in experiences:
            if exp.get("description") or exp.get("responsibilities"):
                continue
            is_internship = self._looks_like_internship_role(exp.get("job_title"))
            if not is_internship:
                continue

            start_idx = None
            for idx, line in enumerate(lines):
                if self._line_matches_experience_entry(line, exp):
                    start_idx = idx
                    break
            if start_idx is None:
                continue

            description_lines = []
            responsibility_lines = []
            for line in lines[start_idx + 1:]:
                if self._looks_like_raw_section_header(line):
                    break
                if any(
                    other is not exp and self._line_matches_experience_entry(line, other)
                    for other in experiences
                ):
                    break
                if self._looks_like_experience_technology_line(line, exp):
                    continue

                cleaned = self._normalize_bullet_or_label(line)
                if not cleaned:
                    continue
                if re.match(r"^\s*[-*•▪◦·●?]+\s*", line):
                    responsibility_lines.append(cleaned)
                else:
                    description_lines.append(cleaned)

            description_lines = self._dedupe_str_list(description_lines)
            responsibility_lines = self._dedupe_str_list(responsibility_lines)
            if description_lines:
                exp["description"] = self._clean_text(" ".join(description_lines))
            elif is_internship and responsibility_lines:
                exp["responsibilities"] = responsibility_lines

    def _recover_projects_from_experience(self, result: dict) -> None:
        """
        Récupère les projets embarqués dans experience[].projects[] et les
        remonte vers projects[] top-level, avec leurs descriptions et bullets.
        """
        if not isinstance(result.get("projects"), list):
            result["projects"] = []

        existing_project_names = {
            self._normalize_for_match(p.get("name") or "")
            for p in result["projects"]
            if isinstance(p, dict) and p.get("name")
        }

        for exp in result.get("experience", []) or []:
            if not isinstance(exp, dict):
                continue

            # Cas 1 : projets explicitement dans experience[].projects[]
            embedded_projects = exp.get("projects") or []
            if not isinstance(embedded_projects, list):
                embedded_projects = []

            for embedded in embedded_projects:
                if isinstance(embedded, str):
                    embedded = {"name": embedded}
                if not isinstance(embedded, dict):
                    continue
                name = self._clean_text(embedded.get("name") or embedded.get("title"))
                if not name:
                    continue
                key = self._normalize_for_match(name)
                if key in existing_project_names:
                    continue
                existing_project_names.add(key)

                raw_desc = embedded.get("description") or embedded.get("details")
                if isinstance(raw_desc, list):
                    raw_desc = " ".join(str(x) for x in raw_desc if x)
                description = self._clean_text(raw_desc)

                raw_bullets = embedded.get("bullets") or embedded.get("responsibilities") or []
                if isinstance(raw_bullets, str):
                    raw_bullets = [raw_bullets]
                bullets = self._dedupe_str_list([str(b).strip() for b in raw_bullets if b])

                raw_technologies = embedded.get("technologies") or []
                if isinstance(raw_technologies, str):
                    raw_technologies = [raw_technologies]
                technologies = self._dedupe_str_list(
                    [str(t).strip() for t in raw_technologies if t]
                )

                if bullets and not description:
                    description = " ".join(bullets)

                result["projects"].append({
                    "name": name,
                    "role": None,
                    "description": description,
                    "bullets": bullets,
                    "technologies": technologies,
                })

            # Cas 2 : bullets des projets dispersés dans responsibilities.
            # Pattern: une responsibility qui est juste un titre de projet,
            # suivie de bullets qui lui appartiennent.
            responsibilities = exp.get("responsibilities") or []
            if not isinstance(responsibilities, list):
                continue

            project_title_pattern = re.compile(
                r"^(?P<name>.{3,80}?(?:\bProject\b|\bProjet\b|\bInitiative\b|\bProgram\b))\s*$",
                re.IGNORECASE,
            )

            new_responsibilities = []
            i = 0
            while i < len(responsibilities):
                item = self._clean_text(responsibilities[i])
                if not item:
                    i += 1
                    continue

                match = project_title_pattern.match(item)
                if not match:
                    new_responsibilities.append(item)
                    i += 1
                    continue

                project_name = self._clean_text(match.group("name"))
                key = self._normalize_for_match(project_name)

                project_bullets = []
                j = i + 1
                while j < len(responsibilities):
                    next_item = self._clean_text(responsibilities[j])
                    if not next_item:
                        j += 1
                        continue
                    if project_title_pattern.match(next_item):
                        break
                    project_bullets.append(next_item)
                    j += 1

                if project_bullets or key not in existing_project_names:
                    if key not in existing_project_names:
                        existing_project_names.add(key)
                        description = " ".join(project_bullets) if project_bullets else None
                        result["projects"].append({
                            "name": project_name,
                            "role": None,
                            "description": description,
                            "bullets": project_bullets,
                            "technologies": [],
                        })
                    i = j
                else:
                    new_responsibilities.append(item)
                    i += 1

            exp["responsibilities"] = new_responsibilities

    def _merge_associations_same_org(self, result: dict) -> None:
        assocs = result.get("associations") or []
        if not isinstance(assocs, list):
            return

        grouped = {}
        no_org = []
        for row in assocs:
            if not isinstance(row, dict):
                continue
            org = self._clean_text(row.get("organization"))
            if not org:
                no_org.append(row)
                continue
            grouped.setdefault(org, []).append(row)

        merged = []
        for org, rows in grouped.items():
            if len(rows) == 1:
                merged.append(rows[0])
                continue

            rows = sorted(rows, key=lambda r: self._clean_text(r.get("start_date")) or "")
            desc_parts = []
            for r in rows:
                role = self._clean_text(r.get("role"))
                sd = self._clean_text(r.get("start_date"))
                ed = self._clean_text(r.get("end_date"))
                frag = role or ""
                if sd or ed:
                    frag += f" ({sd or '?'}-{ed or '?'})"
                if frag.strip():
                    desc_parts.append(frag.strip())

            merged.append({
                "organization": org,
                "role": self._clean_text(rows[-1].get("role")),
                "start_date": self._clean_text(rows[0].get("start_date")),
                "end_date": self._clean_text(rows[-1].get("end_date")),
                "description": ", ".join(desc_parts)
            })

        result["associations"] = merged + no_org

    def _normalize_additional_info(self, data: dict):
        raw = data.get("additional_info", [])
        if not isinstance(raw, list):
            data["additional_info"] = []
            return
        out = []
        for row in raw:
            if isinstance(row, str):
                txt = self._clean_text(row)
                if txt:
                    out.append({"title": txt, "organization": None, "location": None,
                                "start_date": None, "end_date": None, "description": None, "bullets": []})
                continue
            if not isinstance(row, dict):
                continue
            raw_bullets = row.get("bullets") or row.get("responsibilities") or row.get("activities") or []
            if isinstance(raw_bullets, str):
                raw_bullets = [raw_bullets]
            bullets = self._dedupe_str_list([str(b).strip() for b in raw_bullets if b])
            clean = {
                "title": self._clean_text(row.get("title") or row.get("role") or row.get("name")),
                "organization": self._clean_text(
                    row.get("organization") or row.get("club") or row.get("team") or row.get("association")
                ),
                "location": self._clean_text(row.get("location")),
                "start_date": self._clean_text(row.get("start_date")),
                "end_date": self._clean_text(row.get("end_date")),
                "description": self._clean_text(row.get("description")),
                "bullets": bullets,
            }
            if any(v not in (None, [], "") for v in clean.values()):
                out.append(clean)
        data["additional_info"] = out

    def _normalize_other_sections(self, data: dict) -> None:
        raw = data.get("other_sections", [])
        if not isinstance(raw, list):
            data["other_sections"] = []
            return
        out = []
        seen = set()
        for row in raw:
            if isinstance(row, str):
                title = "Additional Info"
                description = self._clean_text(row)
                items = []
            elif isinstance(row, dict):
                title = self._clean_text(
                    row.get("title") or row.get("name") or row.get("section") or row.get("key")
                ) or "Additional Info"
                description = self._coerce_text_block(
                    row.get("description") or row.get("summary") or row.get("content")
                    or row.get("text") or row.get("details")
                )
                raw_items = row.get("items") or row.get("bullets") or row.get("entries") or row.get("activities") or []
                if isinstance(raw_items, str):
                    raw_items = [raw_items]
                items = []
                for item in raw_items:
                    if isinstance(item, str):
                        txt = self._clean_text(item)
                        if txt:
                            items.append(txt)
                    elif isinstance(item, dict):
                        line = self._dict_to_inline_text(item)
                        if line:
                            items.append(line)
                    elif item is not None:
                        txt = self._clean_text(str(item))
                        if txt:
                            items.append(txt)
                items = self._dedupe_str_list(items)
            else:
                continue
            key = (
                title.casefold().strip(),
                (description or "").casefold().strip(),
                "|".join(x.casefold() for x in items),
            )
            if key in seen:
                continue
            seen.add(key)
            if description or items:
                out.append({"title": title, "description": description, "items": items})
        data["other_sections"] = out

    def _normalize_interests(self, data: dict):
        raw = data.get("interests", [])
        if not isinstance(raw, list):
            data["interests"] = []
            return
        vals = []
        for x in raw:
            if isinstance(x, str):
                vals.append(x)
            elif isinstance(x, dict):
                name = x.get("name") or x.get("interest")
                if name:
                    vals.append(str(name))
        data["interests"] = self._dedupe_str_list(vals)

    def _normalize_awards(self, data: dict):
        raw = data.get("awards", [])
        if not isinstance(raw, list):
            data["awards"] = []
            return
        vals = []
        for x in raw:
            if isinstance(x, str):
                vals.append(x)
            elif isinstance(x, dict):
                name = x.get("name") or x.get("title") or x.get("award")
                if name:
                    vals.append(str(name).strip())
        data["awards"] = self._dedupe_str_list(vals)

    def _normalize_projects(self, data: dict):
        raw = data.get("projects", [])
        if not isinstance(raw, list):
            data["projects"] = []
            return
        out = []
        seen = set()
        for row in raw:
            if isinstance(row, str):
                txt = self._clean_text(row)
                if not txt:
                    continue
                key = txt.casefold()
                if key in seen:
                    continue
                seen.add(key)
                out.append({"name": txt, "role": None, "description": None, "bullets": [], "technologies": []})
                continue
            if not isinstance(row, dict):
                continue
            name = self._clean_text(row.get("name") or row.get("title"))
            role = self._clean_text(row.get("role"))
            raw_description = (
                row.get("description") or row.get("details") or row.get("content")
                or row.get("text") or row.get("body")
            )
            if isinstance(raw_description, list):
                description_parts = self._dedupe_str_list([str(x).strip() for x in raw_description if x])
                description = " ".join(description_parts) if description_parts else None
            else:
                description = self._clean_text(raw_description)
            raw_bullets = row.get("bullets") or row.get("responsibilities") or row.get("activities") or []
            if isinstance(raw_bullets, str):
                raw_bullets = [raw_bullets]
            bullets = self._dedupe_str_list([str(x).strip() for x in raw_bullets if x])
            technologies = row.get("technologies") or []
            if isinstance(technologies, str):
                technologies = [technologies]
            technologies = self._dedupe_str_list([str(x).strip() for x in technologies if x])
            if bullets:
                bullets_text = " ".join(bullets)
                if description:
                    if bullets_text.casefold() not in description.casefold():
                        description = f"{description} {bullets_text}".strip()
                else:
                    description = bullets_text
            if not name and not role and not description and not bullets and not technologies:
                continue
            key = (name or description or "").casefold()
            if key and key in seen:
                continue
            if key:
                seen.add(key)
            out.append({"name": name, "role": role, "description": description,
                        "bullets": bullets, "technologies": technologies})
        data["projects"] = out
    # =========================================================================
    # Section promotion helpers
    # =========================================================================

    def _promote_unknown_sections_to_additional_info(self, data: dict, result: dict) -> None:
        if not isinstance(data, dict):
            return
        if not isinstance(result.get("additional_info"), list):
            result["additional_info"] = []
        MODELED_SECTION_TITLES = {
            self._normalize_for_match(x)
            for x in {
                "personal info", "summary", "profile", "education", "experience",
                "stages", "internships", "stage", "internship",
                "skills", "hard skills", "soft skills", "general skills", "technical skills",
                "languages", "certifications", "projects", "interests",
                "volunteer", "associations", "awards",
            }
        }
        known = self._collect_known_content_fingerprints(result)
        existing = {
            (
                (x.get("title") or "").casefold().strip(),
                (x.get("description") or "").casefold().strip(),
                "|".join((b or "").casefold().strip() for b in (x.get("bullets") or [])),
            )
            for x in result["additional_info"] if isinstance(x, dict)
        }
        for key in list(data.keys()):
            if key in self._KNOWN_TOP_LEVEL_KEYS:
                continue
            if str(key).startswith("_"):
                continue
            raw_section = data.pop(key)
            if raw_section in (None, "", [], {}):
                continue
            title = self._humanize_section_key(str(key))
            if self._map_section_title(title):
                continue
            title_norm = self._normalize_for_match(title)
            if title_norm in MODELED_SECTION_TITLES:
                continue
            fragments = self._collect_text_fragments(raw_section)
            fragments = self._dedupe_str_list(fragments)
            filtered = []
            for frag in fragments:
                fp = self._text_fingerprint(frag)
                if fp and fp not in known:
                    filtered.append(frag)
            filtered = self._dedupe_str_list(filtered)
            if not filtered:
                continue
            if isinstance(raw_section, str):
                description = filtered[0]
                bullets = filtered[1:]
            else:
                description = None
                bullets = filtered
            entry = {
                "title": title, "organization": None, "location": None,
                "start_date": None, "end_date": None,
                "description": description, "bullets": bullets,
            }
            entry_key = (
                title.casefold().strip(),
                (description or "").casefold().strip(),
                "|".join(x.casefold() for x in bullets),
            )
            if entry_key in existing:
                continue
            result["additional_info"].append(entry)
            existing.add(entry_key)

    def _append_unknown_sections_to_additional_info(self, result: dict) -> dict:
        if not isinstance(result, dict):
            return result

        result.setdefault("additional_info", [])
        known = self._collect_known_content_fingerprints(result)

        def normalize_entry_from_block(block: dict) -> Optional[dict]:
            if not isinstance(block, dict):
                return None

            title = self._clean_text(
                block.get("title") or block.get("name") or block.get("section")
            )
            if self._map_section_title(title):
                return None
            description = self._clean_text(block.get("description"))

            raw_items = (
                block.get("items")
                or block.get("bullets")
                or block.get("entries")
                or block.get("links")
                or []
            )

            if isinstance(raw_items, str):
                raw_items = [raw_items]

            items = []
            for it in raw_items:
                for frag in self._collect_text_fragments(it):
                    frag = self._clean_text(frag)
                    if frag:
                        items.append(frag)

            items = self._dedupe_str_list(items)

            if description and title:
                if self._normalize_for_match(description) == self._normalize_for_match(title):
                    description = None

            filtered_items = []
            for item in items:
                if self._is_additional_info_content_already_captured(item, known):
                    continue
                filtered_items.append(item)
                fp = self._text_fingerprint(item)
                if fp:
                    known.add(fp)
                fp2 = self._normalize_additional_info_value_for_dedupe(item)
                if fp2:
                    known.add(fp2)

            if description and self._is_additional_info_content_already_captured(description, known):
                description = None

            # garder l'entrée si elle contient au moins un bullet
            if not description and not filtered_items:
                return None

            return {
                "title": title,
                "description": description,
                "bullets": filtered_items,
            }

        # 1. Convertir les clés inconnues top-level
        for key, raw in list(result.items()):
            if key in self._KNOWN_TOP_LEVEL_KEYS:
                continue
            entry = self._coerce_other_section_entry(key, raw)
            if entry:
                normalized = normalize_entry_from_block(entry)
                if normalized:
                    result["additional_info"].append(normalized)

        # 2. Convertir other_sections si dict
        other_sections = result.get("other_sections")
        if isinstance(other_sections, dict):
            for subkey, subraw in other_sections.items():
                entry = self._coerce_other_section_entry(subkey, subraw)
                if entry:
                    normalized = normalize_entry_from_block(entry)
                    if normalized:
                        result["additional_info"].append(normalized)

        # 3. Convertir other_sections si liste
        elif isinstance(other_sections, list):
            for block in other_sections:
                if not isinstance(block, dict):
                    continue

                # IMPORTANT: utiliser directement le bloc déjà structuré du LLM
                normalized = normalize_entry_from_block(block)
                if normalized:
                    result["additional_info"].append(normalized)

        return result

    def _merge_other_sections_into_additional_info(self, result: dict) -> dict:
        if not isinstance(result, dict):
            return result

        additional = result.get("additional_info") or []
        if not isinstance(additional, list):
            additional = []

        other_sections = result.get("other_sections") or []
        if isinstance(other_sections, dict):
            other_sections = [
                {"title": key, **(value if isinstance(value, dict) else {"items": value})}
                for key, value in other_sections.items()
            ]
        if not isinstance(other_sections, list):
            result["additional_info"] = additional
            result["other_sections"] = []
            return result

        _existing_titles = {
            self._normalize_for_match(x.get("title"))
            for x in additional
            if isinstance(x, dict) and self._clean_text(x.get("title"))
        }
        known = self._collect_known_content_fingerprints(result)
        merged_entries = []

        for section in other_sections:
            if not isinstance(section, dict):
                continue

            title = self._clean_text(section.get("title")) or "Additional Info"
            title_norm = self._normalize_for_match(title)

            raw_items = section.get("items") or section.get("bullets") or []
            if isinstance(raw_items, str):
                raw_items = [raw_items]

            bullets = []
            for item in raw_items:
                txt = self._clean_text(item)
                if not txt:
                    continue
                if title_norm != "links" and self._is_additional_info_content_already_captured(txt, known):
                    continue
                bullets.append(txt)

            description = self._clean_text(section.get("description"))

            if not bullets and not description:
                continue

            existing_entry = None
            for entry in additional:
                if (
                    isinstance(entry, dict)
                    and self._normalize_for_match(entry.get("title")) == title_norm
                ):
                    existing_entry = entry
                    break

            if existing_entry is not None:
                existing_bullets = existing_entry.get("bullets") or []
                existing_entry["bullets"] = self._dedupe_str_list(existing_bullets + bullets)
                if not existing_entry.get("description") and description:
                    existing_entry["description"] = description
            else:
                merged_entries.append({
                    "title": title,
                    "organization": None,
                    "location": None,
                    "start_date": None,
                    "end_date": None,
                    "description": description,
                    "bullets": self._dedupe_str_list(bullets),
                })

        result["additional_info"] = additional + merged_entries
        result["other_sections"] = []
        return result

    def _promote_unknown_top_level_keys_to_other_sections(self, data: dict) -> None:
        if not isinstance(data, dict):
            return
        if not isinstance(data.get("other_sections"), list):
            data["other_sections"] = []
        for key in list(data.keys()):
            if key in self._KNOWN_TOP_LEVEL_KEYS:
                continue
            if str(key).startswith("_"):
                continue
            raw_section = data.pop(key)
            entry = self._coerce_other_section_entry(str(key), raw_section)
            if entry:
                data["other_sections"].append(entry)

    def _filter_other_section_against_known(self, row: dict, known: set) -> Optional[dict]:
        if not isinstance(row, dict):
            return None
        title = self._clean_text(row.get("title")) or "Additional Info"
        description = self._clean_text(row.get("description"))
        items = row.get("items") or []
        if isinstance(items, str):
            items = [items]
        filtered_items = []
        for item in items:
            txt = self._clean_text(str(item)) if item is not None else None
            if txt and not self._is_already_known_content(txt, known):
                filtered_items.append(txt)
        filtered_items = self._dedupe_str_list(filtered_items)
        if description and self._is_already_known_content(description, known):
            description = None
        if not description and not filtered_items:
            return None
        return {"title": title, "description": description, "items": filtered_items}

    def _promote_other_sections_to_additional_info(self, data: dict, result: dict) -> None:
        raw = data.get("other_sections", []) or []
        if not raw:
            return
        if not isinstance(result.get("additional_info"), list):
            result["additional_info"] = []
        MODELED_SECTION_TITLES = {
            self._normalize_for_match(x)
            for x in {
                "personal info", "summary", "profile", "education", "experience",
                "stages", "internships", "stage", "internship",
                "skills", "hard skills", "soft skills", "general skills", "technical skills",
                "languages", "certifications", "projects", "interests",
                "volunteer", "associations", "awards",
            }
        }
        known = self._collect_known_content_fingerprints(result)
        existing = {
            (
                (x.get("title") or "").casefold().strip(),
                (x.get("description") or "").casefold().strip(),
                "|".join((b or "").casefold().strip() for b in (x.get("bullets") or [])),
            )
            for x in result["additional_info"] if isinstance(x, dict)
        }
        for row in raw:
            filtered = self._filter_other_section_against_known(row, known)
            if not filtered:
                continue
            title = self._clean_text(filtered.get("title")) or "Additional Info"
            if self._map_section_title(title):
                continue
            title_norm = self._normalize_for_match(title)
            if title_norm in MODELED_SECTION_TITLES:
                continue
            description = self._clean_text(filtered.get("description"))
            items = filtered.get("items") or []
            if isinstance(items, str):
                items = [items]
            bullets = self._dedupe_str_list([str(x).strip() for x in items if x])
            key = (
                title.casefold().strip(),
                (description or "").casefold().strip(),
                "|".join(x.casefold() for x in bullets),
            )
            if key in existing:
                continue
            existing.add(key)
            if description or bullets:
                result["additional_info"].append({
                    "title": title, "organization": None, "location": None,
                    "start_date": None, "end_date": None,
                    "description": description, "bullets": bullets,
                })
                if description:
                    fp = self._text_fingerprint(description)
                    if fp:
                        known.add(fp)
                for b in bullets:
                    fp = self._text_fingerprint(b)
                    if fp:
                        known.add(fp)

    def _promote_passions_to_additional_info(self, data: dict) -> None:
        raw = data.get("passions")
        if not raw:
            return
        if not isinstance(data.get("additional_info"), list):
            data["additional_info"] = []
        items = raw if isinstance(raw, list) else [raw]
        for row in items:
            if isinstance(row, str):
                txt = self._clean_text(row)
                if not txt:
                    continue
                data["additional_info"].append({
                    "title": txt, "organization": None, "location": None,
                    "start_date": None, "end_date": None, "description": None, "bullets": [],
                })
                continue
            if not isinstance(row, dict):
                continue
            raw_bullets = row.get("bullets") or row.get("responsibilities") or row.get("activities") or []
            if isinstance(raw_bullets, str):
                raw_bullets = [raw_bullets]
            bullets = self._dedupe_str_list([str(b).strip() for b in raw_bullets if b])
            clean = {
                "title": self._clean_text(row.get("title") or row.get("name") or row.get("passion")),
                "organization": None, "location": None, "start_date": None, "end_date": None,
                "description": self._clean_text(
                    row.get("description") or row.get("details") or row.get("content") or row.get("text")
                ),
                "bullets": bullets,
            }
            if any(v not in (None, [], "") for v in clean.values()):
                data["additional_info"].append(clean)

    # =========================================================================
    # Special section recovery (CORRIGÉ: plus de _extract_written_skill_level)
    # =========================================================================

    def _recover_special_sections(self, result: dict) -> None:
        if not isinstance(result.get("additional_info"), list):
            result["additional_info"] = []
        if not isinstance(result.get("awards"), list):
            result["awards"] = []
        if not isinstance(result.get("skills"), list):
            result["skills"] = []

        kept = []
        for row in result["additional_info"]:
            if not isinstance(row, dict):
                continue
            title = self._clean_text(row.get("title")) or ""
            mapped_title = self._map_section_title(title)
            title_norm = self._normalize_for_match(title)
            bullets = row.get("bullets") or []
            if isinstance(bullets, str):
                bullets = [bullets]
            bullets = self._dedupe_str_list([str(x).strip() for x in bullets if x])
            description = self._clean_text(row.get("description"))

            # Awards -> awards[]
            if title_norm in {"award", "awards", "prix", "distinctions", "honors", "honor"}:
                vals = []
                if description:
                    vals.append(description)
                vals.extend(bullets)
                result["awards"].extend(vals)
                continue

            # Hard/Soft/General/Technical Skills -> skills[]
            # CORRECTION: on n'appelle plus _extract_written_skill_level (inexistant)
            # On parse directement le niveau depuis le dernier mot
            if mapped_title in {"skills", "software", "it"} or title_norm in {"hard skills", "soft skills", "general skills", "technical skills"}:
                recovered_items = []
                texts = []
                if description:
                    texts.append(description)
                texts.extend(bullets)
                for txt in texts:
                    name = self._clean_text(txt)
                    level = None
                    if name:
                        words = name.split()
                        if len(words) >= 2 and self._is_text_level(words[-1]):
                            level = words[-1]
                            name = " ".join(words[:-1]).strip()
                    name = self._clean_text(name)
                    if not name:
                        continue
                    item = {"name": name}
                    if level and self._is_text_level(level):
                        item["level"] = level
                        item["source"] = "text"
                    recovered_items.append(item)
                if recovered_items:
                    self._merge_skill_group(result["skills"], title, recovered_items)
                continue

            kept.append(row)

        result["additional_info"] = kept
        result["awards"] = self._dedupe_str_list(result["awards"])

    def _recover_skills_from_raw_text(self, result: dict, raw_text: str = "") -> None:
        """
        Si skills est vide après le parsing LLM, tenter de récupérer
        les compétences depuis le texte brut du CV.
        """
        if not raw_text or not raw_text.strip():
            return

        # Ne récupérer que si skills est vide
        existing_skills = result.get("skills") or []
        has_skills = any(
            isinstance(g, dict) and g.get("items")
            for g in existing_skills
        )
        if has_skills:
            return

        recovered_groups = self._extract_skill_groups_from_text(raw_text)
        if recovered_groups:
            result["skills"] = recovered_groups
            return

        lines = [self._clean_text(x) for x in raw_text.splitlines()]
        lines = [x for x in lines if x]

        # Titres de sections compétences reconnus
        SKILL_SECTION_TITLES = {
            "compétences", "competences", "skills", "skill",
            "expertise", "savoir-faire", "know-how", "qualifications",
            "technical skills", "hard skills", "soft skills",
            "logiciels", "informatique", "outils", "software",
            "it", "computer skills", "digital skills",
        }
        skill_section_titles_norm = {
            self._normalize_for_match(x) for x in SKILL_SECTION_TITLES
        }

        # Trouver le début de la section compétences
        start_idx = None
        section_title = None
        for i, line in enumerate(lines):
            norm = self._normalize_for_match(line)
            if norm in skill_section_titles_norm:
                start_idx = i + 1
                section_title = line
                break

        if start_idx is None:
            return

        # Délimiteurs de fin de section
        END_SECTION_TITLES = {
            "langues", "languages", "certifications", "formation",
            "education", "expériences", "experience", "projets", "projects",
            "associations", "vie associative", "awards", "interests",
            "summary", "profil", "profile",
        }
        end_section_titles_norm = {
            self._normalize_for_match(x) for x in END_SECTION_TITLES
        }

        # Collecter le bloc de texte de la section
        block_lines = []
        for line in lines[start_idx:]:
            norm = self._normalize_for_match(line)
            if norm in end_section_titles_norm:
                break
            if line.isupper() and len(line.split()) <= 6 and norm not in skill_section_titles_norm:
                break
            block_lines.append(line)

        if not block_lines:
            return

        # Parser les groupes inline du type "Category : item1 · item2"
        # ou "Category:\nitem1, item2"
        if not isinstance(result.get("skills"), list):
            result["skills"] = []

        current_category = None
        pending_items = []

        def flush_pending():
            nonlocal current_category, pending_items
            if pending_items and current_category:
                # Chercher si ce groupe existe déjà
                cat_norm = self._normalize_for_match(current_category)
                target = next(
                    (g for g in result["skills"]
                     if isinstance(g, dict)
                     and self._normalize_for_match(g.get("category") or "") == cat_norm),
                    None
                )
                if target is None:
                    target = {"category": current_category, "items": []}
                    result["skills"].append(target)
                existing = {
                    self._normalize_for_match(it.get("name") or "")
                    for it in target["items"] if isinstance(it, dict)
                }
                for item_name in pending_items:
                    key = self._normalize_for_match(item_name)
                    if key and key not in existing:
                        target["items"].append({"name": item_name})
                        existing.add(key)
            current_category = None
            pending_items = []

        for line in block_lines:
            line = self._clean_text(line)
            if not line:
                continue

            # Format "Category : item1 · item2" ou "Category : item1, item2"
            inline_group = self._split_skill_group_line(line, parent_section="Skills")
            if inline_group:
                flush_pending()
                cat = inline_group.get("category", "Skills")
                items = [
                    it.get("name") for it in inline_group.get("items", [])
                    if isinstance(it, dict) and it.get("name")
                ]
                if items:
                    cat_norm = self._normalize_for_match(cat)
                    target = next(
                        (g for g in result["skills"]
                         if isinstance(g, dict)
                         and self._normalize_for_match(g.get("category") or "") == cat_norm),
                        None
                    )
                    if target is None:
                        target = {"category": cat, "items": []}
                        result["skills"].append(target)
                    existing = {
                        self._normalize_for_match(it.get("name") or "")
                        for it in target["items"] if isinstance(it, dict)
                    }
                    for item_name in items:
                        key = self._normalize_for_match(item_name)
                        if key and key not in existing:
                            target["items"].append({"name": item_name})
                            existing.add(key)
                continue

            # Format "Category:" sur une ligne seule (sous-titre)
            if line.endswith(":") and len(line.split()) <= 5:
                flush_pending()
                current_category = line.rstrip(":").strip()
                continue

            # Format "item1, item2, item3" (liste CSV)
            if current_category and "," in line:
                parts = [self._clean_text(p) for p in line.split(",") if self._clean_text(p)]
                for p in parts:
                    if p and len(p) >= 2 and re.search(r"[a-zA-Z\u00c0-\u00ff]", p):
                        pending_items.append(p)
                continue

            # Item simple
            norm_line = self._normalize_for_match(line)
            if norm_line in skill_section_titles_norm:
                continue
            if (
                self._looks_like_skill_item(line)
                and not self._looks_like_skill_noise(line, section_context=section_title)
            ):
                if current_category:
                    pending_items.append(line)
                else:
                    # Item sans catégorie -> catégorie générique "Skills"
                    cat_norm = self._normalize_for_match("Skills")
                    target = next(
                        (g for g in result["skills"]
                         if isinstance(g, dict)
                         and self._normalize_for_match(g.get("category") or "") == cat_norm),
                        None
                    )
                    if target is None:
                        target = {"category": "Skills", "items": []}
                        result["skills"].append(target)
                    key = self._normalize_for_match(line)
                    existing = {
                        self._normalize_for_match(it.get("name") or "")
                        for it in target["items"] if isinstance(it, dict)
                    }
                    if key and key not in existing:
                        target["items"].append({"name": line})

        flush_pending()

    def _extract_skill_groups_from_text(self, raw_text: Optional[str]) -> List[dict]:
        if raw_text is None:
            return []

        raw_text = str(raw_text).replace("\r\n", "\n").replace("\r", "\n").strip()
        if not self._clean_text(raw_text):
            return []

        lines = [self._clean_text(x) for x in raw_text.split("\n")]
        lines = [x for x in lines if x]
        skill_headers = {self._normalize_for_match(x) for x in SKILL_HEADERS}
        stop_headers = {self._normalize_for_match(x) for x in STOP_HEADERS}

        groups: List[dict] = []
        current_title = None
        current_lines: List[str] = []
        in_skills = False

        def norm(value: str) -> str:
            return self._normalize_for_match(value)

        def flush_current() -> None:
            nonlocal current_title, current_lines
            joined = self._join_wrapped_skill_lines(current_lines)
            items = self._skills_from_block_lines(joined)
            if items:
                groups.append({
                    "category": self._strip_skill_category_label(current_title or "Skills"),
                    "items": items,
                })
            current_title = None
            current_lines = []

        for line in lines:
            n = norm(line)
            matched_skill_header = next((h for h in skill_headers if h == n or h in n), None)

            if matched_skill_header:
                flush_current()
                in_skills = True
                title = line.split(":", 1)[0].strip() if ":" in line else line
                current_title = title or "Skills"
                if ":" in line:
                    remainder = line.split(":", 1)[1].strip()
                    if remainder:
                        current_lines.append(remainder)
                continue

            if not in_skills:
                continue

            if any(h == n or h in n for h in stop_headers):
                flush_current()
                in_skills = False
                continue

            inline_group = self._split_skill_group_line(line, parent_section=current_title or "Skills")
            if inline_group:
                flush_current()
                groups.append({
                    "category": self._strip_skill_category_label(inline_group.get("category") or "Skills"),
                    "items": self._skills_from_block_lines([
                        item.get("name")
                        for item in inline_group.get("items", [])
                        if isinstance(item, dict)
                    ]),
                })
                current_title = None
                current_lines = []
                continue

            if line.endswith(":") and len(line.split()) <= 6:
                flush_current()
                current_title = line.rstrip(":").strip() or "Skills"
                continue

            current_lines.append(line)

        flush_current()
        return self._repair_skill_groups(groups)

    def _extract_skills_block_from_text(self, raw_text: Optional[str]) -> List[str]:
        if raw_text is None:
            return []

        raw_text = str(raw_text).replace("\r\n", "\n").replace("\r", "\n").strip()
        if not self._clean_text(raw_text):
            return []

        groups = self._extract_skill_groups_from_text(raw_text)
        if groups:
            return [
                item.get("name")
                for group in groups
                for item in (group.get("items") or [])
                if isinstance(item, dict) and item.get("name")
            ]

        lines = [self._clean_text(x) for x in raw_text.split("\n")]
        lines = [x for x in lines if x]

        def norm(s: str) -> str:
            return self._normalize_for_match(s)

        skill_headers = {norm(x) for x in SKILL_HEADERS}
        stop_headers = {norm(x) for x in STOP_HEADERS}

        collected = []
        in_skills = False

        for line in lines:
            n = norm(line)

            matched_header = next(
                (h for h in skill_headers if h == n or h in n),
                None
            )

            if matched_header:
                in_skills = True

                remainder = line.split(":", 1)[1].strip() if ":" in line else ""
                if remainder:
                    collected.append(remainder)
                continue

            if in_skills:
                if any(h == n or h in n for h in stop_headers):
                    break

                if not line or len(line.strip()) <= 1:
                    continue

                collected.append(line)

        return collected

    def _skills_from_block_lines(self, lines: List[str]) -> List[dict]:
        items = []

        for line in self._join_wrapped_skill_lines(lines or []):
            line = self._clean_text(line)
            if not line:
                continue

            for piece in self._explode_skill_line(line):
                piece = self._clean_text(piece)
                if not piece or self._is_obvious_non_skill_line(piece):
                    continue
                items.append({"name": piece})

        return self._dedupe_skill_items_only(items)

    def _post_process_raw_result(
        self,
        result: dict,
        raw_text: Optional[str] = None,
        detected_software_icons: Optional[List[dict]] = None,
    ) -> dict:
        if not isinstance(result, dict):
            result = {}

        raw_skills_payload = result.get("skills_raw")

        self._promote_inline_skill_groups(result)
        self._extract_languages_and_certification_from_skill_lines(result)
        if raw_skills_payload is None:
            raw_skills_payload = result.get("skills")
        if self._payload_has_software_section(raw_skills_payload):
            result["_software_section_seen"] = True
        result["skills"] = self._normalize_skill_groups_generic(raw_skills_payload)

        self._merge_sidebar_skill_sections(result)
        self._inject_common_software_from_context(result, raw_text)
        self._normalize_common_software_names(result)

        self._clean_skills_noise(result)
        self._normalize_language_levels(result)
        self._dedupe_skill_items_in_place(result)

        # NOUVEAU: récupération depuis le texte brut si skills est vide
        self._recover_skills_from_raw_text(result, raw_text or "")

        self._repair_experience_descriptions_and_technologies(result)
        self._recover_projects_from_experience(result)
        self._merge_associations_same_org(result)

        result = self._append_unknown_sections_to_additional_info(result)
        result["skills"] = self._normalize_skill_groups_generic(result.get("skills"))
        self._remove_skill_items_overlapping_other_sections(result)
        if not result.get("skills"):
            fallback_groups = self._extract_skill_groups_from_text(raw_text)
            if fallback_groups:
                result["skills"] = fallback_groups
            else:
                fallback_lines = self._extract_skills_block_from_text(raw_text)
                fallback_items = self._skills_from_block_lines(fallback_lines)
                if fallback_items:
                    result["skills"] = [{"category": "Skills", "items": fallback_items}]

        self._move_hobbies_from_skills_to_interests(result)

        self._merge_detected_software_icons(
            result,
            detected_software_icons=detected_software_icons,
            raw_text=raw_text or "",
        )

        result = extract_and_classify_technical_skills(result)
        result.pop("skills_raw", None)

        return result

    # =========================================================================
    # Summary extraction
    # =========================================================================

    def _extract_summary_candidate(self, data: dict) -> Optional[str]:
        if not isinstance(data, dict):
            return None
        direct = self._coerce_text_block(data.get("summary"))
        if direct:
            return direct
        summary_aliases = {
            "profile", "professional_profile", "professional_summary",
            "career_summary", "executive_summary", "objective",
            "about", "about_me", "introduction", "intro",
            "personal_statement", "profile_summary",
        }
        for key in list(data.keys()):
            if not isinstance(key, str):
                continue
            norm_key = self._normalize_for_match(key).replace(" ", "_")
            if norm_key in summary_aliases:
                txt = self._coerce_text_block(data.pop(key))
                if txt:
                    return txt
        return None

    # =========================================================================
    # Prompt construction
    # =========================================================================

    def _build_layout_instruction(self, layout: str, structure) -> str:
        if layout == "two_columns":
            return """
LAYOUT INSTRUCTION — TWO COLUMNS DETECTED
This CV has TWO distinct columns. You MUST read BOTH columns completely.
Do NOT assume in advance which side is the main column and which side is secondary.
One side may contain summary / experience / education while the other contains
personal info / links / skills / languages.

CRITICAL:
- Scan the LEFT and RIGHT columns independently, then merge them into the final JSON.
- Use the image to reconstruct the visual reading order.
- Do NOT trust raw text order blindly when columns are present.
- Extract every visible skill section found in either column.
- For each skill found in a side column or narrow column:
  * If a written level word appears next to the name (Expert, Advanced, etc.) -> include it.
  * If only graphical dots/circles appear -> extract the skill NAME only, omit the level.
  * NEVER convert dot symbols into characters (e, o, or any other character).
- Do NOT skip any visually separated column.
"""
        elif layout == "sidebar":
            return """
LAYOUT INSTRUCTION — SIDEBAR DETECTED
This CV has a main column and a visually separated SIDEBAR.
The sidebar may be on the LEFT or on the RIGHT.

- Extract ALL content from both the main column and the sidebar.
- Skills, languages, personal info, and links often appear in the sidebar.
- Use the image to determine which content belongs to the sidebar.
- Do NOT trust raw text order blindly when the sidebar is present.
- For graphical dot/circle level indicators in the sidebar: extract skill name only, omit level.
"""
        return ""

    def _use_raw_text_as_primary_source(self, structure) -> bool:
        layout = getattr(structure, "layout", "unknown")
        if layout in {"two_columns", "sidebar"}:
            return False
        if getattr(structure, "has_dark_sidebar", False):
            return False
        return True

    def _rules_block(self) -> str:
        return """
CRITICAL RULE  SKILL AND LANGUAGE LEVELS
ONLY extract a level if it is EXPLICITLY WRITTEN AS TEXT in the CV,
directly next to the skill or language.

ACCEPTED written text levels:
Languages : Native, Natif, Mother tongue, Bilingue, Bilingual, Fluent,
Courant, Full, Advanced, Avancé, Intermediate, Intermédiaire, Limited,
Basic, Notions, Elementary, Débutant, A1, A2, B1, B2, C1, C2,
langue maternelle, maternelle, très bien, tres bien, bien

Skills : Expert, Avancé, Intermédiaire, Débutant, Advanced,
Intermediate, Beginner, Proficient, Familiar, Junior, Senior

IF level written as text -> extract it, source="text"
IF no level -> omit level field entirely
NEVER set level=null

GLOBAL RULES
1. Extract ONLY visible text. Never invent.
2. Return valid raw JSON only. No markdown.
3. Absent section -> [] or null.
4. Copy text exactly as written.

Treat section titles as structural headers, not as content items.

Map section titles by meaning, not only by exact wording.
Examples:
- "COMPÉTENCES", "EXPERTISE", "SAVOIR-FAIRE" -> skills
- "LANGUES" -> languages
- "LOGICIELS", "OUTILS", "INFORMATIQUE" -> software/computer skills, which should be merged into skills
- "FORMATION", "ÉTUDES", "VOIE ACADÉMIQUE" -> education
- "PROJETS ACADÉMIQUE", "PROJETS ACADÉMIQUES", "PROJET ACADÉMIQUE" -> projects
- "EXPÉRIENCES PROFESSIONNELLES" -> experience
- "STAGES", "INTERNSHIPS" -> stages

Do not extract section titles themselves as item names.

If a software/tools/computer section contains readable software names,
extract the corresponding software names under skills.
Do NOT infer software from isolated OCR letters such as W, X, O, P, or N.
If not readable, do not invent a name.

In a skills/competences section, a line may contain a subgroup title followed by a list of skills.

Examples:
- "Déploiement & APIs : API REST · FastAPI · Docker · Docker Compose"
- "Operating System: Windows, MacOS, Linux"
- "Database/Server: MySQL, PostgreSQL, SQL Server"

When this happens:
- the text before ":" is the skill category
- the values after ":" are the items in that category

If a mixed skills section also contains:
- "Langues : ..."
- "Certification : ..."
then extract those under `languages` and `certifications`, not under `skills`.

Do not flatten the subgroup title into a normal skill item.
Do not keep the subgroup title as an item if it has child items after ":".
Do not flatten all subsection headers into a single generic Skills list.

For languages, preserve proficiency levels such as:
- Langue maternelle
- Très bien
- Bien
- B2, C1, etc.

SUMMARY / PROFILE
- summary = the introductory profile text near the top of the CV
- capture it even if there is NO heading
- join multiple short lines in original order
- do NOT drop unheaded introductory text blocks
- do NOT move this text to additional_info

LINKS / PORTFOLIO
- Preserve ALL visible items under LINKS, PORTFOLIO, WEBSITE, ONLINE PRESENCE sections.
- Map URLs to personal_info.website / .linkedin / .github when appropriate.
- Sidebar links are important and must not be ignored.

EDUCATION
- degree = diploma title
- field = major/specialization
- honors = distinction/class/honours
- gpa = numeric only
- NEVER put honours inside degree

CERTIFICATIONS
- certifications = short courses, certificates, certifications, licenses, accreditations
- Extract into certifications even if under Education section.
- Do NOT classify standard academic degrees as certifications.

EXPERIENCE VS INTERNSHIPS / STAGES

Extract professional work experiences into `experience[]`.
Extract internships / stages into `stages[]`.

A stage/internship must go into `stages[]` if the entry explicitly contains one of:
stage, stagiaire, internship, intern, trainee, work placement,
end-of-studies internship, PFE, summer internship, training internship,
alternance, apprentice, apprenticeship

A professional job must go into `experience[]` if it is a real employment
experience and does not explicitly indicate an internship/stage.

Classification rules:
- Classify based on the role title and entry content, not only the section title.
- If a section is called "Experience" but contains "Data Science Intern", put it in `stages[]`.
- If a section is called "Stages" but contains a normal job title without internship
  indicators, classify it as `experience[]` if it is clearly professional.
- Do not invent internship status.
- If ambiguous, set entry_type = "unknown" and keep the entry in `experience[]`.
- Preserve the original wording of title, company, dates and description.
- Do not rewrite job titles.
- Do not infer missing dates.
- If start_date or end_date is missing, leave duration_months and duration_years as null.

EXPERIENCE / STAGES — shared field rules:
- description = visible free text directly under the role/company/date block
- responsibilities = ONLY bullet points that are NOT under a named project title
- is_current = true only if end = Present/Current/En cours
- technologies = tools/frameworks/methodologies explicitly named
- For internships/stages, ALWAYS capture the mission paragraph immediately under
  the company/role/date line as description, even when it is not a bullet.
- Do NOT drop non-bulleted descriptive lines just because the following line is
  a technology/methodology list.

CRITICAL — EMBEDDED PROJECTS inside an experience entry:
If an experience entry contains a sub-section like "Selected Project Experience"
or individual named project titles (e.g. "Fraud Detection Project"), extract each
named project into experience[].projects[] with its own bullets:
  experience[].projects = [
    {
      "name": "Fraud Detection Project",
      "description": null,
      "bullets": [
        "Drove redevelopment of fraud detection algorithm...",
        "Analyzed customer spending behavior...",
        "Led the team of 3 members..."
      ]
    }
  ]
Do NOT put project-specific bullets into experience[].responsibilities[].
Do NOT put project titles into experience[].responsibilities[].

For unknown sections:
- If a section does not match the target data model, preserve it as an additional section.
- Only keep content that has not already been captured elsewhere in the output.
- If the resume contains sections that do not map directly to the target schema
  (such as Exhibitions, Commission, Publications, Conferences, Patents, Workshops,
  Memberships, Competitions, or any other custom section), preserve them under
  `other_sections` as structured content instead of dropping them.
- If a resume contains custom sections such as Details, Links, Exhibitions,
  Commission, Portfolio, Publications, or any unknown section, do not omit them.
  Return them under `other_sections` with their textual content preserved.
- If the resume contains custom or non-standard sections such as Details, Links,
  Portfolio, Exhibitions, Commission, Publications, Workshops, or any unknown
  section, do not omit them.
  Return them under `other_sections` with their full visible textual content preserved.
  For list-like sections, return them as bullets/items.
- Do not omit uncaptured sections. Any visible section not mapped to a standard field
  must be returned in `other_sections`.
- Do not drop sidebar sections.
- Left-column sections such as Details, Links, Skills, Strengths, or custom labels
  must be preserved if visible.
- Never ignore sidebar sections.

ASSOCIATIONS / EXTRA-CURRICULAR / CLUBS
- clubs, committees, student activities -> associations[]
- Preserve ALL visible text under each entry.

PROJECTS
- Map "Projets Académique", "Projets Académiques" -> projects[]
- Map "Selected Project Experience", "Project Experience",
  "Selected Projects", "Key Projects", "Notable Projects",
  "Project Highlights", "Relevant Projects" -> projects[]
- A sub-section titled "Project Experience" or "Selected Project Experience"
  inside an EXPERIENCE block must also be extracted into projects[], NOT into
  experience[].responsibilities[].
- One project = one entry in projects[]
- name = project title (e.g. "Fraud Detection Project")
- description = ALL visible descriptive text under the project
- bullets = all sub-bullet points under the project
- technologies = only tools/frameworks explicitly mentioned
- Do NOT flatten project bullets into experience.responsibilities[]

Extract the "skills" section very carefully.

Rules:
- Detect sections named Skills, Skill, Compétences, Competences, Expertise, Technical Skills, Hard Skills, Soft Skills, Logiciels, Software, Outils, Tools, Informatique, or similar.
- Never ignore a visible skills section.
- Also return the intermediate field skills_raw when a skills-like section exists.
- skills_raw must preserve each visible skills-like section as {"section_title": "...", "lines": ["..."]}.
- Preserve each visible line as a single skill item by default.
- Preserve line text exactly as written; do not summarize, rewrite, infer, or translate.
- Only create subcategories if explicit subgroup headers are visibly present.
- Do not split a skill line unless it is clearly a list of separate tools or technologies.
- A comma inside a skill line does not necessarily mean multiple skills.
- Do not move work responsibilities into skills.
- If unsure, prefer keeping the full visible skill line rather than splitting or dropping it.
- Return an empty skills section only if no skills-like section exists anywhere in the resume.

TECHNICAL SKILLS EXTRACTION

Extract technical/coding skills into `technical_skills`.

`technical_skills` must contain only explicitly written technical items from the CV.

Classify technical skills into these categories:

1. `programming_languages`:
Programming languages and query languages.
Examples: Python, Java, JavaScript, TypeScript, SQL, C, C++, C#, PHP, R, Scala, Kotlin, Swift, Go, Rust, Bash, PowerShell, HTML, CSS.

2. `frameworks_libraries`:
Frameworks and software libraries.
Examples: FastAPI, Django, Flask, Spring Boot, Laravel, Angular, React, Vue, Next.js, Express.js, Pandas, NumPy, Scikit-learn, TensorFlow, PyTorch.

3. `databases`:
Databases and data storage technologies.
Examples: PostgreSQL, MySQL, MongoDB, SQLite, Oracle, Redis, SQL Server, Elasticsearch.

4. `devops_tools`:
DevOps, deployment, version control, containerization, automation.
Examples: Docker, Docker Compose, Git, GitHub, GitLab, Jenkins, CI/CD, Kubernetes, Ansible, Terraform.

5. `data_ai_tools`:
Data analysis, business intelligence, machine learning, AI tools.
Examples: Power BI, Tableau, Excel for analytics, Scikit-learn, TensorFlow, PyTorch, LLM, NLP, RAG, LangChain.

6. `web_technologies`:
Frontend and web technologies.
Examples: HTML, CSS, JavaScript, TypeScript, REST APIs, JSON, XML.

7. `api_backend`:
Backend/API concepts explicitly written in the CV.
Examples: REST API, API REST, authentication flows, backend development, FastAPI endpoints.

8. `other_technical_tools`:
Technical tools that do not fit clearly in the previous categories.

Rules:
- Preserve the original wording exactly as written in the CV.
- Do not rewrite skill names.
- Do not normalize skill names in this extraction step.
- Do not invent technologies.
- Do not add related technologies that are not written.
- If a technical skill appears in experience descriptions, projects, or skills section, extract it.
- If a skill is not technical, keep it in `skills`, not in `technical_skills`.
- Soft skills like communication, teamwork, leadership, documentation, problem solving must stay in `skills`.
- Business/domain skills must stay in `skills` unless they are technical tools.
- Avoid duplicates inside the same `technical_skills` category.

CRITICAL — GRAPHICAL LEVEL INDICATORS:
Do NOT extract dot indicators (●●●○), filled circles, progress bars, stars, or any
visual graphic symbol as a level value.
Do NOT convert graphical symbols into text characters of any kind
(such as "eeeee", "eeee", "eeeeo").
A level MUST be a visible written word directly next to the skill name
(e.g. "Expert", "Advanced", "B2").
If the written word "Expert" or "Advanced" appears as text alongside dots,
extract ONLY the written word, never the dots.
If the only level indicator is graphical, omit the level field entirely.
If a skill name contains only repeated characters or symbols, discard it entirely.

ICONS RULE
- Do not map a single OCR letter to software.
- Software icons are accepted only when they are visually recognizable.
- Unrecognized or ambiguous icons -> ignore

LANGUAGES
- Only human spoken languages
- If not clearly a human spoken language, keep in skills[].
- If uncertain, preserve the item.

PASSIONS
- Passions / hobbies -> additional_info[]
- Do NOT put passions into skills[]

CLASSIFICATION
- volunteer[]       = explicit volunteering only
- associations[]    = clubs / committees / student life
- additional_info[] = extra-curricular, sports, achievements
- awards[]          = prizes and distinctions
- interests[]       = personal hobbies only
"""

    def _schema_block(self) -> str:
        return """
Return ONLY valid raw JSON:
{
  "personal_info":{
    "full_name":null,"email":null,"phone":null,"location":null,
    "linkedin":null,"github":null,"website":null,
    "birth_date":null,"nationality":null
  },
  "summary":null,
  "education":[{"degree":null,"field":null,"institution":null,
    "location":null,"honors":null,"start_date":null,"end_date":null,"gpa":null}],
  "experience":[{"job_title":null,"company":null,"location":null,
    "start_date":null,"end_date":null,"is_current":false,
    "description":null,"responsibilities":[],"technologies":[],
    "projects":[{"name":null,"description":null,"bullets":[],"technologies":[]}]}],
  "stages":[{"job_title":null,"company":null,"location":null,
    "start_date":null,"end_date":null,"is_current":false,
    "description":null,"responsibilities":[],"technologies":[],
    "projects":[{"name":null,"description":null,"bullets":[],"technologies":[]}]}],
  "skills_raw":[{"section_title":null,"lines":[]}],
  "skills":[{"category":null,"items":[{"name":null}]}],
  "technical_skills":{
    "programming_languages":[],
    "frameworks_libraries":[],
    "databases":[],
    "devops_tools":[],
    "data_ai_tools":[],
    "web_technologies":[],
    "api_backend":[],
    "other_technical_tools":[]
  },
  "languages":[{"name":null}],
  "certifications":[{"name":null,"issuer":null,"date":null}],
  "projects":[{"name":null,"role":null,"description":null,"bullets":[],"technologies":[]}],
  "interests":[],
  "volunteer":[{"role":null,"organization":null,"location":null,
    "start_date":null,"end_date":null,"description":null,"bullets":[]}],
  "associations":[{"role":null,"organization":null,"location":null,
    "start_date":null,"end_date":null,"description":null,"bullets":[]}],
  "additional_info":[{"title":null,"organization":null,"location":null,
    "start_date":null,"end_date":null,"description":null,"bullets":[]}],
  "other_sections":[{"title":null,"description":null,"items":[]}],
  "awards":[]
}
"""

    def _default_json(self) -> dict:
        return {
            "personal_info": {
                "full_name": None, "email": None, "phone": None,
                "location": None, "linkedin": None, "github": None,
                "website": None, "birth_date": None, "nationality": None,
            },
            "summary": None,
            "education": [], "experience": [], "stages": [], "skills": [],
            "technical_skills": _blank_technical_skills(),
            "languages": [], "certifications": [], "projects": [],
            "interests": [], "volunteer": [], "associations": [],
            "additional_info": [], "other_sections": [], "awards": [],
            "experience_years": None, "experience_warnings": [],
            "stage_months": None, "stage_years": None,
            "total_career_months": None, "total_career_years": None,
        }

    def build_prompt(self, structure, raw_text: str = "") -> str:
        layout = getattr(structure, "layout", "unknown")
        sidebar_tx = " + dark sidebar" if getattr(structure, "has_dark_sidebar", False) else ""
        layout_instruction = self._build_layout_instruction(layout, structure)
        raw_text_is_primary = self._use_raw_text_as_primary_source(structure)
        raw_text = (raw_text or "").strip()[:20000]
        parts = [
            "You extract structured data from ONE CV.",
            f"DETECTED LAYOUT: {layout}{sidebar_tx}",
        ]
        if layout_instruction:
            parts.append(layout_instruction)
        parts.append(self._rules_block())
        if raw_text:
            if raw_text_is_primary:
                parts.append("RAW TEXT (PRIMARY SOURCE):")
            else:
                parts.append("RAW TEXT (SUPPORT ONLY - VISUAL LAYOUT HAS PRIORITY):")
            parts.append(raw_text)
        parts.append(self._schema_block())
        return "\n\n".join(parts)

    # =========================================================================
    # Main extract + ensure_schema + parse
    # =========================================================================

    def extract(self, img, structure, raw_text: str = "") -> Dict:
        encode_params = [cv2.IMWRITE_JPEG_QUALITY, 95]
        ok, buf = cv2.imencode(".jpg", img, encode_params)
        if not ok:
            raise ValueError("chec encodage image")
        img_b64 = base64.b64encode(buf.tobytes()).decode("utf-8")
        if self._use_raw_text_as_primary_source(structure):
            system_prompt = (
                "You are an expert CV text extractor. "
                "Use raw text as primary source when available. "
                "Use image as support for layout or missing items. "
                "Never invent. Return valid raw JSON only."
            )
        else:
            system_prompt = (
                "You are an expert CV text extractor. "
                "Use the image as primary source for reading order, section boundaries, "
                "and sidebar content. Use raw text only as support and never trust its "
                "ordering blindly on multi-column or sidebar layouts. "
                "Never invent. Return valid raw JSON only."
            )
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"},
                        },
                        {"type": "text", "text": self.build_prompt(structure, raw_text=raw_text)},
                    ],
                },
            ],
            temperature=0,
            max_tokens=7000,
        )
        parsed = self._parse(
            response.choices[0].message.content,
            raw_text=raw_text,
            detected_software_icons=getattr(structure, "detected_software_icons", []),
        )
        return parsed

    def _ensure_schema(
        self,
        data: dict,
        raw_text: Optional[str] = None,
        detected_software_icons: Optional[List[dict]] = None,
    ) -> dict:
        result = self._default_json()
        summary_candidate = self._extract_summary_candidate(data)
        self._promote_unknown_sections_to_additional_info(data, result)
        if isinstance(data.get("personal_info"), dict):
            for k in result["personal_info"]:
                result["personal_info"][k] = self._coerce_personal_info_field(
                    data["personal_info"].get(k)
                )
        result["summary"] = summary_candidate or self._clean_text(data.get("summary"))
        result["education"] = self._normalize_section_list(
            data.get("education", []),
            ["degree", "field", "institution", "location", "honors", "start_date", "end_date", "gpa"],
        )
        result["experience"] = data.get("experience", [])
        self._normalize_experience(result)
        for entry in result["experience"]:
            if isinstance(entry, dict):
                entry.setdefault("source_section", "experience")

        stages_tmp = {"experience": data.get("stages", [])}
        self._normalize_experience(stages_tmp)
        result["stages"] = stages_tmp["experience"]
        for entry in result["stages"]:
            if isinstance(entry, dict):
                entry.setdefault("source_section", "stages")

        result["certifications"] = data.get("certifications", [])
        self._normalize_certifications(result)
        self._promote_education_certifications(result)
        self._normalize_certifications(result)
        result["projects"] = data.get("projects", [])
        self._normalize_projects(result)
        raw_skill_payload = data.get("skills_raw") or data.get("skills")
        _, split_languages = self._split_languages_and_skills(data)
        result["languages"] = split_languages
        self._normalize_languages(result)
        self._normalize_language_levels(result)
        result["skills"] = self._normalize_skill_groups_generic(raw_skill_payload)
        self._normalize_icon_names(result)
        self._normalize_skills(result)
        self._split_inline_skill_items(result)
        self._clean_skills_noise(result)
        result["skills"] = self._repair_skill_groups(result.get("skills", []))
        result["technical_skills"] = data.get("technical_skills") or _blank_technical_skills()
        result["interests"] = data.get("interests", [])
        self._normalize_interests(result)
        result["volunteer"] = data.get("volunteer", [])
        self._normalize_volunteer(result)
        result["associations"] = data.get("associations", [])
        self._normalize_associations(result)
        result["additional_info"] = data.get("additional_info", [])
        self._promote_passions_to_additional_info(data)
        self._promote_other_sections_to_additional_info(data, result)
        self._promote_unknown_sections_to_additional_info(data, result)
        self._normalize_additional_info(result)
        result["other_sections"] = data.get("other_sections", [])
        self._normalize_other_sections(result)
        result["awards"] = data.get("awards", [])
        self._normalize_awards(result)
        self._recover_special_sections(result)
        self._strip_non_text_levels(result)
        self._repair_experience_descriptions_and_technologies(result)
        self._recover_experience_descriptions_from_raw_text(result, raw_text=raw_text)
        self._merge_associations_same_org(result)
        self._collapse_invented_skill_subcategories(result, raw_text=raw_text)
        self._normalize_additional_info(result)
        result["skills"] = self._normalize_skill_groups_generic(result.get("skills"))
        self._remove_skill_items_overlapping_other_sections(result)
        if not result.get("skills"):
            fallback_groups = self._extract_skill_groups_from_text(raw_text)
            if fallback_groups:
                result["skills"] = fallback_groups
            else:
                fallback_lines = self._extract_skills_block_from_text(raw_text)
                fallback_items = self._skills_from_block_lines(fallback_lines)
                if fallback_items:
                    result["skills"] = [{"category": "Skills", "items": fallback_items}]

        self._move_hobbies_from_skills_to_interests(result)

        self._merge_detected_software_icons(
            result,
            detected_software_icons=detected_software_icons,
            raw_text=raw_text or "",
        )

        result = split_experience_and_stages(result)

        for entry in result.get("experience", []):
            if isinstance(entry, dict):
                compute_entry_duration(entry)
        for entry in result.get("stages", []):
            if isinstance(entry, dict):
                compute_entry_duration(entry)

        result = extract_and_classify_technical_skills(result)

        return result

    def _parse(
        self,
        raw: str,
        raw_text: Optional[str] = None,
        detected_software_icons: Optional[List[dict]] = None,
    ) -> dict:
        clean = raw.strip()
        if "```json" in clean:
            clean = clean.split("```json", 1)[1].split("```", 1)[0].strip()
        elif "```" in clean:
            clean = clean.split("```", 1)[1].split("```", 1)[0].strip()
        raw_result = self._safe_json_loads(clean)

        if raw_result is None:
            result = self._default_json()
            result["_error"] = "JSON invalide"
            result["_raw"] = raw[:1000]
            return result

        data = raw_result
        if not isinstance(data, dict):
            data = {}
        result = self._post_process_raw_result(
            data,
            raw_text=raw_text,
            detected_software_icons=detected_software_icons,
        )
        result = self._merge_other_sections_into_additional_info(result)
        return self._ensure_schema(
            result,
            raw_text=raw_text,
            detected_software_icons=detected_software_icons,
        )
