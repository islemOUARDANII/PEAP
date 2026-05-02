from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.session import table_exists
from app.repositories.model_config_repository import (
    get_active_model_for_segment,
    get_segment_assignments,
    get_segment_model_rules,
)
from app.engines.legacy_matching.rules.rule_evaluator import evaluate_rules_grouped
from app.engines.legacy_matching.schemas import SelectedModel, SelectedSegment


def select_model_for_segment(
    session: Session,
    segment: SelectedSegment,
    mapped_cv: dict,
    mapped_offer: dict,
    direction: str = "CANDIDATE_TO_OFFER",
) -> SelectedModel:
    if table_exists(session, "segment_model_assignment"):
        assignments = get_segment_assignments(session, segment.id, direction)
        if assignments:
            context = {"mapped_cv": mapped_cv, "mapped_offer": mapped_offer}
            special_matches: list[dict] = []
            for assignment in assignments:
                rules = get_segment_model_rules(session, assignment["assignment_id"])
                if rules and evaluate_rules_grouped(rules, context, default_if_empty=False):
                    special_matches.append(assignment)

            selected = None
            if special_matches:
                selected = sorted(special_matches, key=lambda item: item["priority"])[0]
            else:
                defaults = [assignment for assignment in assignments if assignment.get("is_default")]
                selected = sorted(defaults or assignments, key=lambda item: item["priority"])[0]

            return SelectedModel(
                model_id=str(selected["model_id"]),
                model_code=str(selected["model_code"]),
                model_version_id=str(selected["model_version_id"]),
                version_number=int(selected["version_number"]),
                case_id=str(selected["case_id"]) if selected.get("case_id") else None,
                case_code=selected.get("case_code"),
                assignment_id=str(selected["assignment_id"]) if selected.get("assignment_id") else None,
                segment_id=segment.id,
                segment_code=segment.code,
            )

    selected = get_active_model_for_segment(session, segment.code, direction=direction)
    return SelectedModel(
        model_id=str(selected["model_id"]),
        model_code=str(selected["model_code"]),
        model_version_id=str(selected["model_version_id"]),
        version_number=int(selected["version_number"]),
        case_id=str(selected["case_id"]) if selected.get("case_id") else None,
        case_code=selected.get("case_code"),
        assignment_id=str(selected["assignment_id"]) if selected.get("assignment_id") else None,
        segment_id=segment.id,
        segment_code=segment.code,
    )
