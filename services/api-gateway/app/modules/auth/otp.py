import hashlib
import hmac
import os
import secrets

OTP_PEPPER = os.getenv("OTP_PEPPER", "")
OTP_TTL_MINUTES = int(os.getenv("OTP_TTL_MINUTES", "10"))
OTP_MAX_ATTEMPTS = int(os.getenv("OTP_MAX_ATTEMPTS", "5"))
OTP_RESEND_COOLDOWN_SECONDS = int(os.getenv("OTP_RESEND_COOLDOWN_SECONDS", "60"))
OTP_DEV_LOG = os.getenv("OTP_DEV_LOG", "false").lower() == "true"


def generate_otp() -> str:
    """Génère un code OTP à 6 chiffres cryptographiquement sûr (100000–999999)."""
    return str(secrets.randbelow(900_000) + 100_000)


def hash_otp(code: str) -> str:
    """Hash le code OTP avec HMAC-SHA256 + pepper. Ne jamais stocker l'OTP brut."""
    return hmac.new(
        OTP_PEPPER.encode("utf-8"),
        code.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def verify_otp(code: str, stored_hash: str) -> bool:
    """Comparaison en temps constant pour éviter les timing attacks."""
    return hmac.compare_digest(hash_otp(code), stored_hash)
