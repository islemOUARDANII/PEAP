from __future__ import annotations

import logging
from datetime import datetime
from typing import Generator, Optional

import psycopg2
import psycopg2.extras
from psycopg2.extensions import connection as PGConnection

from app.config import settings

logger = logging.getLogger(__name__)


def _connect() -> PGConnection:
    return psycopg2.connect(settings.postgres_dsn)


# ---------------------------------------------------------------------------
# OFFERS  (aneti.job_offer + requirements + language requirements)
# ---------------------------------------------------------------------------

_OFFERS_QUERY = """
SELECT
    o.id AS offer_id,
    o.employer_id AS company_id,
    o.status,
    o.title,
    o.description,

    country.iso2 AS country,
    COALESCE(country.name_fr, country.name_en, country.iso2) AS country_label,

    gov.code AS governorate_code,
    COALESCE(gov.label_fr, gov.label_en, gov.label, gov.code) AS governorate,

    del_unit.code AS delegation_code,
    COALESCE(del_unit.label_fr, del_unit.label_en, del_unit.label, del_unit.code) AS delegation,

    COALESCE(work_ref.code, '') AS work_mode,
    COALESCE(work_ref.label_fr, work_ref.label_en, work_ref.label, work_ref.code, '') AS work_mode_label,

    COALESCE(contract_ref.code, '') AS contract_type,
    COALESCE(contract_ref.label_fr, contract_ref.label_en, contract_ref.label, contract_ref.code, '') AS contract_type_label,

    o.salary_min,
    o.salary_max,
    o.salary_currency_code,

    o.occupation_node_id::text AS occupation_node_id,
    occupation.preferred_label AS occupation_label,

    o.min_experience_months,
    o.diploma_ref_id::text AS diploma_ref_id,
    COALESCE(diploma_ref.label_fr, diploma_ref.label_en, diploma_ref.label, diploma_ref.code) AS diploma_label,

    o.specialty_ref_id::text AS specialty_ref_id,
    COALESCE(specialty_ref.label_fr, specialty_ref.label_en, specialty_ref.label, specialty_ref.code) AS specialty_label,

    COALESCE(
        NULLIF(TRIM(CONCAT_WS(
            ', ',
            NULLIF(COALESCE(del_unit.label_fr, del_unit.label_en, del_unit.label, del_unit.code), ''),
            NULLIF(COALESCE(gov.label_fr, gov.label_en, gov.label, gov.code), ''),
            NULLIF(COALESCE(country.name_fr, country.name_en, country.iso2), '')
        )), ''),
        ''
    ) AS location,

    o.created_at,
    o.updated_at,

    COALESCE(
        (
            SELECT array_agg(DISTINCT term)
            FROM (
                SELECT COALESCE(
                    n.preferred_label,
                    rv.label_fr,
                    rv.label_en,
                    rv.label,
                    rv.code
                ) AS term
                FROM aneti.job_offer_requirement r
                LEFT JOIN reference.ref_value rv_ct
                    ON rv_ct.id = r.criterion_type_ref_id
                LEFT JOIN taxonomy.taxonomy_node n
                    ON n.id = r.taxonomy_node_id
                LEFT JOIN reference.ref_value rv
                    ON rv.id = r.ref_value_id
                WHERE r.offer_id = o.id
                AND (
                        rv_ct.code IN ('SKILL', 'SOFT_SKILL')
                        OR n.node_type IN ('SKILL', 'SOFT_SKILL')
                )
                AND COALESCE(
                        n.preferred_label,
                        rv.label_fr,
                        rv.label_en,
                        rv.label,
                        rv.code
                    ) IS NOT NULL
                AND TRIM(COALESCE(
                        n.preferred_label,
                        rv.label_fr,
                        rv.label_en,
                        rv.label,
                        rv.code
                    )) <> ''
            ) q
        ),
        ARRAY[]::text[]
    ) AS skills,

    COALESCE(
        (
            SELECT array_agg(DISTINCT term)
            FROM (
                SELECT occupation.preferred_label AS term
                WHERE occupation.preferred_label IS NOT NULL
                AND TRIM(occupation.preferred_label) <> ''

                UNION

                SELECT COALESCE(
                    n.preferred_label,
                    rv.label_fr,
                    rv.label_en,
                    rv.label,
                    rv.code
                ) AS term
                FROM aneti.job_offer_requirement r
                LEFT JOIN reference.ref_value rv_ct
                    ON rv_ct.id = r.criterion_type_ref_id
                LEFT JOIN taxonomy.taxonomy_node n
                    ON n.id = r.taxonomy_node_id
                LEFT JOIN reference.ref_value rv
                    ON rv.id = r.ref_value_id
                WHERE r.offer_id = o.id
                AND (
                        rv_ct.code IN ('OCCUPATION', 'JOB', 'METIER')
                        OR n.node_type = 'OCCUPATION'
                )
                AND COALESCE(
                        n.preferred_label,
                        rv.label_fr,
                        rv.label_en,
                        rv.label,
                        rv.code
                    ) IS NOT NULL
                AND TRIM(COALESCE(
                        n.preferred_label,
                        rv.label_fr,
                        rv.label_en,
                        rv.label,
                        rv.code
                    )) <> ''
            ) q
        ),
        ARRAY[]::text[]
    ) AS occupations,

    COALESCE(
        (
            SELECT array_agg(DISTINCT term)
            FROM (
                SELECT COALESCE(
                    lang.code,
                    lang.label_fr,
                    lang.label_en,
                    lang.label
                ) AS term
                FROM aneti.job_offer_language_requirement lr
                LEFT JOIN reference.ref_value lang
                    ON lang.id = lr.language_ref_id
                WHERE lr.offer_id = o.id
                AND COALESCE(
                        lang.code,
                        lang.label_fr,
                        lang.label_en,
                        lang.label
                    ) IS NOT NULL
                AND TRIM(COALESCE(
                        lang.code,
                        lang.label_fr,
                        lang.label_en,
                        lang.label
                    )) <> ''
            ) q
        ),
        ARRAY[]::text[]
    ) AS languages

FROM aneti.job_offer o

LEFT JOIN geo.country country
    ON country.id = o.country_id

LEFT JOIN geo.admin_unit gov
    ON gov.id = o.governorate_unit_id

LEFT JOIN geo.admin_unit del_unit
    ON del_unit.id = o.delegation_unit_id

LEFT JOIN taxonomy.taxonomy_node occupation
    ON occupation.id = o.occupation_node_id

LEFT JOIN reference.ref_value contract_ref
    ON contract_ref.id = o.contract_type_ref_id

LEFT JOIN reference.ref_value work_ref
    ON work_ref.id = o.work_mode_ref_id

LEFT JOIN reference.ref_value diploma_ref
    ON diploma_ref.id = o.diploma_ref_id

LEFT JOIN reference.ref_value specialty_ref
    ON specialty_ref.id = o.specialty_ref_id

WHERE
    o.status = 'PUBLISHED'
    AND (
        %(since)s IS NULL
        OR o.updated_at > %(since)s
        OR EXISTS (
            SELECT 1
            FROM aneti.job_offer_requirement rr
            WHERE rr.offer_id = o.id
              AND rr.updated_at > %(since)s
        )
        OR EXISTS (
            SELECT 1
            FROM aneti.job_offer_language_requirement lr
            WHERE lr.offer_id = o.id
              AND lr.updated_at > %(since)s
        )
    )

ORDER BY o.updated_at DESC
"""


def fetch_offers(
    since: Optional[datetime] = None,
    batch_size: int = 500,
) -> Generator[list[dict], None, None]:
    conn = _connect()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(_OFFERS_QUERY, {"since": since})

            while True:
                rows = cur.fetchmany(batch_size)
                if not rows:
                    break

                batch = []

                for row in rows:
                    batch.append(
                        {
                            "_id": str(row["offer_id"]),
                            "offer_id": str(row["offer_id"]),
                            "company_id": str(row["company_id"]),
                            "status": row["status"],
                            "title": row["title"] or "",
                            "description": row["description"] or "",

                            "location": row["location"] or "",
                            "governorate_code": row["governorate_code"] or "",
                            "governorate": row["governorate"] or "",
                            "delegation_code": row["delegation_code"] or "",
                            "delegation": row["delegation"] or "",
                            "country": row["country"] or "",

                            "occupation_node_id": row["occupation_node_id"] or "",
                            "occupation_label": row["occupation_label"] or "",

                            "contract_type": row["contract_type"] or "",
                            "contract_type_label": row["contract_type_label"] or "",

                            "work_mode": row["work_mode"] or "",
                            "work_mode_label": row["work_mode_label"] or "",

                            "salary_min": (
                                float(row["salary_min"])
                                if row["salary_min"] is not None
                                else None
                            ),
                            "salary_max": (
                                float(row["salary_max"])
                                if row["salary_max"] is not None
                                else None
                            ),
                            "salary_currency_code": row["salary_currency_code"] or "",

                            "min_experience_months": (
                                int(row["min_experience_months"])
                                if row["min_experience_months"] is not None
                                else None
                            ),

                            "diploma_ref_id": row["diploma_ref_id"] or "",
                            "diploma_label": row["diploma_label"] or "",
                            "specialty_ref_id": row["specialty_ref_id"] or "",
                            "specialty_label": row["specialty_label"] or "",

                            "skills": list(row["skills"] or []),
                            "occupations": list(row["occupations"] or []),
                            "languages": list(row["languages"] or []),

                            "created_at": (
                                row["created_at"].isoformat()
                                if row["created_at"]
                                else None
                            ),
                            "updated_at": (
                                row["updated_at"].isoformat()
                                if row["updated_at"]
                                else None
                            ),
                        }
                    )

                logger.debug("fetch_offers batch size=%d", len(batch))
                yield batch

    finally:
        conn.close()


# ---------------------------------------------------------------------------
# CANDIDATES  (aneti.job_seeker + related tables)
# ---------------------------------------------------------------------------

_CANDIDATES_QUERY = """
SELECT
    js.id AS candidate_id,
    js.status,
    js.created_at,
    js.updated_at,

    country.iso2 AS country,
    COALESCE(country.name_fr, country.name_en, country.iso2) AS country_label,

    gov.code AS governorate_code,
    COALESCE(gov.label_fr, gov.label_en, gov.label, gov.code) AS governorate,

    del_unit.code AS delegation_code,
    COALESCE(del_unit.label_fr, del_unit.label_en, del_unit.label, del_unit.code) AS delegation,

    COALESCE(
        NULLIF(TRIM(CONCAT_WS(
            ', ',
            NULLIF(COALESCE(del_unit.label_fr, del_unit.label_en, del_unit.label, del_unit.code), ''),
            NULLIF(COALESCE(gov.label_fr, gov.label_en, gov.label, gov.code), ''),
            NULLIF(COALESCE(country.name_fr, country.name_en, country.iso2), '')
        )), ''),
        ''
    ) AS location,

    COALESCE(
        (
            SELECT lang.code
            FROM aneti.job_seeker_language jsl
            LEFT JOIN reference.ref_value lang
                ON lang.id = jsl.language_ref_id
            WHERE jsl.job_seeker_id = js.id
              AND lang.code IS NOT NULL
            ORDER BY jsl.created_at ASC
            LIMIT 1
        ),
        ''
    ) AS primary_lang,

    COALESCE(
        (
            SELECT CAST(
                SUM(
                    COALESCE(
                        exp.duration_months,
                        CASE
                            WHEN exp.start_date IS NOT NULL THEN
                                (
                                    EXTRACT(YEAR FROM AGE(
                                        COALESCE(exp.end_date, CURRENT_DATE),
                                        exp.start_date
                                    )) * 12
                                    +
                                    EXTRACT(MONTH FROM AGE(
                                        COALESCE(exp.end_date, CURRENT_DATE),
                                        exp.start_date
                                    ))
                                )
                            ELSE 0
                        END
                    )
                ) / 12
                AS INTEGER
            )
            FROM aneti.job_seeker_experience exp
            WHERE exp.job_seeker_id = js.id
        ),
        0
    ) AS years_experience,

    COALESCE(
        (
            SELECT COALESCE(
                rv_diploma.code,
                rv_diploma.label_fr,
                rv_diploma.label_en,
                rv_diploma.label
            )
            FROM aneti.job_seeker_education edu
            LEFT JOIN reference.ref_value rv_diploma
                ON rv_diploma.id = edu.diploma_ref_id
            WHERE edu.job_seeker_id = js.id
            ORDER BY edu.graduation_year DESC NULLS LAST, edu.created_at DESC
            LIMIT 1
        ),
        'unknown'
    ) AS education,

    COALESCE(
        (
            SELECT array_agg(DISTINCT term)
            FROM (
                SELECT n.preferred_label AS term
                FROM aneti.job_seeker_skill jss
                LEFT JOIN taxonomy.taxonomy_node n
                    ON n.id = jss.skill_node_id
                WHERE jss.job_seeker_id = js.id
                AND n.preferred_label IS NOT NULL
                AND TRIM(n.preferred_label) <> ''
            ) q
        ),
        ARRAY[]::text[]
    ) AS skills,

    COALESCE(
        (
            SELECT array_agg(DISTINCT lang.code)
            FROM aneti.job_seeker_language jsl
            LEFT JOIN reference.ref_value lang
                ON lang.id = jsl.language_ref_id
            WHERE jsl.job_seeker_id = js.id
              AND lang.code IS NOT NULL
              AND TRIM(lang.code) <> ''
        ),
        ARRAY[]::text[]
    ) AS languages

FROM aneti.job_seeker js

LEFT JOIN aneti.job_seeker_contact jsc
    ON jsc.job_seeker_id = js.id

LEFT JOIN geo.country country
    ON country.id = jsc.country_id

LEFT JOIN geo.admin_unit gov
    ON gov.id = jsc.governorate_unit_id

LEFT JOIN geo.admin_unit del_unit
    ON del_unit.id = jsc.delegation_unit_id

WHERE
    js.status = 'ACTIVE'
    AND (
        %(since)s IS NULL
        OR js.updated_at > %(since)s
        OR jsc.updated_at > %(since)s
        OR EXISTS (
            SELECT 1 FROM aneti.job_seeker_skill s
            WHERE s.job_seeker_id = js.id
              AND s.updated_at > %(since)s
        )
        OR EXISTS (
            SELECT 1 FROM aneti.job_seeker_language l
            WHERE l.job_seeker_id = js.id
              AND l.updated_at > %(since)s
        )
        OR EXISTS (
            SELECT 1 FROM aneti.job_seeker_education e
            WHERE e.job_seeker_id = js.id
              AND e.updated_at > %(since)s
        )
        OR EXISTS (
            SELECT 1 FROM aneti.job_seeker_experience ex
            WHERE ex.job_seeker_id = js.id
              AND ex.updated_at > %(since)s
        )
    )

ORDER BY js.updated_at DESC
"""


def fetch_candidates(
    since: Optional[datetime] = None,
    batch_size: int = 500,
) -> Generator[list[dict], None, None]:
    conn = _connect()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(_CANDIDATES_QUERY, {"since": since})

            while True:
                rows = cur.fetchmany(batch_size)
                if not rows:
                    break

                batch = []

                for row in rows:
                    batch.append(
                        {
                            "_id": str(row["candidate_id"]),
                            "candidate_id": str(row["candidate_id"]),
                            "status": row["status"],

                            "location": row["location"] or "",
                            "governorate_code": row["governorate_code"] or "",
                            "governorate": row["governorate"] or "",
                            "delegation_code": row["delegation_code"] or "",
                            "delegation": row["delegation"] or "",
                            "country": row["country"] or "",

                            "primary_lang": row["primary_lang"] or "",
                            "years_experience": int(row["years_experience"] or 0),
                            "education": (row["education"] or "unknown").lower(),

                            "skills": list(row["skills"] or []),
                            "languages": list(row["languages"] or []),

                            "created_at": (
                                row["created_at"].isoformat()
                                if row["created_at"]
                                else None
                            ),
                            "updated_at": (
                                row["updated_at"].isoformat()
                                if row["updated_at"]
                                else None
                            ),
                        }
                    )

                logger.debug("fetch_candidates batch size=%d", len(batch))
                yield batch

    finally:
        conn.close()