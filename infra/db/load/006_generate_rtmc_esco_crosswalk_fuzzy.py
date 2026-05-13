from __future__ import annotations

import argparse
import json
import os
import re
import sys
import unicodedata
from collections import defaultdict
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Tuple

import psycopg
from rapidfuzz import fuzz, process


# ============================================================
# Text helpers
# ============================================================

def clean_text(value: Optional[str]) -> str:
    if value is None:
        return ""

    value = str(value).replace("\ufeff", "").strip()
    value = re.sub(r"[ \t\r\f\v]+", " ", value)
    value = re.sub(r"\n+", " ", value)
    return value.strip()


def normalize_for_fuzzy(value: Optional[str]) -> str:
    value = clean_text(value).lower()

    if not value:
        return ""

    value = unicodedata.normalize("NFKD", value)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))

    value = value.replace("’", "'")
    value = value.replace("`", "'")

    # On garde les lettres/chiffres et on simplifie la ponctuation.
    value = re.sub(r"[^a-z0-9\u0600-\u06FF]+", " ", value, flags=re.IGNORECASE)
    value = re.sub(r"\s+", " ", value).strip()

    return value


def word_count(value: str) -> int:
    value = normalize_for_fuzzy(value)
    if not value:
        return 0
    return len(value.split())

def token_count(value: str) -> int:
    value = normalize_for_fuzzy(value)
    if not value:
        return 0
    return len(set(value.split()))


def compute_effective_fuzzy_score(source: str, target: str) -> tuple[float, dict]:
    source_norm = normalize_for_fuzzy(source)
    target_norm = normalize_for_fuzzy(target)

    token_set = fuzz.token_set_ratio(source_norm, target_norm)
    token_sort = fuzz.token_sort_ratio(source_norm, target_norm)
    wratio = fuzz.WRatio(source_norm, target_norm)
    simple_ratio = fuzz.ratio(source_norm, target_norm)

    source_tokens = token_count(source_norm)
    target_tokens = token_count(target_norm)

    length_ratio = min(source_tokens, target_tokens) / max(source_tokens, target_tokens, 1)

    # Score final plus strict :
    # - token_set sert à détecter le chevauchement
    # - token_sort / WRatio pénalisent les phrases trop différentes
    # - on limite les cas "petit terme contenu dans un grand terme"
    effective_score = min(
        token_set,
        wratio,
        token_sort + 8
    )

    # Forte pénalité quand un terme très court est inclus dans un terme très long.
    # Exemple : "pharmacie" -> "enseignant-chercheur en pharmacie"
    if token_set >= 98 and length_ratio < 0.55:
        effective_score = min(effective_score, 82)

    return effective_score, {
        "token_set_ratio": token_set,
        "token_sort_ratio": token_sort,
        "wratio": wratio,
        "simple_ratio": simple_ratio,
        "source_token_count": source_tokens,
        "target_token_count": target_tokens,
        "token_length_ratio": round(length_ratio, 4),
        "effective_score": effective_score,
    }

def chunks(items: List[Any], size: int) -> Iterable[List[Any]]:
    for i in range(0, len(items), size):
        yield items[i:i + size]


# ============================================================
# Data classes
# ============================================================

@dataclass(frozen=True)
class SearchTerm:
    node_id: str
    model_code: str
    model_version: str
    node_type: str
    external_code: str
    term: str
    normalized_term: str
    fuzzy_term: str
    term_source: str
    language_code: str
    term_weight: float


@dataclass
class CrosswalkCandidate:
    source_node_id: str
    target_node_id: str
    source_node_type: str
    target_node_type: str

    source_term: str
    target_term: str
    source_term_source: str
    target_term_source: str
    source_language_code: str
    target_language_code: str

    score_raw: float
    confidence: float
    mapping_type: str
    method: str
    metadata: Dict[str, Any]


# ============================================================
# DB helpers
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

    values = re.findall(r"'([^']+)'", row[0])
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


def get_model_id(cur, code: str, version: Optional[str] = None) -> str:
    if version:
        cur.execute("""
            SELECT id
            FROM taxonomy.taxonomy_model
            WHERE code = %s
              AND version = %s
              AND is_active = true
            LIMIT 1;
        """, (code, version))
    else:
        cur.execute("""
            SELECT id
            FROM taxonomy.taxonomy_model
            WHERE code = %s
              AND is_active = true
            ORDER BY is_default DESC, imported_at DESC NULLS LAST, created_at DESC
            LIMIT 1;
        """, (code,))

    row = cur.fetchone()
    if not row:
        raise RuntimeError(f"Could not find active taxonomy model: {code} {version or ''}")

    return str(row[0])


def create_import_batch(cur, source_model_id: str, args: argparse.Namespace) -> str:
    metadata = {
        "source": "AUTO_GENERATED",
        "kind": "taxonomy_crosswalk",
        "direction": "RTMC_TO_ESCO",
        "script": "006_generate_rtmc_esco_crosswalk_fuzzy.py",
        "rtmc_version": args.rtmc_version,
        "esco_version": args.esco_version,
        "threshold": args.threshold,
        "max_candidates_per_source": args.max_candidates_per_source,
        "languages": args.languages,
        "include_task": args.include_task,
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
            'RTMC_ESCO_CROSSWALK_FUZZY',
            'generated_by_006_generate_rtmc_esco_crosswalk_fuzzy.py',
            NULL,
            'STARTED',
            %s::jsonb
        )
        RETURNING id;
    """, (
        source_model_id,
        json.dumps(metadata, ensure_ascii=False),
    ))

    return str(cur.fetchone()[0])


def update_import_batch_success(
    cur,
    batch_id: str,
    status: str,
    inserted_count: int,
    candidates_count: int,
) -> None:
    cur.execute("""
        UPDATE taxonomy.taxonomy_import_batch b
        SET
            import_status = %s,
            finished_at = now(),
            metadata_json = COALESCE(b.metadata_json, '{}'::jsonb)
                || jsonb_build_object(
                    'finished_by', '006_generate_rtmc_esco_crosswalk_fuzzy.py',
                    'finished_at', now(),
                    'generated_candidates_count', %s,
                    'inserted_crosswalk_count', %s
                )
        WHERE b.id = %s;
    """, (
        status,
        candidates_count,
        inserted_count,
        batch_id,
    ))


def update_import_batch_failed(
    conn,
    batch_id: Optional[str],
    status: str,
    error: Exception,
) -> None:
    if not batch_id:
        return

    payload = [{
        "error_type": type(error).__name__,
        "message": str(error),
    }]

    with conn.cursor() as cur:
        cur.execute("""
            UPDATE taxonomy.taxonomy_import_batch b
            SET
                import_status = %s,
                finished_at = now(),
                errors_json = COALESCE(b.errors_json, '[]'::jsonb) || %s::jsonb,
                metadata_json = COALESCE(b.metadata_json, '{}'::jsonb)
                    || jsonb_build_object(
                        'failed_by', '006_generate_rtmc_esco_crosswalk_fuzzy.py',
                        'failed_at', now()
                    )
            WHERE b.id = %s;
        """, (
            status,
            json.dumps(payload, ensure_ascii=False),
            batch_id,
        ))

    conn.commit()


def load_terms(
    cur,
    model_code: str,
    model_version: Optional[str],
    node_types: List[str],
    languages: List[str],
    min_chars: int,
    min_words: int,
) -> List[SearchTerm]:
    params: List[Any] = [model_code]

    version_filter = ""
    if model_version:
        version_filter = "AND t.model_version = %s"
        params.append(model_version)

    params.extend([node_types, languages])

    sql = f"""
        SELECT
            t.node_id,
            t.model_code,
            t.model_version,
            t.node_type,
            t.external_code,
            t.term,
            t.normalized_term,
            t.term_source,
            COALESCE(t.language_code, 'fr') AS language_code,
            COALESCE(t.term_weight, 0.8)::float AS term_weight
        FROM taxonomy.v_taxonomy_search_terms t
        JOIN taxonomy.taxonomy_node n ON n.id = t.node_id
        WHERE t.model_code = %s
          {version_filter}
          AND t.node_type = ANY(%s::text[])
          AND COALESCE(t.language_code, 'fr') = ANY(%s::text[])
          AND n.active = true
          AND t.term IS NOT NULL
          AND trim(t.term) <> '';
    """

    cur.execute(sql, params)
    rows = cur.fetchall()

    result: List[SearchTerm] = []
    seen = set()

    for row in rows:
        (
            node_id,
            m_code,
            m_version,
            node_type,
            external_code,
            term,
            normalized_term,
            term_source,
            language_code,
            term_weight,
        ) = row

        term = clean_text(term)
        fuzzy_term = normalize_for_fuzzy(term)

        if len(fuzzy_term) < min_chars:
            continue

        if word_count(fuzzy_term) < min_words:
            continue

        key = (str(node_id), fuzzy_term, str(term_source), str(language_code))
        if key in seen:
            continue

        seen.add(key)

        result.append(SearchTerm(
            node_id=str(node_id),
            model_code=str(m_code),
            model_version=str(m_version),
            node_type=str(node_type),
            external_code=str(external_code),
            term=term,
            normalized_term=clean_text(normalized_term),
            fuzzy_term=fuzzy_term,
            term_source=str(term_source),
            language_code=str(language_code),
            term_weight=float(term_weight or 0.8),
        ))

    return result

def load_existing_pairs(cur) -> set[Tuple[str, str]]:
    cur.execute("""
        SELECT
            cw.source_node_id,
            cw.target_node_id
        FROM taxonomy.taxonomy_crosswalk cw
        JOIN taxonomy.taxonomy_node src ON src.id = cw.source_node_id
        JOIN taxonomy.taxonomy_model sm ON sm.id = src.model_id
        JOIN taxonomy.taxonomy_node tgt ON tgt.id = cw.target_node_id
        JOIN taxonomy.taxonomy_model tm ON tm.id = tgt.model_id
        WHERE sm.code = 'RTMC'
          AND tm.code = 'ESCO';
    """)

    return {(str(s), str(t)) for s, t in cur.fetchall()}


# ============================================================
# Fuzzy matching
# ============================================================

def compatible_type_pairs(include_task: bool = False) -> List[Tuple[str, str]]:
    pairs = [
        ("OCCUPATION", "OCCUPATION"),
        ("SKILL", "SKILL"),
        ("SKILL", "KNOWLEDGE"),
        ("SOFT_SKILL", "SOFT_SKILL"),
        ("SOFT_SKILL", "SKILL"),
    ]

    if include_task:
        pairs.extend([
            ("TASK", "SKILL"),
            ("TASK", "KNOWLEDGE"),
        ])

    return pairs


def term_source_multiplier(source: str) -> float:
    source = (source or "").upper()

    if source == "PREFERRED_LABEL":
        return 1.00

    if "OCCUPATION_LABEL" in source:
        return 0.98

    if "APPELLATION" in source:
        return 0.95

    if "ALT" in source:
        return 0.93

    if "HIDDEN" in source:
        return 0.85

    return 0.90


def type_multiplier(source_type: str, target_type: str) -> float:
    if source_type == target_type:
        return 1.00

    if source_type == "SKILL" and target_type == "KNOWLEDGE":
        return 0.92

    if source_type == "SOFT_SKILL" and target_type == "SKILL":
        return 0.85

    if source_type == "TASK" and target_type in {"SKILL", "KNOWLEDGE"}:
        return 0.78

    return 0.75


def compute_confidence(
    score_raw: float,
    source_term: SearchTerm,
    target_term: SearchTerm,
) -> float:
    base = score_raw / 100.0

    confidence = (
        base
        * source_term.term_weight
        * target_term.term_weight
        * term_source_multiplier(source_term.term_source)
        * term_source_multiplier(target_term.term_source)
        * type_multiplier(source_term.node_type, target_term.node_type)
    )

    # On évite de donner 0.99 à un mapping automatique.
    confidence = min(confidence, 0.88)

    # On garde 4 décimales pour NUMERIC.
    return round(confidence, 4)


def generate_candidates_for_pair(
    source_terms: List[SearchTerm],
    target_terms: List[SearchTerm],
    threshold: float,
    max_matches_per_term: int,
    max_candidates_per_source: int,
    existing_pairs: set[Tuple[str, str]],
) -> List[CrosswalkCandidate]:
    if not source_terms or not target_terms:
        return []

    target_choices = [t.fuzzy_term for t in target_terms]

    best_by_pair: Dict[Tuple[str, str], CrosswalkCandidate] = {}

    for idx, src in enumerate(source_terms, start=1):
        if src.node_type == "OCCUPATION" and src.term_source == "PREFERRED_LABEL":
            if word_count(src.term) <= 3:
                continue
        matches = process.extract(
            src.fuzzy_term,
            target_choices,
            scorer=fuzz.WRatio,
            limit=max_matches_per_term,
            score_cutoff=max(threshold - 5, 80),
        )

        for matched_text, score_raw, target_index in matches:
            tgt = target_terms[target_index]

            effective_score, score_details = compute_effective_fuzzy_score(src.term, tgt.term)

            if effective_score < threshold:
                continue

            if src.node_id == tgt.node_id:
                continue

            pair = (src.node_id, tgt.node_id)

            if pair in existing_pairs:
                continue

            confidence = compute_confidence(effective_score, src, tgt)

            # Sécurité : si après pénalités la confidence est trop faible, on ignore.
            if confidence < 0.70:
                continue

            candidate = CrosswalkCandidate(
                source_node_id=src.node_id,
                target_node_id=tgt.node_id,
                source_node_type=src.node_type,
                target_node_type=tgt.node_type,
                source_term=src.term,
                target_term=tgt.term,
                source_term_source=src.term_source,
                target_term_source=tgt.term_source,
                source_language_code=src.language_code,
                target_language_code=tgt.language_code,
                score_raw=float(effective_score),
                confidence=confidence,
                mapping_type="AUTO_MATCH",
                method="FUZZY_TOKEN_SET_FR",
                metadata={
                    "source": "AUTO_GENERATED",
                    "strategy": "fuzzy_token_set_similarity",
                    "direction": "RTMC_TO_ESCO",
                    "rtmc_term": src.term,
                    "esco_term": tgt.term,
                    "rtmc_fuzzy_term": src.fuzzy_term,
                    "esco_fuzzy_term": tgt.fuzzy_term,
                    "rtmc_term_source": src.term_source,
                    "esco_term_source": tgt.term_source,
                    "rtmc_language_code": src.language_code,
                    "esco_language_code": tgt.language_code,
                    "rtmc_node_type": src.node_type,
                    "esco_node_type": tgt.node_type,
                    "rapidfuzz_scorer": "hybrid_wratio_token_sort_token_set",
                    "rapidfuzz_initial_score": float(score_raw),
                    "rapidfuzz_effective_score": float(effective_score),
                    "score_details": score_details,
                    "confidence_after_penalties": confidence,
                    "validated_required": True,
                },
            )

            old = best_by_pair.get(pair)
            if old is None or candidate.confidence > old.confidence:
                best_by_pair[pair] = candidate

        if idx % 500 == 0:
            print(f"  processed source terms: {idx}/{len(source_terms)}")

    # On limite à max N candidats par node RTMC.
    by_source: Dict[str, List[CrosswalkCandidate]] = defaultdict(list)

    for c in best_by_pair.values():
        by_source[c.source_node_id].append(c)

    final_candidates: List[CrosswalkCandidate] = []

    for source_node_id, candidates in by_source.items():
        candidates.sort(key=lambda c: (c.confidence, c.score_raw), reverse=True)
        final_candidates.extend(candidates[:max_candidates_per_source])

    return final_candidates


def generate_all_candidates(
    rtmc_terms: List[SearchTerm],
    esco_terms: List[SearchTerm],
    threshold: float,
    max_matches_per_term: int,
    max_candidates_per_source: int,
    existing_pairs: set[Tuple[str, str]],
    include_task: bool,
) -> List[CrosswalkCandidate]:
    rtmc_by_type: Dict[str, List[SearchTerm]] = defaultdict(list)
    esco_by_type: Dict[str, List[SearchTerm]] = defaultdict(list)

    for t in rtmc_terms:
        rtmc_by_type[t.node_type].append(t)

    for t in esco_terms:
        esco_by_type[t.node_type].append(t)

    all_candidates: List[CrosswalkCandidate] = []

    for source_type, target_type in compatible_type_pairs(include_task=include_task):
        source_terms = rtmc_by_type.get(source_type, [])
        target_terms = esco_by_type.get(target_type, [])

        print()
        print(f"Generating fuzzy candidates: RTMC {source_type} -> ESCO {target_type}")
        print(f"  source terms: {len(source_terms)}")
        print(f"  target terms: {len(target_terms)}")

        candidates = generate_candidates_for_pair(
            source_terms=source_terms,
            target_terms=target_terms,
            threshold=threshold,
            max_matches_per_term=max_matches_per_term,
            max_candidates_per_source=max_candidates_per_source,
            existing_pairs=existing_pairs,
        )

        print(f"  candidates kept: {len(candidates)}")

        all_candidates.extend(candidates)

    # Dédup globale par pair
    best_by_pair: Dict[Tuple[str, str], CrosswalkCandidate] = {}

    for c in all_candidates:
        pair = (c.source_node_id, c.target_node_id)
        old = best_by_pair.get(pair)
        if old is None or c.confidence > old.confidence:
            best_by_pair[pair] = c

    final = list(best_by_pair.values())
    final.sort(key=lambda c: c.confidence, reverse=True)

    return final


# ============================================================
# Insert candidates
# ============================================================

def insert_candidates(
    cur,
    batch_id: str,
    candidates: List[CrosswalkCandidate],
    batch_size: int,
) -> int:
    rows = []

    for c in candidates:
        rows.append((
            batch_id,
            c.source_node_id,
            c.target_node_id,
            c.mapping_type,
            c.confidence,
            c.method,
            False,
            True,
            json.dumps(c.metadata, ensure_ascii=False),

            # NOT EXISTS params
            c.source_node_id,
            c.target_node_id,
        ))

    sql = """
        INSERT INTO taxonomy.taxonomy_crosswalk (
            import_batch_id,
            source_node_id,
            target_node_id,
            mapping_type,
            confidence,
            method,
            validated,
            active,
            metadata_json
        )
        SELECT
            %s, %s, %s, %s, %s,
            %s, %s, %s, %s::jsonb
        WHERE NOT EXISTS (
            SELECT 1
            FROM taxonomy.taxonomy_crosswalk existing
            WHERE existing.source_node_id = %s
              AND existing.target_node_id = %s
        );
    """

    inserted_checked = 0
    total = len(rows)

    for chunk_rows in chunks(rows, batch_size):
        cur.executemany(sql, chunk_rows)
        inserted_checked += len(chunk_rows)
        print(f"Crosswalk candidates inserted/checked: {inserted_checked}/{total}")

    return total


def print_preview(candidates: List[CrosswalkCandidate], limit: int = 30) -> None:
    print()
    print("Preview of fuzzy candidates")
    print("=" * 100)

    for i, c in enumerate(candidates[:limit], start=1):
        print(
            f"{i:02d}. "
            f"{c.source_node_type} -> {c.target_node_type} | "
            f"score={c.score_raw:.1f} confidence={c.confidence:.4f}"
        )
        print(f"    RTMC: {c.source_term}")
        print(f"    ESCO: {c.target_term}")
        print(f"    sources: {c.source_term_source} -> {c.target_term_source}")
        print()


# ============================================================
# Main
# ============================================================

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate fuzzy RTMC -> ESCO taxonomy crosswalk candidates."
    )

    parser.add_argument("--database-url", default=None)

    parser.add_argument("--rtmc-version", default=None)
    parser.add_argument("--esco-version", default="1.2.1")

    parser.add_argument(
        "--threshold",
        type=float,
        default=86.0,
        help="RapidFuzz score cutoff. Recommended: 86-92.",
    )

    parser.add_argument(
        "--max-matches-per-term",
        type=int,
        default=8,
        help="Max ESCO matches per RTMC term before grouping.",
    )

    parser.add_argument(
        "--max-candidates-per-source",
        type=int,
        default=5,
        help="Max ESCO candidates kept per RTMC node.",
    )

    parser.add_argument(
        "--min-chars",
        type=int,
        default=4,
        help="Ignore terms shorter than this after normalization.",
    )

    parser.add_argument(
        "--min-words",
        type=int,
        default=1,
        help="Ignore terms with fewer words than this.",
    )

    parser.add_argument(
        "--languages",
        nargs="+",
        default=["fr"],
        help="Languages to compare. For now recommended: fr.",
    )

    parser.add_argument(
        "--include-task",
        action="store_true",
        help="Also generate RTMC TASK -> ESCO SKILL/KNOWLEDGE candidates.",
    )

    parser.add_argument("--batch-size", type=int, default=2000)

    parser.add_argument(
        "--preview-limit",
        type=int,
        default=40,
    )

    parser.add_argument(
        "--commit",
        action="store_true",
        help="Actually insert candidates. Without this flag, dry-run only.",
    )

    return parser.parse_args()


def main() -> None:
    args = parse_args()
    database_url = get_database_url(args)

    batch_id: Optional[str] = None

    with psycopg.connect(database_url) as conn:
        try:
            with conn.cursor() as cur:
                allowed_statuses = get_allowed_import_statuses(cur)
                success_status = choose_success_status(allowed_statuses)
                failed_status = choose_failed_status(allowed_statuses)

                print(f"Allowed import statuses: {allowed_statuses}")
                print(f"Success status selected: {success_status}")

                rtmc_model_id = get_model_id(cur, "RTMC", args.rtmc_version)
                esco_model_id = get_model_id(cur, "ESCO", args.esco_version)

                print(f"RTMC model id: {rtmc_model_id}")
                print(f"ESCO model id: {esco_model_id}")

                source_types = ["OCCUPATION", "SKILL", "SOFT_SKILL"]
                if args.include_task:
                    source_types.append("TASK")

                target_types = ["OCCUPATION", "SKILL", "KNOWLEDGE", "SOFT_SKILL"]

                print("Loading RTMC terms...")
                rtmc_terms = load_terms(
                    cur=cur,
                    model_code="RTMC",
                    model_version=args.rtmc_version,
                    node_types=source_types,
                    languages=args.languages,
                    min_chars=args.min_chars,
                    min_words=args.min_words,
                )

                print("Loading ESCO terms...")
                esco_terms = load_terms(
                    cur=cur,
                    model_code="ESCO",
                    model_version=args.esco_version,
                    node_types=target_types,
                    languages=args.languages,
                    min_chars=args.min_chars,
                    min_words=args.min_words,
                )

                print(f"RTMC terms loaded: {len(rtmc_terms)}")
                print(f"ESCO terms loaded: {len(esco_terms)}")

                print("Loading existing RTMC -> ESCO pairs...")
                existing_pairs = load_existing_pairs(cur)
                print(f"Existing pairs: {len(existing_pairs)}")

                candidates = generate_all_candidates(
                    rtmc_terms=rtmc_terms,
                    esco_terms=esco_terms,
                    threshold=args.threshold,
                    max_matches_per_term=args.max_matches_per_term,
                    max_candidates_per_source=args.max_candidates_per_source,
                    existing_pairs=existing_pairs,
                    include_task=args.include_task,
                )

                print()
                print(f"Final fuzzy candidates: {len(candidates)}")

                print_preview(candidates, limit=args.preview_limit)

                if not args.commit:
                    print("DRY RUN ONLY. Nothing inserted.")
                    print("Run again with --commit to insert candidates.")
                    return

                print("Commit mode enabled. Inserting candidates...")

                batch_id = create_import_batch(cur, rtmc_model_id, args)

                inserted_count = insert_candidates(
                    cur=cur,
                    batch_id=batch_id,
                    candidates=candidates,
                    batch_size=args.batch_size,
                )

                update_import_batch_success(
                    cur=cur,
                    batch_id=batch_id,
                    status=success_status,
                    inserted_count=inserted_count,
                    candidates_count=len(candidates),
                )

            conn.commit()
            print("Fuzzy crosswalk generation finished successfully.")

        except Exception as exc:
            conn.rollback()
            print(f"ERROR: {type(exc).__name__}: {exc}", file=sys.stderr)

            if batch_id:
                try:
                    update_import_batch_failed(conn, batch_id, failed_status, exc)
                except Exception as fail_exc:
                    print(f"Could not update failed import batch: {fail_exc}", file=sys.stderr)

            raise


if __name__ == "__main__":
    main()