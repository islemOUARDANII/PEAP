"""
CLI de parsing + mapping RTMC d'une offre en une seule commande.

Lancement :
    python -m mapper_app.pipeline.parse_and_map_offer data/test/offer_backend.txt --out data/test/mapped_offer_backend.json
"""

from __future__ import annotations

import argparse
import mimetypes
from pathlib import Path

from app_storage import settings as storage_settings
from mapper_app.pipeline.map_cv import save_json
from mapper_app.pipeline.map_offer import map_parsed_offer
from offer_parser_app.parser import parse_offer, to_schema_json


SUPPORTED_EXTS = {".txt", ".md"}
_storage_repository = None


def get_storage_repository():
    global _storage_repository
    if not storage_settings.app_db_enabled:
        return None
    if _storage_repository is None:
        from app_storage.repository import StorageRepository

        _storage_repository = StorageRepository()
    return _storage_repository


def resolve_input_offer_path(input_path: str | Path) -> Path:
    offer_path = Path(input_path)
    if offer_path.exists():
        return offer_path
    raise FileNotFoundError(f"Input introuvable : {offer_path}")


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(encoding="latin-1")


def parse_and_map_offer_file(
    input_path: str | Path,
    *,
    out_path: str | Path | None = None,
    use_vector: bool = True,
    use_llm: bool = True,
    save_output: bool = True,
) -> tuple[dict, dict, Path | None]:
    offer_path = resolve_input_offer_path(input_path)
    if offer_path.suffix.lower() not in SUPPORTED_EXTS:
        raise ValueError(f"Format non supporte : {offer_path.suffix}")

    raw_text = read_text(offer_path)
    mime_type = mimetypes.guess_type(str(offer_path))[0] or "text/plain"
    parsed_offer = to_schema_json(
        parse_offer(raw_text),
        filename=offer_path.name,
        mime_type=mime_type,
    )
    mapped_offer = map_parsed_offer(
        parsed_offer,
        use_vector=use_vector,
        use_llm=use_llm,
    )

    storage_repository = get_storage_repository()
    if storage_repository is not None:
        storage_meta = storage_repository.save_offer_run(
            parsed_offer=parsed_offer,
            mapped_offer=mapped_offer,
            source_filename=offer_path.name,
            source_mime_type=mime_type,
            raw_text=raw_text,
            use_vector=use_vector,
            use_llm=use_llm,
        )
        mapped_offer = {**mapped_offer, "_storage": storage_meta}

    saved_path = None
    if save_output or out_path is not None:
        final_path = Path(out_path) if out_path is not None else offer_path.with_name(f"{offer_path.stem}_mapped.json")
        saved_path = save_json(mapped_offer, final_path)

    return parsed_offer, mapped_offer, saved_path


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Parse puis map une offre vers RTMC.")
    parser.add_argument("input_offer", help="Chemin vers l'offre d'entree.")
    parser.add_argument("--out", help="Chemin du mapped_offer.json de sortie.")
    parser.add_argument("--no-vector", action="store_true", help="Desactive la recherche vectorielle.")
    parser.add_argument("--no-llm", action="store_true", help="Desactive le fallback LLM.")
    parser.add_argument("--no-save-output", action="store_true", help="N'enregistre pas les sorties JSON.")
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    _, mapped_offer, saved_path = parse_and_map_offer_file(
        args.input_offer,
        out_path=args.out,
        use_vector=not args.no_vector,
        use_llm=not args.no_llm,
        save_output=not args.no_save_output,
    )
    quality = mapped_offer["mapping_quality"]

    print("=" * 72)
    print("  OFFER PARSE + MAP")
    print("=" * 72)
    print(f"Total entities : {quality['total_entities']}")
    print(f"Auto accept    : {quality['auto_accept_count']}")
    print(f"Manual review  : {quality['manual_review_count']}")
    print(f"Reject         : {quality['reject_count']}")
    print(f"Output path    : {saved_path}")
    if mapped_offer.get("_storage"):
        print(f"Parsed offer id: {mapped_offer['_storage']['parsed_offer_id']}")
        print(f"Mapped offer id: {mapped_offer['_storage']['mapped_offer_id']}")
    print("=" * 72)


if __name__ == "__main__":
    main()
