"""
Logique métier pour l'inscription candidat avec vérification email OTP.

Flux :
1. register_start  → crée le compte (PENDING_VERIFICATION), génère OTP, envoie email
2. verify_email    → valide OTP, active le compte (ACTIVE), retourne un token JWT
3. resend_code     → invalide l'ancien code, en génère un nouveau, renvoie l'email

Table utilisée : iam.verification_code (migration 132)
"""

import json
import logging

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from .brevo import send_otp_email
from .otp import (
    OTP_DEV_LOG,
    OTP_MAX_ATTEMPTS,
    OTP_RESEND_COOLDOWN_SECONDS,
    OTP_TTL_MINUTES,
    generate_otp,
    hash_otp,
    verify_otp,
)
from .schemas import (
    CandidateRegisterStartRequest,
    CandidateRegisterStartResponse,
    CandidateResendCodeRequest,
    CandidateResendCodeResponse,
    CandidateVerifyEmailRequest,
    TokenResponse,
)
from .security import create_access_token
from .service import build_current_user_response, get_user_roles

logger = logging.getLogger(__name__)

OTP_PURPOSE = "CANDIDATE_REGISTER"
OTP_CHANNEL = "EMAIL"
USER_PENDING_STATUS = "PENDING_VERIFICATION"


# ─── Helpers SQL ──────────────────────────────────────────────────────────────


def _find_user_by_email(db: Session, email: str) -> dict | None:
    row = db.execute(
        text("""
            SELECT id::text AS id, email, status
            FROM iam.auth_user
            WHERE lower(email) = lower(:email)
            LIMIT 1;
        """),
        {"email": email},
    ).mappings().first()
    return dict(row) if row else None


def _create_auth_user(db: Session, email: str, password: str) -> str:
    """Crée un auth_user en statut PENDING_VERIFICATION. Retourne l'UUID."""
    row = db.execute(
        text("""
            INSERT INTO iam.auth_user (email, password_hash, status)
            VALUES (
                lower(:email),
                crypt(:password, gen_salt('bf')),
                :pending_status
            )
            RETURNING id::text AS id;
        """),
        {"email": email, "password": password, "pending_status": USER_PENDING_STATUS},
    ).mappings().first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Impossible de créer le compte.",
        )
    return row["id"]


def _invalidate_old_codes(db: Session, identifier: str) -> None:
    """Invalide tous les codes actifs pour cet identifiant/purpose."""
    db.execute(
        text("""
            UPDATE iam.verification_code
            SET consumed_at = now(), updated_at = now()
            WHERE lower(identifier) = lower(:identifier)
              AND purpose = :purpose
              AND channel = :channel
              AND consumed_at IS NULL;
        """),
        {"identifier": identifier, "purpose": OTP_PURPOSE, "channel": OTP_CHANNEL},
    )


def _insert_otp_code(
    db: Session,
    user_id: str,
    identifier: str,
    code_hash: str,
    metadata: dict,
    provider_message_id: str | None = None,
) -> None:
    db.execute(
        text("""
            INSERT INTO iam.verification_code (
                user_id, identifier, channel, purpose,
                code_hash, expires_at,
                max_attempts, provider, provider_message_id,
                metadata_json
            )
            VALUES (
                CAST(:user_id AS uuid),
                lower(:identifier),
                :channel,
                :purpose,
                :code_hash,
                now() + (:ttl_minutes || ' minutes')::interval,
                :max_attempts,
                'BREVO',
                :provider_message_id,
                :metadata_json::jsonb
            );
        """),
        {
            "user_id": user_id,
            "identifier": identifier,
            "channel": OTP_CHANNEL,
            "purpose": OTP_PURPOSE,
            "code_hash": code_hash,
            "ttl_minutes": OTP_TTL_MINUTES,
            "max_attempts": OTP_MAX_ATTEMPTS,
            "provider_message_id": provider_message_id,
            "metadata_json": json.dumps(metadata, ensure_ascii=False),
        },
    )


def _find_active_code(db: Session, identifier: str) -> dict | None:
    row = db.execute(
        text("""
            SELECT
                id::text AS id,
                user_id::text AS user_id,
                code_hash,
                expires_at,
                consumed_at,
                attempts_count,
                max_attempts,
                last_sent_at,
                metadata_json
            FROM iam.verification_code
            WHERE lower(identifier) = lower(:identifier)
              AND purpose = :purpose
              AND channel = :channel
              AND consumed_at IS NULL
              AND expires_at > now()
            ORDER BY created_at DESC
            LIMIT 1;
        """),
        {"identifier": identifier, "purpose": OTP_PURPOSE, "channel": OTP_CHANNEL},
    ).mappings().first()
    return dict(row) if row else None


def _increment_attempts(db: Session, code_id: str) -> None:
    db.execute(
        text("""
            UPDATE iam.verification_code
            SET attempts_count = attempts_count + 1, updated_at = now()
            WHERE id = CAST(:code_id AS uuid);
        """),
        {"code_id": code_id},
    )


def _consume_code(db: Session, code_id: str) -> None:
    db.execute(
        text("""
            UPDATE iam.verification_code
            SET consumed_at = now(), updated_at = now()
            WHERE id = CAST(:code_id AS uuid);
        """),
        {"code_id": code_id},
    )


def _activate_user(db: Session, user_id: str) -> None:
    db.execute(
        text("""
            UPDATE iam.auth_user
            SET status = 'ACTIVE'
            WHERE id = CAST(:user_id AS uuid);
        """),
        {"user_id": user_id},
    )


def _ensure_job_seeker(db: Session, user_id: str) -> None:
    """Crée le profil job_seeker (statut ACTIVE) s'il n'existe pas encore."""
    db.execute(
        text("""
            INSERT INTO aneti.job_seeker (user_id, status, created_at, updated_at)
            VALUES (
                CAST(:user_id AS uuid),
                'ACTIVE',
                now(),
                now()
            )
            ON CONFLICT (user_id) DO NOTHING;
        """),
        {"user_id": user_id},
    )


def _assign_job_seeker_role(db: Session, user_id: str) -> None:
    """Affecte le rôle JOB_SEEKER si pas encore attribué."""
    db.execute(
        text("""
            INSERT INTO iam.auth_user_role (user_id, role_id)
            SELECT CAST(:user_id AS uuid), r.id
            FROM iam.auth_role r
            WHERE r.code = 'JOB_SEEKER'
            ON CONFLICT DO NOTHING;
        """),
        {"user_id": user_id},
    )


def _check_resend_cooldown(db: Session, identifier: str) -> None:
    """Lève une 429 si le cooldown n'est pas écoulé."""
    row = db.execute(
        text("""
            SELECT last_sent_at
            FROM iam.verification_code
            WHERE lower(identifier) = lower(:identifier)
              AND purpose = :purpose
              AND channel = :channel
            ORDER BY created_at DESC
            LIMIT 1;
        """),
        {"identifier": identifier, "purpose": OTP_PURPOSE, "channel": OTP_CHANNEL},
    ).mappings().first()

    if row:
        elapsed = db.execute(
            text("SELECT EXTRACT(EPOCH FROM (now() - :sent_at)) AS elapsed"),
            {"sent_at": row["last_sent_at"]},
        ).scalar()
        if elapsed is not None and elapsed < OTP_RESEND_COOLDOWN_SECONDS:
            remaining = int(OTP_RESEND_COOLDOWN_SECONDS - elapsed)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    f"Veuillez patienter encore {remaining} seconde(s) "
                    "avant de demander un nouveau code."
                ),
            )


def _send_email_otp(email: str, otp_code: str, first_name: str) -> str | None:
    """
    Appelle Brevo ou logue en mode dev.
    En production (OTP_DEV_LOG=false) : lève HTTPException si Brevo échoue.
    En dev (OTP_DEV_LOG=true) : logue le code et continue sans Brevo.
    """
    if OTP_DEV_LOG:
        logger.warning(
            "[DEV ONLY — NE PAS UTILISER EN PRODUCTION] OTP pour %s : %s",
            email, otp_code,
        )
        return "dev-mode"

    try:
        return send_otp_email(email, otp_code, first_name)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Impossible d'envoyer l'email de vérification : {exc}",
        ) from exc


# ─── Services publics ─────────────────────────────────────────────────────────


def register_start(
    db: Session,
    payload: CandidateRegisterStartRequest,
) -> CandidateRegisterStartResponse:
    """Étape 1 — Création du compte + envoi du code OTP."""
    email = payload.email.strip().lower()

    if len(payload.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Le mot de passe doit contenir au moins 8 caractères.",
        )
    if payload.password != payload.password_confirm:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Les mots de passe ne correspondent pas.",
        )

    existing = _find_user_by_email(db, email)

    if existing and existing["status"] == "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Un compte existe déjà avec cet email. Veuillez vous connecter.",
        )

    user_id = existing["id"] if existing else _create_auth_user(db, email, payload.password)

    otp_code = generate_otp()
    code_hash = hash_otp(otp_code)
    first_name = payload.first_name or ""

    # Envoi email (ou log dev) — AVANT invalidation pour ne pas perdre l'ancien code si ça échoue
    provider_message_id = _send_email_otp(email, otp_code, first_name)

    _invalidate_old_codes(db, email)
    _insert_otp_code(
        db,
        user_id=user_id,
        identifier=email,
        code_hash=code_hash,
        metadata={
            "first_name": first_name,
            "last_name": payload.last_name or "",
            "national_id": payload.national_id or "",
            "phone": payload.phone or "",
        },
        provider_message_id=provider_message_id,
    )

    db.commit()

    return CandidateRegisterStartResponse(
        message=(
            "Un code de vérification a été envoyé à votre adresse email. "
            f"Il est valable {OTP_TTL_MINUTES} minutes."
        ),
        email=email,
    )


def verify_email(
    db: Session,
    payload: CandidateVerifyEmailRequest,
) -> TokenResponse:
    """Étape 2 — Vérification du code OTP. Retourne un JWT si valide."""
    email = payload.email.strip().lower()
    code = payload.code.strip()

    code_row = _find_active_code(db, email)
    if not code_row:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Code incorrect ou expiré. Demandez un nouveau code si nécessaire.",
        )

    if code_row["attempts_count"] >= code_row["max_attempts"]:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Nombre maximum de tentatives atteint. Veuillez demander un nouveau code.",
        )

    _increment_attempts(db, code_row["id"])

    if not verify_otp(code, code_row["code_hash"]):
        db.commit()
        remaining = code_row["max_attempts"] - code_row["attempts_count"] - 1
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Code incorrect. Il vous reste {remaining} tentative(s)."
                if remaining > 0
                else "Code incorrect ou expiré. Veuillez demander un nouveau code."
            ),
        )

    user_id = code_row["user_id"]
    _consume_code(db, code_row["id"])
    _activate_user(db, user_id)
    _ensure_job_seeker(db, user_id)
    _assign_job_seeker_role(db, user_id)
    db.commit()

    roles = get_user_roles(db, user_id) or ["JOB_SEEKER"]
    access_token, expires_in = create_access_token(
        user_id=user_id, email=email, roles=roles,
    )
    user_dict = {"id": user_id, "email": email, "status": "ACTIVE", "roles": roles}
    current_user = build_current_user_response(db, user_dict)

    return TokenResponse(
        access_token=access_token,
        expires_in=expires_in,
        user=current_user,
    )


def resend_code(
    db: Session,
    payload: CandidateResendCodeRequest,
) -> CandidateResendCodeResponse:
    """Renvoi d'un nouveau code OTP (après cooldown)."""
    email = payload.email.strip().lower()

    user = _find_user_by_email(db, email)
    if not user:
        return CandidateResendCodeResponse(
            message="Si cet email est enregistré, un nouveau code vous a été envoyé."
        )

    if user["status"] == "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ce compte est déjà vérifié. Veuillez vous connecter.",
        )

    _check_resend_cooldown(db, email)

    otp_code = generate_otp()
    code_hash = hash_otp(otp_code)

    last_code = db.execute(
        text("""
            SELECT metadata_json FROM iam.verification_code
            WHERE lower(identifier) = lower(:identifier)
              AND purpose = :purpose
              AND channel = :channel
            ORDER BY created_at DESC LIMIT 1;
        """),
        {"identifier": email, "purpose": OTP_PURPOSE, "channel": OTP_CHANNEL},
    ).mappings().first()

    first_name = ""
    if last_code and last_code["metadata_json"]:
        meta = last_code["metadata_json"]
        if isinstance(meta, str):
            meta = json.loads(meta)
        first_name = meta.get("first_name", "")

    provider_message_id = _send_email_otp(email, otp_code, first_name)

    _invalidate_old_codes(db, email)
    _insert_otp_code(
        db,
        user_id=user["id"],
        identifier=email,
        code_hash=code_hash,
        metadata={"first_name": first_name},
        provider_message_id=provider_message_id,
    )
    db.commit()

    return CandidateResendCodeResponse(
        message="Un nouveau code de vérification a été envoyé à votre adresse email."
    )
