from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


logger = logging.getLogger(__name__)

_TABLE_CANDIDATES: list[tuple[str, str]] = [
    ("candidate", "mapped_cvs"),
    ("candidate", "parsed_cvs"),
    ("candidate", "mapped_cv"),
    ("candidate", "cv_profile"),
    ("candidate", "candidate_profile"),
    ("candidate", "cv"),
    ("public", "mapped_cvs"),
    ("public", "parsed_cvs"),
    ("public", "mapped_cv"),
    ("public", "cv_profile"),
]
_JSON_COLUMN_CANDIDATES = [
    "mapped_cv_json",
    "parsed_cv_json",
    "scoring_features_json",
    "mapped_cv",
    "mapped_data",
    "parsed_cv",
    "parsed_json",
    "data",
    "json_data",
]
_ID_COLUMN_CANDIDATES = ["id", "cv_id", "candidate_id"]


def _quote_identifier(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def _get_columns(session: Session, schema: str, table_name: str) -> set[str]:
    rows = session.execute(
        text(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = :schema
              AND table_name = :table_name
            ORDER BY ordinal_position
            """
        ),
        {"schema": schema, "table_name": table_name},
    ).fetchall()
    return {row.column_name for row in rows}


def _table_exists(session: Session, schema: str, table_name: str) -> bool:
    row = session.execute(
        text(
            """
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = :schema
              AND table_name = :table_name
            LIMIT 1
            """
        ),
        {"schema": schema, "table_name": table_name},
    ).first()
    return row is not None


def _deserialize_json_payload(raw_value: Any, source_name: str) -> dict[str, Any] | None:
    if raw_value is None:
        logger.warning("CV ignore depuis %s: colonne JSON vide.", source_name)
        return None
    if isinstance(raw_value, dict):
        return dict(raw_value)
    if isinstance(raw_value, str):
        try:
            data = json.loads(raw_value)
        except json.JSONDecodeError as exc:
            logger.error("JSON invalide dans %s: %s", source_name, exc)
            return None
        if isinstance(data, dict):
            return data
        logger.warning("CV ignore depuis %s: le JSON charge n'est pas un objet.", source_name)
        return None
    logger.warning("CV ignore depuis %s: type JSON non supporte (%s).", source_name, type(raw_value).__name__)
    return None


def _detect_db_source(session: Session) -> tuple[str, str, str, str | None, bool] | None:
    for schema, table_name in _TABLE_CANDIDATES:
        if not _table_exists(session, schema, table_name):
            continue
        columns = _get_columns(session, schema, table_name)
        json_column = next((column for column in _JSON_COLUMN_CANDIDATES if column in columns), None)
        if json_column is None:
            continue
        id_column = next((column for column in _ID_COLUMN_CANDIDATES if column in columns), None)
        has_active = "active" in columns
        return schema, table_name, json_column, id_column, has_active
    return None


def load_mapped_cvs_from_db(session: Session, limit: int | None = None) -> list[dict]:
    source = _detect_db_source(session)
    if source is None:
        logger.warning(
            "Aucune table de CV mappes trouvee. Utilisez --cvs-dir pour charger les CVs depuis des fichiers JSON."
        )
        return []

    schema, table_name, json_column, id_column, has_active = source
    source_name = f"{schema}.{table_name}"
    select_parts = [f"{_quote_identifier(json_column)} AS mapped_cv_payload"]
    if id_column:
        select_parts.append(f"{_quote_identifier(id_column)} AS external_cv_id")

    sql = [
        f"SELECT {', '.join(select_parts)}",
        f"FROM {_quote_identifier(schema)}.{_quote_identifier(table_name)}",
    ]
    if has_active:
        sql.append("WHERE active = TRUE")
    if id_column:
        sql.append(f"ORDER BY {_quote_identifier(id_column)} DESC")
    if limit is not None:
        sql.append("LIMIT :limit")

    params = {"limit": limit} if limit is not None else {}
    rows = session.execute(text("\n".join(sql)), params).mappings().all()

    mapped_cvs: list[dict[str, Any]] = []
    for row in rows:
        payload = _deserialize_json_payload(row.get("mapped_cv_payload"), source_name)
        if payload is None:
            continue
        external_cv_id = row.get("external_cv_id")
        if external_cv_id not in (None, ""):
            payload.setdefault("cv_id", str(external_cv_id))
        payload["source_table"] = source_name
        mapped_cvs.append(payload)
    return mapped_cvs


def load_mapped_cvs_from_folder(cvs_dir: str) -> list[dict]:
    directory = Path(cvs_dir)
    if not directory.exists():
        raise FileNotFoundError(f"Dossier de CVs introuvable: {directory}")
    if not directory.is_dir():
        raise NotADirectoryError(f"Le chemin fourni n'est pas un dossier: {directory}")

    mapped_cvs: list[dict[str, Any]] = []
    for json_path in sorted(directory.glob("*.json")):
        try:
            with open(json_path, "r", encoding="utf-8") as handle:
                data = json.load(handle)
        except json.JSONDecodeError as exc:
            logger.error("JSON invalide ignore dans %s: %s", json_path, exc)
            continue
        if not isinstance(data, dict):
            logger.warning("Fichier ignore dans %s: le contenu n'est pas un objet JSON.", json_path)
            continue
        data["source_file"] = str(json_path)
        mapped_cvs.append(data)
    return mapped_cvs
