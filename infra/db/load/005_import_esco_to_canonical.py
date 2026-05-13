from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import sys
import unicodedata
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import psycopg
from psycopg.types.json import Json


ESCO_VERSION = "1.2.1"


# ============================================================
# Helpers
# ============================================================

def clean_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None

    value = str(value).replace("\ufeff", "").strip()

    if value == "" or value.lower() in {"nan", "none", "null"}:
        return None

    value = re.sub(r"[ \t\r\f\v]+", " ", value)
    value = re.sub(r"\n+", "\n", value)

    return value.strip()


def normalize_text(value: Optional[str]) -> str:
    value = clean_text(value)
    if not value:
        return ""

    value = value.lower().strip()
    value = re.sub(r"\s+", " ", value)

    # On enlève les accents pour améliorer la recherche FR/EN.
    # Pour l'arabe, ça ne casse pas le texte, car les caractères arabes restent.
    value = unicodedata.normalize("NFKD", value)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))

    return value.strip()


def uri_suffix(uri: str) -> str:
    uri = clean_text(uri) or ""
    return uri.rstrip("/").split("/")[-1]


def split_aliases(value: Optional[str]) -> List[str]:
    value = clean_text(value)
    if not value:
        return []

    # ESCO utilise souvent des retours ligne.
    # Certains fichiers collection utilisent aussi " | ".
    parts: List[str] = []
    for chunk in re.split(r"\n|\s+\|\s+", value):
        chunk = clean_text(chunk)
        if chunk:
            parts.append(chunk)

    # Déduplication en gardant l'ordre
    seen = set()
    result = []
    for p in parts:
        key = normalize_text(p)
        if key and key not in seen:
            seen.add(key)
            result.append(p)

    return result


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def ensure_zip_exists(path: Optional[str], label: str) -> Path:
    if not path:
        raise RuntimeError(f"Missing {label} zip path")

    p = Path(path)
    if not p.exists():
        raise RuntimeError(f"{label} zip not found: {p}")

    if not zipfile.is_zipfile(p):
        raise RuntimeError(f"{label} is not a valid zip: {p}")

    return p


def read_csv_from_zip(zip_path: Path, csv_name: str) -> List[Dict[str, str]]:
    with zipfile.ZipFile(zip_path, "r") as zf:
        if csv_name not in zf.namelist():
            return []

        with zf.open(csv_name, "r") as raw:
            text = raw.read().decode("utf-8-sig", errors="replace").splitlines()

        reader = csv.DictReader(text)
        rows = []
        for row in reader:
            rows.append({k: clean_text(v) for k, v in row.items()})
        return rows


def find_zip_by_lang(base_dir: Path, lang: str) -> Optional[Path]:
    patterns = [
        f"*classification*{lang}*csv*.zip",
        f"*classification* - {lang} - csv*.zip",
        f"*{lang}*.zip",
    ]

    for pattern in patterns:
        matches = list(base_dir.glob(pattern))
        if matches:
            return matches[0]

    return None


def as_bool_status(status: Optional[str]) -> bool:
    status = (status or "").lower().strip()
    return status in {"released", "active", "true", "1", "yes", "y"}


def chunks(items: List[Any], size: int) -> Iterable[List[Any]]:
    for i in range(0, len(items), size):
        yield items[i:i + size]


# ============================================================
# Data model in memory
# ============================================================

@dataclass
class EscoConcept:
    uri: str
    concept_kind: str  # OCCUPATION / SKILL / ISCO_GROUP / SKILL_GROUP
    source_files: List[str] = field(default_factory=list)

    code: Optional[str] = None
    isco_group: Optional[str] = None
    skill_type: Optional[str] = None
    reuse_level: Optional[str] = None
    status: Optional[str] = None
    modified_date: Optional[str] = None
    nace_code: Optional[str] = None
    regulated_profession_note: Optional[str] = None

    labels: Dict[str, str] = field(default_factory=dict)
    descriptions: Dict[str, str] = field(default_factory=dict)
    definitions: Dict[str, str] = field(default_factory=dict)
    scope_notes: Dict[str, str] = field(default_factory=dict)
    alt_labels: Dict[str, List[str]] = field(default_factory=dict)
    hidden_labels: Dict[str, List[str]] = field(default_factory=dict)

    tags: Dict[str, bool] = field(default_factory=dict)
    collection_labels: Dict[str, Dict[str, str]] = field(default_factory=dict)

    def preferred_label(self) -> str:
        return (
            self.labels.get("fr")
            or self.labels.get("ar")
            or self.labels.get("en")
            or self.code
            or uri_suffix(self.uri)
        )

    def description(self) -> Optional[str]:
        return (
            self.descriptions.get("fr")
            or self.descriptions.get("ar")
            or self.descriptions.get("en")
        )

    def language_code(self) -> str:
        if self.labels.get("fr"):
            return "fr"
        if self.labels.get("ar"):
            return "ar"
        if self.labels.get("en"):
            return "en"
        return "fr"

    def active(self) -> bool:
        return as_bool_status(self.status)

    def node_type(self) -> str:
        if self.concept_kind == "OCCUPATION":
            return "OCCUPATION"

        if self.concept_kind == "ISCO_GROUP":
            return "SECTOR"

        if self.concept_kind == "SKILL_GROUP":
            return "OTHER"

        # Skills
        if self.tags.get("is_transversal_skill"):
            return "SOFT_SKILL"

        if (self.skill_type or "").lower() == "knowledge":
            return "KNOWLEDGE"

        # Les language skills restent SKILL pour éviter d'introduire un node_type
        # potentiellement non autorisé par la contrainte SQL.
        return "SKILL"

    def external_code(self) -> str:
        if self.concept_kind == "OCCUPATION":
            return f"ESCO_OCCUPATION:{self.code or uri_suffix(self.uri)}"

        if self.concept_kind == "ISCO_GROUP":
            return f"ESCO_ISCO:{self.code or uri_suffix(self.uri)}"

        if self.concept_kind == "SKILL_GROUP":
            return f"ESCO_SKILL_GROUP:{self.code or uri_suffix(self.uri)}"

        return f"ESCO_SKILL:{uri_suffix(self.uri)}"

    def metadata(self) -> Dict[str, Any]:
        return {
            "source": "ESCO",
            "provider": "European Commission",
            "version": ESCO_VERSION,
            "concept_kind": self.concept_kind,
            "concept_uri": self.uri,
            "code": self.code,
            "isco_group": self.isco_group,
            "skill_type": self.skill_type,
            "reuse_level": self.reuse_level,
            "status": self.status,
            "modified_date": self.modified_date,
            "nace_code": self.nace_code,
            "regulated_profession_note": self.regulated_profession_note,
            "labels": self.labels,
            "descriptions": self.descriptions,
            "definitions": self.definitions,
            "scope_notes": self.scope_notes,
            "tags": self.tags,
            "source_files": sorted(set(self.source_files)),
            "language_priority": ["fr", "ar", "en"],
        }


# ============================================================
# ESCO CSV loading
# ============================================================

def get_or_create_concept(
    concepts: Dict[str, EscoConcept],
    uri: str,
    concept_kind: str,
) -> EscoConcept:
    if uri not in concepts:
        concepts[uri] = EscoConcept(uri=uri, concept_kind=concept_kind)
    else:
        # Si le concept existe déjà comme skill et qu'on découvre une info plus précise,
        # on garde le kind initial sauf si c'était générique.
        if concepts[uri].concept_kind != concept_kind:
            if concepts[uri].concept_kind == "SKILL" and concept_kind in {"SKILL", "SKILL_GROUP"}:
                pass
    return concepts[uri]


def load_occupations(concepts: Dict[str, EscoConcept], zip_path: Path, lang: str) -> None:
    file_name = f"occupations_{lang}.csv"
    rows = read_csv_from_zip(zip_path, file_name)

    for row in rows:
        uri = clean_text(row.get("conceptUri"))
        if not uri:
            continue

        c = get_or_create_concept(concepts, uri, "OCCUPATION")
        c.source_files.append(file_name)

        c.code = c.code or clean_text(row.get("code"))
        c.isco_group = c.isco_group or clean_text(row.get("iscoGroup"))
        c.status = c.status or clean_text(row.get("status"))
        c.modified_date = c.modified_date or clean_text(row.get("modifiedDate"))
        c.nace_code = c.nace_code or clean_text(row.get("naceCode"))
        c.regulated_profession_note = c.regulated_profession_note or clean_text(row.get("regulatedProfessionNote"))

        label = clean_text(row.get("preferredLabel"))
        if label:
            c.labels[lang] = label

        desc = clean_text(row.get("description"))
        if desc:
            c.descriptions[lang] = desc

        definition = clean_text(row.get("definition"))
        if definition:
            c.definitions[lang] = definition

        scope_note = clean_text(row.get("scopeNote"))
        if scope_note:
            c.scope_notes[lang] = scope_note

        alt = split_aliases(row.get("altLabels"))
        if alt:
            c.alt_labels[lang] = alt

        hidden = split_aliases(row.get("hiddenLabels"))
        if hidden:
            c.hidden_labels[lang] = hidden


def load_skills(concepts: Dict[str, EscoConcept], zip_path: Path, lang: str) -> None:
    file_name = f"skills_{lang}.csv"
    rows = read_csv_from_zip(zip_path, file_name)

    for row in rows:
        uri = clean_text(row.get("conceptUri"))
        if not uri:
            continue

        c = get_or_create_concept(concepts, uri, "SKILL")
        c.source_files.append(file_name)

        c.skill_type = c.skill_type or clean_text(row.get("skillType"))
        c.reuse_level = c.reuse_level or clean_text(row.get("reuseLevel"))
        c.status = c.status or clean_text(row.get("status"))
        c.modified_date = c.modified_date or clean_text(row.get("modifiedDate"))

        label = clean_text(row.get("preferredLabel"))
        if label:
            c.labels[lang] = label

        desc = clean_text(row.get("description"))
        if desc:
            c.descriptions[lang] = desc

        definition = clean_text(row.get("definition"))
        if definition:
            c.definitions[lang] = definition

        scope_note = clean_text(row.get("scopeNote"))
        if scope_note:
            c.scope_notes[lang] = scope_note

        alt = split_aliases(row.get("altLabels"))
        if alt:
            c.alt_labels[lang] = alt

        hidden = split_aliases(row.get("hiddenLabels"))
        if hidden:
            c.hidden_labels[lang] = hidden


def load_isco_groups(concepts: Dict[str, EscoConcept], zip_path: Path, lang: str) -> None:
    file_name = f"ISCOGroups_{lang}.csv"
    rows = read_csv_from_zip(zip_path, file_name)

    for row in rows:
        uri = clean_text(row.get("conceptUri"))
        if not uri:
            continue

        c = get_or_create_concept(concepts, uri, "ISCO_GROUP")
        c.source_files.append(file_name)

        c.code = c.code or clean_text(row.get("code"))
        c.status = c.status or clean_text(row.get("status"))

        label = clean_text(row.get("preferredLabel"))
        if label:
            c.labels[lang] = label

        desc = clean_text(row.get("description"))
        if desc:
            c.descriptions[lang] = desc

        alt = split_aliases(row.get("altLabels"))
        if alt:
            c.alt_labels[lang] = alt


def load_skill_groups(concepts: Dict[str, EscoConcept], zip_path: Path, lang: str) -> None:
    file_name = f"skillGroups_{lang}.csv"
    rows = read_csv_from_zip(zip_path, file_name)

    for row in rows:
        uri = clean_text(row.get("conceptUri"))
        if not uri:
            continue

        c = get_or_create_concept(concepts, uri, "SKILL_GROUP")
        c.source_files.append(file_name)

        c.code = c.code or clean_text(row.get("code"))
        c.status = c.status or clean_text(row.get("status"))
        c.modified_date = c.modified_date or clean_text(row.get("modifiedDate"))

        label = clean_text(row.get("preferredLabel"))
        if label:
            c.labels[lang] = label

        desc = clean_text(row.get("description"))
        if desc:
            c.descriptions[lang] = desc

        scope_note = clean_text(row.get("scopeNote"))
        if scope_note:
            c.scope_notes[lang] = scope_note

        alt = split_aliases(row.get("altLabels"))
        if alt:
            c.alt_labels[lang] = alt

        hidden = split_aliases(row.get("hiddenLabels"))
        if hidden:
            c.hidden_labels[lang] = hidden


def load_collection_tags(concepts: Dict[str, EscoConcept], zip_path: Path, lang: str) -> None:
    collection_files = [
        ("transversalSkillsCollection", "is_transversal_skill"),
        ("languageSkillsCollection", "is_language_skill"),
        ("digCompSkillsCollection", "is_digcomp_skill"),
        ("greenSkillsCollection", "is_green_skill"),
        ("researchSkillsCollection", "is_research_skill"),
        ("digitalSkillsCollection", "is_digital_skill"),
        ("researchOccupationsCollection", "is_research_occupation"),
    ]

    for prefix, tag in collection_files:
        file_name = f"{prefix}_{lang}.csv"
        rows = read_csv_from_zip(zip_path, file_name)

        for row in rows:
            uri = clean_text(row.get("conceptUri"))
            if not uri:
                continue

            kind = "OCCUPATION" if tag == "is_research_occupation" else "SKILL"
            c = get_or_create_concept(concepts, uri, kind)
            c.source_files.append(file_name)
            c.tags[tag] = True

            label = clean_text(row.get("preferredLabel"))
            if label:
                c.collection_labels.setdefault(tag, {})[lang] = label


def load_green_share(zip_path: Path, lang: str) -> Dict[str, str]:
    file_name = f"greenShareOcc_{lang}.csv"
    rows = read_csv_from_zip(zip_path, file_name)

    result = {}
    for row in rows:
        uri = clean_text(row.get("conceptUri"))
        share = clean_text(row.get("greenShare"))
        if uri and share:
            result[uri] = share

    return result


def load_broader_relations(zip_path: Path, lang: str) -> List[Tuple[str, str, str]]:
    result: List[Tuple[str, str, str]] = []

    for file_name in [
        f"broaderRelationsOccPillar_{lang}.csv",
        f"broaderRelationsSkillPillar_{lang}.csv",
    ]:
        rows = read_csv_from_zip(zip_path, file_name)
        for row in rows:
            child = clean_text(row.get("conceptUri"))
            parent = clean_text(row.get("broaderUri"))
            if child and parent and child != parent:
                result.append((child, parent, file_name))

    return result


def load_occupation_skill_relations(zip_path: Path, lang: str) -> List[Dict[str, Any]]:
    file_name = f"occupationSkillRelations_{lang}.csv"
    rows = read_csv_from_zip(zip_path, file_name)

    result = []
    for row in rows:
        occupation_uri = clean_text(row.get("occupationUri"))
        skill_uri = clean_text(row.get("skillUri"))
        if not occupation_uri or not skill_uri:
            continue

        relation_type_raw = clean_text(row.get("relationType")) or "related"
        weight = 1.0 if relation_type_raw.lower() == "essential" else 0.6

        result.append({
            "source_uri": occupation_uri,
            "target_uri": skill_uri,
            "relation_type": "REQUIRES_SKILL",
            "weight": weight,
            "confidence": 1.0,
            "active": True,
            "metadata": {
                "source": "ESCO",
                "version": ESCO_VERSION,
                "source_file": file_name,
                "esco_relation_type": relation_type_raw,
                "skill_type": clean_text(row.get("skillType")),
                "occupation_label_from_relation_file": clean_text(row.get("occupationLabel")),
                "skill_label_from_relation_file": clean_text(row.get("skillLabel")),
            },
        })

    return result


def load_skill_skill_relations(zip_path: Path, lang: str) -> List[Dict[str, Any]]:
    file_name = f"skillSkillRelations_{lang}.csv"
    rows = read_csv_from_zip(zip_path, file_name)

    result = []
    for row in rows:
        source_uri = clean_text(row.get("originalSkillUri"))
        target_uri = clean_text(row.get("relatedSkillUri"))
        if not source_uri or not target_uri or source_uri == target_uri:
            continue

        relation_type_raw = clean_text(row.get("relationType")) or "related"
        weight = 1.0 if relation_type_raw.lower() == "essential" else 0.6

        result.append({
            "source_uri": source_uri,
            "target_uri": target_uri,
            "relation_type": "RELATED_TO",
            "weight": weight,
            "confidence": 1.0,
            "active": True,
            "metadata": {
                "source": "ESCO",
                "version": ESCO_VERSION,
                "source_file": file_name,
                "esco_relation_type": relation_type_raw,
                "original_skill_type": clean_text(row.get("originalSkillType")),
                "related_skill_type": clean_text(row.get("relatedSkillType")),
            },
        })

    return result


# ============================================================
# PostgreSQL
# ============================================================

def get_database_url(args: argparse.Namespace) -> str:
    value = args.database_url or os.getenv("DATABASE_URL")
    if not value:
        raise RuntimeError("DATABASE_URL is missing. Set env DATABASE_URL or pass --database-url.")
    return value


def get_allowed_import_statuses(cur) -> List[str]:
    cur.execute("""
        SELECT pg_get_constraintdef(oid)
        FROM pg_constraint
        WHERE conrelid = 'taxonomy.taxonomy_import_batch'::regclass
          AND conname = 'ck_taxonomy_import_batch_status';
    """)
    row = cur.fetchone()
    if not row or not row[0]:
        return ["STARTED", "SUCCESS", "FAILED"]

    text = row[0]
    values = re.findall(r"'([^']+)'", text)
    return values or ["STARTED", "SUCCESS", "FAILED"]


def choose_success_status(allowed: List[str]) -> str:
    for candidate in ["SUCCESS", "COMPLETED", "DONE", "FINISHED", "COMMITTED"]:
        if candidate in allowed:
            return candidate
    return allowed[0]


def choose_failed_status(allowed: List[str]) -> str:
    for candidate in ["FAILED", "ERROR"]:
        if candidate in allowed:
            return candidate
    return allowed[0]


def ensure_esco_model(cur) -> str:
    cur.execute("""
        INSERT INTO taxonomy.taxonomy_model (
            code,
            label,
            version,
            source,
            is_active,
            is_default,
            released_at,
            imported_at,
            metadata_json
        )
        SELECT
            'ESCO',
            'European Skills, Competences, Qualifications and Occupations',
            '1.2.1',
            'European Commission / ESCO',
            true,
            false,
            DATE '2025-12-10',
            now(),
            %s
        WHERE NOT EXISTS (
            SELECT 1
            FROM taxonomy.taxonomy_model
            WHERE code = 'ESCO'
              AND version = '1.2.1'
        );
    """, (
        Json({
            "source": "official_esco_download",
            "provider": "European Commission",
            "version": ESCO_VERSION,
            "language_priority": ["fr", "ar", "en"],
            "preferred_language": "fr",
            "secondary_language": "ar",
            "fallback_language": "en",
            "format": "CSV",
        }),
    ))

    cur.execute("""
        SELECT id
        FROM taxonomy.taxonomy_model
        WHERE code = 'ESCO'
          AND version = '1.2.1'
        LIMIT 1;
    """)
    row = cur.fetchone()
    if not row:
        raise RuntimeError("Could not create or find ESCO model.")
    return str(row[0])


def create_import_batch(
    cur,
    model_id: str,
    fr_zip: Path,
    ar_zip: Path,
    en_zip: Path,
) -> str:
    checksum = hashlib.sha256(
        (
            file_sha256(fr_zip)
            + file_sha256(ar_zip)
            + file_sha256(en_zip)
        ).encode("utf-8")
    ).hexdigest()

    metadata = {
        "source": "ESCO",
        "version": ESCO_VERSION,
        "language_priority": ["fr", "ar", "en"],
        "files": {
            "fr": str(fr_zip),
            "ar": str(ar_zip),
            "en": str(en_zip),
        },
        "file_checksums": {
            "fr": file_sha256(fr_zip),
            "ar": file_sha256(ar_zip),
            "en": file_sha256(en_zip),
        },
    }

    cur.execute("""
        INSERT INTO taxonomy.taxonomy_import_batch (
            model_id,
            source_name,
            source_file_name,
            source_checksum,
            import_status,
            metadata_json
        )
        VALUES (
            %s,
            'ESCO',
            'ESCO classification FR/AR/EN CSV zips',
            %s,
            'STARTED',
            %s
        )
        RETURNING id;
    """, (
        model_id,
        checksum,
        Json(metadata),
    ))

    return str(cur.fetchone()[0])

def upsert_nodes(
    cur,
    model_id: str,
    batch_id: str,
    concepts: Dict[str, EscoConcept],
    batch_size: int = 1000,
) -> None:
    rows = []

    for c in concepts.values():
        preferred_label = c.preferred_label()
        normalized_label = normalize_text(preferred_label)

        if not preferred_label or not normalized_label:
            continue

        metadata = c.metadata()

        external_code = c.external_code()
        external_uri = c.uri
        node_type = c.node_type()
        description = c.description()
        language_code = c.language_code()
        active = c.active()

        rows.append((
            # UPDATE params
            batch_id,
            external_uri,
            node_type,
            preferred_label,
            normalized_label,
            description,
            language_code,
            active,
            json.dumps(metadata, ensure_ascii=False),
            model_id,
            external_code,

            # INSERT params
            model_id,
            batch_id,
            external_code,
            external_uri,
            node_type,
            preferred_label,
            normalized_label,
            description,
            language_code,
            active,
            json.dumps(metadata, ensure_ascii=False),
        ))

    sql = """
        WITH updated AS (
            UPDATE taxonomy.taxonomy_node
            SET
                import_batch_id = %s,
                external_uri = %s,
                node_type = %s,
                preferred_label = %s,
                normalized_label = %s,
                description = %s,
                language_code = %s,
                active = %s,
                metadata_json = COALESCE(metadata_json, '{}'::jsonb) || %s::jsonb,
                updated_at = now()
            WHERE model_id = %s
              AND external_code = %s
            RETURNING id
        )
        INSERT INTO taxonomy.taxonomy_node (
            model_id,
            import_batch_id,
            external_code,
            external_uri,
            node_type,
            preferred_label,
            normalized_label,
            description,
            language_code,
            active,
            metadata_json
        )
        SELECT
            %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s::jsonb
        WHERE NOT EXISTS (
            SELECT 1 FROM updated
        );
    """

    total = len(rows)
    done = 0

    for chunk_rows in chunks(rows, batch_size):
        cur.executemany(sql, chunk_rows)
        done += len(chunk_rows)
        print(f"Nodes inserted/updated: {done}/{total}")


def fetch_uri_to_node_id(cur, model_id: str) -> Dict[str, str]:
    cur.execute("""
        SELECT external_uri, id
        FROM taxonomy.taxonomy_node
        WHERE model_id = %s
          AND external_uri IS NOT NULL;
    """, (model_id,))
    return {str(uri): str(node_id) for uri, node_id in cur.fetchall()}


def fetch_code_to_node_id(cur, model_id: str) -> Dict[str, str]:
    cur.execute("""
        SELECT external_code, id
        FROM taxonomy.taxonomy_node
        WHERE model_id = %s
          AND external_code IS NOT NULL;
    """, (model_id,))
    return {str(code): str(node_id) for code, node_id in cur.fetchall()}


def build_alias_rows(
    concepts: Dict[str, EscoConcept],
    uri_to_node_id: Dict[str, str],
    batch_id: str,
) -> List[Tuple[Any, ...]]:
    rows = []

    for c in concepts.values():
        node_id = uri_to_node_id.get(c.uri)
        if not node_id:
            continue

        # preferred labels comme alias
        for lang, label in c.labels.items():
            label = clean_text(label)
            norm = normalize_text(label)
            if not label or not norm:
                continue

            rows.append((
                node_id,
                batch_id,
                label,
                norm,
                lang,
                "ESCO_PREFERRED_LABEL",
                1.0,
                True,
                Json({
                    "source": "ESCO",
                    "version": ESCO_VERSION,
                    "concept_uri": c.uri,
                    "language": lang,
                    "alias_kind": "preferredLabel",
                }),
            ))

        # alt labels
        for lang, aliases in c.alt_labels.items():
            for alias in aliases:
                norm = normalize_text(alias)
                if not alias or not norm:
                    continue

                rows.append((
                    node_id,
                    batch_id,
                    alias,
                    norm,
                    lang,
                    "ESCO_ALT_LABEL",
                    0.95,
                    True,
                    Json({
                        "source": "ESCO",
                        "version": ESCO_VERSION,
                        "concept_uri": c.uri,
                        "language": lang,
                        "alias_kind": "altLabel",
                    }),
                ))

        # hidden labels
        for lang, aliases in c.hidden_labels.items():
            for alias in aliases:
                norm = normalize_text(alias)
                if not alias or not norm:
                    continue

                rows.append((
                    node_id,
                    batch_id,
                    alias,
                    norm,
                    lang,
                    "ESCO_HIDDEN_LABEL",
                    0.85,
                    True,
                    Json({
                        "source": "ESCO",
                        "version": ESCO_VERSION,
                        "concept_uri": c.uri,
                        "language": lang,
                        "alias_kind": "hiddenLabel",
                    }),
                ))

    # Déduplication avant DB
    seen = set()
    unique_rows = []
    for r in rows:
        key = (r[0], r[3])
        if key in seen:
            continue
        seen.add(key)
        unique_rows.append(r)

    return unique_rows


def upsert_aliases(
    cur,
    alias_rows: List[Tuple[Any, ...]],
    batch_size: int = 2000,
) -> None:
    sql = """
        INSERT INTO taxonomy.taxonomy_alias (
            node_id,
            import_batch_id,
            alias,
            normalized_alias,
            language_code,
            source,
            confidence,
            active,
            metadata_json
        )
        VALUES (
            %s, %s, %s, %s, %s,
            %s, %s, %s, %s
        )
        ON CONFLICT (node_id, normalized_alias)
        DO UPDATE SET
            alias = EXCLUDED.alias,
            language_code = EXCLUDED.language_code,
            source = EXCLUDED.source,
            confidence = GREATEST(taxonomy.taxonomy_alias.confidence, EXCLUDED.confidence),
            active = true,
            metadata_json = taxonomy.taxonomy_alias.metadata_json || EXCLUDED.metadata_json;
    """

    total = len(alias_rows)
    done = 0

    for chunk_rows in chunks(alias_rows, batch_size):
        cur.executemany(sql, chunk_rows)
        done += len(chunk_rows)
        print(f"Aliases upserted: {done}/{total}")


def update_parents(
    cur,
    uri_to_node_id: Dict[str, str],
    code_to_node_id: Dict[str, str],
    concepts: Dict[str, EscoConcept],
    broader_relations: List[Tuple[str, str, str]],
    batch_size: int = 2000,
) -> None:
    parent_updates: Dict[str, str] = {}

    # 1. Parent occupation -> ISCO group par isco_group
    for c in concepts.values():
        if c.concept_kind != "OCCUPATION":
            continue

        child_id = uri_to_node_id.get(c.uri)
        if not child_id:
            continue

        if c.isco_group:
            parent_id = code_to_node_id.get(f"ESCO_ISCO:{c.isco_group}")
            if parent_id and parent_id != child_id:
                parent_updates[child_id] = parent_id

    # 2. Relations broader officielles ESCO
    for child_uri, parent_uri, _source_file in broader_relations:
        child_id = uri_to_node_id.get(child_uri)
        parent_id = uri_to_node_id.get(parent_uri)

        if child_id and parent_id and child_id != parent_id:
            parent_updates[child_id] = parent_id

    rows = [(parent_id, child_id, parent_id) for child_id, parent_id in parent_updates.items()]

    sql = """
        UPDATE taxonomy.taxonomy_node
        SET parent_id = %s,
            updated_at = now()
        WHERE id = %s
          AND (
              parent_id IS NULL
              OR parent_id <> %s
          );
    """

    total = len(rows)
    done = 0

    for chunk_rows in chunks(rows, batch_size):
        cur.executemany(sql, chunk_rows)
        done += len(chunk_rows)
        print(f"Parents updated: {done}/{total}")


def insert_relations(
    cur,
    model_id: str,
    batch_id: str,
    uri_to_node_id: Dict[str, str],
    relation_rows: List[Dict[str, Any]],
    batch_size: int = 2000,
) -> None:
    db_rows = []

    for r in relation_rows:
        source_id = uri_to_node_id.get(r["source_uri"])
        target_id = uri_to_node_id.get(r["target_uri"])

        if not source_id or not target_id or source_id == target_id:
            continue

        db_rows.append((
            model_id,
            batch_id,
            source_id,
            target_id,
            r["relation_type"],
            r["weight"],
            r["confidence"],
            r["active"],
            Json(r["metadata"]),
            model_id,
            source_id,
            target_id,
            r["relation_type"],
        ))

    sql = """
        INSERT INTO taxonomy.taxonomy_relation (
            model_id,
            import_batch_id,
            source_node_id,
            target_node_id,
            relation_type,
            weight,
            confidence,
            active,
            metadata_json
        )
        SELECT
            %s, %s, %s, %s, %s,
            %s, %s, %s, %s
        WHERE NOT EXISTS (
            SELECT 1
            FROM taxonomy.taxonomy_relation existing
            WHERE existing.model_id = %s
              AND existing.source_node_id = %s
              AND existing.target_node_id = %s
              AND existing.relation_type = %s
        );
    """

    total = len(db_rows)
    done = 0

    for chunk_rows in chunks(db_rows, batch_size):
        cur.executemany(sql, chunk_rows)
        done += len(chunk_rows)
        print(f"Relations inserted/checked: {done}/{total}")


def update_batch_success(
    cur,
    batch_id: str,
    success_status: str,
) -> None:
    cur.execute("""
        UPDATE taxonomy.taxonomy_import_batch b
        SET
            import_status = %s,
            finished_at = now(),
            imported_nodes_count = (
                SELECT COUNT(*)
                FROM taxonomy.taxonomy_node n
                WHERE n.import_batch_id = b.id
            ),
            imported_aliases_count = (
                SELECT COUNT(*)
                FROM taxonomy.taxonomy_alias a
                WHERE a.import_batch_id = b.id
            ),
            imported_relations_count = (
                SELECT COUNT(*)
                FROM taxonomy.taxonomy_relation r
                WHERE r.import_batch_id = b.id
            ),
            metadata_json = b.metadata_json || jsonb_build_object(
                'finished_by', '005_import_esco_to_canonical.py',
                'finished_at', now()
            )
        WHERE b.id = %s;
    """, (success_status, batch_id))


def update_batch_failed(
    conn,
    batch_id: Optional[str],
    failed_status: str,
    error: Exception,
) -> None:
    if not batch_id:
        return

    error_payload = [
        {
            "error_type": type(error).__name__,
            "message": str(error),
        }
    ]

    with conn.cursor() as cur:
        cur.execute("""
            UPDATE taxonomy.taxonomy_import_batch b
            SET
                import_status = %s,
                finished_at = now(),
                errors_json = COALESCE(b.errors_json, '[]'::jsonb) || %s::jsonb,
                metadata_json = COALESCE(b.metadata_json, '{}'::jsonb) || jsonb_build_object(
                    'failed_by', '005_import_esco_to_canonical.py',
                    'failed_at', now()
                )
            WHERE b.id = %s;
        """, (
            failed_status,
            json.dumps(error_payload, ensure_ascii=False),
            batch_id,
        ))

    conn.commit()

# ============================================================
# Main
# ============================================================

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Import ESCO v1.2.1 FR/AR/EN CSV zips into taxonomy canonical tables."
    )

    parser.add_argument("--database-url", default=None)

    parser.add_argument("--fr-zip", default=None)
    parser.add_argument("--ar-zip", default=None)
    parser.add_argument("--en-zip", default=None)

    parser.add_argument(
        "--esco-dir",
        default="infra/db/data/esco",
        help="Folder used to auto-detect ESCO zip files if explicit zip paths are not passed.",
    )

    parser.add_argument("--batch-size", type=int, default=2000)

    return parser.parse_args()


def main() -> None:
    args = parse_args()
    database_url = get_database_url(args)

    esco_dir = Path(args.esco_dir)

    fr_zip = Path(args.fr_zip) if args.fr_zip else find_zip_by_lang(esco_dir, "fr")
    ar_zip = Path(args.ar_zip) if args.ar_zip else find_zip_by_lang(esco_dir, "ar")
    en_zip = Path(args.en_zip) if args.en_zip else find_zip_by_lang(esco_dir, "en")

    fr_zip = ensure_zip_exists(str(fr_zip) if fr_zip else None, "FR")
    ar_zip = ensure_zip_exists(str(ar_zip) if ar_zip else None, "AR")
    en_zip = ensure_zip_exists(str(en_zip) if en_zip else None, "EN")

    print("Using ESCO files:")
    print(f"  FR: {fr_zip}")
    print(f"  AR: {ar_zip}")
    print(f"  EN: {en_zip}")

    concepts: Dict[str, EscoConcept] = {}

    # Langue principale ANETI : FR
    for lang, zip_path in [("fr", fr_zip), ("ar", ar_zip), ("en", en_zip)]:
        print(f"Loading ESCO {lang}...")
        load_occupations(concepts, zip_path, lang)
        load_skills(concepts, zip_path, lang)
        load_isco_groups(concepts, zip_path, lang)
        load_skill_groups(concepts, zip_path, lang)
        load_collection_tags(concepts, zip_path, lang)

    # Green share surtout pour enrichissement
    green_share_fr = load_green_share(fr_zip, "fr")
    for uri, share in green_share_fr.items():
        if uri in concepts:
            concepts[uri].tags["has_green_share"] = True
            concepts[uri].tags["green_share"] = share

    broader_relations = []
    broader_relations.extend(load_broader_relations(fr_zip, "fr"))

    occupation_skill_relations = load_occupation_skill_relations(fr_zip, "fr")
    skill_skill_relations = load_skill_skill_relations(fr_zip, "fr")

    all_relation_rows = occupation_skill_relations + skill_skill_relations

    print("Loaded concepts:")
    counts_by_kind: Dict[str, int] = {}
    for c in concepts.values():
        counts_by_kind[c.concept_kind] = counts_by_kind.get(c.concept_kind, 0) + 1

    for k, v in sorted(counts_by_kind.items()):
        print(f"  {k}: {v}")

    print(f"Broader relations: {len(broader_relations)}")
    print(f"Occupation-skill relations: {len(occupation_skill_relations)}")
    print(f"Skill-skill relations: {len(skill_skill_relations)}")

    batch_id: Optional[str] = None

    with psycopg.connect(database_url) as conn:
        try:
            with conn.cursor() as cur:
                allowed_statuses = get_allowed_import_statuses(cur)
                success_status = choose_success_status(allowed_statuses)
                failed_status = choose_failed_status(allowed_statuses)

                print(f"Allowed import statuses: {allowed_statuses}")
                print(f"Success status selected: {success_status}")

                model_id = ensure_esco_model(cur)
                print(f"ESCO model id: {model_id}")

                batch_id = create_import_batch(cur, model_id, fr_zip, ar_zip, en_zip)
                print(f"Import batch id: {batch_id}")

                upsert_nodes(
                    cur=cur,
                    model_id=model_id,
                    batch_id=batch_id,
                    concepts=concepts,
                    batch_size=args.batch_size,
                )

                uri_to_node_id = fetch_uri_to_node_id(cur, model_id)
                code_to_node_id = fetch_code_to_node_id(cur, model_id)

                alias_rows = build_alias_rows(concepts, uri_to_node_id, batch_id)
                print(f"Alias rows prepared: {len(alias_rows)}")

                upsert_aliases(
                    cur=cur,
                    alias_rows=alias_rows,
                    batch_size=args.batch_size,
                )

                update_parents(
                    cur=cur,
                    uri_to_node_id=uri_to_node_id,
                    code_to_node_id=code_to_node_id,
                    concepts=concepts,
                    broader_relations=broader_relations,
                    batch_size=args.batch_size,
                )

                insert_relations(
                    cur=cur,
                    model_id=model_id,
                    batch_id=batch_id,
                    uri_to_node_id=uri_to_node_id,
                    relation_rows=all_relation_rows,
                    batch_size=args.batch_size,
                )

                update_batch_success(cur, batch_id, success_status)

            conn.commit()
            print("ESCO import finished successfully.")

        except Exception as exc:
            conn.rollback()
            print(f"ERROR: {type(exc).__name__}: {exc}", file=sys.stderr)

            try:
                update_batch_failed(conn, batch_id, failed_status, exc)
            except Exception as fail_update_exc:
                print(f"Could not update failed batch: {fail_update_exc}", file=sys.stderr)

            raise


if __name__ == "__main__":
    main()