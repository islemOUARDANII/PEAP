import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

from .config import Settings
from .groq_extractor import (
    LlamaVisionExtractor,
    compute_total_duration,
    extract_and_classify_technical_skills,
)
from .models import CVData, CVStructure, validate_cv_data
from .opencv_analyzer import OpenCVAnalyzer
from .preprocessor import ImagePreprocessor


@dataclass
class ParseResult:
    file_path: str
    file_name: str
    cv_data: CVData
    cv_structure: Optional[CVStructure]
    raw_json: Dict
    warnings: List[str]
    processing_time: float
    status: str


class CVParsingPipeline:

    def __init__(self, settings: Settings):
        self.settings = settings
        self.settings.ensure_dirs()
        self.preprocessor = ImagePreprocessor(settings)
        self.cv_analyzer = OpenCVAnalyzer(settings)
        self.llama = LlamaVisionExtractor(settings)

    def parse(
        self,
        cv_path: str,
        save_output: bool = True,
        verbose: bool = True
    ) -> ParseResult:

        start_time = time.time()
        path = Path(cv_path)
        ext = path.suffix.lower()

        if verbose:
            print(f"\n{'=' * 55}")
            print(f"Parsing : {path.name}")
            print(f"{'=' * 55}")

        all_raw_data: Dict = {}
        all_structures: List[CVStructure] = []

        try:
            images = self.preprocessor.load_cv(str(path))
            if not images:
                raise ValueError("Aucune image chargée.")

            raw_text = self.preprocessor.extract_text(str(path))

            if ext == ".pdf":
                first_img_processed = self.preprocessor.preprocess(images[0])
                first_structure = self.cv_analyzer.analyze(first_img_processed)

                if self._should_use_page_by_page_pdf_flow(
                    raw_text=raw_text,
                    first_structure=first_structure,
                    page_count=len(images),
                ):
                    page_texts = self.preprocessor.extract_pdf_pages_text(str(path))
                    for page_idx, img in enumerate(images, start=1):
                        if verbose and len(images) > 1:
                            print(f"--- Page {page_idx}/{len(images)} ---")

                        page_raw_text = page_texts[page_idx - 1] if page_idx - 1 < len(page_texts) else ""

                        if page_idx == 1:
                            img_processed = first_img_processed
                            structure = first_structure
                        else:
                            img_processed = self.preprocessor.preprocess(img)
                            structure = self.cv_analyzer.analyze(img_processed)

                        all_structures.append(structure)
                        page_data = self.llama.extract(
                            img_processed,
                            structure,
                            raw_text=page_raw_text,
                        )
                        all_raw_data = self._merge_pages(all_raw_data, page_data)
                else:
                    all_structures.append(first_structure)
                    page_data = self.llama.extract(
                        first_img_processed,
                        first_structure,
                        raw_text=raw_text,
                    )
                    all_raw_data = page_data

            elif ext == ".docx" and raw_text.strip():
                img_processed = self.preprocessor.preprocess(images[0])
                structure = self.cv_analyzer.analyze(img_processed)
                all_structures.append(structure)

                page_data = self.llama.extract(
                    img_processed,
                    structure,
                    raw_text=raw_text
                )
                all_raw_data = self._merge_pages(all_raw_data, page_data)

            else:
                for page_idx, img in enumerate(images, start=1):
                    if verbose and len(images) > 1:
                        print(f"--- Page {page_idx}/{len(images)} ---")

                    img_processed = self.preprocessor.preprocess(img)
                    structure = self.cv_analyzer.analyze(img_processed)
                    all_structures.append(structure)

                    page_data = self.llama.extract(
                        img_processed,
                        structure,
                        raw_text=""
                    )
                    all_raw_data = self._merge_pages(all_raw_data, page_data)

            all_raw_data = self._post_process_before_validation(
                all_raw_data,
                raw_text=raw_text
            )

            if verbose:
                print("Validation des données...")

            cv_data, warnings = validate_cv_data(all_raw_data)

            experience_total = compute_total_duration(
                [row.model_dump() for row in cv_data.experience]
            )
            stage_total = compute_total_duration(
                [row.model_dump() for row in cv_data.stages]
            )

            cv_data.experience_years = experience_total["years"]
            cv_data.stage_months = stage_total["months"]
            cv_data.stage_years = stage_total["years"]
            cv_data.total_career_months = experience_total["months"] + stage_total["months"]
            cv_data.total_career_years = round(cv_data.total_career_months / 12, 1)

            all_raw_data["experience_years"] = experience_total["years"]
            all_raw_data["stage_months"] = stage_total["months"]
            all_raw_data["stage_years"] = stage_total["years"]
            all_raw_data["total_career_months"] = cv_data.total_career_months
            all_raw_data["total_career_years"] = cv_data.total_career_years

            if verbose and warnings:
                print("  Avertissements :")
                for w in warnings:
                    print(f"    - {w}")

            status = "success" if not warnings else "partial"

        except Exception as e:
            if verbose:
                import traceback
                print(f"Erreur : {e}")
                traceback.print_exc()

            cv_data = CVData()
            warnings = [f"Erreur critique : {str(e)}"]
            status = "error"

        elapsed = time.time() - start_time

        result = ParseResult(
            file_path=str(path),
            file_name=path.name,
            cv_data=cv_data,
            cv_structure=all_structures[0] if all_structures else None,
            raw_json=all_raw_data if isinstance(all_raw_data, dict) else {},
            warnings=warnings,
            processing_time=elapsed,
            status=status,
        )

        if save_output:
            self._save_result(result, verbose=verbose)

        if verbose:
            print(f"\nTerminé en {elapsed:.1f}s - Statut : {status}")

        return result

    def _should_use_page_by_page_pdf_flow(
        self,
        raw_text: str,
        first_structure: Optional[CVStructure],
        page_count: int,
    ) -> bool:
        if not (raw_text or "").strip():
            return True

        if page_count > 1:
            return True

        if not first_structure:
            return False

        if getattr(first_structure, "has_dark_sidebar", False):
            return True

        return getattr(first_structure, "layout", "single_column") in {"two_columns", "sidebar"}

    def _merge_pages(self, existing: Dict, new_page: Dict) -> Dict:
        if not existing:
            return new_page.copy() if isinstance(new_page, dict) else {}

        if not isinstance(new_page, dict):
            return existing

        result = existing.copy()

        if new_page.get("personal_info"):
            existing_pi = result.get("personal_info", {})
            for key, val in new_page["personal_info"].items():
                if val and not existing_pi.get(key):
                    result.setdefault("personal_info", {})[key] = val

        if not result.get("summary") and new_page.get("summary"):
            result["summary"] = new_page["summary"]

        list_sections = [
            "education",
            "experience",
            "stages",
            "skills",
            "languages",
            "certifications",
            "projects",
            "interests",
            "volunteer",
            "associations",
            "additional_info",
            "other_sections",
            "awards",
        ]

        for key in list_sections:
            if new_page.get(key):
                result.setdefault(key, [])
                result[key].extend(new_page[key])

        technical_skills = new_page.get("technical_skills")
        if isinstance(technical_skills, dict):
            merged_technical = result.setdefault("technical_skills", {})
            for category, values in technical_skills.items():
                if not values:
                    merged_technical.setdefault(category, [])
                    continue
                merged_technical.setdefault(category, [])
                seen = {str(item).casefold() for item in merged_technical[category] if item}
                for value in values:
                    if not value:
                        continue
                    text = str(value).strip()
                    if not text:
                        continue
                    key = text.casefold()
                    if key in seen:
                        continue
                    seen.add(key)
                    merged_technical[category].append(text)

        return result

    def _post_process_before_validation(
        self,
        result: Dict,
        raw_text: Optional[str] = None
    ) -> Dict:
        if not isinstance(result, dict):
            result = {}

        clean_languages_noise = getattr(self.llama, "_clean_languages_noise", None)
        result = self.llama._post_process_raw_result(result, raw_text=raw_text)

        if not result.get("skills"):
            fallback_groups = self.llama._extract_skill_groups_from_text(raw_text)
            if fallback_groups:
                result["skills"] = fallback_groups
            else:
                fallback_lines = self.llama._extract_skills_block_from_text(raw_text)
                fallback_items = self.llama._skills_from_block_lines(fallback_lines)
                if fallback_items:
                    result["skills"] = [{"category": "Skills", "items": fallback_items}]

        if callable(clean_languages_noise):
            clean_languages_noise(result)

        result = extract_and_classify_technical_skills(result)
        return result

    def _save_result(self, result: ParseResult, verbose: bool = True):
        """
        Sauvegarde uniquement cv_data dans le fichier JSON.
        Aucune metadata n'est ajoutée.
        """
        stem = Path(result.file_name).stem
        output_file = self.settings.output_dir / f"{stem}.json"

        cv_dict = result.cv_data.model_dump()
        cv_dict = self._clean_output(cv_dict)

        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(cv_dict, f, indent=2, ensure_ascii=False)

        if verbose and result.status != "error":
            print(f"Sauvegardé : {output_file}")

    def _clean_output(
        self,
        obj,
        parent_key=None,
        keep_null_keys=(),
        drop_keys=(
            "level_score", "source", "code", "confidence",
            "normalized_name", "match_type", "raw_text", "type",
            "mapping", "esco_code", "onet_code",
        )
    ):
        """
        Nettoyage récursif :
        - enlève toujours les clés de drop_keys
        - enlève None / [] / {}
        """
        if isinstance(obj, dict):
            cleaned = {}

            for k, v in obj.items():
                if k in drop_keys:
                    continue

                cleaned_v = self._clean_output(
                    v,
                    parent_key=k,
                    keep_null_keys=keep_null_keys,
                    drop_keys=drop_keys
                )

                if k in keep_null_keys:
                    cleaned[k] = cleaned_v
                elif k == "skills":
                    cleaned[k] = cleaned_v if cleaned_v is not None else []
                elif k == "technical_skills":
                    cleaned[k] = cleaned_v if isinstance(cleaned_v, dict) else {}
                elif parent_key == "technical_skills":
                    cleaned[k] = cleaned_v if cleaned_v is not None else []
                elif cleaned_v not in (None, [], {}):
                    cleaned[k] = cleaned_v

            return cleaned

        if isinstance(obj, list):
            cleaned_list = []
            for item in obj:
                cleaned_item = self._clean_output(
                    item,
                    parent_key=parent_key,
                    keep_null_keys=keep_null_keys,
                    drop_keys=drop_keys
                )
                if cleaned_item is None or cleaned_item == {}:
                    continue
                cleaned_list.append(cleaned_item)
            return cleaned_list

        return obj


__all__ = ["ParseResult", "CVParsingPipeline"]
