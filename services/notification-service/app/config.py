from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str

    internal_api_key: str | None = None

    email_dry_run: bool = True
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str = "no-reply@matchcore.local"
    smtp_from_name: str = "MatchCore"

    public_app_base_url: str = "http://localhost:5173"
    match_notification_threshold: float = 60
    match_notification_top_limit: int = 50
    email_subject_prefix: str = "[MatchCore]"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


settings = Settings()