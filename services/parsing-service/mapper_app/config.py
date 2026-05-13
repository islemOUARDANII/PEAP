from pathlib import Path
from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict


class MapperSettings(BaseSettings):
    """Configuration du mapper, chargée depuis .env"""

    # === Database ===
    database_url: str | None = None
    mapper_db_host: str = "localhost"
    mapper_db_port: int = 5432
    mapper_db_name: str = "rtmc_mapper"
    mapper_db_user: str = "mapper_user"
    mapper_db_password: str = "mapper123"

    # === Embeddings ===
    embedding_model: str = "BAAI/bge-m3"
    embedding_dimension: int = 1024
    embedding_device: str = "cpu"

    # === LLM Reranker - hybride ===
    llm_provider: Literal["groq", "ollama"] = "groq"
    llm_fallback_enabled: bool = True

    # Groq
    groq_api_key: str = ""
    groq_model: str = "qwen/qwen3-32b"
    groq_timeout: int = 30
    groq_max_retries: int = 2

    # Ollama
    ollama_host: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:7b-instruct"
    ollama_timeout: int = 60

    # === Thresholds ===
    auto_accept_score: float = 0.85
    auto_accept_gap: float = 0.10
    reject_score: float = 0.40

    # === Paths ===
    rtmc_xlsx_path: str = "data/rtmc/RTMC.xlsx"
    bm25_index_dir: str = "data/rtmc/bm25_indexes"
    aliases_path: str = "data/rtmc/aliases.json"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def db_url(self) -> str:
        """URL SQLAlchemy."""
        database_url = self.database_url

        if database_url:
            if database_url.startswith("postgresql://"):
                return database_url.replace(
                    "postgresql://",
                    "postgresql+psycopg2://",
                    1,
                )
            return database_url

        return (
            f"postgresql+psycopg2://{self.mapper_db_user}:{self.mapper_db_password}"
            f"@{self.mapper_db_host}:{self.mapper_db_port}/{self.mapper_db_name}"
        )

    @property
    def project_root(self) -> Path:
        """Racine du projet."""
        return Path(__file__).parent.parent

    @property
    def rtmc_xlsx_full_path(self) -> Path:
        return self.project_root / self.rtmc_xlsx_path

    @property
    def bm25_index_full_dir(self) -> Path:
        return self.project_root / self.bm25_index_dir

    @property
    def aliases_full_path(self) -> Path:
        return self.project_root / self.aliases_path


settings = MapperSettings()
