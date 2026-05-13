from __future__ import annotations

from typing import Any

from app.engines.legacy_matching.rules.rule_evaluator import evaluate_rule
from app.engines.legacy_matching.services.feature_extractor import (
    extract_cv_features,
    extract_offer_features,
)
from app.engines.legacy_matching.services.subscore_calculator import (
    calculate_all_subscores,
    calculate_must_have_skill_rate,
)
from app.engines.legacy_matching.utils.score_utils import clamp


def evaluate_hard_filters(
    hard_filters: list[dict[str, Any]],
    context: dict[str, Any],
) -> dict[str, Any]:
    checks: list[dict[str, Any]] = []

    for hard_filter in hard_filters:
        attribute_path = hard_filter.get("attribute_path") or ""
        actual_value = _get_by_path(context, attribute_path)

        passed = evaluate_rule(
            actual_value,
            hard_filter.get("rule_operator", ""),
            hard_filter.get("rule_value"),
        )

        checks.append(
            {
                "criterion_code": hard_filter.get("criterion_code"),
                "attribute_path": attribute_path,
                "rule_operator": hard_filter.get("rule_operator"),
                "rule_value": hard_filter.get("rule_value"),
                "actual_value": actual_value,
                "passed": passed,
                "rejection_reason": hard_filter.get("rejection_reason"),
            }
        )

        if not passed:
            return {
                "passed": False,
                "rejection_reason": hard_filter.get("rejection_reason")
                or hard_filter.get("criterion_code"),
                "checks": checks,
            }

    return {
        "passed": True,
        "rejection_reason": None,
        "checks": checks,
    }


def compute_matching_score(
    candidate_payload: dict[str, Any],
    offer_payload: dict[str, Any],
    model_config: dict[str, Any],
) -> dict[str, Any]:
    """
    Pure scoring adapter.

    Input:
    - candidate_payload: normalized candidate features from our DB
    - offer_payload: normalized offer features from our DB
    - model_config: official matching model config from our DB

    Output:
    - structure ready to be inserted into matching_result and matching_result_detail
    """

    cv_features = extract_cv_features(
        candidate_payload,
        model_config.get("params", {}),
    )

    offer_features = extract_offer_features(
        offer_payload,
        model_config.get("params", {}),
    )

    subscore_bundle = calculate_all_subscores(
        cv_features,
        offer_features,
        {
            "criteria": model_config.get("criteria", []),
            "weights": model_config.get("weights", {}),
            "params": model_config.get("params", {}),
            "hard_filters": model_config.get("hard_filters", []),
            "formula": model_config.get("formula", {}),
            "decision_thresholds": model_config.get("decision_thresholds", []),
        },
    )

    sub_scores = subscore_bundle.get("sub_scores", {})
    subscore_details = subscore_bundle.get("details", [])
    hard_filter_context = subscore_bundle.get("hard_filter_context", {})

    must_have_skill_rate = calculate_must_have_skill_rate(
        cv_features,
        offer_features,
        model_config.get("params", {}).get("skills_score", {}),
    )

    if hard_filter_context.get("must_have_skill_rate") is None:
        hard_filter_context["must_have_skill_rate"] = must_have_skill_rate

    hard_filters_result = evaluate_hard_filters(
        model_config.get("hard_filters", []),
        {
            "candidate": candidate_payload,
            "offer": offer_payload,
            "sub_scores": sub_scores,
            "hard_filters": hard_filter_context,
        },
    )

    if not hard_filters_result["passed"]:
        return {
            "score_global": 0.0,
            "score_rule_based": 0.0,
            "score_semantic": 0.0,
            "eligibility_status": "NOT_ELIGIBLE",
            "decision_status": "TEMPORARY",
            "explanation_short": hard_filters_result.get("rejection_reason"),
            "explanation_json": {
                "hard_filters": hard_filters_result,
                "sub_scores": sub_scores,
                "details": subscore_details,
            },
            "details": _build_result_details(
                sub_scores=sub_scores,
                subscore_details=subscore_details,
                weights=model_config.get("weights", {}),
            ),
        }

    score_global = _weighted_score(
        sub_scores=sub_scores,
        weights=model_config.get("weights", {}),
    )

    return {
        "score_global": score_global,
        "score_rule_based": score_global,
        "score_semantic": 0.0,
        "eligibility_status": "ELIGIBLE",
        "decision_status": "TEMPORARY",
        "explanation_short": f"Score global: {round(score_global * 100, 2)}%",
        "explanation_json": {
            "sub_scores": sub_scores,
            "details": subscore_details,
            "hard_filters": hard_filters_result,
            "weights": model_config.get("weights", {}),
        },
        "details": _build_result_details(
            sub_scores=sub_scores,
            subscore_details=subscore_details,
            weights=model_config.get("weights", {}),
        ),
    }


def _weighted_score(
    sub_scores: dict[str, Any],
    weights: dict[str, float],
) -> float:
    total = 0.0
    total_weight = 0.0

    for code, weight in weights.items():
        if code == "semantic_score":
            continue

        value = sub_scores.get(code)
        if value is None:
            continue

        w = float(weight)
        total += float(value) * w
        total_weight += w

    if total_weight <= 0:
        return 0.0

    return clamp(total / total_weight)


def _build_result_details(
    sub_scores: dict[str, Any],
    subscore_details: list[dict[str, Any]],
    weights: dict[str, float],
) -> list[dict[str, Any]]:
    details: list[dict[str, Any]] = []

    for code, score in sub_scores.items():
        if code == "details":
            continue

        weight = float(weights.get(code, 0.0) or 0.0)

        details.append(
            {
                "criterion_code": code,
                "criterion_label": code,
                "score": float(score or 0.0),
                "weight": weight,
                "weighted_score": float(score or 0.0) * weight,
                "matched": float(score or 0.0) > 0,
                "is_gap": float(score or 0.0) < 0.5,
                "gap_type": "LOW_SCORE" if float(score or 0.0) < 0.5 else None,
                "gap_message": None,
                "recommendation": None,
                "metadata_json": {
                    "raw_detail": _find_detail(code, subscore_details),
                },
            }
        )

    return details


def _find_detail(code, subscore_details):
    if not isinstance(subscore_details, list):
        return None

    for item in subscore_details:
        if not isinstance(item, dict):
            continue

        if item.get("criterion_code") == code or item.get("code") == code:
            return item

    return None


def _get_by_path(data: dict[str, Any], path: str) -> Any:
    if not path:
        return None

    current: Any = data
    for part in path.split("."):
        if isinstance(current, dict):
            current = current.get(part)
        else:
            return None
    return current