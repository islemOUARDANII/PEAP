from __future__ import annotations

from typing import Any

from app.engines.geo_normalizer_adapter import enrich_offer_locations


def map_offer_to_rtmc(
    *,
    parsed_offer: dict[str, Any],
    use_vector: bool = False,
    use_llm: bool = False,
) -> dict[str, Any]:
    """
    Adapter entre le parsing-service et mapper_app pour les offres.
    """

    from mapper_app.pipeline.map_offer import map_parsed_offer

    enriched_offer = enrich_offer_locations(parsed_offer)

    rtmc_mapping = map_parsed_offer(
        enriched_offer,
        use_vector=use_vector,
        use_llm=use_llm,
    )

    return {
        **enriched_offer,
        "rtmc_mapping": rtmc_mapping,
    }