from collections.abc import Mapping
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session
import json

def _fetch_one(db: Session, query: str, params: dict | None = None) -> dict | None:
    row = db.execute(text(query), params or {}).mappings().first()
    return dict(row) if row else None


def _fetch_all(db: Session, query: str, params: dict | None = None) -> list[dict]:
    rows = db.execute(text(query), params or {}).mappings().all()
    return [dict(row) for row in rows]


def _get_job_seeker_cv_columns(db: Session) -> set[str]:
    rows = db.execute(
        text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'aneti'
              AND table_name = 'job_seeker_cv'
        """)
    ).scalars().all()

    return set(rows)


def _cv_col(
    existing_columns: set[str],
    alias: str,
    candidates: list[str],
    default_sql: str,
    cast_text: bool = False,
) -> str:
    for col in candidates:
        if col in existing_columns:
            expr = f"cv.{col}"
            if cast_text:
                expr += "::text"
            return f"{expr} AS {alias}"

    return f"{default_sql} AS {alias}"

def list_cvs(db: Session, job_seeker_id: str) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            cv.id::text AS id,
            cv.id::text AS cv_id,

            -- Champs legacy attendus par le schema/front.
            -- La table actuelle ne les possède plus, donc on retourne des valeurs sûres.
            ''::text AS storage_provider,
            ''::text AS container_name,
            ''::text AS blob_name,
            ''::text AS storage_key,
            NULL::text AS blob_url,

            'CV'::text AS original_filename,
            'application/octet-stream'::text AS mime_type,
            NULL::bigint AS file_size_bytes,

            COALESCE(cv.status, 'UPLOADED') AS status,
            COALESCE(cv.is_current, false) AS is_current,
            cv.parsed_resume_id::text AS parsed_resume_id,
            COALESCE(cv.parsing_status, 'PENDING') AS parsing_status,

            NULL::text AS uploaded_by_user_id,
            cv.created_at AS uploaded_at,
            cv.created_at,
            cv.updated_at
        FROM aneti.job_seeker_cv cv
        WHERE cv.job_seeker_id = CAST(:job_seeker_id AS uuid)
        ORDER BY cv.created_at DESC;
        """,
        {"job_seeker_id": job_seeker_id},
    )


def get_cv_by_id(db: Session, job_seeker_id: str, cv_record_id: str) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            cv.id::text AS id,
            COALESCE(df.metadata_json->>'cv_id', cv.id::text) AS cv_id,

            df.storage_provider,
            df.container_name,
            df.blob_name,
            df.storage_key,
            df.metadata_json->>'blob_url' AS blob_url,
            df.original_filename,
            df.mime_type,
            df.file_size_bytes,

            cv.status,
            cv.is_current,
            cv.parsed_resume_id::text AS parsed_resume_id,
            cv.parsing_status,

            df.uploaded_by_user_id::text AS uploaded_by_user_id,
            df.uploaded_at,
            cv.created_at,
            cv.updated_at

        FROM aneti.job_seeker_cv cv
        LEFT JOIN aneti.document_file df
            ON df.id = cv.document_file_id
        WHERE cv.job_seeker_id = CAST(:job_seeker_id AS uuid)
          AND cv.id = CAST(:cv_record_id AS uuid)
        LIMIT 1;
        """,
        {
            "job_seeker_id": job_seeker_id,
            "cv_record_id": cv_record_id,
        },
    )


def get_current_cv(db: Session, job_seeker_id: str) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            cv.id::text AS id,
            COALESCE(df.metadata_json->>'cv_id', cv.id::text) AS cv_id,

            df.storage_provider,
            df.container_name,
            df.blob_name,
            df.storage_key,
            df.metadata_json->>'blob_url' AS blob_url,
            df.original_filename,
            df.mime_type,
            df.file_size_bytes,

            cv.status,
            cv.is_current,
            cv.parsed_resume_id::text AS parsed_resume_id,
            cv.parsing_status,

            df.uploaded_by_user_id::text AS uploaded_by_user_id,
            df.uploaded_at,
            cv.created_at,
            cv.updated_at

        FROM aneti.job_seeker_cv cv
        LEFT JOIN aneti.document_file df
            ON df.id = cv.document_file_id
        WHERE cv.job_seeker_id = CAST(:job_seeker_id AS uuid)
          AND cv.is_current = TRUE
          AND cv.status <> 'ARCHIVED'
        ORDER BY cv.created_at DESC
        LIMIT 1;
        """,
        {"job_seeker_id": job_seeker_id},
    )


def clear_current_flag(db: Session, job_seeker_id: str) -> None:
    db.execute(
        text("""
        UPDATE aneti.job_seeker_cv
        SET is_current = FALSE
        WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)
          AND is_current = TRUE;
        """),
        {"job_seeker_id": job_seeker_id},
    )


def create_cv_record(db: Session, payload: Mapping[str, object]) -> dict:
    return _fetch_one(
        db,
        """
        INSERT INTO aneti.job_seeker_cv (
            job_seeker_id,
            document_file_id,
            status,
            is_current,
            parsing_status
        )
        VALUES (
            CAST(:job_seeker_id AS uuid),
            CAST(:document_file_id AS uuid),
            :status,
            :is_current,
            :parsing_status
        )
        RETURNING id::text AS id;
        """,
        dict(payload),
    )

def archive_cv(db: Session, job_seeker_id: str, cv_record_id: str) -> dict | None:
    return _fetch_one(
        db,
        """
        UPDATE aneti.job_seeker_cv
        SET
            status = 'ARCHIVED',
            is_current = FALSE
        WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)
          AND id = CAST(:cv_record_id AS uuid)
        RETURNING id::text AS id;
        """,
        {
            "job_seeker_id": job_seeker_id,
            "cv_record_id": cv_record_id,
        },
    )


def update_parsing_status(
    db: Session,
    job_seeker_id: str,
    cv_record_id: str,
    parsing_status: str,
) -> dict | None:
    return _fetch_one(
        db,
        """
        UPDATE aneti.job_seeker_cv
        SET parsing_status = :parsing_status
        WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)
          AND id = CAST(:cv_record_id AS uuid)
        RETURNING id::text AS id, parsing_status;
        """,
        {
            "job_seeker_id": job_seeker_id,
            "cv_record_id": cv_record_id,
            "parsing_status": parsing_status,
        },
    )

def _json_param(value) -> str:
    return json.dumps(value if value is not None else {}, ensure_ascii=False)


def create_document_file(db: Session, payload: Mapping[str, object]) -> dict:
    return _fetch_one(
        db,
        """
        INSERT INTO aneti.document_file (
            owner_type,
            owner_id,
            storage_provider,
            container_name,
            blob_name,
            storage_key,
            original_filename,
            mime_type,
            file_size_bytes,
            status,
            uploaded_by_user_id,
            metadata_json
        )
        VALUES (
            :owner_type,
            CAST(:owner_id AS uuid),
            :storage_provider,
            :container_name,
            :blob_name,
            :storage_key,
            :original_filename,
            :mime_type,
            :file_size_bytes,
            :status,
            CAST(:uploaded_by_user_id AS uuid),
            CAST(:metadata_json AS jsonb)
        )
        RETURNING id::text AS id;
        """,
        dict(payload),
    )


def _json_array_param(value) -> str:
    return json.dumps(value if value is not None else [], ensure_ascii=False)


def create_parsed_resume_snapshot(
    db: Session,
    *,
    job_seeker_id: str,
    cv_record_id: str,
    parsing_status: str,
    parser_name: str | None,
    parser_version: str | None,
    parsed_payload: dict | None,
    mapped_payload: dict | None,
    extracted_profile_patch: dict | None,
    warnings: list | None,
    errors: list | None,
    created_by_user_id: str | None = None,
) -> dict | None:
    return _fetch_one(
        db,
        """
        INSERT INTO aneti.parsed_resume_snapshot (
            job_seeker_id,
            cv_record_id,
            parsing_status,
            parser_name,
            parser_version,
            source,
            parsed_payload,
            mapped_payload,
            extracted_profile_patch,
            warnings,
            errors,
            created_by_user_id
        )
        VALUES (
            CAST(:job_seeker_id AS uuid),
            CAST(:cv_record_id AS uuid),
            :parsing_status,
            :parser_name,
            :parser_version,
            'parsing-service',
            CAST(:parsed_payload AS jsonb),
            CAST(:mapped_payload AS jsonb),
            CAST(:extracted_profile_patch AS jsonb),
            CAST(:warnings AS jsonb),
            CAST(:errors AS jsonb),
            CASE
                WHEN :created_by_user_id IS NULL THEN NULL
                ELSE CAST(:created_by_user_id AS uuid)
            END
        )
        RETURNING id::text AS id;
        """,
        {
            "job_seeker_id": job_seeker_id,
            "cv_record_id": cv_record_id,
            "parsing_status": parsing_status,
            "parser_name": parser_name,
            "parser_version": parser_version,
            "parsed_payload": _json_param(parsed_payload),
            "mapped_payload": _json_param(mapped_payload),
            "extracted_profile_patch": _json_param(extracted_profile_patch),
            "warnings": _json_array_param(warnings),
            "errors": _json_array_param(errors),
            "created_by_user_id": created_by_user_id,
        },
    )


def attach_parsed_resume_snapshot(
    db: Session,
    *,
    cv_record_id: str,
    parsed_resume_id: str | None,
    parsing_status: str,
) -> dict | None:
    return _fetch_one(
        db,
        """
        UPDATE aneti.job_seeker_cv
        SET
            parsed_resume_id = CASE
                WHEN :parsed_resume_id IS NULL THEN parsed_resume_id
                ELSE CAST(:parsed_resume_id AS uuid)
            END,
            parsing_status = :parsing_status,
            updated_at = now()
        WHERE id = CAST(:cv_record_id AS uuid)
        RETURNING
            id::text AS id,
            parsed_resume_id::text AS parsed_resume_id,
            parsing_status;
        """,
        {
            "cv_record_id": cv_record_id,
            "parsed_resume_id": parsed_resume_id,
            "parsing_status": parsing_status,
        },
    )


def get_parsed_resume_snapshot_by_cv(
    db: Session,
    *,
    job_seeker_id: str,
    cv_record_id: str,
) -> dict | None:
    return _fetch_one(
        db,
        """
        SELECT
            prs.id::text AS id,
            prs.job_seeker_id::text AS job_seeker_id,
            prs.cv_record_id::text AS cv_record_id,
            prs.parsing_status,
            prs.parser_name,
            prs.parser_version,
            prs.source,
            prs.parsed_payload,
            prs.mapped_payload,
            prs.extracted_profile_patch,
            prs.warnings,
            prs.errors,
            prs.created_by_user_id::text AS created_by_user_id,
            prs.created_at
        FROM aneti.parsed_resume_snapshot prs
        WHERE prs.job_seeker_id = CAST(:job_seeker_id AS uuid)
          AND prs.cv_record_id = CAST(:cv_record_id AS uuid)
        ORDER BY prs.created_at DESC
        LIMIT 1;
        """,
        {
            "job_seeker_id": job_seeker_id,
            "cv_record_id": cv_record_id,
        },
    )


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _clean_text(value: Any) -> str | None:
    if value is None:
        return None
    text_value = str(value).strip()
    return text_value or None


def _first_present(*values: Any) -> Any:
    for value in values:
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        if isinstance(value, (list, dict)) and not value:
            continue
        return value
    return None


def _maybe_apply_value(current_value: Any, new_value: Any, *, replace: bool) -> dict[str, Any]:
    current_clean = _clean_text(current_value)
    new_clean = _clean_text(new_value)

    if not new_clean:
        return {
            "current": current_value,
            "proposed": new_value,
            "action": "SKIP_EMPTY_SOURCE",
            "will_update": False,
        }

    if replace or not current_clean:
        return {
            "current": current_value,
            "proposed": new_value,
            "action": "UPDATE" if current_clean != new_clean else "NO_CHANGE",
            "will_update": current_clean != new_clean,
        }

    return {
        "current": current_value,
        "proposed": new_value,
        "action": "KEEP_EXISTING",
        "will_update": False,
    }


def _extract_patch(snapshot: Mapping[str, Any]) -> dict[str, Any]:
    return _as_dict(snapshot.get("extracted_profile_patch"))


def _extract_parsed_payload(snapshot: Mapping[str, Any]) -> dict[str, Any]:
    return _as_dict(snapshot.get("parsed_payload"))


def _extract_mapped_payload(snapshot: Mapping[str, Any]) -> dict[str, Any]:
    return _as_dict(snapshot.get("mapped_payload"))


def _extract_personal_info(parsed_payload: Mapping[str, Any]) -> dict[str, Any]:
    cv_data = _as_dict(parsed_payload.get("cv_data"))
    raw_json = _as_dict(parsed_payload.get("raw_json"))
    return _as_dict(cv_data.get("personal_info") or raw_json.get("personal_info"))


def _extract_candidate_location(snapshot: Mapping[str, Any]) -> dict[str, Any]:
    parsed_payload = _extract_parsed_payload(snapshot)
    enrichment = _as_dict(parsed_payload.get("enrichment"))
    location = _as_dict(enrichment.get("candidate_location"))

    if location:
        return location

    personal = _extract_personal_info(parsed_payload)
    raw_location = personal.get("location") or personal.get("address")
    return {"raw_location": raw_location, "status": "NOT_NORMALIZED"} if raw_location else {}


def _extract_language_label(entry: Any) -> str | None:
    if isinstance(entry, str):
        return _clean_text(entry)
    if not isinstance(entry, dict):
        return None
    return _clean_text(
        _first_present(
            entry.get("language"),
            entry.get("name"),
            entry.get("label"),
            entry.get("value"),
            entry.get("language_label"),
            entry.get("raw_label"),
        )
    )


def _extract_language_level(entry: Any) -> str | None:
    if not isinstance(entry, dict):
        return None
    return _clean_text(
        _first_present(
            entry.get("level"),
            entry.get("proficiency"),
            entry.get("level_code"),
            entry.get("cefr"),
        )
    )


def _extract_skill_label(entry: Any) -> str | None:
    if isinstance(entry, str):
        return _clean_text(entry)
    if not isinstance(entry, dict):
        return None
    return _clean_text(
        _first_present(
            entry.get("skill_label_raw"),
            entry.get("skill_label"),
            entry.get("label"),
            entry.get("name"),
            entry.get("skill"),
            entry.get("raw_label"),
        )
    )


def _extract_education_label(entry: Mapping[str, Any]) -> str | None:
    return _clean_text(
        _first_present(
            entry.get("diploma_label"),
            entry.get("degree"),
            entry.get("raw_degree"),
            entry.get("diploma"),
        )
    )


def _extract_experience_title(entry: Mapping[str, Any]) -> str | None:
    return _clean_text(
        _first_present(
            entry.get("title"),
            entry.get("job_title_raw"),
            entry.get("job_title"),
            entry.get("position"),
            entry.get("role"),
        )
    )


def _unique_items(items: list[dict[str, Any]], key_name: str) -> list[dict[str, Any]]:
    seen: set[str] = set()
    output: list[dict[str, Any]] = []

    for item in items:
        key = _clean_text(item.get(key_name))
        if not key:
            continue
        dedupe_key = key.lower()
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        output.append(item)

    return output


def _get_current_profile_state(db: Session, job_seeker_id: str) -> dict[str, Any]:
    identity = _fetch_one(
        db,
        """
        SELECT
            first_name,
            last_name,
            birth_date::text AS birth_date,
            nationality_country_id::text AS nationality_country_id
        FROM aneti.job_seeker_identity
        WHERE job_seeker_id = CAST(:job_seeker_id AS uuid)
        LIMIT 1;
        """,
        {"job_seeker_id": job_seeker_id},
    ) or {}

    contact = _fetch_one(
        db,
        """
        SELECT
            c.email,
            c.address,
            c.country_id::text AS country_id,
            country.iso2 AS country_iso2,
            c.governorate_unit_id::text AS governorate_unit_id,
            gov.code AS governorate_code,
            c.delegation_unit_id::text AS delegation_unit_id,
            deleg.code AS delegation_code
        FROM aneti.job_seeker_contact c
        LEFT JOIN geo.country country ON country.id = c.country_id
        LEFT JOIN geo.admin_unit gov ON gov.id = c.governorate_unit_id
        LEFT JOIN geo.admin_unit deleg ON deleg.id = c.delegation_unit_id
        WHERE c.job_seeker_id = CAST(:job_seeker_id AS uuid)
        LIMIT 1;
        """,
        {"job_seeker_id": job_seeker_id},
    ) or {}

    skills = _fetch_all(
        db,
        """
        SELECT
            s.id::text AS id,
            s.skill_node_id::text AS skill_node_id,
            n.preferred_label AS label,
            n.normalized_label AS normalized_label
        FROM aneti.job_seeker_skill s
        JOIN taxonomy.taxonomy_node n ON n.id = s.skill_node_id
        WHERE s.job_seeker_id = CAST(:job_seeker_id AS uuid);
        """,
        {"job_seeker_id": job_seeker_id},
    )

    languages = _fetch_all(
        db,
        """
        SELECT
            l.id::text AS id,
            l.language_ref_id::text AS language_ref_id,
            rv_lang.code AS language_code,
            COALESCE(rv_lang.label_fr, rv_lang.label_en, rv_lang.label, rv_lang.code) AS language_label,
            l.level_ref_id::text AS level_ref_id,
            rv_level.code AS level_code
        FROM aneti.job_seeker_language l
        JOIN reference.ref_value rv_lang ON rv_lang.id = l.language_ref_id
        LEFT JOIN reference.ref_value rv_level ON rv_level.id = l.level_ref_id
        WHERE l.job_seeker_id = CAST(:job_seeker_id AS uuid);
        """,
        {"job_seeker_id": job_seeker_id},
    )

    education = _fetch_all(
        db,
        """
        SELECT
            e.id::text AS id,
            e.graduation_year,
            rv_diploma.code AS diploma_code,
            COALESCE(rv_diploma.label_fr, rv_diploma.label_en, rv_diploma.label, rv_diploma.code) AS diploma_label,
            rv_specialty.code AS specialty_code,
            COALESCE(rv_specialty.label_fr, rv_specialty.label_en, rv_specialty.label, rv_specialty.code) AS specialty_label
        FROM aneti.job_seeker_education e
        LEFT JOIN reference.ref_value rv_diploma ON rv_diploma.id = e.diploma_ref_id
        LEFT JOIN reference.ref_value rv_specialty ON rv_specialty.id = e.specialty_ref_id
        WHERE e.job_seeker_id = CAST(:job_seeker_id AS uuid);
        """,
        {"job_seeker_id": job_seeker_id},
    )

    experience = _fetch_all(
        db,
        """
        SELECT
            e.id::text AS id,
            e.job_title_raw,
            e.organization_name,
            e.start_date::text AS start_date,
            e.end_date::text AS end_date
        FROM aneti.job_seeker_experience e
        WHERE e.job_seeker_id = CAST(:job_seeker_id AS uuid);
        """,
        {"job_seeker_id": job_seeker_id},
    )

    return {
        "identity": identity,
        "contact": contact,
        "skills": skills,
        "languages": languages,
        "education": education,
        "experience": experience,
    }


def build_apply_parsed_profile_plan(
    db: Session,
    *,
    job_seeker_id: str,
    snapshot: Mapping[str, Any],
    replace: bool = False,
) -> dict[str, Any]:
    """Construit un plan dry-run avant écriture dans les tables aneti.job_seeker_*.

    Cette fonction ne modifie pas la base. Elle sert à valider le mapping entre
    parsed_resume_snapshot et le modèle ANETI avant d'activer l'écriture réelle.
    """
    patch = _extract_patch(snapshot)
    parsed_payload = _extract_parsed_payload(snapshot)
    mapped_payload = _extract_mapped_payload(snapshot)
    current = _get_current_profile_state(db, job_seeker_id)

    personal = _extract_personal_info(parsed_payload)
    identity_patch = _as_dict(patch.get("identity"))
    location = _extract_candidate_location(snapshot)

    proposed_identity = {
        "first_name": _first_present(identity_patch.get("first_name"), personal.get("first_name"), personal.get("firstname")),
        "last_name": _first_present(identity_patch.get("last_name"), personal.get("last_name"), personal.get("lastname")),
        "birth_date": _first_present(identity_patch.get("birth_date"), personal.get("birth_date")),
        "nationality": _first_present(identity_patch.get("nationality"), personal.get("nationality")),
    }

    identity_plan = {
        field: _maybe_apply_value(current["identity"].get(field), value, replace=replace)
        for field, value in proposed_identity.items()
    }

    proposed_contact = {
        "email": _first_present(personal.get("email"), identity_patch.get("email")),
        "address": _first_present(location.get("display_location"), location.get("raw_location"), personal.get("address")),
        "country_id": location.get("country_id"),
        "country_iso2": location.get("country_iso2"),
        "governorate_code": _as_dict(location.get("governorate")).get("code"),
        "delegation_code": _as_dict(location.get("delegation")).get("code"),
        "city_raw": location.get("city_raw"),
        "region_raw": location.get("region_raw"),
        "location_status": location.get("status"),
        "is_foreign": location.get("is_foreign"),
    }

    contact_plan = {
        "email": _maybe_apply_value(current["contact"].get("email"), proposed_contact.get("email"), replace=replace),
        "address": _maybe_apply_value(current["contact"].get("address"), proposed_contact.get("address"), replace=replace),
        "country": _maybe_apply_value(current["contact"].get("country_iso2"), proposed_contact.get("country_iso2"), replace=replace),
        "governorate": _maybe_apply_value(current["contact"].get("governorate_code"), proposed_contact.get("governorate_code"), replace=replace),
        "delegation": _maybe_apply_value(current["contact"].get("delegation_code"), proposed_contact.get("delegation_code"), replace=replace),
        "raw_location_resolution": proposed_contact,
    }

    skill_items: list[dict[str, Any]] = []
    for item in _as_list(patch.get("skills")):
        label = _extract_skill_label(item)
        if not label:
            continue
        skill_items.append({
            "label": label,
            "level": _as_dict(item).get("level") if isinstance(item, dict) else None,
            "source": _as_dict(item).get("source") if isinstance(item, dict) else "CV_PARSER",
        })

    current_skill_keys = {
        str(row.get("label") or row.get("normalized_label") or "").strip().lower()
        for row in current["skills"]
    }
    skill_plan = []
    for item in _unique_items(skill_items, "label"):
        key = str(item["label"]).strip().lower()
        skill_plan.append({
            **item,
            "action": "KEEP_EXISTING" if key in current_skill_keys else "ADD_IF_RESOLVED_TO_TAXONOMY",
            "will_insert": key not in current_skill_keys,
            "note": "L'insertion réelle vérifiera taxonomy.taxonomy_node avant écriture.",
        })

    language_items: list[dict[str, Any]] = []
    for item in _as_list(patch.get("languages")):
        label = _extract_language_label(item)
        if not label:
            continue
        language_items.append({"label": label, "level": _extract_language_level(item)})

    current_language_keys = {
        str(row.get("language_code") or row.get("language_label") or "").strip().lower()
        for row in current["languages"]
    }
    language_plan = []
    for item in _unique_items(language_items, "label"):
        key = str(item["label"]).strip().lower()
        language_plan.append({
            **item,
            "action": "KEEP_EXISTING" if key in current_language_keys else "ADD_IF_RESOLVED_TO_REFERENCE",
            "will_insert": key not in current_language_keys,
            "note": "L'insertion réelle vérifiera reference.ref_value LANGUAGE/LANGUAGE_LEVEL avant écriture.",
        })

    education_items: list[dict[str, Any]] = []
    for item in _as_list(patch.get("education")):
        if not isinstance(item, dict):
            continue
        diploma_label = _extract_education_label(item)
        specialty = _clean_text(_first_present(item.get("specialty"), item.get("field"), item.get("field_of_study")))
        if not diploma_label and not specialty:
            continue
        education_items.append({
            "diploma_label": diploma_label,
            "diploma_code": _clean_text(item.get("level_code") or item.get("diploma_code")),
            "specialty": specialty,
            "specialty_code": _clean_text(item.get("specialty_code")),
            "institution": _clean_text(item.get("institution")),
            "graduation_year": _clean_text(item.get("graduation_year")),
        })

    current_education_keys = {
        "|".join([
            str(row.get("diploma_label") or row.get("diploma_code") or "").strip().lower(),
            str(row.get("specialty_label") or row.get("specialty_code") or "").strip().lower(),
            str(row.get("graduation_year") or "").strip().lower(),
        ])
        for row in current["education"]
    }
    education_plan = []
    for item in education_items:
        key = "|".join([
            str(item.get("diploma_label") or item.get("diploma_code") or "").strip().lower(),
            str(item.get("specialty") or item.get("specialty_code") or "").strip().lower(),
            str(item.get("graduation_year") or "").strip().lower(),
        ])
        education_plan.append({
            **item,
            "action": "KEEP_EXISTING" if key in current_education_keys else "ADD_IF_REFERENCE_RESOLVED",
            "will_insert": key not in current_education_keys,
        })

    experience_entries = _as_list(patch.get("experience")) + _as_list(patch.get("stages"))
    current_experience_keys = {
        "|".join([
            str(row.get("job_title_raw") or "").strip().lower(),
            str(row.get("organization_name") or "").strip().lower(),
            str(row.get("start_date") or "").strip().lower(),
        ])
        for row in current["experience"]
    }
    experience_plan = []
    for item in experience_entries:
        if not isinstance(item, dict):
            continue
        title = _extract_experience_title(item)
        company = _clean_text(_first_present(item.get("company"), item.get("organization_name"), item.get("company_name")))
        if not title and not company:
            continue
        key = "|".join([
            str(title or "").strip().lower(),
            str(company or "").strip().lower(),
            str(item.get("start_date") or "").strip().lower(),
        ])
        experience_plan.append({
            "job_title_raw": title,
            "organization_name": company,
            "start_date": item.get("start_date"),
            "end_date": item.get("end_date"),
            "is_current": bool(item.get("is_current") or False),
            "duration_months": item.get("duration_months"),
            "entry_type": item.get("entry_type"),
            "description": item.get("description"),
            "action": "KEEP_EXISTING" if key in current_experience_keys else "ADD",
            "will_insert": key not in current_experience_keys,
        })

    mapped_quality = _as_dict(mapped_payload.get("rtmc_mapping") or mapped_payload.get("mapping_quality"))

    return {
        "mode": "replace" if replace else "fill_empty_and_add_missing",
        "snapshot": {
            "id": snapshot.get("id"),
            "parsing_status": snapshot.get("parsing_status"),
            "parser_name": snapshot.get("parser_name"),
            "parser_version": snapshot.get("parser_version"),
        },
        "mapping_quality": mapped_quality,
        "identity": identity_plan,
        "contact": contact_plan,
        "education": {
            "existing_count": len(current["education"]),
            "proposed_count": len(education_plan),
            "items": education_plan,
        },
        "experience": {
            "existing_count": len(current["experience"]),
            "proposed_count": len(experience_plan),
            "items": experience_plan,
        },
        "skills": {
            "existing_count": len(current["skills"]),
            "proposed_count": len(skill_plan),
            "items": skill_plan,
        },
        "languages": {
            "existing_count": len(current["languages"]),
            "proposed_count": len(language_plan),
            "items": language_plan,
        },
        "warnings": [
            "Dry-run only: aucune table aneti.job_seeker_* n'est modifiée.",
            "Les skills seront insérés seulement si un taxonomy.taxonomy_node est résolu.",
            "Les langues seront insérées seulement si reference.ref_value contient la langue/niveau.",
        ],
    }
