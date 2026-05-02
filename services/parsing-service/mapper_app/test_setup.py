"""
Script de validation du setup mapper RTMC.
Lancement : python -m mapper_app.test_setup
"""

import sys


def _check_imports() -> bool:
    print("\n[1/6] Vérification des imports...")
    modules = {
        "sqlalchemy": "sqlalchemy",
        "psycopg2": "psycopg2",
        "pgvector": "pgvector",
        "sentence_transformers": "sentence-transformers",
        "rank_bm25": "rank-bm25",
        "pandas": "pandas",
        "groq": "groq",
        "ollama": "ollama",
    }
    ok = True
    for mod, pkg in modules.items():
        try:
            __import__(mod)
            print(f"  [OK] {mod}")
        except ImportError:
            print(f"  [KO] {mod}  →  pip install {pkg}")
            ok = False
    return ok


def _check_paths() -> None:
    print("\n[2/6] Vérification des chemins...")
    from mapper_app.config import settings

    rtmc_dir = settings.project_root / "data" / "rtmc"
    bm25_dir = settings.bm25_index_full_dir

    rtmc_dir.mkdir(parents=True, exist_ok=True)
    bm25_dir.mkdir(parents=True, exist_ok=True)
    print(f"  [OK] {rtmc_dir}")
    print(f"  [OK] {bm25_dir}")

    xlsx = settings.rtmc_xlsx_full_path
    if xlsx.exists():
        print(f"  [OK] RTMC.xlsx trouvé : {xlsx}")
    else:
        print(f"  [WARN] RTMC.xlsx manquant : {xlsx}")
        print("         Copie le fichier dans data/rtmc/RTMC.xlsx pour continuer.")


def _check_postgres() -> bool:
    print("\n[3/6] Vérification PostgreSQL + pgvector...")
    try:
        from mapper_app.db import check_pgvector, create_database_info, test_db_connection
        db_ok = test_db_connection()
        if db_ok:
            create_database_info()
            check_pgvector()
        return db_ok
    except Exception as e:
        print(f"  [KO] Erreur inattendue : {e}")
        return False


def _check_groq() -> bool:
    print("\n[4/6] Vérification Groq...")
    from mapper_app.config import settings

    key = settings.groq_api_key
    if not key or "REMPLACE" in key:
        print("  [WARN] GROQ_API_KEY non configurée.")
        print("         Édite .env et remplace GROQ_API_KEY par ta vraie clé.")
        return False

    try:
        from groq import Groq
        client = Groq(api_key=key, timeout=settings.groq_timeout)
        resp = client.chat.completions.create(
            model=settings.groq_model,
            messages=[{"role": "user", "content": "Réponds juste 'ok'"}],
            max_tokens=10,
        )
        reply = resp.choices[0].message.content.strip()
        print(f"  [OK] Groq fonctionnel — réponse : {reply!r}")
        return True
    except Exception as e:
        print(f"  [KO] Groq erreur : {e}")
        return False


def _check_ollama() -> bool:
    print("\n[5/6] Vérification Ollama...")
    from mapper_app.config import settings

    try:
        import httpx
        resp = httpx.get(f"{settings.ollama_host}/api/tags", timeout=5)
        resp.raise_for_status()
        models = [m["name"] for m in resp.json().get("models", [])]
        target = settings.ollama_model
        if target in models:
            print(f"  [OK] Ollama fonctionnel — modèle '{target}' présent")
            return True
        else:
            print(f"  [WARN] Ollama actif mais '{target}' absent.")
            print(f"         Lance : ollama pull {target}")
            return False
    except Exception as e:
        print(f"  [KO] Ollama non joignable ({settings.ollama_host}) : {e}")
        print("       Installe Ollama depuis https://ollama.com si tu veux le fallback local.")
        return False


def _print_strategy() -> None:
    print("\n[6/6] Stratégie hybride LLM...")
    from mapper_app.config import settings
    print(f"  Provider primaire : {settings.llm_provider}")
    print(f"  Fallback activé   : {settings.llm_fallback_enabled}")


def main() -> None:
    print("=" * 60)
    print("  MAPPER RTMC — Validation du setup")
    print("=" * 60)

    imports_ok = _check_imports()
    if not imports_ok:
        print("\n[STOP] Installe les dépendances manquantes, puis relance.")
        sys.exit(1)

    _check_paths()
    _check_postgres()
    groq_ok = _check_groq()
    ollama_ok = _check_ollama()
    _print_strategy()

    print("\n" + "=" * 60)
    if groq_ok and ollama_ok:
        print("  [OK] SETUP COMPLET : Groq + Ollama fonctionnels")
    elif groq_ok:
        print("  [OK] SETUP OK : Groq fonctionnel, Ollama fallback a configurer plus tard")
    elif ollama_ok:
        print("  [WARN] Groq KO mais Ollama fonctionnel")
    else:
        print("  [KO] Aucun LLM provider fonctionnel")
        print("       Configure GROQ_API_KEY dans .env ou lance Ollama.")
    print("=" * 60)


if __name__ == "__main__":
    main()
