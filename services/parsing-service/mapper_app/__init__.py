__all__ = [
    "MapperService",
    "get_mapper_service",
    "map_text_to_rtmc",
]


def __getattr__(name: str):
    if name in __all__:
        from mapper_app.service import MapperService, get_mapper_service, map_text_to_rtmc

        exports = {
            "MapperService": MapperService,
            "get_mapper_service": get_mapper_service,
            "map_text_to_rtmc": map_text_to_rtmc,
        }
        return exports[name]
    raise AttributeError(f"module 'mapper_app' has no attribute {name!r}")
