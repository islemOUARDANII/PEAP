from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from app.config import settings

logger = logging.getLogger(__name__)


def send_email(
    *,
    to_email: str,
    subject: str,
    html_body: str,
    text_body: str,
) -> tuple[str, str | None]:
    """
    Returns:
      ("SENT" | "DRY_RUN" | "FAILED", error_message)
    """

    if settings.email_dry_run:
        logger.info(
            "EMAIL_DRY_RUN=true; not sending email to=%s subject=%s",
            to_email,
            subject,
        )
        return "DRY_RUN", None

    try:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
        msg["To"] = to_email

        msg.set_content(text_body)
        msg.add_alternative(html_body, subtype="html")

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as smtp:
            smtp.starttls()

            if settings.smtp_username and settings.smtp_password:
                smtp.login(settings.smtp_username, settings.smtp_password)

            smtp.send_message(msg)

        return "SENT", None

    except Exception as exc:
        logger.exception("Email send failed to=%s", to_email)
        return "FAILED", str(exc)