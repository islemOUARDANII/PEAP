from __future__ import annotations

from collections import defaultdict
from typing import Any

from app.engines.legacy_matching.utils.path_utils import get_by_path
from app.engines.legacy_matching.utils.score_utils import normalize_list, to_float

__all__ = ["get_by_path", "evaluate_rule", "evaluate_rules_grouped"]


def _exists(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (list, tuple, set, dict)):
        return len(value) > 0
    return True


def _normalize_scalar(value: Any) -> Any:
    if isinstance(value, str):
        return value.strip()
    return value


def _string_eq(left: Any, right: Any) -> bool:
    if isinstance(left, str) and isinstance(right, str):
        return left.casefold() == right.casefold()
    return left == right


def evaluate_rule(actual_value: Any, operator: str, expected_value: Any) -> bool:
    operator = (operator or "").strip().upper()

    if operator == "EXISTS":
        return _exists(actual_value)
    if operator == "NOT_EXISTS":
        return not _exists(actual_value)

    if operator in {"GT", "GTE", "LT", "LTE"}:
        actual_num = to_float(actual_value, default=float("nan"))
        expected_num = to_float(expected_value, default=float("nan"))
        if actual_num != actual_num or expected_num != expected_num:
            return False
        if operator == "GT":
            return actual_num > expected_num
        if operator == "GTE":
            return actual_num >= expected_num
        if operator == "LT":
            return actual_num < expected_num
        return actual_num <= expected_num

    actual_value = _normalize_scalar(actual_value)
    expected_value = _normalize_scalar(expected_value)

    if operator == "EQ":
        return _string_eq(actual_value, expected_value)
    if operator == "NEQ":
        return not _string_eq(actual_value, expected_value)

    if operator in {"IN", "NOT_IN"}:
        expected_values = normalize_list(expected_value)
        actual_values = normalize_list(actual_value)
        if actual_values:
            match = any(
                any(_string_eq(item, candidate) for candidate in expected_values)
                for item in actual_values
            )
        else:
            match = any(_string_eq(actual_value, candidate) for candidate in expected_values)
        return match if operator == "IN" else not match

    if operator in {"CONTAINS", "NOT_CONTAINS"}:
        if isinstance(actual_value, str):
            match = str(expected_value).casefold() in actual_value.casefold()
        elif isinstance(actual_value, (list, tuple, set)):
            match = any(_string_eq(item, expected_value) for item in actual_value)
        elif isinstance(actual_value, dict):
            match = str(expected_value) in actual_value
        else:
            match = False
        return match if operator == "CONTAINS" else not match

    return False


def evaluate_rules_grouped(
    rules: list[dict[str, Any]],
    context: dict[str, Any],
    *,
    default_if_empty: bool = False,
) -> bool:
    if not rules:
        return default_if_empty

    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for rule in rules:
        grouped[str(rule.get("logic_group") or "default")].append(rule)

    group_results: list[bool] = []
    for group_rules in grouped.values():
        current_result: bool | None = None
        for rule in group_rules:
            actual_value = get_by_path(context, rule.get("attribute_path", ""))
            current = evaluate_rule(actual_value, rule.get("operator", ""), rule.get("value"))
            if current_result is None:
                current_result = current
                continue
            logic = (rule.get("logic_operator") or rule.get("logic") or "AND").strip().upper()
            if logic == "OR":
                current_result = current_result or current
            else:
                current_result = current_result and current
        group_results.append(bool(current_result))

    return all(group_results)
