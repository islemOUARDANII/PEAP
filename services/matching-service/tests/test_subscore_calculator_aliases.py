import unittest

from app.engines.legacy_matching.services.subscore_calculator import (
    _CALCULATOR_REGISTRY,
    calculate_all_subscores,
    get_calculator_for_criterion,
)


class CriterionAliasResolutionTests(unittest.TestCase):
    def test_db_match_codes_resolve_to_legacy_calculators(self) -> None:
        expected = {
            "SKILLS_MATCH": "skills_score",
            "EDUCATION_MATCH": "education_score",
            "EXPERIENCE_MATCH": "experience_score",
            "LANGUAGE_MATCH": "language_score",
            "LOCATION_MATCH": "location_score",
            "CONTRACT_MATCH": "contract_score",
        }

        for criterion_code, resolved_code in expected.items():
            with self.subTest(criterion_code=criterion_code):
                actual_code, calculator = get_calculator_for_criterion(_CALCULATOR_REGISTRY, criterion_code)
                self.assertEqual(actual_code, resolved_code)
                self.assertIsNotNone(calculator)

    def test_alias_resolution_falls_back_to_secondary_candidates(self) -> None:
        calculators = {
            "rtmc_skill": (lambda _cv, _offer, _params: {"skills_score": 1.0}, "skills_score"),
        }

        resolved_code, calculator = get_calculator_for_criterion(calculators, "SKILLS_MATCH")

        self.assertEqual(resolved_code, "rtmc_skill")
        self.assertIsNotNone(calculator)

    def test_subscores_keep_original_db_codes_in_output(self) -> None:
        weights = {
            "SKILLS_MATCH": 0.3,
            "EDUCATION_MATCH": 0.15,
            "EXPERIENCE_MATCH": 0.2,
            "LANGUAGE_MATCH": 0.1,
            "LOCATION_MATCH": 0.1,
            "CONTRACT_MATCH": 0.15,
        }
        params = {
            "skills_score": {
                "must_have_rate_if_no_requirement": 1.0,
                "nice_to_have_rate_if_no_requirement": 1.0,
                "must_have_weight": 0.7,
                "nice_to_have_weight": 0.3,
                "coverage_weight": 0.8,
                "level_weight": 0.2,
                "level_beginner": 0.25,
                "level_intermediate": 0.55,
                "level_advanced": 0.8,
                "level_expert": 1.0,
                "skill_coverage_if_no_requirement": 1.0,
            },
            "education_score": {
                "degree_fit_no_requirement": 1.0,
                "degree_fit_missing_cv": 0.0,
                "degree_fit_equal_requirement": 1.0,
                "degree_fit_above_requirement": 1.0,
                "degree_fit_below_requirement": 0.4,
                "field_fit_no_requirement": 1.0,
                "field_fit_match": 1.0,
                "field_fit_mismatch": 0.3,
                "degree_level_weight": 0.7,
                "field_weight": 0.3,
            },
            "experience_score": {
                "years_fit_if_no_requirement": 1.0,
                "role_fit_if_no_target": 1.0,
                "role_fit_match": 1.0,
                "role_fit_mismatch": 0.2,
                "tech_coverage_if_no_demand": 1.0,
                "responsibility_fit_if_no_demand": 1.0,
                "years_weight": 0.5,
                "role_weight": 0.3,
                "task_weight": 0.2,
                "task_tech_weight": 0.7,
                "task_responsibility_weight": 0.3,
            },
            "location_score": {
                "no_requirement_score": 1.0,
                "exact_match_score": 1.0,
                "partial_match_score": 0.7,
                "remote_or_flexible_score": 0.9,
                "mismatch_score": 0.2,
            },
            "language_score": {
                "no_requirement_score": 1.0,
            },
            "contract_score": {
                "no_requirement_score": 1.0,
                "compatible_score": 1.0,
                "mismatch_score": 0.0,
            },
        }
        cv_features = {
            "skill_codes": ["PYTHON", "SQL"],
            "skill_levels": {"PYTHON": "advanced", "SQL": "expert"},
            "education_degree_rank": 7,
            "education_field_codes": ["CS"],
            "experience_years": 5,
            "experience_role_codes": ["DEV"],
            "occupation_codes": ["DEV"],
            "experience_skill_codes": ["PYTHON", "SQL"],
            "responsibility_codes": ["BUILD"],
            "location_codes": ["TN-11"],
            "languages": ["FR", "EN"],
            "contract_types": ["CDI"],
        }
        offer_features = {
            "must_have_skill_codes": ["PYTHON"],
            "nice_to_have_skill_codes": ["SQL"],
            "minimum_degree_rank": 6,
            "target_field_codes": ["CS"],
            "required_experience_years": 3,
            "target_occupation_codes": ["DEV"],
            "required_skill_codes": ["PYTHON", "SQL"],
            "mission_codes": ["BUILD"],
            "responsibility_codes": ["BUILD"],
            "location_codes": ["TN-11"],
            "required_languages": ["FR"],
            "contract_types": ["CDI"],
        }

        bundle = calculate_all_subscores(
            cv_features,
            offer_features,
            {
                "weights": weights,
                "params": params,
            },
        )

        self.assertEqual(bundle["warnings"], [])
        self.assertEqual(set(bundle["sub_scores"]), set(weights))
        self.assertEqual(set(bundle["details"]), set(weights))
        self.assertGreater(bundle["sub_scores"]["SKILLS_MATCH"], 0.0)
        self.assertGreater(bundle["sub_scores"]["EDUCATION_MATCH"], 0.0)
        self.assertGreater(bundle["sub_scores"]["EXPERIENCE_MATCH"], 0.0)


if __name__ == "__main__":
    unittest.main()
