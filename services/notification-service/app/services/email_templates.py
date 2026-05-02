from __future__ import annotations

from html import escape

from app.config import settings


def build_match_email_subject(*, offer_title: str, score: float) -> str:
    safe_title = offer_title or "Offre"
    return f"{settings.email_subject_prefix} Offre compatible : {safe_title} ({score:.0f}%)"


def build_match_email_text(
    *,
    candidate_name: str,
    offer_title: str,
    company_name: str,
    score: float,
    offer_id: str,
) -> str:
    offer_url = f"{settings.public_app_base_url}/offers/{offer_id}"

    return f"""
Bonjour {candidate_name or "Candidat"},

Une offre semble compatible avec votre profil.

Poste : {offer_title or "Offre"}
Entreprise : {company_name or "Entreprise"}
Score de compatibilité : {score:.0f}%

Consulter l'offre :
{offer_url}

Ceci est une notification automatique MatchCore.
""".strip()


def build_match_email_html(
    *,
    candidate_name: str,
    offer_title: str,
    company_name: str,
    score: float,
    offer_id: str,
) -> str:
    safe_candidate_name = escape(candidate_name or "Candidat")
    safe_offer_title = escape(offer_title or "Offre")
    safe_company_name = escape(company_name or "Entreprise")
    offer_url = escape(f"{settings.public_app_base_url}/offers/{offer_id}")

    return f"""
<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; color: #0f172a; background:#f8fafc; padding:24px;">
    <div style="max-width: 640px; margin: auto; background:white; border:1px solid #e2e8f0; border-radius:16px; padding:24px;">
      <h2 style="margin-bottom: 8px;">Bonjour {safe_candidate_name},</h2>

      <p>Une nouvelle offre semble compatible avec votre profil.</p>

      <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 20px 0;">
        <p><strong>Poste :</strong> {safe_offer_title}</p>
        <p><strong>Entreprise :</strong> {safe_company_name}</p>
        <p><strong>Score :</strong> {score:.0f}%</p>
      </div>

      <p>
        <a href="{offer_url}"
           style="background:#0f766e;color:white;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block;">
          Consulter l'offre
        </a>
      </p>

      <p style="font-size:12px;color:#64748b;margin-top:24px;">
        Ceci est une notification automatique MatchCore.
      </p>
    </div>
  </body>
</html>
""".strip()