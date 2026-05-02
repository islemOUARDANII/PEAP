from dataclasses import dataclass
from pathlib import Path
import os

from dotenv import load_dotenv

load_dotenv()


@dataclass
class Settings:
    groq_api_key: str | None = os.getenv("GROQ_API_KEY")
    poppler_path: str | None = os.getenv("POPPLER_PATH") or None
    software_icon_templates_dir: Path = Path(
        os.getenv("SOFTWARE_ICON_TEMPLATES_DIR", "parser_app/assets/software_icons")
    )
    vision_model: str = "meta-llama/llama-4-scout-17b-16e-instruct"
    cv_dpi: int = 200
    min_bar_width: int = 60
    max_bar_height: int = 25
    min_bar_ratio: int = 4
    output_dir: Path = Path("outputs")

    def ensure_dirs(self):
        self.output_dir.mkdir(parents=True, exist_ok=True)
