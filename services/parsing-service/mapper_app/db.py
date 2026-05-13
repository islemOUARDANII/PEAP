from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from mapper_app.config import settings

engine = create_engine(settings.db_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_db_connection() -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("[DB] Connexion PostgreSQL OK")
        return True
    except Exception as e:
        print(f"[DB] Erreur de connexion PostgreSQL : {e}")
        print(f"[DB] Vérifiez que la base '{settings.mapper_db_name}' existe et que l'utilisateur '{settings.mapper_db_user}' a les droits.")
        return False


def check_pgvector() -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT '[1,2,3]'::vector"))
        print("[DB] Extension pgvector OK")
        return True
    except Exception as e:
        print(f"[DB] pgvector non disponible : {e}")
        print(f"[DB] Exécute dans psql ou pgAdmin sur la base '{settings.mapper_db_name}' :")
        print("       CREATE EXTENSION IF NOT EXISTS vector;")
        return False


def create_database_info() -> None:
    try:
        with engine.connect() as conn:
            version = conn.execute(text("SELECT version()")).scalar()
            db_name = conn.execute(text("SELECT current_database()")).scalar()
            db_user = conn.execute(text("SELECT current_user")).scalar()
        print(f"[DB] PostgreSQL version : {version}")
        print(f"[DB] Base courante      : {db_name}")
        print(f"[DB] Utilisateur courant: {db_user}")
    except Exception as e:
        print(f"[DB] Impossible de récupérer les infos base : {e}")
