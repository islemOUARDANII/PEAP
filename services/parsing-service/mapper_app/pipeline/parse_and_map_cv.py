"""
CLI de parsing + mapping RTMC en une seule commande.

Lancement :
    python -m mapper_app.pipeline.parse_and_map_cv data/test/cv_nour.pdf --out data/test/mapped_cv_nour.json
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Iterable

from app_storage import settings as storage_settings
from mapper_app.pipeline.map_cv import map_parsed_cv, save_json


SUPPORTED_EXTS = {".pdf", ".docx", ".png", ".jpg", ".jpeg"}

_storage_repository = None


def get_storage_repository():
    global _storage_repository
    if not storage_settings.app_db_enabled:
        return None
    if _storage_repository is None:
        from app_storage.repository import StorageRepository

        _storage_repository = StorageRepository()
    return _storage_repository


def resolve_input_cv_path(input_path: str | Path, supported_exts: Iterable[str] = SUPPORTED_EXTS) -> Path:
    cv_path = Path(input_path)
    if cv_path.exists():
        return cv_path

    if cv_path.suffix:
        raise FileNotFoundError(f"Input introuvable : {cv_path}")

    candidates = []
    for ext in supported_exts:
        candidate = cv_path.with_suffix(ext)
        if candidate.exists():
            candidates.append(candidate)

    if len(candidates) == 1:
        return candidates[0]

    if len(candidates) > 1:
        matches = ", ".join(str(path) for path in candidates)
        raise FileNotFoundError(
            f"Chemin ambigu pour {cv_path}. Plusieurs fichiers possibles : {matches}"
        )

    raise FileNotFoundError(f"Input introuvable : {cv_path}")


def parse_and_map_cv_file(
    input_path: str | Path,
    *,
    out_path: str | Path | None = None,
    output_dir: str | Path | None = None,
    use_vector: bool = True,
    use_llm: bool = True,
    save_output: bool = True,
) -> tuple[dict, dict, Path | None]:
    from parser_app.config import Settings
    from parser_app.pipeline import CVParsingPipeline

    cv_path = resolve_input_cv_path(input_path)
    if cv_path.suffix.lower() not in SUPPORTED_EXTS:
        raise ValueError(f"Format non supporte : {cv_path.suffix}")

    settings = Settings()
    if output_dir is not None:
        settings.output_dir = Path(output_dir)
    elif out_path is not None:
        settings.output_dir = Path(out_path).parent
    settings.ensure_dirs()

    pipeline = CVParsingPipeline(settings)
    parse_result = pipeline.parse(
        str(cv_path),
        save_output=save_output,
        verbose=False,
    )
    parsed_cv = parse_result.cv_data.model_dump()
    mapped_cv = map_parsed_cv(
        parsed_cv,
        use_vector=use_vector,
        use_llm=use_llm,
    )
    storage_repository = get_storage_repository()
    if storage_repository is not None:
        storage_meta = storage_repository.save_cv_run(
            parsed_cv=parsed_cv,
            mapped_cv=mapped_cv,
            parse_status=parse_result.status,
            warnings=parse_result.warnings,
            processing_time=parse_result.processing_time,
            source_filename=cv_path.name,
            source_mime_type=_guess_mime_type(cv_path),
            file_bytes=cv_path.read_bytes(),
            use_vector=use_vector,
            use_llm=use_llm,
        )
        mapped_cv = {**mapped_cv, "_storage": storage_meta}

    saved_path = None
    if save_output or out_path is not None:
        final_path = Path(out_path) if out_path is not None else settings.output_dir / f"{cv_path.stem}_mapped.json"
        saved_path = save_json(mapped_cv, final_path)

    return parsed_cv, mapped_cv, saved_path


def _guess_mime_type(cv_path: Path) -> str:
    ext = cv_path.suffix.lower()
    return {
        ".pdf": "application/pdf",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
    }.get(ext, "application/octet-stream")


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Parse puis map un CV vers RTMC.")
    parser.add_argument("input_cv", help="Chemin vers le CV d'entree.")
    parser.add_argument("--out", help="Chemin du mapped_cv.json de sortie.")
    parser.add_argument("--output-dir", help="Dossier de sortie pour parsed_cv.json et mapped_cv.json.")
    parser.add_argument("--no-vector", action="store_true", help="Desactive la recherche vectorielle.")
    parser.add_argument("--no-llm", action="store_true", help="Desactive le fallback LLM.")
    parser.add_argument("--no-save-output", action="store_true", help="N'enregistre pas les sorties JSON.")
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    _, mapped_cv, saved_path = parse_and_map_cv_file(
        args.input_cv,
        out_path=args.out,
        output_dir=args.output_dir,
        use_vector=not args.no_vector,
        use_llm=not args.no_llm,
        save_output=not args.no_save_output,
    )
    quality = mapped_cv["mapping_quality"]

    print("=" * 72)
    print("  CV PARSE + MAP")
    print("=" * 72)
    print(f"Total entities : {quality['total_entities']}")
    print(f"Auto accept    : {quality['auto_accept_count']}")
    print(f"Manual review  : {quality['manual_review_count']}")
    print(f"Reject         : {quality['reject_count']}")
    print(f"Output path    : {saved_path}")
    if mapped_cv.get("_storage"):
        print(f"Parsed CV id   : {mapped_cv['_storage']['parsed_cv_id']}")
        print(f"Mapped CV id   : {mapped_cv['_storage']['mapped_cv_id']}")
    print("=" * 72)


if __name__ == "__main__":
    main()
