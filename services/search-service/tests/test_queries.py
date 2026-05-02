"""
Tests unitaires des query builders ES.

Ces tests vérifient la structure exacte des requêtes ES générées
sans aucune dépendance externe (ni ES, ni PG, ni modèle).
"""

from __future__ import annotations

import pytest

from app.queries.candidates import build_candidates_filter_query
from app.queries.offers import build_offers_keyword_only_query, build_offers_search_query


# ---------------------------------------------------------------------------
# build_offers_search_query
# ---------------------------------------------------------------------------

class TestOffersSearchQuery:

    def _fake_vector(self):
        return [0.1] * 384

    def test_query_has_bool_and_knn(self):
        body = build_offers_search_query("python", self._fake_vector())
        assert "query" in body
        assert "knn" in body

    def test_multi_match_fields_present(self):
        body = build_offers_search_query("python", self._fake_vector())
        mm = body["query"]["bool"]["should"][0]["multi_match"]
        fields = mm["fields"]
        assert any("title" in f for f in fields)
        assert any("description" in f for f in fields)
        assert any("skills" in f for f in fields)

    def test_title_has_highest_boost(self):
        body = build_offers_search_query("python", self._fake_vector())
        mm = body["query"]["bool"]["should"][0]["multi_match"]
        # title^3 doit être présent et avoir le boost le plus élevé
        title_field = next(f for f in mm["fields"] if "title" in f)
        boost = int(title_field.split("^")[1])
        other_boosts = [
            int(f.split("^")[1]) for f in mm["fields"]
            if "^" in f and "title" not in f
        ]
        assert all(boost > b for b in other_boosts)

    def test_knn_vector_is_passed(self):
        vec = self._fake_vector()
        body = build_offers_search_query("python", vec)
        assert body["knn"]["query_vector"] == vec
        assert body["knn"]["field"] == "embedding"

    def test_size_respected(self):
        body = build_offers_search_query("python", self._fake_vector(), size=5)
        assert body["size"] == 5
        assert body["knn"]["k"] == 5

    def test_embedding_excluded_from_source(self):
        body = build_offers_search_query("python", self._fake_vector())
        assert "embedding" in body["_source"]["excludes"]

    def test_keyword_only_fallback_has_no_knn(self):
        body = build_offers_keyword_only_query("python")
        assert "knn" not in body
        assert "multi_match" in body["query"]


# ---------------------------------------------------------------------------
# build_candidates_filter_query
# ---------------------------------------------------------------------------

class TestCandidatesFilterQuery:

    def test_no_filters_returns_only_status_filter(self):
        body = build_candidates_filter_query()
        filters = body["query"]["bool"]["filter"]
        assert len(filters) == 1
        assert filters[0] == {"term": {"status": "active"}}

    def test_years_experience_range_gte(self):
        body = build_candidates_filter_query(years_experience=3)
        filters = body["query"]["bool"]["filter"]
        range_f = next(f for f in filters if "range" in f)
        assert range_f["range"]["years_experience"]["gte"] == 3

    def test_education_term_filter_lowercased(self):
        body = build_candidates_filter_query(education="Master")
        filters = body["query"]["bool"]["filter"]
        term_f = next(f for f in filters if "term" in f and "education" in f["term"])
        assert term_f["term"]["education"] == "master"

    def test_skills_uses_terms_not_term(self):
        """skills → `terms` (OR) et non plusieurs `term` (AND)."""
        body = build_candidates_filter_query(skills=["Python", "FastAPI"])
        filters = body["query"]["bool"]["filter"]
        terms_f = next(f for f in filters if "terms" in f)
        # normalisé en lowercase
        assert set(terms_f["terms"]["skills"]) == {"python", "fastapi"}

    def test_location_term_filter(self):
        body = build_candidates_filter_query(location="Paris")
        filters = body["query"]["bool"]["filter"]
        term_f = next(f for f in filters if "term" in f and "location" in f["term"])
        assert term_f["term"]["location"] == "Paris"

    def test_all_filters_combined_count(self):
        body = build_candidates_filter_query(
            years_experience=2,
            education="bachelor",
            skills=["java"],
            location="Lyon",
        )
        filters = body["query"]["bool"]["filter"]
        # status + years + education + skills + location = 5
        assert len(filters) == 5

    def test_size_respected(self):
        body = build_candidates_filter_query(size=10)
        assert body["size"] == 10

    def test_no_knn_in_candidates_query(self):
        """MVP candidats = filtres seulement, jamais de kNN."""
        body = build_candidates_filter_query(skills=["python"])
        assert "knn" not in body
