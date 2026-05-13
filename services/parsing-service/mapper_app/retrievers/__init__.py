from importlib import import_module


__all__ = [
    "AliasRetriever",
    "BM25Retriever",
    "ExactRetriever",
    "HybridRetriever",
    "VectorRetriever",
    "reciprocal_rank_fusion",
]


_EXPORT_MAP = {
    "AliasRetriever": ("mapper_app.retrievers.alias", "AliasRetriever"),
    "BM25Retriever": ("mapper_app.retrievers.bm25", "BM25Retriever"),
    "ExactRetriever": ("mapper_app.retrievers.exact", "ExactRetriever"),
    "HybridRetriever": ("mapper_app.retrievers.hybrid", "HybridRetriever"),
    "VectorRetriever": ("mapper_app.retrievers.vector", "VectorRetriever"),
    "reciprocal_rank_fusion": ("mapper_app.retrievers.rrf", "reciprocal_rank_fusion"),
}


def __getattr__(name: str):
    if name not in _EXPORT_MAP:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

    module_name, attr_name = _EXPORT_MAP[name]
    module = import_module(module_name)
    value = getattr(module, attr_name)
    globals()[name] = value
    return value
