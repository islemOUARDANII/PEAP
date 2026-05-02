import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

class OfferParserSettings:
    project_root: Path = Path(__file__).resolve().parents[1]
    llm_on: bool = os.getenv("OFFER_LLM_ON", os.getenv("LLM_ON", "true")).lower() == "true"
    groq_model: str = os.getenv("OFFER_GROQ_MODEL", os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"))
    max_retries: int = int(os.getenv("OFFER_MAX_RETRIES", "1"))
    fuzzy_threshold: int = int(os.getenv("OFFER_FUZZY_THRESHOLD", "78"))
    groq_min_interval: float = float(os.getenv("OFFER_GROQ_MIN_INTERVAL", "6.0"))
    taxonomy_path: Path = project_root / "offer_parser_app" / "assets" / "taxonomy.json"

settings = OfferParserSettings()