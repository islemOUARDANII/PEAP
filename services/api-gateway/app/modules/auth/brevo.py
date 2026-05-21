import logging
import os

import httpx

BREVO_API_KEY = os.getenv("BREVO_API_KEY", "")
BREVO_SENDER_EMAIL = os.getenv("BREVO_SENDER_EMAIL", "no-reply@aneti.tn")
BREVO_SENDER_NAME = os.getenv("BREVO_SENDER_NAME", "ANETI")
BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"

logger = logging.getLogger(__name__)


def send_otp_email(
    to_email: str,
    otp_code: str,
    first_name: str = "",
) -> str:
    """
    Envoie le code OTP par email via l'API transactionnelle Brevo.

    Retourne le provider_message_id (str) si succès.
    Lève RuntimeError si la clé API est absente ou si l'envoi échoue.
    L'appelant est responsable de gérer OTP_DEV_LOG avant d'appeler cette fonction.
    """
    if not BREVO_API_KEY:
        raise RuntimeError(
            "La variable BREVO_API_KEY n'est pas configurée. "
            "Définissez-la dans le fichier .env ou les variables d'environnement."
        )

    greeting = f"Bonjour {first_name.strip()}," if first_name.strip() else "Bonjour,"

    html_content = f"""
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#f4f6f7;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f7;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:8px;overflow:hidden;
                      box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#1a5276;padding:24px 32px;">
              <h2 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">
                Vérification de votre compte ANETI
              </h2>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;color:#333;font-size:15px;">{greeting}</p>
              <p style="margin:0 0 24px;color:#333;font-size:15px;">
                Pour finaliser la création de votre compte, veuillez saisir le code
                de vérification ci-dessous :
              </p>
              <div style="text-align:center;margin:0 0 24px;">
                <div style="display:inline-block;background:#eaf0f6;border-radius:8px;
                            padding:18px 40px;border:2px solid #d0dce8;">
                  <span style="font-size:36px;font-weight:700;letter-spacing:10px;
                               color:#1a5276;font-family:'Courier New',monospace;">
                    {otp_code}
                  </span>
                </div>
              </div>
              <p style="margin:0 0 8px;color:#555;font-size:14px;">
                Ce code est valable pendant <strong>10 minutes</strong>.
              </p>
              <p style="margin:0 0 24px;color:#888;font-size:13px;">
                Si vous n'avez pas demandé la création d'un compte ANETI,
                ignorez cet email.
              </p>
              <hr style="border:none;border-top:1px solid #eee;margin:0 0 16px;" />
              <p style="margin:0;color:#aaa;font-size:12px;">
                Agence Nationale pour l'Emploi et le Travail Indépendant (ANETI) —
                Ne pas répondre à cet email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

    payload = {
        "sender": {
            "email": BREVO_SENDER_EMAIL,
            "name": BREVO_SENDER_NAME,
        },
        "to": [{"email": to_email}],
        "subject": "Code de vérification de votre compte ANETI",
        "htmlContent": html_content,
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.post(
                BREVO_API_URL,
                json=payload,
                headers={
                    "api-key": BREVO_API_KEY,
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
            )
            response.raise_for_status()
            data = response.json()
            message_id: str = data.get("messageId", "")
            logger.info("Email OTP envoyé à %s — messageId=%s", to_email, message_id)
            return message_id
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text[:200] if exc.response else ""
        raise RuntimeError(
            f"Brevo a retourné HTTP {exc.response.status_code} : {detail}"
        ) from exc
    except httpx.TimeoutException:
        raise RuntimeError("Délai d'attente dépassé lors de l'envoi via Brevo.") from None
    except RuntimeError:
        raise
    except Exception as exc:
        raise RuntimeError(f"Erreur réseau Brevo : {exc}") from exc
