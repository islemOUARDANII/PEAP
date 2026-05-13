import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any

import pandas as pd
import psycopg2
from psycopg2.extras import Json, execute_values


def normalize_text(value: Any) -> str:
    if value is None or pd.isna(value):
        return ""
    value = str(value).strip().lower()
    value = re.sub(r"\s+", " ", value)
    return value


def clean_text(value: Any) -> str | None:
    if value is None or pd.isna(value):
        return None
    value = str(value).strip()
    return value if value else None


def clean_bool(value: Any) -> bool:
    if value is None or pd.isna(value):
        return True

    if isinstance(value, bool):
        return value

    text = str(value).strip().lower()
    if text in {"1", "true", "vrai", "yes", "y", "oui", "actif"}:
        return True
    if text in {"0", "false", "faux", "no", "n", "non", "inactif"}:
        return False

    return True


def checksum_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def row_to_payload(row: pd.Series) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    for key, value in row.items():
        if value is None or pd.isna(value):
            payload[str(key)] = None
        elif hasattr(value, "isoformat"):
            payload[str(key)] = value.isoformat()
        else:
            payload[str(key)] = value
    return payload


class RTMCImporter:
    def __init__(self, database_url: str, excel_path: Path, version: str) -> None:
        self.database_url = database_url
        self.excel_path = excel_path
        self.version = version
        self.conn = psycopg2.connect(database_url)
        self.conn.autocommit = False

        self.model_id: str | None = None
        self.import_batch_id: str | None = None
        self.source_file_id: str | None = None

        self.node_by_key: dict[tuple[str, str], str] = {}

    def run(self) -> None:
        try:
            self._ensure_model()
            self._create_import_batch()
            self._register_source_file()
            self._load_raw_records()

            self._import_sectors_and_occupations()
            self._import_appellations_as_aliases()
            self._import_activities()
            self._import_skills()
            self._import_work_contexts()
            self._import_mobilities()
            self._import_soft_skills()

            self._mark_success()
            self.conn.commit()
            print("[OK] RTMC import completed successfully.")
            self._print_summary()

        except Exception as exc:
            self.conn.rollback()
            print(f"[ERROR] RTMC import failed: {exc}", file=sys.stderr)
            raise
        finally:
            self.conn.close()

    def _read_sheet(self, sheet_name: str) -> pd.DataFrame:
        return pd.read_excel(self.excel_path, sheet_name=sheet_name)

    def _ensure_model(self) -> None:
        with self.conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO taxonomy.taxonomy_model (
                    code,
                    label,
                    version,
                    source,
                    is_active,
                    is_default,
                    imported_at,
                    metadata_json
                )
                VALUES (
                    'RTMC',
                    'Référentiel Tunisien des Métiers et Compétences',
                    %s,
                    'ANETI / RTMC',
                    TRUE,
                    FALSE,
                    now(),
                    %s
                )
                ON CONFLICT (code, version) DO UPDATE
                SET
                    label = EXCLUDED.label,
                    source = EXCLUDED.source,
                    is_active = TRUE,
                    imported_at = now(),
                    metadata_json = taxonomy.taxonomy_model.metadata_json || EXCLUDED.metadata_json,
                    updated_at = now()
                RETURNING id;
                """,
                (
                    self.version,
                    Json(
                        {
                            "source_file": self.excel_path.name,
                            "format": "xlsx",
                            "status": "IMPORTED",
                        }
                    ),
                ),
            )
            self.model_id = str(cur.fetchone()[0])

    def _create_import_batch(self) -> None:
        assert self.model_id

        with self.conn.cursor() as cur:
            cur.execute(
                """
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
                    'RTMC',
                    %s,
                    %s,
                    'STARTED',
                    %s
                )
                RETURNING id;
                """,
                (
                    self.model_id,
                    self.excel_path.name,
                    checksum_file(self.excel_path),
                    Json({"version": self.version}),
                ),
            )
            self.import_batch_id = str(cur.fetchone()[0])

    def _register_source_file(self) -> None:
        checksum = checksum_file(self.excel_path)

        with self.conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO taxonomy_raw.source_file (
                    source_code,
                    source_version,
                    file_name,
                    file_type,
                    file_path,
                    file_checksum,
                    metadata_json
                )
                VALUES (
                    'RTMC',
                    %s,
                    %s,
                    'xlsx',
                    %s,
                    %s,
                    %s
                )
                ON CONFLICT (
                    source_code,
                    source_version,
                    file_name,
                    file_checksum
                ) DO UPDATE
                SET imported_at = now()
                RETURNING id;
                """,
                (
                    self.version,
                    self.excel_path.name,
                    str(self.excel_path),
                    checksum,
                    Json({"import_batch_id": self.import_batch_id}),
                ),
            )
            self.source_file_id = str(cur.fetchone()[0])

    def _load_raw_records(self) -> None:
        assert self.source_file_id

        sheet_names = [
            "Métiers",
            "Appellations",
            "Savoir faire (activités)",
            "Savoir (compétences)",
            "Environnements",
            "Mobilites",
            "Savoir être",
        ]

        with self.conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM taxonomy_raw.source_record
                WHERE source_code = 'RTMC'
                  AND source_version = %s;
                """,
                (self.version,),
            )

            total = 0

            for sheet_name in sheet_names:
                df = self._read_sheet(sheet_name)
                records = []

                for index, row in df.iterrows():
                    payload = row_to_payload(row)
                    external_key = (
                        clean_text(payload.get("code metier"))
                        or clean_text(payload.get("code appellation"))
                        or clean_text(payload.get("code activite"))
                        or clean_text(payload.get("code competence"))
                        or clean_text(payload.get("code savoir etre"))
                        or clean_text(payload.get("id"))
                    )

                    records.append(
                        (
                            self.source_file_id,
                            "RTMC",
                            self.version,
                            sheet_name,
                            external_key,
                            int(index) + 2,
                            Json(payload),
                            Json({}),
                            "PENDING",
                        )
                    )

                if records:
                    execute_values(
                        cur,
                        """
                        INSERT INTO taxonomy_raw.source_record (
                            source_file_id,
                            source_code,
                            source_version,
                            source_table,
                            external_key,
                            row_number,
                            raw_payload,
                            normalized_payload,
                            import_status
                        )
                        VALUES %s;
                        """,
                        records,
                    )

                total += len(records)

            print(f"[OK] Raw RTMC records inserted: {total}")

    def _upsert_node(
        self,
        *,
        external_code: str,
        node_type: str,
        preferred_label: str,
        description: str | None = None,
        language_code: str = "fr",
        parent_id: str | None = None,
        active: bool = True,
        metadata: dict[str, Any] | None = None,
    ) -> str:
        assert self.model_id
        assert self.import_batch_id

        external_code = str(external_code)
        normalized_label = normalize_text(preferred_label)

        with self.conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO taxonomy.taxonomy_node (
                    model_id,
                    import_batch_id,
                    external_code,
                    node_type,
                    preferred_label,
                    normalized_label,
                    description,
                    language_code,
                    parent_id,
                    active,
                    deprecated,
                    metadata_json
                )
                VALUES (
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    FALSE,
                    %s
                )
                ON CONFLICT (model_id, external_code) DO UPDATE
                SET
                    import_batch_id = EXCLUDED.import_batch_id,
                    node_type = EXCLUDED.node_type,
                    preferred_label = EXCLUDED.preferred_label,
                    normalized_label = EXCLUDED.normalized_label,
                    description = EXCLUDED.description,
                    language_code = EXCLUDED.language_code,
                    parent_id = EXCLUDED.parent_id,
                    active = EXCLUDED.active,
                    deprecated = FALSE,
                    metadata_json = taxonomy.taxonomy_node.metadata_json || EXCLUDED.metadata_json,
                    updated_at = now()
                RETURNING id;
                """,
                (
                    self.model_id,
                    self.import_batch_id,
                    external_code,
                    node_type,
                    preferred_label,
                    normalized_label,
                    description,
                    language_code,
                    parent_id,
                    active,
                    Json(metadata or {}),
                ),
            )
            node_id = str(cur.fetchone()[0])

        self.node_by_key[(node_type, external_code)] = node_id
        return node_id

    def _upsert_alias(
        self,
        *,
        node_id: str,
        alias: str,
        source: str,
        language_code: str = "fr",
        confidence: float = 1.0,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        assert self.import_batch_id

        alias = str(alias).strip()
        if not alias:
            return

        with self.conn.cursor() as cur:
            cur.execute(
                """
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
                    %s,
                    %s,
                    %s,
                    taxonomy.normalize_text(%s),
                    %s,
                    %s,
                    %s,
                    TRUE,
                    %s
                )
                ON CONFLICT (node_id, normalized_alias) DO UPDATE
                SET
                    import_batch_id = EXCLUDED.import_batch_id,
                    alias = EXCLUDED.alias,
                    source = EXCLUDED.source,
                    confidence = EXCLUDED.confidence,
                    active = TRUE,
                    metadata_json = taxonomy.taxonomy_alias.metadata_json || EXCLUDED.metadata_json;
                """,
                (
                    node_id,
                    self.import_batch_id,
                    alias,
                    alias,
                    language_code,
                    source,
                    confidence,
                    Json(metadata or {}),
                ),
            )

    def _upsert_relation(
        self,
        *,
        source_node_id: str,
        target_node_id: str,
        relation_type: str,
        weight: float = 1.0,
        confidence: float = 1.0,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        assert self.model_id
        assert self.import_batch_id

        if source_node_id == target_node_id:
            return

        with self.conn.cursor() as cur:
            cur.execute(
                """
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
                VALUES (
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    TRUE,
                    %s
                )
                ON CONFLICT (
                    model_id,
                    source_node_id,
                    target_node_id,
                    relation_type
                ) DO UPDATE
                SET
                    import_batch_id = EXCLUDED.import_batch_id,
                    weight = EXCLUDED.weight,
                    confidence = EXCLUDED.confidence,
                    active = TRUE,
                    metadata_json = taxonomy.taxonomy_relation.metadata_json || EXCLUDED.metadata_json;
                """,
                (
                    self.model_id,
                    self.import_batch_id,
                    source_node_id,
                    target_node_id,
                    relation_type,
                    weight,
                    confidence,
                    Json(metadata or {}),
                ),
            )

    def _import_sectors_and_occupations(self) -> None:
        df = self._read_sheet("Métiers")

        count = 0

        for _, row in df.iterrows():
            code_metier = clean_text(row.get("code metier"))
            label_metier = clean_text(row.get("libelle metier"))
            if not code_metier or not label_metier:
                continue

            grand_code = clean_text(row.get("code grand domaine professionnel"))
            grand_label = clean_text(row.get("libelle grand domaine professionnel"))
            domain_code = clean_text(row.get("code domaine professionnel"))
            domain_label = clean_text(row.get("libelle domaine professionnel"))
            active = clean_bool(row.get("actif"))

            grand_node_id = None
            if grand_code and grand_label:
                grand_node_id = self._upsert_node(
                    external_code=f"RTMC-SECTOR-GRAND-{grand_code}",
                    node_type="SECTOR",
                    preferred_label=grand_label,
                    active=True,
                    metadata={
                        "rtmc_level": "grand_domaine_professionnel",
                        "rtmc_code": grand_code,
                    },
                )

            domain_node_id = None
            if domain_code and domain_label:
                domain_node_id = self._upsert_node(
                    external_code=f"RTMC-SECTOR-DOMAIN-{domain_code}",
                    node_type="SECTOR",
                    preferred_label=domain_label,
                    parent_id=grand_node_id,
                    active=True,
                    metadata={
                        "rtmc_level": "domaine_professionnel",
                        "rtmc_code": domain_code,
                        "grand_domain_code": grand_code,
                    },
                )

            occupation_node_id = self._upsert_node(
                external_code=f"RTMC-OCC-{code_metier}",
                node_type="OCCUPATION",
                preferred_label=label_metier,
                parent_id=domain_node_id,
                active=active,
                metadata={
                    "rtmc_id": clean_text(row.get("id")),
                    "code_metier": code_metier,
                    "libelle_up_metier": clean_text(row.get("libelle_up metier")),
                    "grand_domain_code": grand_code,
                    "domain_code": domain_code,
                },
            )

            self.node_by_key[("OCCUPATION_CODE", code_metier)] = occupation_node_id

            count += 1

        print(f"[OK] RTMC occupations imported: {count}")

    def _import_appellations_as_aliases(self) -> None:
        df = self._read_sheet("Appellations")
        count = 0

        for _, row in df.iterrows():
            code_metier = clean_text(row.get("code metier"))
            label = clean_text(row.get("libelle appellation"))
            code_appellation = clean_text(row.get("code appellation"))

            if not code_metier or not label:
                continue

            occupation_node_id = self.node_by_key.get(("OCCUPATION_CODE", code_metier))
            if not occupation_node_id:
                continue

            self._upsert_alias(
                node_id=occupation_node_id,
                alias=label,
                source="RTMC_APPELLATION",
                confidence=1.0,
                metadata={
                    "code_appellation": code_appellation,
                    "libelle_up_appellation": clean_text(row.get("libelle_up appellation")),
                    "active": clean_bool(row.get("actif")),
                },
            )
            count += 1

        print(f"[OK] RTMC appellations imported as aliases: {count}")

    def _import_activities(self) -> None:
        df = self._read_sheet("Savoir faire (activités)")
        count_nodes = 0
        count_relations = 0

        for _, row in df.iterrows():
            code_metier = clean_text(row.get("code metier"))
            code_activite = clean_text(row.get("code activite"))
            label = clean_text(row.get("libelle activite"))

            if not code_metier or not code_activite or not label:
                continue

            occupation_node_id = self.node_by_key.get(("OCCUPATION_CODE", code_metier))
            if not occupation_node_id:
                continue

            task_node_id = self._upsert_node(
                external_code=f"RTMC-TASK-{code_activite}",
                node_type="TASK",
                preferred_label=label,
                active=clean_bool(row.get("actif")),
                metadata={
                    "code_activite": code_activite,
                    "code_metier": code_metier,
                    "libelle_up_activite": clean_text(row.get("libelle_up activite")),
                    "rtmc_type": clean_text(row.get("type")),
                },
            )

            self._upsert_relation(
                source_node_id=occupation_node_id,
                target_node_id=task_node_id,
                relation_type="HAS_TASK",
                weight=1.0,
                confidence=1.0,
                metadata={
                    "source_sheet": "Savoir faire (activités)",
                    "rtmc_type": clean_text(row.get("type")),
                },
            )

            count_nodes += 1
            count_relations += 1

        print(f"[OK] RTMC activities imported: nodes={count_nodes}, relations={count_relations}")

    def _import_skills(self) -> None:
        df = self._read_sheet("Savoir (compétences)")
        count_nodes = 0
        count_relations = 0

        for _, row in df.iterrows():
            code_metier = clean_text(row.get("code metier"))
            code_competence = clean_text(row.get("code competence"))
            label = clean_text(row.get("libelle competence"))

            if not code_metier or not code_competence or not label:
                continue

            occupation_node_id = self.node_by_key.get(("OCCUPATION_CODE", code_metier))
            if not occupation_node_id:
                continue

            skill_node_id = self._upsert_node(
                external_code=f"RTMC-SKILL-{code_competence}",
                node_type="SKILL",
                preferred_label=label,
                active=clean_bool(row.get("actif")),
                metadata={
                    "code_competence": code_competence,
                    "code_metier": code_metier,
                    "libelle_up_competence": clean_text(row.get("libelle_up competence")),
                    "rtmc_type": clean_text(row.get("type")),
                },
            )

            self._upsert_relation(
                source_node_id=occupation_node_id,
                target_node_id=skill_node_id,
                relation_type="REQUIRES_SKILL",
                weight=1.0,
                confidence=1.0,
                metadata={
                    "source_sheet": "Savoir (compétences)",
                    "rtmc_type": clean_text(row.get("type")),
                },
            )

            count_nodes += 1
            count_relations += 1

        print(f"[OK] RTMC skills imported: nodes={count_nodes}, relations={count_relations}")

    def _import_work_contexts(self) -> None:
        df = self._read_sheet("Environnements")
        count_nodes = 0
        count_relations = 0

        for _, row in df.iterrows():
            code_metier = clean_text(row.get("metier"))
            environnement_code = clean_text(row.get("environnement"))
            label = clean_text(row.get("libelle"))

            if not code_metier or not environnement_code or not label:
                continue

            occupation_node_id = self.node_by_key.get(("OCCUPATION_CODE", code_metier))
            if not occupation_node_id:
                continue

            context_node_id = self._upsert_node(
                external_code=f"RTMC-WORK-CONTEXT-{environnement_code}",
                node_type="WORK_CONTEXT",
                preferred_label=label,
                active=clean_bool(row.get("actif")),
                metadata={
                    "environnement_code": environnement_code,
                    "code_metier": code_metier,
                    "libelle_up": clean_text(row.get("libelle_up")),
                    "rtmc_type": clean_text(row.get("type")),
                },
            )

            self._upsert_relation(
                source_node_id=occupation_node_id,
                target_node_id=context_node_id,
                relation_type="RELATED_TO",
                weight=1.0,
                confidence=1.0,
                metadata={
                    "source_sheet": "Environnements",
                    "rtmc_type": clean_text(row.get("type")),
                },
            )

            count_nodes += 1
            count_relations += 1

        print(f"[OK] RTMC work contexts imported: nodes={count_nodes}, relations={count_relations}")

    def _import_mobilities(self) -> None:
        df = self._read_sheet("Mobilites")
        count = 0

        for _, row in df.iterrows():
            code_metier = clean_text(row.get("code metier"))
            target_code = clean_text(row.get("code metier mobilté professionnelle"))

            if not code_metier or not target_code:
                continue

            source_occupation_id = self.node_by_key.get(("OCCUPATION_CODE", code_metier))
            target_occupation_id = self.node_by_key.get(("OCCUPATION_CODE", target_code))

            if not source_occupation_id or not target_occupation_id:
                continue

            self._upsert_relation(
                source_node_id=source_occupation_id,
                target_node_id=target_occupation_id,
                relation_type="MOBILITY_TO",
                weight=1.0,
                confidence=1.0,
                metadata={
                    "source_sheet": "Mobilites",
                    "rtmc_type": clean_text(row.get("type")),
                    "used": clean_text(row.get("used")),
                },
            )
            count += 1

        print(f"[OK] RTMC mobilities imported: relations={count}")

    def _import_soft_skills(self) -> None:
        df = self._read_sheet("Savoir être")
        count = 0

        for _, row in df.iterrows():
            code = clean_text(row.get("code savoir etre"))
            label = clean_text(row.get("libelle savoir etre"))

            if not code or not label:
                continue

            self._upsert_node(
                external_code=f"RTMC-SOFT-SKILL-{code}",
                node_type="SOFT_SKILL",
                preferred_label=label,
                active=clean_bool(row.get("actif")),
                metadata={
                    "code_savoir_etre": code,
                    "libelle_up_etre": clean_text(row.get("libelle_up etre")),
                },
            )
            count += 1

        print(f"[OK] RTMC soft skills imported: {count}")

    def _mark_success(self) -> None:
        assert self.import_batch_id

        with self.conn.cursor() as cur:
            cur.execute(
                """
                WITH counts AS (
                    SELECT
                        (SELECT COUNT(*) FROM taxonomy.taxonomy_node WHERE import_batch_id = %s) AS nodes_count,
                        (SELECT COUNT(*) FROM taxonomy.taxonomy_alias WHERE import_batch_id = %s) AS aliases_count,
                        (SELECT COUNT(*) FROM taxonomy.taxonomy_relation WHERE import_batch_id = %s) AS relations_count,
                        (SELECT COUNT(*) FROM taxonomy.taxonomy_crosswalk WHERE import_batch_id = %s) AS crosswalks_count
                )
                UPDATE taxonomy.taxonomy_import_batch b
                SET
                    import_status = 'SUCCESS',
                    finished_at = now(),
                    imported_nodes_count = counts.nodes_count,
                    imported_aliases_count = counts.aliases_count,
                    imported_relations_count = counts.relations_count,
                    imported_crosswalks_count = counts.crosswalks_count
                FROM counts
                WHERE b.id = %s;
                """,
                (
                    self.import_batch_id,
                    self.import_batch_id,
                    self.import_batch_id,
                    self.import_batch_id,
                    self.import_batch_id,
                ),
            )

            cur.execute(
                """
                UPDATE taxonomy_raw.source_record
                SET
                    import_status = 'PROCESSED',
                    processed_at = now()
                WHERE source_code = 'RTMC'
                  AND source_version = %s
                  AND import_status = 'PENDING';
                """,
                (self.version,),
            )

    def _print_summary(self) -> None:
        with self.conn.cursor() as cur:
            cur.execute(
                """
                SELECT node_type, COUNT(*)
                FROM taxonomy.taxonomy_node n
                JOIN taxonomy.taxonomy_model m ON m.id = n.model_id
                WHERE m.code = 'RTMC'
                  AND m.version = %s
                GROUP BY node_type
                ORDER BY node_type;
                """,
                (self.version,),
            )

            print("\nSummary taxonomy nodes:")
            for row in cur.fetchall():
                print(f"  {row[0]}: {row[1]}")

            cur.execute(
                """
                SELECT relation_type, COUNT(*)
                FROM taxonomy.taxonomy_relation r
                JOIN taxonomy.taxonomy_model m ON m.id = r.model_id
                WHERE m.code = 'RTMC'
                  AND m.version = %s
                GROUP BY relation_type
                ORDER BY relation_type;
                """,
                (self.version,),
            )

            print("\nSummary taxonomy relations:")
            for row in cur.fetchall():
                print(f"  {row[0]}: {row[1]}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--database-url", required=True)
    parser.add_argument("--file", required=True)
    parser.add_argument("--version", default="2.0")
    args = parser.parse_args()

    excel_path = Path(args.file)
    if not excel_path.exists():
        raise FileNotFoundError(excel_path)

    importer = RTMCImporter(
        database_url=args.database_url,
        excel_path=excel_path,
        version=args.version,
    )
    importer.run()


if __name__ == "__main__":
    main()