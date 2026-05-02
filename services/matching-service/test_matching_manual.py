from sqlalchemy import text

from app.db.session import SessionLocal
from app.repositories.candidate_repository import load_candidate_payload
from app.repositories.offer_repository import load_offer_payload
from app.repositories.model_config_repository import _default_params
from app.engines.scoring_adapter import compute_matching_score


OFFER_ID = "4ea5eecc-7acd-4b69-994c-4bd703fd70c6"
JOB_SEEKER_ID = "895c44f2-81ac-4187-8ade-ce7b8d20cb36"


def load_model_versions(db):
    rows = db.execute(
        text("""
            SELECT
                mv.id AS model_version_id,
                m.id AS model_id,
                m.code AS model_code,
                m.label AS model_label,
                m.direction,
                m.active,
                mv.version_number,
                mv.status,
                mv.created_at,
                mv.published_at
            FROM matching.matching_model_version mv
            JOIN matching.matching_model m
                ON m.id = mv.model_id
            WHERE m.active = true
            ORDER BY m.code, mv.version_number DESC
        """)
    ).mappings().all()

    return [dict(row) for row in rows]


def load_model_config_from_db(db, model_version_id: str) -> dict:
    rows = db.execute(
        text("""
            SELECT
                c.code AS criterion_code,
                mc.weight,
                mc.is_must,
                mc.min_threshold,
                mc.logic_operator
            FROM matching.matching_model_criterion mc
            JOIN matching.matching_criterion c
                ON c.id = mc.criterion_id
            WHERE mc.model_version_id = CAST(:model_version_id AS uuid)
            ORDER BY c.code
        """),
        {"model_version_id": model_version_id},
    ).mappings().all()

    weights = {}
    hard_filters = []
    params = _default_params()

    for row in rows:
        criterion_code = str(row["criterion_code"]).strip().upper()
        weight = float(row["weight"] or 0)

        # La DB stocke souvent 50 pour 50%, alors que le moteur attend 0.50.
        if weight > 1:
            weight = weight / 100.0

        weights[criterion_code] = weight

        if row.get("is_must"):
            hard_filters.append(
                {
                    "criterion": criterion_code,
                    "min_threshold": float(row["min_threshold"] or 0),
                    "logic_operator": row.get("logic_operator") or ">=",
                }
            )

    # Sécurité : si un critère manque, on met 0 pour éviter KeyError.
    for criterion in [
        "SKILLS_MATCH",
        "EDUCATION_MATCH",
        "EXPERIENCE_MATCH",
        "LANGUAGE_MATCH",
        "LOCATION_MATCH",
        "CONTRACT_MATCH",
    ]:
        weights.setdefault(criterion, 0.0)

    total = sum(weights.values())

    # Si les poids ne totalisent pas 1.0, on normalise.
    if total > 0:
        weights = {
            key: value / total
            for key, value in weights.items()
        }

    return {
        "weights": weights,
        "params": params,
        "hard_filters": hard_filters,
    }


def main():
    db = SessionLocal()

    try:
        candidate = load_candidate_payload(db, JOB_SEEKER_ID)
        offer = load_offer_payload(db, OFFER_ID)

        models = load_model_versions(db)

        print("\n================ INPUT ================")
        print("candidate_id =", JOB_SEEKER_ID)
        print("offer_id     =", OFFER_ID)

        print("\n================ CANDIDATE FEATURES ================")
        print(candidate.get("scoring_features"))

        print("\n================ OFFER FEATURES ================")
        print(offer.get("scoring_features"))

        print("\n================ MODELS FOUND ================")

        for model in models:
            print(
                model["model_version_id"],
                "|",
                model["model_code"],
                "|",
                model["model_label"],
                "| version",
                model["version_number"],
                "| status =",
                model["status"],
                "| active =",
                model["active"],
            )

        print("\n================ SCORES BY MODEL ================")

        results = []

        for model in models:
            model_config = load_model_config_from_db(
                db=db,
                model_version_id=str(model["model_version_id"]),
            )

            result = compute_matching_score(candidate, offer, model_config)

            sub_scores = result.get("explanation_json", {}).get("sub_scores", {})
            details = result.get("explanation_json", {}).get("details", {})

            results.append(
                {
                    "model": model,
                    "model_config": model_config,
                    "score_global": result.get("score_global"),
                    "sub_scores": sub_scores,
                    "details": details,
                }
            )

        results.sort(
            key=lambda item: item["score_global"] or 0,
            reverse=True,
        )

        for item in results:
            model = item["model"]
            weights = item["model_config"]["weights"]
            sub_scores = item["sub_scores"]

            print("\n--------------------------------------------------")
            print("MODEL            :", model["model_code"], "-", model["model_label"])
            print("VERSION          :", model["version_number"])
            print("MODEL_VERSION_ID :", model["model_version_id"])
            print("GLOBAL SCORE     :", round((item["score_global"] or 0) * 100, 2), "%")

            print("\nWEIGHTS")
            for key, value in weights.items():
                print(f"  {key:<18} = {round(value * 100, 2)}%")

            print("\nSUB SCORES")
            for key, value in sub_scores.items():
                print(f"  {key:<18} = {value}")

            print("\nIMPORTANT DETAILS")
            print("  LANGUAGE :", item["details"].get("LANGUAGE_MATCH"))
            print("  CONTRACT :", item["details"].get("CONTRACT_MATCH"))
            print("  EDUCATION:", item["details"].get("EDUCATION_MATCH"))
            print("  SKILLS   :", item["details"].get("SKILLS_MATCH"))

    finally:
        db.close()


if __name__ == "__main__":
    main()