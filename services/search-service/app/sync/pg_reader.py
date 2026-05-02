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
# OFFERS  (aneti.job_offer + aneti.job_offer_requirement)
# ---------------------------------------------------------------------------

_OFFERS_QUERY = """
SELECT
    o.id                                                            AS offer_id,
    o.employer_id                                                   AS company_id,
    o.status,
    o.title,
    o.description,

    o.governorate_code,
    gov.libelle_gouvernorat                                         AS governorate,

    o.delegation_code,
    del.libelle_delegation                                          AS delegation,

    o.country,
    o.work_mode,
    o.salary_min,
    o.salary_max,

    COALESCE(
        NULLIF(TRIM(
            COALESCE(del.libelle_delegation, '')
            || CASE
                WHEN gov.libelle_gouvernorat IS NOT NULL
                THEN ', ' || gov.libelle_gouvernorat
                ELSE ''
            END
            || CASE
                WHEN o.country IS NOT NULL AND o.country <> ''
                THEN ', ' || o.country
                ELSE ''
            END
        ), ', '),
        gov.libelle_gouvernorat,
        del.libelle_delegation,
        o.country,
        ''
    )                                                               AS location,

    o.contract_type,
    o.created_at,
    o.updated_at,

    COALESCE(
        array_agg(DISTINCT r.raw_value) FILTER (
            WHERE r.criterion_type = 'SKILL'
              AND r.raw_value IS NOT NULL
              AND TRIM(r.raw_value) <> ''
        ),
        '{}'
    )                                                               AS skills,

    COALESCE(
        array_agg(DISTINCT r.raw_value) FILTER (
            WHERE r.criterion_type IN ('OCCUPATION', 'JOB', 'METIER')
              AND r.raw_value IS NOT NULL
              AND TRIM(r.raw_value) <> ''
        ),
        '{}'
    )                                                               AS occupations,

    COALESCE(
        array_agg(DISTINCT r.raw_value) FILTER (
            WHERE r.criterion_type = 'LANGUAGE'
              AND r.raw_value IS NOT NULL
              AND TRIM(r.raw_value) <> ''
        ),
        '{}'
    )                                                               AS languages

FROM aneti.job_offer o

LEFT JOIN taxonomy.ref_n_gouvern gov
    ON gov.code_gouvernorat = o.governorate_code

LEFT JOIN taxonomy.ref_n_delegat del
    ON del.code_delegation = o.delegation_code

LEFT JOIN aneti.job_offer_requirement r
    ON r.offer_id = o.id

WHERE
    (%(since)s IS NULL OR o.updated_at > %(since)s)
    AND o.status = 'PUBLISHED'

GROUP BY
    o.id,
    o.employer_id,
    o.status,
    o.title,
    o.description,
    o.governorate_code,
    gov.libelle_gouvernorat,
    o.delegation_code,
    del.libelle_delegation,
    o.country,
    o.work_mode,
    o.salary_min,
    o.salary_max,
    o.contract_type,
    o.created_at,
    o.updated_at

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

                            "contract_type": row["contract_type"] or "",
                            "work_mode": row["work_mode"] or "",

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
    js.id                                                           AS candidate_id,
    js.status,
    js.primary_language                                             AS primary_lang,
    js.created_at,
    js.updated_at,

    jsc.governorate_code,
    gov.libelle_gouvernorat                                         AS governorate,

    jsc.delegation_code,
    del.libelle_delegation                                          AS delegation,

    jsc.country,

    COALESCE(
        NULLIF(TRIM(
            COALESCE(del.libelle_delegation, '')
            || CASE
                WHEN gov.libelle_gouvernorat IS NOT NULL
                THEN ', ' || gov.libelle_gouvernorat
                ELSE ''
            END
            || CASE
                WHEN jsc.country IS NOT NULL AND jsc.country <> ''
                THEN ', ' || jsc.country
                ELSE ''
            END
        ), ', '),
        gov.libelle_gouvernorat,
        del.libelle_delegation,
        jsc.country,
        ''
    )                                                               AS location,

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
    )                                                               AS years_experience,

    COALESCE(
        (
            SELECT edu.level_code
            FROM aneti.job_seeker_education edu
            WHERE edu.job_seeker_id = js.id
              AND edu.level_code IS NOT NULL
            ORDER BY edu.graduation_year DESC NULLS LAST
            LIMIT 1
        ),
        'unknown'
    )                                                               AS education,

    COALESCE(
        (
            SELECT array_agg(DISTINCT jss.skill_label_raw)
            FROM aneti.job_seeker_skill jss
            WHERE jss.job_seeker_id = js.id
              AND jss.skill_label_raw IS NOT NULL
              AND TRIM(jss.skill_label_raw) <> ''
        ),
        '{}'
    )                                                               AS skills,

    COALESCE(
        (
            SELECT array_agg(DISTINCT jsl.language_code)
            FROM aneti.job_seeker_language jsl
            WHERE jsl.job_seeker_id = js.id
              AND jsl.language_code IS NOT NULL
              AND TRIM(jsl.language_code) <> ''
        ),
        '{}'
    )                                                               AS languages

FROM aneti.job_seeker js

LEFT JOIN aneti.job_seeker_contact jsc
    ON jsc.job_seeker_id = js.id

LEFT JOIN taxonomy.ref_n_gouvern gov
    ON gov.code_gouvernorat = jsc.governorate_code

LEFT JOIN taxonomy.ref_n_delegat del
    ON del.code_delegation = jsc.delegation_code

WHERE
    (%(since)s IS NULL OR js.updated_at > %(since)s)
    AND js.status = 'ACTIVE'

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