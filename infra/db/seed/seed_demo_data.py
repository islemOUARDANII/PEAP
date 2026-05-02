#!/usr/bin/env python3
"""
Seed demo data for ANETI PEAP / MatchCore.

Creates synthetic users, candidates, employers, offers, requirements and one
active matching configuration for local/demo testing.

Usage:
  python scripts/seed_demo_data.py --dry-run
  python scripts/seed_demo_data.py --apply --yes
  python scripts/seed_demo_data.py --reset-demo --yes

Environment:
  DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
  DEMO_PASSWORD=Password123!   # optional
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any
from urllib.parse import urlparse

try:
    import psycopg2
    import psycopg2.extras
except ImportError as exc:
    raise SystemExit(
        "Missing dependency psycopg2. Install with: pip install psycopg2-binary"
    ) from exc


DEMO_PASSWORD = os.getenv("DEMO_PASSWORD", "Password123!")
DEMO_EMAIL_SUFFIX = ".demo@aneti.tn"
RANDOM_SEED = 42024
TOTAL_CANDIDATES = 300
TOTAL_EMPLOYERS = 40
TOTAL_OFFERS = 80


# ---------------------------------------------------------------------------
# Synthetic deterministic data
# ---------------------------------------------------------------------------

FIRST_NAMES = [
    "Amine", "Yassine", "Sarra", "Meriem", "Nour", "Ines", "Rania", "Malek",
    "Omar", "Aymen", "Khalil", "Salma", "Youssef", "Farah", "Lina", "Mehdi",
    "Amina", "Karim", "Rim", "Sami", "Nesrine", "Houssem", "Wassim", "Aya", "Islem", "Sahar", "Ghofrane",
]

LAST_NAMES = [
    "Ben Ali", "Mansour", "Trabelsi", "Jaziri", "Khemiri", "Saidi", "Mrad",
    "Gharbi", "Haddad", "Chebbi", "Bouzid", "Ayadi", "Cherif", "Mellouli",
    "Amri", "Baccouche", "Karray", "Hamdi", "Zouari", "Abidi",
]

GOVERNORATE_FALLBACKS = [
    ("11", "Tunis"),
    ("31", "Sousse"),
    ("34", "Sfax"),
    ("21", "Nabeul"),
    ("35", "Monastir"),
]

COMPANY_NAMES = [
    "DigitalSoft Tunisia", "DataBridge Solutions", "MedTech Services",
    "Carthage Consulting", "Sahel Industries", "Tunisian Cloud Factory",
    "Novasoft Labs", "SmartOps Tunisia", "BluePeak Analytics",
    "SecureNet Maghreb", "Nabeul Web Studio", "Sfax Data Systems",
    "Monastir Industrial Tech", "Ariana Digital Group", "Bizerte Tech Services",
    "Sousse Innovation Hub", "Carthage Finance Lab", "Optima HR Solutions",
    "Tunisia Marketing Lab", "Djerba Travel Tech", "Kairouan Business Services",
    "Cap Bon Software", "El Ghazala AI Studio", "Medina Commerce",
    "Atlas Network Services", "PixelForge Tunisia", "ByteCraft Solutions",
    "NextStep Consulting", "GreenFactory Systems", "OmniCRM Tunisia",
    "ProServe IT", "NorthStar Cyber", "Sahel Maintenance", "Accurate Accounting",
    "TalentWorks Tunisia", "SalesBridge Africa", "FactoryPlus Services",
    "MetaAds Studio", "ERP Connect", "FinOps Tunisia",
]

DOMAIN_SPECS: list[dict[str, Any]] = [
    {
        "key": "web",
        "label": "Web development",
        "count": 70,
        "titles": ["Développeur Web", "Développeur Frontend", "Développeur Backend", "Développeur Full Stack"],
        "skills": ["Python", "JavaScript", "TypeScript", "React", "Node.js", "FastAPI", "Django", "PostgreSQL", "Docker", "Git"],
        "offer_titles": ["Développeur Full Stack", "Développeur Frontend React", "Développeur Backend Python", "Développeur Web Junior"],
        "education": ["Licence en informatique", "Ingénieur logiciel", "Master informatique"],
    },
    {
        "key": "data",
        "label": "Data / AI",
        "count": 45,
        "titles": ["Data Analyst", "Data Scientist", "Ingénieur Machine Learning", "BI Analyst"],
        "skills": ["Python", "SQL", "Pandas", "NumPy", "Scikit-learn", "PyTorch", "TensorFlow", "Power BI", "ETL", "Machine Learning"],
        "offer_titles": ["Data Analyst", "Ingénieur Data", "Machine Learning Engineer", "Consultant BI"],
        "education": ["Master data science", "Ingénieur informatique", "Licence statistique"],
    },
    {
        "key": "cyber",
        "label": "Networks / cybersecurity",
        "count": 35,
        "titles": ["Technicien Réseaux", "Analyste SOC", "Ingénieur Cybersécurité", "Administrateur Système"],
        "skills": ["Linux", "TCP/IP", "Cisco", "Firewall", "SOC", "SIEM", "Python", "Network Security", "Active Directory", "Incident Response"],
        "offer_titles": ["Analyste SOC", "Ingénieur Cybersécurité", "Administrateur Réseaux", "Technicien Support Réseaux"],
        "education": ["Licence réseaux", "Ingénieur réseaux", "Master cybersécurité"],
    },
    {
        "key": "support",
        "label": "IT support",
        "count": 30,
        "titles": ["Technicien Helpdesk", "Technicien Support IT", "Agent Support Informatique"],
        "skills": ["Windows", "Linux", "Helpdesk", "Hardware", "Office 365", "Troubleshooting", "Networking basics"],
        "offer_titles": ["Technicien Support IT", "Agent Helpdesk", "Technicien Informatique"],
        "education": ["BTS informatique", "Licence informatique appliquée", "Technicien supérieur"],
    },
    {
        "key": "marketing",
        "label": "Digital marketing",
        "count": 25,
        "titles": ["Chargé Marketing Digital", "Community Manager", "Traffic Manager"],
        "skills": ["SEO", "Google Ads", "Meta Ads", "Canva", "Content Marketing", "Analytics", "CRM"],
        "offer_titles": ["Chargé Marketing Digital", "Community Manager", "Spécialiste SEO"],
        "education": ["Licence marketing", "Master marketing digital", "Licence communication"],
    },
    {
        "key": "finance",
        "label": "Finance / accounting",
        "count": 25,
        "titles": ["Comptable", "Analyste Financier", "Gestionnaire Paie"],
        "skills": ["Accounting", "Excel", "ERP", "Tax", "Payroll", "Financial Reporting"],
        "offer_titles": ["Comptable", "Analyste Financier", "Gestionnaire Paie"],
        "education": ["Licence comptabilité", "Master finance", "BTS comptabilité"],
    },
    {
        "key": "hr",
        "label": "HR / administration",
        "count": 20,
        "titles": ["Assistant RH", "Chargé Recrutement", "Gestionnaire RH"],
        "skills": ["Recruitment", "Payroll", "HR Administration", "Excel", "Communication"],
        "offer_titles": ["Assistant RH", "Chargé Recrutement", "Gestionnaire Administration RH"],
        "education": ["Licence gestion RH", "Master RH", "Licence administration"],
    },
    {
        "key": "sales",
        "label": "Sales / business",
        "count": 30,
        "titles": ["Commercial B2B", "Business Developer", "Conseiller Commercial"],
        "skills": ["CRM", "Negotiation", "Prospecting", "B2B Sales", "Customer Relationship"],
        "offer_titles": ["Commercial B2B", "Business Developer", "Conseiller Commercial"],
        "education": ["Licence commerce", "Master management commercial", "BTS vente"],
    },
    {
        "key": "industry",
        "label": "Industry / maintenance",
        "count": 20,
        "titles": ["Technicien Maintenance", "Technicien Automatisme", "Contrôleur Qualité"],
        "skills": ["Maintenance", "PLC", "Electrical systems", "Mechanical systems", "Quality control", "Safety"],
        "offer_titles": ["Technicien Maintenance", "Technicien Automatisme", "Contrôleur Qualité"],
        "education": ["BTS maintenance industrielle", "Licence électromécanique", "Technicien supérieur industrie"],
    },
]

LANGUAGES = [("fr", "B2"), ("en", "B1"), ("ar", "native")]


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

@dataclass
class DbContext:
    conn: Any
    schemas: dict[str, str]
    columns: dict[str, set[str]]
    unique_constraints: dict[str, list[list[str]]]


def hash_password(password: str) -> str:
    """Return a bcrypt-compatible hash for FastAPI/passlib verification."""
    try:
        from passlib.context import CryptContext

        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        return pwd_context.hash(password)
    except Exception:
        pass

    try:
        import bcrypt

        return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    except Exception as exc:
        raise RuntimeError(
            "Install passlib[bcrypt] or bcrypt to generate demo password hashes."
        ) from exc


def parse_db_info(dsn: str) -> tuple[str, str]:
    parsed = urlparse(dsn)
    return parsed.hostname or "unknown", (parsed.path or "/unknown").lstrip("/")


def qident(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def fq(schema: str, table: str) -> str:
    return f"{qident(schema)}.{qident(table)}"


def fetch_one(cur: Any, query: str, params: tuple | dict | None = None) -> dict | None:
    cur.execute(query, params)
    row = cur.fetchone()
    return dict(row) if row else None


def fetch_all(cur: Any, query: str, params: tuple | dict | None = None) -> list[dict]:
    cur.execute(query, params)
    return [dict(row) for row in cur.fetchall()]


def discover_context(conn: Any) -> DbContext:
    wanted = [
        "auth_user", "auth_role", "auth_user_role", "advisor_profile", "aneti_agency",
        "employer", "employer_contact", "employer_location", "employer_status_history",
        "job_seeker", "job_seeker_identity", "job_seeker_contact",
        "job_seeker_education", "job_seeker_experience", "job_seeker_skill",
        "job_seeker_language", "job_seeker_preference", "job_seeker_cv",
        "job_offer", "job_offer_requirement",
        "matching_criterion", "matching_model", "matching_model_version",
        "matching_model_criterion", "matching_hard_filter", "matching_run",
        "matching_result", "matching_result_detail", "matching_search",
        "matching_search_criterion",
        "ref_n_gouvern", "ref_n_delegat",
    ]

    schemas: dict[str, str] = {}
    columns: dict[str, set[str]] = {}
    unique_constraints: dict[str, list[list[str]]] = {}

    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        for table in wanted:
            rows = fetch_all(
                cur,
                """
                SELECT table_schema, column_name
                FROM information_schema.columns
                WHERE table_name = %s
                  AND table_schema NOT IN ('pg_catalog', 'information_schema')
                ORDER BY
                  CASE table_schema
                    WHEN 'aneti' THEN 1
                    WHEN 'matching' THEN 2
                    WHEN 'iam' THEN 3
                    WHEN 'audit' THEN 4
                    WHEN 'taxonomy' THEN 5
                    WHEN 'public' THEN 6
                    ELSE 99
                  END,
                  ordinal_position
                """,
                (table,),
            )
            if not rows:
                continue
            schema = rows[0]["table_schema"]
            schemas[table] = schema
            columns[table] = {r["column_name"] for r in rows if r["table_schema"] == schema}

            cons_rows = fetch_all(
                cur,
                """
                SELECT
                  c.conname,
                  c.contype,
                  array_agg(a.attname ORDER BY u.ord) AS cols
                FROM pg_constraint c
                JOIN pg_class cl ON cl.oid = c.conrelid
                JOIN pg_namespace n ON n.oid = cl.relnamespace
                JOIN unnest(c.conkey) WITH ORDINALITY AS u(attnum, ord) ON true
                JOIN pg_attribute a ON a.attrelid = cl.oid AND a.attnum = u.attnum
                WHERE n.nspname = %s
                  AND cl.relname = %s
                  AND c.contype IN ('u', 'p')
                GROUP BY c.conname, c.contype
                """,
                (schema, table),
            )
            unique_constraints[table] = [list(r["cols"]) for r in cons_rows]

    missing = [
        t for t in [
            "auth_user", "auth_role", "auth_user_role", "job_seeker", "job_offer",
            "job_offer_requirement", "matching_model", "matching_model_version",
            "matching_criterion", "matching_model_criterion",
        ]
        if t not in schemas
    ]
    if missing:
        raise RuntimeError(f"Required tables not found in DB: {missing}")

    return DbContext(conn=conn, schemas=schemas, columns=columns, unique_constraints=unique_constraints)


def has_col(ctx: DbContext, table: str, column: str) -> bool:
    return column in ctx.columns.get(table, set())


def table(ctx: DbContext, name: str) -> str:
    if name not in ctx.schemas:
        raise RuntimeError(f"Table {name!r} not found")
    return fq(ctx.schemas[name], name)


def json_param(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def uuid4() -> str:
    return str(uuid.uuid4())


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Safety and deletion
# ---------------------------------------------------------------------------

def count_existing_demo_users(ctx: DbContext) -> int:
    with ctx.conn.cursor() as cur:
        cur.execute(
            f"SELECT COUNT(*) FROM {table(ctx, 'auth_user')} WHERE email LIKE %s",
            (f"%{DEMO_EMAIL_SUFFIX}",),
        )
        return int(cur.fetchone()[0])


def print_safety_banner(dsn: str, mode: str, demo_count: int) -> None:
    host, dbname = parse_db_info(dsn)
    print("=" * 78)
    print("ANETI PEAP / MatchCore demo seed")
    print("=" * 78)
    print(f"Database host : {host}")
    print(f"Database name : {dbname}")
    print(f"Mode          : {mode}")
    print(f"Demo users    : {demo_count}")
    print("=" * 78)


def confirm_or_exit(args: argparse.Namespace) -> None:
    if args.yes or args.dry_run:
        return
    answer = input("Continue? Type 'yes' to confirm: ").strip().lower()
    if answer != "yes":
        raise SystemExit("Aborted.")


def reset_demo(ctx: DbContext) -> dict[str, int]:
    """Delete only demo records identifiable by demo emails/users."""
    counts: dict[str, int] = {}
    with ctx.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        demo_users = fetch_all(
            cur,
            f"SELECT id FROM {table(ctx, 'auth_user')} WHERE email LIKE %s",
            (f"%{DEMO_EMAIL_SUFFIX}",),
        )
        user_ids = [str(r["id"]) for r in demo_users]
        if not user_ids:
            return {"demo_users_deleted": 0}

        def delete(query: str, params: dict | tuple | None = None, key: str = "deleted") -> None:
            cur.execute(query, params)
            counts[key] = counts.get(key, 0) + cur.rowcount

        # Resolve demo ids.
        employer_ids: list[str] = []
        job_seeker_ids: list[str] = []
        offer_ids: list[str] = []
        result_ids: list[str] = []
        run_ids: list[str] = []

        if "employer" in ctx.schemas:
            rows = fetch_all(
                cur,
                f"SELECT id FROM {table(ctx, 'employer')} WHERE user_id = ANY(%s::uuid[])",
                (user_ids,),
            )
            employer_ids = [str(r["id"]) for r in rows]

        if "job_seeker" in ctx.schemas:
            rows = fetch_all(
                cur,
                f"SELECT id FROM {table(ctx, 'job_seeker')} WHERE user_id = ANY(%s::uuid[])",
                (user_ids,),
            )
            job_seeker_ids = [str(r["id"]) for r in rows]

        if employer_ids and "job_offer" in ctx.schemas:
            rows = fetch_all(
                cur,
                f"SELECT id FROM {table(ctx, 'job_offer')} WHERE employer_id = ANY(%s::uuid[])",
                (employer_ids,),
            )
            offer_ids = [str(r["id"]) for r in rows]

        # Matching artifacts referencing demo data.
        if "matching_result" in ctx.schemas:
            conditions = []
            params: dict[str, Any] = {}
            if offer_ids:
                conditions.append("offer_id = ANY(%(offer_ids)s::uuid[])")
                params["offer_ids"] = offer_ids
            if job_seeker_ids:
                conditions.append("candidate_id = ANY(%(job_seeker_ids)s::uuid[])")
                params["job_seeker_ids"] = job_seeker_ids
            if conditions:
                rows = fetch_all(
                    cur,
                    f"SELECT id, run_id FROM {table(ctx, 'matching_result')} WHERE {' OR '.join(conditions)}",
                    params,
                )
                result_ids = [str(r["id"]) for r in rows]
                run_ids.extend(str(r["run_id"]) for r in rows if r.get("run_id"))

        if result_ids and "matching_result_detail" in ctx.schemas:
            delete(
                f"DELETE FROM {table(ctx, 'matching_result_detail')} WHERE result_id = ANY(%s::uuid[])",
                (result_ids,),
                "matching_result_details",
            )
        if result_ids and "matching_result" in ctx.schemas:
            delete(
                f"DELETE FROM {table(ctx, 'matching_result')} WHERE id = ANY(%s::uuid[])",
                (result_ids,),
                "matching_results",
            )

        if "matching_run" in ctx.schemas:
            rows = fetch_all(
                cur,
                f"""
                SELECT id FROM {table(ctx, 'matching_run')}
                WHERE launched_by_user_id = ANY(%(user_ids)s::uuid[])
                   OR source_entity_id = ANY(%(source_ids)s)
                   OR id = ANY(%(run_ids)s::uuid[])
                """,
                {
                    "user_ids": user_ids,
                    "source_ids": offer_ids + job_seeker_ids,
                    "run_ids": list(set(run_ids)) or [str(uuid.UUID(int=0))],
                },
            )
            more_run_ids = [str(r["id"]) for r in rows]
            if more_run_ids:
                delete(
                    f"DELETE FROM {table(ctx, 'matching_run')} WHERE id = ANY(%s::uuid[])",
                    (more_run_ids,),
                    "matching_runs",
                )

        # Offers.
        if offer_ids and "job_offer_requirement" in ctx.schemas:
            delete(
                f"DELETE FROM {table(ctx, 'job_offer_requirement')} WHERE offer_id = ANY(%s::uuid[])",
                (offer_ids,),
                "offer_requirements",
            )
        if offer_ids and "job_offer" in ctx.schemas:
            delete(
                f"DELETE FROM {table(ctx, 'job_offer')} WHERE id = ANY(%s::uuid[])",
                (offer_ids,),
                "offers",
            )

        # Employers.
        for child in ["employer_status_history", "employer_contact", "employer_location"]:
            if employer_ids and child in ctx.schemas:
                delete(
                    f"DELETE FROM {table(ctx, child)} WHERE employer_id = ANY(%s::uuid[])",
                    (employer_ids,),
                    child,
                )
        if employer_ids and "employer" in ctx.schemas:
            delete(
                f"DELETE FROM {table(ctx, 'employer')} WHERE id = ANY(%s::uuid[])",
                (employer_ids,),
                "employers",
            )

        # Job seekers.
        for child in [
            "job_seeker_preference", "job_seeker_language", "job_seeker_skill",
            "job_seeker_experience", "job_seeker_education", "job_seeker_contact",
            "job_seeker_identity", "job_seeker_cv",
        ]:
            if job_seeker_ids and child in ctx.schemas:
                delete(
                    f"DELETE FROM {table(ctx, child)} WHERE job_seeker_id = ANY(%s::uuid[])",
                    (job_seeker_ids,),
                    child,
                )
        if job_seeker_ids and "job_seeker" in ctx.schemas:
            delete(
                f"DELETE FROM {table(ctx, 'job_seeker')} WHERE id = ANY(%s::uuid[])",
                (job_seeker_ids,),
                "job_seekers",
            )

        # Advisors.
        if "advisor_profile" in ctx.schemas:
            delete(
                f"DELETE FROM {table(ctx, 'advisor_profile')} WHERE user_id = ANY(%s::uuid[])",
                (user_ids,),
                "advisor_profiles",
            )

        # User roles and users.
        delete(
            f"DELETE FROM {table(ctx, 'auth_user_role')} WHERE user_id = ANY(%s::uuid[])",
            (user_ids,),
            "auth_user_roles",
        )
        delete(
            f"DELETE FROM {table(ctx, 'auth_user')} WHERE id = ANY(%s::uuid[])",
            (user_ids,),
            "auth_users",
        )

    return counts


# ---------------------------------------------------------------------------
# Insertion helpers
# ---------------------------------------------------------------------------

def upsert_role(ctx: DbContext, cur: Any, code: str, label: str) -> str:
    row = fetch_one(cur, f"SELECT id FROM {table(ctx, 'auth_role')} WHERE code = %s", (code,))
    if row:
        cur.execute(f"UPDATE {table(ctx, 'auth_role')} SET label = %s WHERE id = %s", (label, row["id"]))
        return str(row["id"])

    rid = uuid4()
    cols = ["id", "code", "label"]
    cur.execute(
        f"INSERT INTO {table(ctx, 'auth_role')} ({', '.join(cols)}) VALUES (%s, %s, %s)",
        (rid, code, label),
    )
    return rid


def upsert_user(ctx: DbContext, cur: Any, email: str, password_hash: str, phone: str | None = None) -> str:
    row = fetch_one(cur, f"SELECT id FROM {table(ctx, 'auth_user')} WHERE email = %s", (email,))
    if row:
        cur.execute(
            f"""
            UPDATE {table(ctx, 'auth_user')}
            SET password_hash = %s, phone = COALESCE(%s, phone), status = 'ACTIVE', updated_at = now()
            WHERE id = %s
            """,
            (password_hash, phone, row["id"]),
        )
        return str(row["id"])

    uid = uuid4()
    cur.execute(
        f"""
        INSERT INTO {table(ctx, 'auth_user')}
            (id, email, password_hash, phone, status, created_at, updated_at)
        VALUES
            (%s, %s, %s, %s, 'ACTIVE', now(), now())
        """,
        (uid, email, password_hash, phone),
    )
    return uid


def assign_role(ctx: DbContext, cur: Any, user_id: str, role_id: str) -> None:
    row = fetch_one(
        cur,
        f"SELECT 1 FROM {table(ctx, 'auth_user_role')} WHERE user_id = %s AND role_id = %s",
        (user_id, role_id),
    )
    if row:
        return
    cur.execute(
        f"""
        INSERT INTO {table(ctx, 'auth_user_role')} (user_id, role_id, assigned_at)
        VALUES (%s, %s, now())
        """,
        (user_id, role_id),
    )


def upsert_agency(ctx: DbContext, cur: Any, code: str, name: str, governorate: str, delegation: str) -> str:
    row = fetch_one(cur, f"SELECT id FROM {table(ctx, 'aneti_agency')} WHERE code = %s", (code,))
    if row:
        cur.execute(
            f"""
            UPDATE {table(ctx, 'aneti_agency')}
            SET name = %s, governorate = %s, delegation = %s, active = true, updated_at = now()
            WHERE id = %s
            """,
            (name, governorate, delegation, row["id"]),
        )
        return str(row["id"])

    aid = uuid4()
    cur.execute(
        f"""
        INSERT INTO {table(ctx, 'aneti_agency')}
            (id, code, name, governorate, delegation, address, active, created_at, updated_at)
        VALUES
            (%s, %s, %s, %s, %s, %s, true, now(), now())
        """,
        (aid, code, name, governorate, delegation, f"Agence {name}, {governorate}"),
    )
    return aid


def insert_advisor_profile(ctx: DbContext, cur: Any, user_id: str, agency_id: str | None, full_name: str, position: str) -> str:
    row = fetch_one(cur, f"SELECT id FROM {table(ctx, 'advisor_profile')} WHERE user_id = %s", (user_id,))
    if row:
        cur.execute(
            f"""
            UPDATE {table(ctx, 'advisor_profile')}
            SET agency_id = %s, full_name = %s, position = %s, active = true, updated_at = now()
            WHERE id = %s
            """,
            (agency_id, full_name, position, row["id"]),
        )
        return str(row["id"])

    pid = uuid4()
    cur.execute(
        f"""
        INSERT INTO {table(ctx, 'advisor_profile')}
            (id, user_id, agency_id, full_name, position, active, created_at, updated_at)
        VALUES
            (%s, %s, %s, %s, %s, true, now(), now())
        """,
        (pid, user_id, agency_id, full_name, position),
    )
    return pid


def get_geo_values(ctx: DbContext, cur: Any) -> list[dict[str, str | None]]:
    """Return safe governorate/delegation code pairs from referentials when available."""
    values: list[dict[str, str | None]] = []

    if "ref_n_gouvern" in ctx.schemas and "ref_n_delegat" in ctx.schemas:
        try:
            rows = fetch_all(
                cur,
                f"""
                SELECT
                    g.code_gouvernorat,
                    g.libelle_gouvernorat,
                    d.code_delegation,
                    d.libelle_delegation
                FROM {table(ctx, 'ref_n_gouvern')} g
                LEFT JOIN {table(ctx, 'ref_n_delegat')} d
                  ON d.code_gouvernorat = g.code_gouvernorat
                ORDER BY g.code_gouvernorat, d.code_delegation
                LIMIT 200
                """,
            )
            for r in rows:
                values.append(
                    {
                        "governorate_code": r["code_gouvernorat"],
                        "governorate_label": r["libelle_gouvernorat"],
                        "delegation_code": r["code_delegation"],
                        "delegation_label": r["libelle_delegation"],
                    }
                )
        except Exception:
            values = []

    if values:
        return values

    return [
        {
            "governorate_code": code,
            "governorate_label": label,
            "delegation_code": None,
            "delegation_label": None,
        }
        for code, label in GOVERNORATE_FALLBACKS
    ]


def insert_employer_bundle(
    ctx: DbContext,
    cur: Any,
    *,
    user_id: str,
    index: int,
    company_name: str,
    geo: dict[str, str | None],
) -> str:
    row = fetch_one(cur, f"SELECT id FROM {table(ctx, 'employer')} WHERE user_id = %s", (user_id,))
    sector = random.choice(["IT", "SERVICES", "INDUSTRY", "FINANCE", "COMMERCE"])
    if row:
        employer_id = str(row["id"])
        cur.execute(
            f"""
            UPDATE {table(ctx, 'employer')}
            SET legal_name = %s, commercial_name = %s, sector_code = %s, status = 'ACTIVE', updated_at = now()
            WHERE id = %s
            """,
            (company_name, company_name, sector, employer_id),
        )
    else:
        employer_id = uuid4()
        cur.execute(
            f"""
            INSERT INTO {table(ctx, 'employer')}
                (id, user_id, legal_name, commercial_name, tax_identifier, sector_code,
                 size_category, status, created_at, updated_at)
            VALUES
                (%s, %s, %s, %s, %s, %s, %s, 'ACTIVE', now(), now())
            """,
            (
                employer_id,
                user_id,
                company_name,
                company_name,
                f"MF-DEMO-{index:04d}",
                sector,
                random.choice(["SMALL", "MEDIUM", "LARGE"]),
            ),
        )

    # Contact.
    contact_row = fetch_one(cur, f"SELECT id FROM {table(ctx, 'employer_contact')} WHERE employer_id = %s", (employer_id,))
    contact_name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
    if contact_row:
        cur.execute(
            f"""
            UPDATE {table(ctx, 'employer_contact')}
            SET contact_name = %s, job_title = 'Responsable recrutement',
                email = %s, phone = %s, website = %s, updated_at = now()
            WHERE id = %s
            """,
            (contact_name, f"hr{index:03d}.demo@aneti.tn", f"+216 20 {index:03d} {100+index:03d}", f"https://demo-company-{index:03d}.example", contact_row["id"]),
        )
    else:
        cur.execute(
            f"""
            INSERT INTO {table(ctx, 'employer_contact')}
                (id, employer_id, contact_name, job_title, email, phone, website, created_at, updated_at)
            VALUES
                (%s, %s, %s, 'Responsable recrutement', %s, %s, %s, now(), now())
            """,
            (uuid4(), employer_id, contact_name, f"hr{index:03d}.demo@aneti.tn", f"+216 20 {index:03d} {100+index:03d}", f"https://demo-company-{index:03d}.example"),
        )

    # Location.
    location_row = fetch_one(cur, f"SELECT id FROM {table(ctx, 'employer_location')} WHERE employer_id = %s", (employer_id,))
    if location_row:
        cur.execute(
            f"""
            UPDATE {table(ctx, 'employer_location')}
            SET address = %s, governorate_code = %s, delegation_code = %s, country = 'TN', updated_at = now()
            WHERE id = %s
            """,
            (f"Adresse demo {index}, Tunisie", geo["governorate_code"], geo["delegation_code"], location_row["id"]),
        )
    else:
        cur.execute(
            f"""
            INSERT INTO {table(ctx, 'employer_location')}
                (id, employer_id, address, governorate_code, delegation_code, created_at, updated_at, country)
            VALUES
                (%s, %s, %s, %s, %s, now(), now(), 'TN')
            """,
            (uuid4(), employer_id, f"Adresse demo {index}, Tunisie", geo["governorate_code"], geo["delegation_code"]),
        )

    return employer_id


def insert_job_seeker_bundle(
    ctx: DbContext,
    cur: Any,
    *,
    user_id: str,
    index: int,
    spec: dict[str, Any],
    geo: dict[str, str | None],
    language_allowed: bool,
) -> str:
    row = fetch_one(cur, f"SELECT id FROM {table(ctx, 'job_seeker')} WHERE user_id = %s", (user_id,))
    if row:
        job_seeker_id = str(row["id"])
        cur.execute(
            f"""
            UPDATE {table(ctx, 'job_seeker')}
            SET status = 'ACTIVE', primary_language = 'fr', updated_at = now()
            WHERE id = %s
            """,
            (job_seeker_id,),
        )
    else:
        job_seeker_id = uuid4()
        cur.execute(
            f"""
            INSERT INTO {table(ctx, 'job_seeker')}
                (id, user_id, aneti_identifier, status, registration_date,
                 primary_language, created_at, updated_at)
            VALUES
                (%s, %s, %s, 'ACTIVE', %s, 'fr', now(), now())
            """,
            (job_seeker_id, user_id, f"DEMO-JS-{index:04d}", date(2025, 1, 1) + timedelta(days=index % 300)),
        )

    first_name = FIRST_NAMES[index % len(FIRST_NAMES)]
    last_name = LAST_NAMES[(index * 3) % len(LAST_NAMES)]

    # Identity.
    row = fetch_one(cur, f"SELECT id FROM {table(ctx, 'job_seeker_identity')} WHERE job_seeker_id = %s", (job_seeker_id,))
    birth_year = 1985 + (index % 20)
    if row:
        cur.execute(
            f"""
            UPDATE {table(ctx, 'job_seeker_identity')}
            SET first_name = %s, last_name = %s, birth_date = %s, nationality = 'TN', updated_at = now()
            WHERE id = %s
            """,
            (first_name, last_name, date(birth_year, 1 + index % 12, 1 + index % 25), row["id"]),
        )
    else:
        cur.execute(
            f"""
            INSERT INTO {table(ctx, 'job_seeker_identity')}
                (id, job_seeker_id, cin, passport_number, first_name, last_name,
                 birth_date, gender_code, nationality, created_at, updated_at)
            VALUES
                (%s, %s, %s, NULL, %s, %s, %s, NULL, 'TN', now(), now())
            """,
            (uuid4(), job_seeker_id, f"DEMO{index:08d}", first_name, last_name, date(birth_year, 1 + index % 12, 1 + index % 25)),
        )

    # Contact.
    row = fetch_one(cur, f"SELECT id FROM {table(ctx, 'job_seeker_contact')} WHERE job_seeker_id = %s", (job_seeker_id,))
    if row:
        cur.execute(
            f"""
            UPDATE {table(ctx, 'job_seeker_contact')}
            SET email = %s, phone = %s, address = %s,
                governorate_code = %s, delegation_code = %s, country = 'TN', updated_at = now()
            WHERE id = %s
            """,
            (f"candidate{index:03d}{DEMO_EMAIL_SUFFIX}", f"+216 50 {index:03d} {200+index:03d}", f"Adresse candidat demo {index}", geo["governorate_code"], geo["delegation_code"], row["id"]),
        )
    else:
        cur.execute(
            f"""
            INSERT INTO {table(ctx, 'job_seeker_contact')}
                (id, job_seeker_id, email, phone, address, governorate_code,
                 delegation_code, created_at, updated_at, country)
            VALUES
                (%s, %s, %s, %s, %s, %s, %s, now(), now(), 'TN')
            """,
            (uuid4(), job_seeker_id, f"candidate{index:03d}{DEMO_EMAIL_SUFFIX}", f"+216 50 {index:03d} {200+index:03d}", f"Adresse candidat demo {index}", geo["governorate_code"], geo["delegation_code"]),
        )

    # Clear and recreate child rows for deterministic output.
    for child in ["job_seeker_education", "job_seeker_experience", "job_seeker_skill"]:
        cur.execute(f"DELETE FROM {table(ctx, child)} WHERE job_seeker_id = %s", (job_seeker_id,))

    # Education rows.
    edu_count = 1 + (index % 2)
    for j in range(edu_count):
        cur.execute(
            f"""
            INSERT INTO {table(ctx, 'job_seeker_education')}
                (id, job_seeker_id, level_code, diploma_label, specialty, institution,
                 graduation_year, rtmc_education_node_id, created_at, updated_at)
            VALUES
                (%s, %s, %s, %s, %s, %s, %s, NULL, now(), now())
            """,
            (
                uuid4(),
                job_seeker_id,
                random.choice(["BTS", "LICENCE", "MASTER", "INGENIEUR"]),
                random.choice(spec["education"]),
                spec["label"],
                random.choice(["ISSAT Sousse", "ENIT", "FST", "ISET", "Université de Sfax", "Université de Tunis"]),
                2016 + ((index + j) % 9),
            ),
        )

    # Experience rows.
    exp_count = 1 + (index % 3)
    for j in range(exp_count):
        months = 6 + ((index + j) % 48)
        start = date(2018 + ((index + j) % 5), 1 + ((index + j) % 12), 1)
        end = start + timedelta(days=months * 30)
        cur.execute(
            f"""
            INSERT INTO {table(ctx, 'job_seeker_experience')}
                (id, job_seeker_id, occupation_id, job_title_raw, company_name, sector,
                 start_date, end_date, duration_months, description, created_at, updated_at)
            VALUES
                (%s, %s, NULL, %s, %s, %s, %s, %s, %s, %s, now(), now())
            """,
            (
                uuid4(),
                job_seeker_id,
                random.choice(spec["titles"]),
                random.choice(COMPANY_NAMES),
                spec["label"],
                start,
                end,
                months,
                f"Expérience demo en {spec['label']} avec responsabilités opérationnelles et projets clients.",
            ),
        )

    # Skills.
    skill_count = min(len(spec["skills"]), 4 + (index % 7))
    skills = random.sample(spec["skills"], skill_count)
    # Add some overlap to help matching.
    if "Python" in spec["skills"] and "Python" not in skills:
        skills[0] = "Python"
    for skill in skills:
        cur.execute(
            f"""
            INSERT INTO {table(ctx, 'job_seeker_skill')}
                (id, job_seeker_id, skill_id, skill_label_raw, level, years,
                 evidence, source, created_at, updated_at)
            VALUES
                (%s, %s, NULL, %s, %s, %s, %s, 'PARSING', now(), now())
            """,
            (
                uuid4(),
                job_seeker_id,
                skill,
                random.choice(["beginner", "intermediate", "advanced"]),
                Decimal(str(1 + (index % 6))),
                f"Compétence utilisée dans des projets demo {spec['label']}.",
            ),
        )

    # Language.
    if language_allowed and "job_seeker_language" in ctx.schemas:
        cur.execute(f"DELETE FROM {table(ctx, 'job_seeker_language')} WHERE job_seeker_id = %s", (job_seeker_id,))
        lang_code, level = random.choice(LANGUAGES)
        try:
            cur.execute(
                f"""
                INSERT INTO {table(ctx, 'job_seeker_language')}
                    (id, job_seeker_id, language_code, level, evidence, created_at, updated_at)
                VALUES
                    (%s, %s, %s, %s, 'PARSING', now(), now())
                ON CONFLICT DO NOTHING
                """,
                (uuid4(), job_seeker_id, lang_code, level),
            )
        except Exception:
            ctx.conn.rollback()
            raise

    # Preference.
    row = fetch_one(cur, f"SELECT id FROM {table(ctx, 'job_seeker_preference')} WHERE job_seeker_id = %s", (job_seeker_id,))
    pref_contract = random.choice(["CDI", "CDD", "SIVP", "STAGE", "FREELANCE"])
    if row:
        cur.execute(
            f"""
            UPDATE {table(ctx, 'job_seeker_preference')}
            SET preferred_contract_type = %s, preferred_governorate = %s,
                mobility_radius_km = %s, accepts_relocation = %s,
                desired_salary_min = %s, desired_salary_max = %s, updated_at = now()
            WHERE id = %s
            """,
            (pref_contract, geo["governorate_code"], Decimal("30"), bool(index % 3 == 0), Decimal(str(900 + (index % 10) * 100)), Decimal(str(1800 + (index % 10) * 150)), row["id"]),
        )
    else:
        cur.execute(
            f"""
            INSERT INTO {table(ctx, 'job_seeker_preference')}
                (id, job_seeker_id, preferred_contract_type, preferred_governorate,
                 mobility_radius_km, accepts_relocation, desired_salary_min,
                 desired_salary_max, created_at, updated_at)
            VALUES
                (%s, %s, %s, %s, %s, %s, %s, %s, now(), now())
            """,
            (uuid4(), job_seeker_id, pref_contract, geo["governorate_code"], Decimal("30"), bool(index % 3 == 0), Decimal(str(900 + (index % 10) * 100)), Decimal(str(1800 + (index % 10) * 150))),
        )

    return job_seeker_id


def insert_offer(
    ctx: DbContext,
    cur: Any,
    *,
    employer_id: str,
    created_by_user_id: str,
    index: int,
    spec: dict[str, Any],
    geo: dict[str, str | None],
) -> str:
    offer_id = uuid4()
    title = random.choice(spec["offer_titles"])
    contract_type = random.choice(["CDI", "CDD", "SIVP", "STAGE"])
    work_mode = random.choice(["ONSITE", "HYBRID", "REMOTE"])
    salary_min = Decimal(str(900 + (index % 12) * 100))
    salary_max = salary_min + Decimal(str(600 + (index % 6) * 150))
    description = (
        f"Offre demo: {title}. Nous recherchons un profil en {spec['label']} "
        f"avec bonnes compétences pratiques, autonomie et capacité de communication."
    )

    cur.execute(
        f"""
        INSERT INTO {table(ctx, 'job_offer')}
            (id, employer_id, rtmc_occupation_id, title, description,
             number_of_positions, status, contract_type, work_mode,
             salary_min, salary_max, governorate_code, delegation_code,
             published_at, deadline_at, created_by_user_id, validated_by_user_id,
             created_at, updated_at, country)
        VALUES
            (%s, %s, NULL, %s, %s, %s, 'PUBLISHED', %s, %s,
             %s, %s, %s, %s, now(), %s, %s, NULL, now(), now(), 'TN')
        """,
        (
            offer_id,
            employer_id,
            title,
            description,
            1 + (index % 4),
            contract_type,
            work_mode,
            salary_min,
            salary_max,
            geo["governorate_code"],
            geo["delegation_code"],
            now_utc() + timedelta(days=30 + (index % 60)),
            created_by_user_id,
        ),
    )

    skills = random.sample(spec["skills"], min(len(spec["skills"]), 4 + (index % 5)))
    for sidx, skill in enumerate(skills):
        insert_requirement(ctx, cur, offer_id, "SKILL", skill, sidx, True)

    # Add language requirement for a subset.
    if index % 3 == 0:
        insert_requirement(ctx, cur, offer_id, "LANGUAGE", "fr", 99, False, min_level="B2", weight=5)

    return offer_id


def insert_requirement(
    ctx: DbContext,
    cur: Any,
    offer_id: str,
    criterion_type: str,
    raw_value: str,
    index: int,
    is_must: bool,
    *,
    min_level: str | None = None,
    weight: int | None = None,
) -> None:
    cols = [
        "id", "offer_id", "criterion_type", "node_id", "raw_value",
        "min_level", "min_years", "is_must", "weight", "created_at", "updated_at"
    ]
    vals: list[Any] = [
        uuid4(),
        offer_id,
        criterion_type,
        None,
        raw_value,
        min_level or random.choice(["beginner", "intermediate", "advanced"]),
        None,
        is_must,
        weight if weight is not None else random.choice([10, 15, 20, 25, 30]),
        now_utc(),
        now_utc(),
    ]

    if has_col(ctx, "job_offer_requirement", "metadata_json"):
        cols.append("metadata_json")
        vals.append(json_param({"seed": "PARSING", "raw_value": raw_value}))

    placeholders = ", ".join(["%s"] * len(cols))
    cur.execute(
        f"INSERT INTO {table(ctx, 'job_offer_requirement')} ({', '.join(cols)}) VALUES ({placeholders})",
        vals,
    )


def exact_unique(ctx: DbContext, table_name: str, cols: list[str]) -> bool:
    target = sorted(cols)
    for uc in ctx.unique_constraints.get(table_name, []):
        if sorted(uc) == target:
            return True
    return False


def language_seeding_allowed(ctx: DbContext) -> bool:
    # If language_code alone is unique, seeding repeated fr/en/ar will fail.
    if exact_unique(ctx, "job_seeker_language", ["language_code"]):
        return False
    return "job_seeker_language" in ctx.schemas


def ensure_matching_config(ctx: DbContext, cur: Any, created_by_user_id: str | None = None) -> dict[str, str]:
    criteria = [
        ("SKILLS_MATCH", "Skills match", "Similarity between offer requirements and candidate skills", "NUMBER", 40),
        ("EXPERIENCE_MATCH", "Experience match", "Candidate experience duration and job history", "NUMBER", 20),
        ("EDUCATION_MATCH", "Education match", "Candidate education alignment", "NUMBER", 10),
        ("LOCATION_MATCH", "Location match", "Geographic compatibility", "NUMBER", 10),
        ("LANGUAGE_MATCH", "Language match", "Language requirements compatibility", "NUMBER", 10),
        ("CONTRACT_MATCH", "Contract match", "Preferred contract compatibility", "NUMBER", 10),
    ]

    criterion_ids: dict[str, str] = {}
    for code, label, desc, data_type, _weight in criteria:
        row = fetch_one(cur, f"SELECT id FROM {table(ctx, 'matching_criterion')} WHERE code = %s", (code,))
        if row:
            cid = str(row["id"])
            cur.execute(
                f"""
                UPDATE {table(ctx, 'matching_criterion')}
                SET label = %s, description = %s, data_type = %s, active = true
                WHERE id = %s
                """,
                (label, desc, data_type, cid),
            )
        else:
            cid = uuid4()
            cur.execute(
                f"""
                INSERT INTO {table(ctx, 'matching_criterion')}
                    (id, code, label, description, data_type, active)
                VALUES
                    (%s, %s, %s, %s, %s, true)
                """,
                (cid, code, label, desc, data_type),
            )
        criterion_ids[code] = cid

    model_row = fetch_one(cur, f"SELECT id FROM {table(ctx, 'matching_model')} WHERE code = %s", ("DEFAULT_OFFER_TO_CANDIDATE",))
    if model_row:
        model_id = str(model_row["id"])
        cur.execute(
            f"""
            UPDATE {table(ctx, 'matching_model')}
            SET label = 'Default Offer to Candidates',
                direction = 'OFFER_TO_CANDIDATE',
                description = 'Default demo matching model for offer to candidates',
                active = true
            WHERE id = %s
            """,
            (model_id,),
        )
    else:
        model_id = uuid4()
        cur.execute(
            f"""
            INSERT INTO {table(ctx, 'matching_model')}
                (id, code, label, direction, description, active)
            VALUES
                (%s, 'DEFAULT_OFFER_TO_CANDIDATE', 'Default Offer to Candidates',
                 'OFFER_TO_CANDIDATE', 'Default demo matching model for offer to candidates', true)
            """,
            (model_id,),
        )

    version_row = fetch_one(
        cur,
        f"SELECT id FROM {table(ctx, 'matching_model_version')} WHERE model_id = %s AND version_number = 1",
        (model_id,),
    )
    if version_row:
        version_id = str(version_row["id"])
        cur.execute(
            f"""
            UPDATE {table(ctx, 'matching_model_version')}
            SET status = 'ACTIVE', published_at = COALESCE(published_at, now())
            WHERE id = %s
            """,
            (version_id,),
        )
    else:
        version_id = uuid4()
        cur.execute(
            f"""
            INSERT INTO {table(ctx, 'matching_model_version')}
                (id, model_id, version_number, status, created_by_user_id, created_at, published_at)
            VALUES
                (%s, %s, 1, 'ACTIVE', %s, now(), now())
            """,
            (version_id, model_id, created_by_user_id),
        )

    # Upsert model criteria by checking existing rows.
    for code, _label, _desc, _data_type, weight in criteria:
        existing = fetch_one(
            cur,
            f"""
            SELECT id FROM {table(ctx, 'matching_model_criterion')}
            WHERE model_version_id = %s AND criterion_id = %s
            """,
            (version_id, criterion_ids[code]),
        )
        if existing:
            cur.execute(
                f"""
                UPDATE {table(ctx, 'matching_model_criterion')}
                SET weight = %s, is_must = false, min_threshold = NULL, logic_operator = 'AND'
                WHERE id = %s
                """,
                (Decimal(str(weight)), existing["id"]),
            )
        else:
            cur.execute(
                f"""
                INSERT INTO {table(ctx, 'matching_model_criterion')}
                    (id, model_version_id, criterion_id, weight, is_must, min_threshold, logic_operator)
                VALUES
                    (%s, %s, %s, %s, false, NULL, 'AND')
                """,
                (uuid4(), version_id, criterion_ids[code], Decimal(str(weight))),
            )

    return {"model_id": model_id, "model_version_id": version_id}


# ---------------------------------------------------------------------------
# Main seed
# ---------------------------------------------------------------------------

def seed(ctx: DbContext, args: argparse.Namespace) -> dict[str, Any]:
    random.seed(RANDOM_SEED)
    stats: dict[str, Any] = {
        "users": 0,
        "advisors": 0,
        "employers": 0,
        "candidates": 0,
        "offers": 0,
        "requirements": 0,
        "matching_criteria": 6,
        "model_versions": 1,
        "warnings": [],
    }

    password_hash = hash_password(DEMO_PASSWORD)
    language_allowed = language_seeding_allowed(ctx)
    if not language_allowed:
        stats["warnings"].append(
            "job_seeker_language has UNIQUE(language_code) or table missing; language rows skipped."
        )

    with ctx.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        # Roles.
        role_ids = {
            "TECH_ADMIN": upsert_role(ctx, cur, "TECH_ADMIN", "Technical administrator"),
            "FUNCTIONAL_ADMIN": upsert_role(ctx, cur, "FUNCTIONAL_ADMIN", "Functional administrator"),
            "ANETI_ADVISOR": upsert_role(ctx, cur, "ANETI_ADVISOR", "ANETI advisor"),
            "EMPLOYER": upsert_role(ctx, cur, "EMPLOYER", "Employer"),
            "JOB_SEEKER": upsert_role(ctx, cur, "JOB_SEEKER", "Job seeker"),
        }

        geo_values = get_geo_values(ctx, cur)

        # Agencies.
        agencies = [
            ("AG-TUN-DEMO", "Agence ANETI Tunis Demo", "Tunis", "Tunis"),
            ("AG-SOU-DEMO", "Agence ANETI Sousse Demo", "Sousse", "Sousse"),
            ("AG-SFX-DEMO", "Agence ANETI Sfax Demo", "Sfax", "Sfax"),
            ("AG-NAB-DEMO", "Agence ANETI Nabeul Demo", "Nabeul", "Nabeul"),
            ("AG-MON-DEMO", "Agence ANETI Monastir Demo", "Monastir", "Monastir"),
        ]
        agency_ids = [upsert_agency(ctx, cur, *agency) for agency in agencies]

        # Admin + advisors.
        admin_specs = [
            ("tech.demo@aneti.tn", "TECH_ADMIN", None, None),
            ("functional.demo@aneti.tn", "FUNCTIONAL_ADMIN", None, None),
            ("advisor1.demo@aneti.tn", "ANETI_ADVISOR", agency_ids[0], "Conseiller emploi demo 1"),
            ("advisor2.demo@aneti.tn", "ANETI_ADVISOR", agency_ids[1], "Conseiller emploi demo 2"),
            ("advisor3.demo@aneti.tn", "ANETI_ADVISOR", agency_ids[2], "Conseiller emploi demo 3"),
        ]
        first_admin_user_id: str | None = None
        for idx, (email, role, agency_id, advisor_name) in enumerate(admin_specs, start=1):
            uid = upsert_user(ctx, cur, email, password_hash, f"+216 70 000 00{idx}")
            if first_admin_user_id is None:
                first_admin_user_id = uid
            assign_role(ctx, cur, uid, role_ids[role])
            stats["users"] += 1
            if role == "ANETI_ADVISOR":
                insert_advisor_profile(ctx, cur, uid, agency_id, advisor_name or "Conseiller demo", "Conseiller ANETI")
                stats["advisors"] += 1

        # Employers.
        employer_records: list[tuple[str, str]] = []  # employer_id, user_id
        for idx in range(2, TOTAL_EMPLOYERS + 1):
            email = f"employer{idx:03d}{DEMO_EMAIL_SUFFIX}"
            uid = upsert_user(ctx, cur, email, password_hash, f"+216 21 {idx:03d} {idx:03d}")
            assign_role(ctx, cur, uid, role_ids["EMPLOYER"])
            geo = geo_values[(idx - 1) % len(geo_values)]
            company = f"{COMPANY_NAMES[(idx - 1) % len(COMPANY_NAMES)]} Demo"
            employer_id = insert_employer_bundle(ctx, cur, user_id=uid, index=idx, company_name=company, geo=geo)
            employer_records.append((employer_id, uid))
            stats["users"] += 1
            stats["employers"] += 1

        # Candidates.
        candidate_idx = 1
        for spec in DOMAIN_SPECS:
            for _ in range(spec["count"]):
                email = f"candidate{candidate_idx:03d}{DEMO_EMAIL_SUFFIX}"
                uid = upsert_user(ctx, cur, email, password_hash, f"+216 50 {candidate_idx:03d} {candidate_idx:03d}")
                assign_role(ctx, cur, uid, role_ids["JOB_SEEKER"])
                geo = geo_values[(candidate_idx - 1) % len(geo_values)]
                insert_job_seeker_bundle(
                    ctx,
                    cur,
                    user_id=uid,
                    index=candidate_idx,
                    spec=spec,
                    geo=geo,
                    language_allowed=language_allowed,
                )
                candidate_idx += 1
                stats["users"] += 1
                stats["candidates"] += 1

        # Offers.
        for idx in range(1, TOTAL_OFFERS + 1):
            spec = DOMAIN_SPECS[(idx - 1) % len(DOMAIN_SPECS)]
            employer_id, employer_user_id = employer_records[(idx - 1) % len(employer_records)]
            geo = geo_values[(idx - 1) % len(geo_values)]
            before = fetch_one(cur, f"SELECT COUNT(*) AS c FROM {table(ctx, 'job_offer_requirement')}")
            insert_offer(ctx, cur, employer_id=employer_id, created_by_user_id=employer_user_id, index=idx, spec=spec, geo=geo)
            after = fetch_one(cur, f"SELECT COUNT(*) AS c FROM {table(ctx, 'job_offer_requirement')}")
            stats["offers"] += 1
            stats["requirements"] += int(after["c"]) - int(before["c"])

        # Matching config.
        matching_ids = ensure_matching_config(ctx, cur, created_by_user_id=first_admin_user_id)
        stats["matching_model_id"] = matching_ids["model_id"]
        stats["matching_model_version_id"] = matching_ids["model_version_id"]

    return stats


def print_validation_queries(model_version_id: str | None = None) -> None:
    print("\nValidation SQL:")
    print(
        """
-- candidates with skills
SELECT js.id, ji.first_name, ji.last_name, array_agg(jss.skill_label_raw) AS skills
FROM aneti.job_seeker js
LEFT JOIN aneti.job_seeker_identity ji ON ji.job_seeker_id = js.id
LEFT JOIN aneti.job_seeker_skill jss ON jss.job_seeker_id = js.id
GROUP BY js.id, ji.first_name, ji.last_name
ORDER BY js.created_at DESC
LIMIT 10;

-- offers with requirements
SELECT jo.id, jo.title, jo.status, array_agg(jor.raw_value) AS requirements
FROM aneti.job_offer jo
LEFT JOIN aneti.job_offer_requirement jor ON jor.offer_id = jo.id
GROUP BY jo.id, jo.title, jo.status
ORDER BY jo.created_at DESC
LIMIT 10;

-- active matching model version
SELECT mm.code, mm.direction, mm.active, mmv.id AS version_id, mmv.status
FROM matching.matching_model mm
JOIN matching.matching_model_version mmv ON mmv.model_id = mm.id
WHERE mm.code = 'DEFAULT_OFFER_TO_CANDIDATE';

-- sample ids for matching test
SELECT id AS offer_id, title
FROM aneti.job_offer
WHERE status = 'PUBLISHED'
ORDER BY created_at DESC
LIMIT 1;
"""
    )
    if model_version_id:
        print(f"-- seeded model_version_id: {model_version_id}")

    print(
        """
-- after login as advisor/tech admin, create a run:
POST http://localhost:8000/matching/runs
{
  "run_type": "MANUAL",
  "direction": "OFFER_TO_CANDIDATE",
  "model_version_id": "<MODEL_VERSION_ID>",
  "source_entity_type": "OFFER",
  "source_entity_id": "<OFFER_ID>",
  "parameters_json": {}
}

-- sync search index:
curl -X POST http://localhost:8000/tech-admin/services/search/sync -H "Authorization: Bearer TOKEN"
"""
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Seed ANETI PEAP demo data.")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="Run inside a transaction and roll back.")
    mode.add_argument("--apply", action="store_true", help="Apply seed without deleting existing demo data.")
    mode.add_argument("--reset-demo", action="store_true", help="Delete existing demo records, then seed.")
    parser.add_argument("--yes", action="store_true", help="Skip confirmation prompt.")
    parser.add_argument("--dsn", default=os.getenv("DATABASE_URL") or os.getenv("POSTGRES_DSN"), help="Database URL. Defaults to DATABASE_URL or POSTGRES_DSN.")
    args = parser.parse_args(argv)

    if not args.dry_run and not args.apply and not args.reset_demo:
        parser.print_help()
        print("\nRefusing to run without an explicit mode: --dry-run, --apply, or --reset-demo")
        return 2

    if not args.dsn:
        print("DATABASE_URL or POSTGRES_DSN is required.", file=sys.stderr)
        return 2

    conn = psycopg2.connect(args.dsn)
    conn.autocommit = False

    try:
        ctx = discover_context(conn)
        demo_count = count_existing_demo_users(ctx)
        mode_label = "dry-run" if args.dry_run else "reset-demo" if args.reset_demo else "apply"
        print_safety_banner(args.dsn, mode_label, demo_count)
        print("Detected schema mapping:")
        for t in sorted(ctx.schemas):
            print(f"  {t:<32} -> {ctx.schemas[t]}.{t}")

        if args.apply and demo_count > 0:
            print(
                "\nExisting demo users were found. --apply will upsert/skip many rows, "
                "but for a clean deterministic seed use --reset-demo --yes."
            )

        confirm_or_exit(args)

        reset_counts: dict[str, int] = {}
        if args.reset_demo:
            print("\nResetting demo data...")
            reset_counts = reset_demo(ctx)
            print(json.dumps(reset_counts, indent=2, default=str))

        print("\nSeeding demo data...")
        stats = seed(ctx, args)

        if args.dry_run:
            conn.rollback()
            print("\nDRY RUN complete. Transaction rolled back.")
        else:
            conn.commit()
            print("\nSeed committed.")

        print("\nDemo accounts:")
        print(f"  Password: {DEMO_PASSWORD}")
        print("  tech.demo@aneti.tn")
        print("  functional.demo@aneti.tn")
        print("  advisor1.demo@aneti.tn")
        print("  employer001.demo@aneti.tn")
        print("  candidate001.demo@aneti.tn")

        print("\nCounts:")
        print(json.dumps(stats, indent=2, default=str, ensure_ascii=False))

        if stats.get("warnings"):
            print("\nWarnings:")
            for warning in stats["warnings"]:
                print(f"  - {warning}")

        print_validation_queries(stats.get("matching_model_version_id"))
        return 0

    except Exception as exc:
        conn.rollback()
        print(f"\nSeed failed, transaction rolled back: {exc}", file=sys.stderr)
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
