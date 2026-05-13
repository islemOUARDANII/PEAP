from __future__ import annotations

import hashlib
import json
import os
import pickle
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from rank_bm25 import BM25Okapi
from sqlalchemy import create_engine, text


GENERATOR_VERSION = "rtmc-bm25-builder-v1"


def normalize_text(value: str) -> str:
    value = value or ""
    value = value.lower().strip()
    value = unicodedata.normalize("NFKD", value)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = re.sub(r"[^a-z0-9+#.\s-]", " ", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def tokenize(value: str) -> list[str]:
    normalized = normalize_text(value)
    stopwords = {
        "de", "du", "des", "la", "le", "les", "un", "une",
        "et", "en", "a", "au", "aux", "the", "of", "for",
        "and", "with", "sur", "dans", "pour",
    }

    tokens = []
    for token in normalized.split():
        if len(token) < 2:
            continue
        if token in stopwords:
            continue
        tokens.append(token)

    return tokens


def get_output_dir() -> Path:
    raw = os.getenv("RTMC_BM25_INDEX_DIR", "./data/rtmc/bm25_indexes")
    output_dir = Path(raw)
    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir


def get_engine():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured")

    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+psycopg2://", 1)

    return create_engine(database_url, pool_pre_ping=True)


def fetch_entities(engine) -> list[dict[str, Any]]:
    query = text(
        """
        SELECT
            entity_type,
            code,
            label,
            label_up,
            occupation_code,
            occupation_label,
            parent_code,
            source_table
        FROM taxonomy.v_rtmc_mapper_entities
        WHERE label IS NOT NULL
          AND length(trim(label)) > 0
        ORDER BY entity_type, code
        """
    )

    with engine.connect() as conn:
        rows = conn.execute(query).mappings().all()

    return [dict(row) for row in rows]


def build_index(records: list[dict[str, Any]]) -> dict[str, Any]:
    documents = []
    tokenized_documents = []

    for record in records:
        text_parts = [
            record.get("label") or "",
            record.get("label_up") or "",
            record.get("occupation_label") or "",
            record.get("entity_type") or "",
        ]

        document_text = " ".join(part for part in text_parts if part)
        tokens = tokenize(document_text)

        documents.append(
            {
                **record,
                "document_text": document_text,
                "normalized_label": normalize_text(record.get("label") or ""),
            }
        )
        tokenized_documents.append(tokens)

    bm25 = BM25Okapi(tokenized_documents)

    return {
        "generator_version": GENERATOR_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "document_count": len(documents),
        "documents": documents,
        "tokenized_documents": tokenized_documents,
        "bm25": bm25,
    }


def write_pickle(path: Path, data: Any) -> str:
    with path.open("wb") as f:
        pickle.dump(data, f)

    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    return digest


def write_metadata(path: Path, metadata: dict[str, Any]) -> None:
    path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")


def insert_metadata(engine, *, index_name: str, output_path: str, checksum: str, source_counts: dict[str, int]) -> None:
    query = text(
        """
        UPDATE taxonomy.rtmc_index_metadata
        SET active = false
        WHERE index_name = :index_name
          AND active = true;

        INSERT INTO taxonomy.rtmc_index_metadata (
            index_name,
            index_type,
            taxonomy_name,
            source_tables,
            source_counts,
            output_path,
            checksum,
            generator_version,
            active
        )
        VALUES (
            :index_name,
            'BM25',
            'RTMC',
            :source_tables,
            :source_counts,
            :output_path,
            :checksum,
            :generator_version,
            true
        );
        """
    )

    with engine.begin() as conn:
        conn.execute(
            query,
            {
                "index_name": index_name,
                "source_tables": json.dumps(
                    [
                        "taxonomy.rtmc_metiers",
                        "taxonomy.rtmc_appellations",
                        "taxonomy.rtmc_savoir_competences",
                        "taxonomy.rtmc_savoir_faire_activites",
                    ]
                ),
                "source_counts": json.dumps(source_counts),
                "output_path": output_path,
                "checksum": checksum,
                "generator_version": GENERATOR_VERSION,
            },
        )


def main() -> None:
    load_dotenv()

    output_dir = get_output_dir()
    engine = get_engine()

    records = fetch_entities(engine)

    if not records:
        raise RuntimeError("No RTMC records found in taxonomy.v_rtmc_mapper_entities")

    source_counts: dict[str, int] = {}
    for record in records:
        entity_type = record["entity_type"]
        source_counts[entity_type] = source_counts.get(entity_type, 0) + 1

    all_index = build_index(records)

    occupation_records = [
        r for r in records if r["entity_type"] in {"occupation", "appellation"}
    ]
    skill_records = [
        r for r in records if r["entity_type"] in {"skill", "activity"}
    ]

    occupation_index = build_index(occupation_records)
    skill_index = build_index(skill_records)

    all_path = output_dir / "bm25_rtmc_all.pkl"
    occupation_path = output_dir / "bm25_rtmc_occupations.pkl"
    skill_path = output_dir / "bm25_rtmc_skills.pkl"
    metadata_path = output_dir / "metadata.json"

    all_checksum = write_pickle(all_path, all_index)
    occupation_checksum = write_pickle(occupation_path, occupation_index)
    skill_checksum = write_pickle(skill_path, skill_index)

    metadata = {
        "taxonomy": "RTMC",
        "generator_version": GENERATOR_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "PostgreSQL",
        "source_view": "taxonomy.v_rtmc_mapper_entities",
        "source_counts": source_counts,
        "indexes": {
            "all": {
                "path": str(all_path),
                "checksum": all_checksum,
                "document_count": all_index["document_count"],
            },
            "occupations": {
                "path": str(occupation_path),
                "checksum": occupation_checksum,
                "document_count": occupation_index["document_count"],
            },
            "skills": {
                "path": str(skill_path),
                "checksum": skill_checksum,
                "document_count": skill_index["document_count"],
            },
        },
    }

    write_metadata(metadata_path, metadata)

    insert_metadata(
        engine,
        index_name="bm25_rtmc_all",
        output_path=str(all_path),
        checksum=all_checksum,
        source_counts=source_counts,
    )

    insert_metadata(
        engine,
        index_name="bm25_rtmc_occupations",
        output_path=str(occupation_path),
        checksum=occupation_checksum,
        source_counts={
            "occupation": source_counts.get("occupation", 0),
            "appellation": source_counts.get("appellation", 0),
        },
    )

    insert_metadata(
        engine,
        index_name="bm25_rtmc_skills",
        output_path=str(skill_path),
        checksum=skill_checksum,
        source_counts={
            "skill": source_counts.get("skill", 0),
            "activity": source_counts.get("activity", 0),
        },
    )

    print("BM25 indexes generated successfully")
    print(json.dumps(metadata, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()