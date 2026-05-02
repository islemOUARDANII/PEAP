__all__ = [
    "call_mapper_service",
    "build_candidate_profile",
    "build_scoring_features",
    "extract_cv_entities",
    "flatten_technical_skills",
    "load_json",
    "map_entity",
    "map_entities_with_agent",
    "map_parsed_cv",
    "map_parsed_offer",
    "normalize_mapping_result",
    "parse_and_map_cv_file",
    "save_json",
]


def __getattr__(name: str):
    if name in {
        "call_mapper_service",
        "map_entity",
        "map_entities_with_agent",
        "normalize_mapping_result",
    }:
        from mapper_app.pipeline.common_mapping import (
            call_mapper_service,
            map_entity,
            map_entities_with_agent,
            normalize_mapping_result,
        )

        exports = {
            "call_mapper_service": call_mapper_service,
            "map_entity": map_entity,
            "map_entities_with_agent": map_entities_with_agent,
            "normalize_mapping_result": normalize_mapping_result,
        }
        return exports[name]

    if name in {
        "build_candidate_profile",
        "build_scoring_features",
        "extract_cv_entities",
        "flatten_technical_skills",
        "load_json",
        "map_parsed_cv",
        "save_json",
    }:
        from mapper_app.pipeline.map_cv import (
            build_candidate_profile,
            build_scoring_features,
            extract_cv_entities,
            flatten_technical_skills,
            load_json,
            map_parsed_cv,
            save_json,
        )

        exports = {
            "build_candidate_profile": build_candidate_profile,
            "build_scoring_features": build_scoring_features,
            "extract_cv_entities": extract_cv_entities,
            "flatten_technical_skills": flatten_technical_skills,
            "load_json": load_json,
            "map_parsed_cv": map_parsed_cv,
            "save_json": save_json,
        }
        return exports[name]

    if name == "map_parsed_offer":
        from mapper_app.pipeline.map_offer import map_parsed_offer

        return map_parsed_offer

    if name == "parse_and_map_cv_file":
        from mapper_app.pipeline.parse_and_map_cv import parse_and_map_cv_file

        return parse_and_map_cv_file

    raise AttributeError(f"module 'mapper_app.pipeline' has no attribute {name!r}")
