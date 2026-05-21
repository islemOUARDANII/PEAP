from sqlalchemy import text
from sqlalchemy.orm import Session


def _fetch_all(db: Session, query: str, params: dict | None = None) -> list[dict]:
    rows = db.execute(text(query), params or {}).mappings().all()
    return [dict(row) for row in rows]


def _list_ref_values(db: Session, group_codes: list[str]) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            v.code::text AS code,
            COALESCE(v.label_fr, v.label_en, v.label, v.code)::text AS label
        FROM reference.ref_value v
        JOIN reference.ref_group g ON g.id = v.group_id
        WHERE g.code = ANY(:group_codes)
          AND COALESCE(g.active, true) = true
          AND COALESCE(v.active, true) = true
        ORDER BY v.sort_order ASC, COALESCE(v.label_fr, v.label_en, v.label, v.code) ASC;
        """,
        {"group_codes": group_codes},
    )


def list_reference(db: Session, table_name: str, code_column: str, label_column: str) -> list[dict]:
    """
    Compatibility layer for old /referentials/* endpoints.

    Old router still calls:
      list_reference(db, "ref_genre", ...)
      list_reference(db, "ref_type_contrat", ...)
      etc.

    We do NOT use taxonomy.ref_* anymore.
    We redirect to reference.ref_group / reference.ref_value or geo.admin_unit.
    """

    reference_map = {
        "ref_genre": ["GENDER"],
        "ref_type_handicap": ["HANDICAP_TYPE", "TYPE_HANDICAP"],
        "ref_degre_handicap": ["HANDICAP_DEGREE", "DEGRE_HANDICAP"],
        "ref_language": ["LANGUAGE"],
        "ref_language_level": ["LANGUAGE_LEVEL"],
        "ref_diplomes": ["DIPLOMA", "DIPLOMA_LEVEL", "EDUCATION_LEVEL", "NIVEAU_INSTRUCTION"],
        "ref_niveau_instruction": ["NIVEAU_INSTRUCTION", "EDUCATION_LEVEL", "DIPLOMA_LEVEL"],
        "ref_specialites": ["SPECIALTY"],
        "ref_certifications": ["CERTIFICATION"],
        "ref_type_contrat": ["CONTRACT_TYPE"],
        "ref_type_offre": ["OFFER_TYPE"],
        "ref_situation_offre": ["OFFER_STATUS"],
        "ref_type_permis": ["PERMIT_TYPE", "DRIVING_LICENSE_TYPE"],
        "ref_type_pae": ["PAE_TYPE"],
        "ref_organisation_temps_travail": ["WORK_TIME_ORGANIZATION"],
        "ref_regime_travail": ["WORK_MODE", "WORK_REGIME"],
        "ref_type_handicap": ["HANDICAP_TYPE", "TYPE_HANDICAP"],
    }

    if table_name == "ref_n_gouvern":
        return list_governorates(db)

    if table_name == "ref_n_delegat":
        return list_delegations(db, None)

    group_codes = reference_map.get(table_name)

    if not group_codes:
        return []

    return _list_ref_values(db, group_codes)


def list_governorates(db: Session) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            au.code::text AS code,
            COALESCE(au.label_fr, au.label_en, au.label, au.code)::text AS label
        FROM geo.admin_unit au
        JOIN geo.country c ON c.id = au.country_id
        WHERE c.iso2 = 'TN'
          AND au.admin_level = 1
          AND COALESCE(au.active, true) = true
        ORDER BY COALESCE(au.label_fr, au.label_en, au.label, au.code) ASC;
        """,
    )


def list_delegations(db: Session, governorate_code: str | None = None) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            d.code::text AS code,
            COALESCE(d.label_fr, d.label_en, d.label, d.code)::text AS label,
            g.code::text AS governorate_code
        FROM geo.admin_unit d
        JOIN geo.country c ON c.id = d.country_id
        LEFT JOIN geo.admin_unit g ON g.id = d.parent_id
        WHERE c.iso2 = 'TN'
          AND d.admin_level = 2
          AND COALESCE(d.active, true) = true
          AND (
                :governorate_code IS NULL
                OR g.code = :governorate_code
                OR g.metadata_json->>'admin1_code' = :governorate_code
          )
        ORDER BY COALESCE(d.label_fr, d.label_en, d.label, d.code) ASC;
        """,
        {"governorate_code": governorate_code},
    )


def list_languages(db: Session) -> list[dict]:
    return _list_ref_values(db, ["LANGUAGE"])


def list_language_levels(db: Session) -> list[dict]:
    return _list_ref_values(db, ["LANGUAGE_LEVEL"])


def list_imadas(
    db: Session,
    delegation_code: str | None = None,
    governorate_code: str | None = None,
    q: str | None = None,
) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            im.id::text AS id,
            im.code::text AS code,
            COALESCE(im.label_fr, im.label_en, im.label, im.code)::text AS label,

            d.code::text AS delegation_code,
            COALESCE(d.label_fr, d.label_en, d.label, d.code)::text AS delegation_label,

            g.code::text AS governorate_code,
            COALESCE(g.label_fr, g.label_en, g.label, g.code)::text AS governorate_label

        FROM geo.admin_unit im
        JOIN geo.country c ON c.id = im.country_id
        LEFT JOIN geo.admin_unit d ON d.id = im.parent_id
        LEFT JOIN geo.admin_unit g ON g.id = d.parent_id

        WHERE c.iso2 = 'TN'
          AND im.admin_level = 3
          AND im.unit_type = 'IMADA'
          AND COALESCE(im.active, true) = true
          AND (
                :delegation_code IS NULL
                OR d.code = :delegation_code
          )
          AND (
                :governorate_code IS NULL
                OR g.code = :governorate_code
          )
          AND (
                :q IS NULL
                OR im.code ILIKE :q_like
                OR im.label ILIKE :q_like
                OR im.label_fr ILIKE :q_like
                OR im.label_en ILIKE :q_like
                OR im.label_ar ILIKE :q_like
          )

        ORDER BY COALESCE(im.label_fr, im.label_en, im.label, im.code) ASC;
        """,
        {
            "delegation_code": delegation_code,
            "governorate_code": governorate_code,
            "q": q,
            "q_like": f"%{q}%" if q else None,
        },
    )


def list_postal_codes(
    db: Session,
    imada_code: str | None = None,
    delegation_code: str | None = None,
    governorate_code: str | None = None,
    q: str | None = None,
) -> list[dict]:
    return _fetch_all(
        db,
        """
        SELECT
            pc.id::text AS id,
            pc.postal_code::text AS postal_code,
            COALESCE(pc.label, pc.postal_code)::text AS label,

            COALESCE(
                NULLIF(au.label_fr, ''),
                NULLIF(au.label_en, ''),
                NULLIF(au.label, ''),
                au.code
            )::text AS locality_label,

            NULL::text AS locality_label_ar,

            au.id::text AS admin_unit_id,
            au.code::text AS admin_unit_code,
            COALESCE(au.label_fr, au.label_en, au.label, au.code)::text AS admin_unit_label,
            au.admin_level,
            au.unit_type,

            d.code::text AS delegation_code,
            COALESCE(d.label_fr, d.label_en, d.label, d.code)::text AS delegation_label,

            g.code::text AS governorate_code,
            COALESCE(g.label_fr, g.label_en, g.label, g.code)::text AS governorate_label

        FROM geo.postal_code pc
        JOIN geo.country c ON c.id = pc.country_id
        LEFT JOIN geo.admin_unit au ON au.id = pc.admin_unit_id
        LEFT JOIN geo.admin_unit d ON d.id = au.parent_id
        LEFT JOIN geo.admin_unit g ON g.id = d.parent_id

        WHERE c.iso2 = 'TN'
          AND COALESCE(pc.active, true) = true
          AND (
                :imada_code IS NULL
                OR au.code = :imada_code
          )
          AND (
                :delegation_code IS NULL
                OR d.code = :delegation_code
          )
          AND (
                :governorate_code IS NULL
                OR g.code = :governorate_code
          )
          AND (
                :q IS NULL
                OR pc.postal_code ILIKE :q_like
                OR pc.label ILIKE :q_like
                OR au.code ILIKE :q_like
                OR au.label_fr ILIKE :q_like
                OR au.label_en ILIKE :q_like
                OR au.label ILIKE :q_like
          )

        ORDER BY
            pc.postal_code ASC,
            COALESCE(au.label_fr, au.label_en, au.label, au.code) ASC NULLS LAST;
        """,
        {
            "imada_code": imada_code,
            "delegation_code": delegation_code,
            "governorate_code": governorate_code,
            "q": q,
            "q_like": f"%{q}%" if q else None,
        },
    )