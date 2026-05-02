from __future__ import annotations

from sqlalchemy.orm import Session

from app.repositories.segment_repository import get_candidate_segments, get_segment_rules
from app.engines.legacy_matching.rules.rule_evaluator import evaluate_rules_grouped
from app.engines.legacy_matching.schemas import SelectedSegment


def select_candidate_segment(session: Session, mapped_cv: dict) -> SelectedSegment:
    segments = get_candidate_segments(session)
    if not segments:
        raise RuntimeError("Aucun segment actif disponible dans matching.segment.")

    # Important :
    # tes segment_rule.attribute_path peuvent pointer vers mapped_cv.identity.age,
    # mapped_cv.experience.total_months, mapped_cv.education.level, etc.
    context = {
        "mapped_cv": mapped_cv,
        "candidate": mapped_cv,
    }

    for segment in sorted(segments, key=lambda item: int(item["priority"])):
        rules = get_segment_rules(session, segment["id"])

        if evaluate_rules_grouped(rules, context, default_if_empty=False):
            return SelectedSegment(
                id=str(segment["id"]),
                code=str(segment["code"]),
                label=str(segment["label"]),
                priority=int(segment["priority"]),
            )

    # Fallback à adapter à tes vrais codes de segment
    fallback = next(
        (
            segment
            for segment in segments
            if segment["code"] in {
                "JEUNE_DIPLOME_SANS_EXPERIENCE",
                "JEUNE_DIPLOME",
                "JEUNE",
                "STANDARD",
                "BEGINNER",
            }
        ),
        None,
    )

    if fallback:
        return SelectedSegment(
            id=str(fallback["id"]),
            code=str(fallback["code"]),
            label=str(fallback["label"]),
            priority=int(fallback["priority"]),
        )

    raise RuntimeError(
        "Aucun segment ne matche ce candidat et aucun segment fallback n'est disponible."
    )