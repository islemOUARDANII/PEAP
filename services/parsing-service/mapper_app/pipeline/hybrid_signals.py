from __future__ import annotations

import re
import unicodedata
from typing import Any


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    return " ".join(str(value).split()).strip()


def as_list(value: Any) -> list[Any]:
    if not value:
        return []
    if isinstance(value, list):
        return value
    return [value]


def normalize_term_key(value: Any) -> str:
    text = clean_text(value).casefold()
    if not text:
        return ""
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = re.sub(r"[^a-z0-9]+", " ", text)
    tokens = [token for token in text.split() if token]
    return " ".join(sorted(tokens))


def unique_terms(values: list[Any]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for value in values:
        raw = clean_text(value)
        key = normalize_term_key(raw)
        if not raw or not key or key in seen:
            continue
        seen.add(key)
        out.append(raw)
    return out


def extract_named_value(value: Any) -> str:
    if isinstance(value, dict):
        for key in ("raw_label", "normalized_label", "name", "label", "skill", "title", "code"):
            text = clean_text(value.get(key))
            if text:
                return text
        return ""
    return clean_text(value)


def build_signal(
    *,
    raw_term: Any,
    source_path: str,
    group: str,
    entity_kind: str,
    taxonomy_code: Any = None,
    taxonomy_label: Any = None,
    taxonomy_type: Any = None,
    decision: Any = None,
    usable_for_scoring: Any = None,
    decision_score: Any = None,
    decision_reason: Any = None,
    confidence_label: Any = None,
    signal_origin: str,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    raw = clean_text(raw_term)
    normalized = normalize_term_key(raw)
    if not raw or not normalized:
        return None

    code = clean_text(taxonomy_code) or None
    label = clean_text(taxonomy_label) or None
    signal = {
        "raw_term": raw,
        "normalized_term": normalized,
        "source_path": source_path,
        "group": group,
        "entity_kind": entity_kind,
        "taxonomy_code": code,
        "taxonomy_label": label,
        "taxonomy_type": clean_text(taxonomy_type) or None,
        "decision": clean_text(decision) or None,
        "usable_for_scoring": bool(usable_for_scoring) if usable_for_scoring is not None else None,
        "decision_score": decision_score,
        "decision_reason": clean_text(decision_reason) or None,
        "confidence_label": clean_text(confidence_label) or None,
        "signal_origin": signal_origin,
        "matching_basis": "taxonomy_and_term" if code else "term_only",
    }
    if extra:
        signal.update(extra)
    return signal


def signal_from_mapped_entity(item: dict[str, Any], *, group: str) -> dict[str, Any] | None:
    return build_signal(
        raw_term=item.get("original_text") or item.get("rtmc_label"),
        source_path=clean_text(item.get("source_path")) or f"mapped_entities.{group}",
        group=group,
        entity_kind=clean_text(item.get("entity_kind")) or group.rstrip("s"),
        taxonomy_code=item.get("rtmc_code"),
        taxonomy_label=item.get("rtmc_label"),
        taxonomy_type=item.get("taxonomy_type"),
        decision=item.get("decision"),
        usable_for_scoring=item.get("usable_for_scoring"),
        decision_score=item.get("decision_score"),
        decision_reason=item.get("decision_reason"),
        confidence_label=item.get("confidence_label"),
        signal_origin="mapped_entity",
    )


def dedupe_signals(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in items:
        group = clean_text(item.get("group"))
        taxonomy_code = clean_text(item.get("taxonomy_code")).upper()
        normalized = clean_text(item.get("normalized_term"))
        if taxonomy_code:
            key = f"{group}|code|{taxonomy_code}"
        else:
            key = f"{group}|term|{normalized}"
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


def signal_terms(items: list[dict[str, Any]], *, usable_only: bool = False) -> list[str]:
    values: list[str] = []
    for item in items:
        if usable_only and item.get("usable_for_scoring") is False:
            continue
        raw = clean_text(item.get("raw_term"))
        if raw:
            values.append(raw)
    return unique_terms(values)


def signal_codes(items: list[dict[str, Any]], *, usable_only: bool = True) -> list[str]:
    values: list[str] = []
    for item in items:
        if usable_only and item.get("usable_for_scoring") is False:
            continue
        code = clean_text(item.get("taxonomy_code"))
        if code:
            values.append(code)
    return unique_terms(values)


def signal_unmapped_terms(items: list[dict[str, Any]]) -> list[str]:
    values = [
        item.get("raw_term")
        for item in items
        if clean_text(item.get("raw_term")) and not clean_text(item.get("taxonomy_code"))
    ]
    return unique_terms(values)
