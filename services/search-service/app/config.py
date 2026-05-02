from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # PostgreSQL — même DSN que parsing-service
    postgres_dsn: str = "postgresql://user:password@localhost:5432/matching"

    # Elasticsearch / OpenSearch
    es_url: str = "http://localhost:9200"
    es_api_key: str = ""            # optionnel si pas d'auth
    es_index_offers: str = "offers"
    es_index_candidates: str = "candidates"

    # Embedding model (même que matching_engine/semantic)
    embedding_model: str = "all-MiniLM-L6-v2"
    embedding_dim: int = 384        # MiniLM-L6-v2 → 384 dims

    # Sync
    sync_interval_seconds: int = 60 # cron incremental toutes les 60s
    sync_batch_size: int = 500      # docs par batch bulk

    # Hybrid scoring weights  (keyword + vector)
    hybrid_keyword_weight: float = 0.4
    hybrid_vector_weight: float = 0.6

    # PG connection pool
    pg_pool_min: int = 2
    pg_pool_max: int = 10

    # Embedding timeout (secondes)
    embed_timeout_seconds: float = 15.0

    # Rate limiting (par IP, fenêtre glissante)
    rate_limit_calls: int = 60
    rate_limit_period: int = 60       # secondes

    # API
    api_key: str = "changeme"       # X-Api-Key header

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
