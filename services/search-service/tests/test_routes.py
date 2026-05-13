"""
Tests d'intégration des endpoints FastAPI.

Couvre :
  - POST /search/offers  → réponse normale, filtres, pagination, fallback, auth, validation
  - POST /search/candidates → filtres, texte libre, pagination, auth
  - GET  /health
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from tests.conftest import (
    FAKE_OFFER,
    FAKE_CANDIDATE,
    _make_es_hit,
    _make_es_response,
)


# ---------------------------------------------------------------------------
# /health
# ---------------------------------------------------------------------------

class TestHealth:
    def test_health_ok(self, app_client):
        r = app_client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


# ---------------------------------------------------------------------------
# POST /search/offers
# ---------------------------------------------------------------------------

class TestSearchOffers:

    def test_hybrid_search_returns_ranked_results(self, app_client, mock_es_client):
        """Cas nominal : query valide → résultats triés par score."""
        mock_es_client.search.return_value = _make_es_response([
            _make_es_hit(FAKE_OFFER, score=2.1),
            _make_es_hit({**FAKE_OFFER, "_id": "offer-uuid-002", "offer_id": "offer-uuid-002", "title": "Backend Dev"}, score=1.3),
        ])

        r = app_client.post("/search/offers", json={"query": "python backend api"})

        assert r.status_code == 200
        body = r.json()
        assert body["total"] == 2
        assert len(body["results"]) == 2
        assert body["results"][0]["score"] > body["results"][1]["score"]
        assert body["results"][0]["title"] == "Senior Python Backend Engineer"
        assert body["mode"] in ("hybrid", "keyword_only")

    def test_response_excludes_embedding_field(self, app_client, mock_es_client):
        """Le champ embedding ne doit jamais apparaître dans la réponse."""
        source_with_emb = {**FAKE_OFFER, "embedding": [0.1] * 384}
        mock_es_client.search.return_value = _make_es_response([
            _make_es_hit(source_with_emb)
        ])

        r = app_client.post("/search/offers", json={"query": "data engineer"})
        assert r.status_code == 200
        for result in r.json()["results"]:
            assert "embedding" not in result

    def test_empty_results(self, app_client, mock_es_client):
        """Aucune offre matchante → liste vide, total=0."""
        mock_es_client.search.return_value = _make_es_response([])

        r = app_client.post("/search/offers", json={"query": "abcxyz inexistant"})
        assert r.status_code == 200
        assert r.json()["total"] == 0
        assert r.json()["results"] == []

    def test_fallback_keyword_when_embedding_fails(self, app_client, mock_es_client):
        """Si l'embedding échoue, le service doit fallback en keyword-only."""
        mock_es_client.search.return_value = _make_es_response([_make_es_hit(FAKE_OFFER)])

        with patch("app.routers.offers.embed_text", side_effect=RuntimeError("model down")):
            r = app_client.post("/search/offers", json={"query": "python"})

        assert r.status_code == 200
        assert r.json()["mode"] == "keyword_only"

    def test_missing_query_returns_422(self, app_client):
        """Body sans `query` → validation Pydantic → 422."""
        r = app_client.post("/search/offers", json={})
        assert r.status_code == 422

    def test_empty_query_returns_422(self, app_client):
        """Query vide → min_length=1 → 422."""
        r = app_client.post("/search/offers", json={"query": ""})
        assert r.status_code == 422

    def test_size_respected(self, app_client, mock_es_client):
        """Le paramètre size est transmis à ES."""
        mock_es_client.search.return_value = _make_es_response([])

        app_client.post("/search/offers", json={"query": "python", "size": 5})

        call_body = mock_es_client.search.call_args[1]["body"]
        assert call_body["size"] == 5

    def test_unauthorized_without_api_key(self, app_client):
        """Requête sans header X-Api-Key → 401."""
        r = app_client.post(
            "/search/offers",
            json={"query": "python"},
            headers={"X-Api-Key": "wrong-key"},
        )
        assert r.status_code == 401

    def test_es_error_returns_503(self, app_client, mock_es_client):
        """Si ES est down → 503 (pas 500)."""
        mock_es_client.search.side_effect = ConnectionError("ES unreachable")

        r = app_client.post("/search/offers", json={"query": "python"})
        assert r.status_code == 503

    # --- Nouveaux paramètres ---

    def test_from_pagination_transmitted_to_es(self, app_client, mock_es_client):
        """Le paramètre from_ est transmis à ES pour la pagination."""
        mock_es_client.search.return_value = _make_es_response([])

        app_client.post("/search/offers", json={"query": "python", "from_": 20})

        call_body = mock_es_client.search.call_args[1]["body"]
        assert call_body["from"] == 20

    def test_contract_type_filter_added(self, app_client, mock_es_client):
        """contract_type → term filter transmis à ES."""
        mock_es_client.search.return_value = _make_es_response([])

        app_client.post("/search/offers", json={"query": "python", "contract_type": "CDI"})

        call_body = mock_es_client.search.call_args[1]["body"]
        knn_filters = call_body["knn"]["filter"]["bool"]["filter"]
        bool_filters = call_body["query"]["bool"]["filter"]
        assert {"term": {"contract_type": "CDI"}} in knn_filters
        assert {"term": {"contract_type": "CDI"}} in bool_filters

    def test_work_mode_filter_added(self, app_client, mock_es_client):
        """work_mode → term filter transmis à ES."""
        mock_es_client.search.return_value = _make_es_response([])

        app_client.post("/search/offers", json={"query": "python", "work_mode": "REMOTE"})

        call_body = mock_es_client.search.call_args[1]["body"]
        bool_filters = call_body["query"]["bool"]["filter"]
        assert {"term": {"work_mode": "REMOTE"}} in bool_filters

    def test_governorate_filter_added(self, app_client, mock_es_client):
        """governorate → match filter avec fuzziness transmis à ES."""
        mock_es_client.search.return_value = _make_es_response([])

        app_client.post("/search/offers", json={"query": "python", "governorate": "Tunis"})

        call_body = mock_es_client.search.call_args[1]["body"]
        bool_filters = call_body["query"]["bool"]["filter"]
        gov_filter = next(
            (f for f in bool_filters if "match" in f and "governorate" in f["match"]),
            None,
        )
        assert gov_filter is not None
        assert gov_filter["match"]["governorate"]["query"] == "Tunis"

    def test_salary_range_filter_added(self, app_client, mock_es_client):
        """salary_min + salary_max → range filter transmis à ES."""
        mock_es_client.search.return_value = _make_es_response([])

        app_client.post("/search/offers", json={
            "query": "python",
            "salary_min": 1500,
            "salary_max": 3000,
        })

        call_body = mock_es_client.search.call_args[1]["body"]
        bool_filters = call_body["query"]["bool"]["filter"]
        range_filter = next(
            (f for f in bool_filters if "range" in f and "salary_min" in f["range"]),
            None,
        )
        assert range_filter is not None
        assert range_filter["range"]["salary_min"]["gte"] == 1500
        assert range_filter["range"]["salary_min"]["lte"] == 3000

    def test_salary_min_only(self, app_client, mock_es_client):
        """salary_min seul → range gte sans lte."""
        mock_es_client.search.return_value = _make_es_response([])

        app_client.post("/search/offers", json={"query": "python", "salary_min": 2000})

        call_body = mock_es_client.search.call_args[1]["body"]
        bool_filters = call_body["query"]["bool"]["filter"]
        range_filter = next(
            (f for f in bool_filters if "range" in f and "salary_min" in f["range"]),
            None,
        )
        assert range_filter is not None
        assert range_filter["range"]["salary_min"]["gte"] == 2000
        assert "lte" not in range_filter["range"]["salary_min"]

    def test_combined_filters_all_present(self, app_client, mock_es_client):
        """Tous les filtres combinés → présents dans la requête ES."""
        mock_es_client.search.return_value = _make_es_response([])

        app_client.post("/search/offers", json={
            "query": "développeur",
            "contract_type": "CDI",
            "work_mode": "HYBRID",
            "governorate": "Sfax",
            "salary_min": 1000,
            "salary_max": 2500,
            "from_": 10,
            "size": 5,
        })

        call_body = mock_es_client.search.call_args[1]["body"]
        # size et from correct
        assert call_body["size"] == 5
        assert call_body["from"] == 10
        # au minimum status + PUBLISHED + contract + work_mode + governorate + salary = 6
        bool_filters = call_body["query"]["bool"]["filter"]
        assert len(bool_filters) >= 6

    def test_no_filters_only_published_status(self, app_client, mock_es_client):
        """Sans filtres optionnels → seulement status=PUBLISHED + exists:skills."""
        mock_es_client.search.return_value = _make_es_response([])

        app_client.post("/search/offers", json={"query": "python"})

        call_body = mock_es_client.search.call_args[1]["body"]
        bool_filters = call_body["query"]["bool"]["filter"]
        assert {"term": {"status": "PUBLISHED"}} in bool_filters
        assert len(bool_filters) == 2  # PUBLISHED + exists:skills


# ---------------------------------------------------------------------------
# POST /search/candidates
# ---------------------------------------------------------------------------

class TestSearchCandidates:

    def test_filter_by_skills_returns_candidates(self, app_client, mock_es_client):
        """Filtre skills → candidats retournés."""
        mock_es_client.search.return_value = _make_es_response([
            _make_es_hit(FAKE_CANDIDATE, score=1.0)
        ])

        r = app_client.post("/search/candidates", json={
            "filters": {"skills": ["python", "fastapi"]}
        })

        assert r.status_code == 200
        body = r.json()
        assert body["total"] == 1
        assert body["results"][0]["candidate_id"] == "candidate-uuid-001"
        assert "python" in body["results"][0]["skills"]

    def test_all_structured_filters_in_filter_clause(self, app_client, mock_es_client):
        """years_experience, location et education vont dans filter ; skills dans should."""
        mock_es_client.search.return_value = _make_es_response([])

        app_client.post("/search/candidates", json={
            "filters": {
                "years_experience": 3,
                "education": "master",
                "skills": ["python"],
                "location": "Tunis",
            }
        })

        call_body = mock_es_client.search.call_args[1]["body"]
        filters = call_body["query"]["bool"]["filter"]
        should = call_body["query"]["bool"].get("should", [])

        # filter : status + years_experience + education + location = 4
        assert len(filters) == 4
        assert {"term": {"status": "ACTIVE"}} in filters
        assert {"term": {"education": "master"}} in filters

        # should : skills[0] (1 match clause)
        assert len(should) == 1
        assert call_body["query"]["bool"]["minimum_should_match"] == 1

    def test_empty_filters_returns_all_active(self, app_client, mock_es_client):
        """Filtres vides → seulement le filtre status=ACTIVE (uppercase)."""
        mock_es_client.search.return_value = _make_es_response([])

        app_client.post("/search/candidates", json={"filters": {}})

        call_body = mock_es_client.search.call_args[1]["body"]
        filters = call_body["query"]["bool"]["filter"]
        assert len(filters) == 1
        assert filters[0] == {"term": {"status": "ACTIVE"}}

    def test_filters_applied_in_response(self, app_client, mock_es_client):
        """La réponse reflète les filtres effectivement appliqués."""
        mock_es_client.search.return_value = _make_es_response([])

        r = app_client.post("/search/candidates", json={
            "filters": {"years_experience": 5, "location": "Lyon"}
        })

        body = r.json()
        assert body["filters_applied"]["years_experience"] == 5
        assert body["filters_applied"]["location"] == "Lyon"
        assert "education" not in body["filters_applied"]

    def test_skills_use_fuzzy_match_in_should(self, app_client, mock_es_client):
        """skills → chaque skill → match avec fuzziness dans should (pas terms dans filter)."""
        mock_es_client.search.return_value = _make_es_response([])

        app_client.post("/search/candidates", json={
            "filters": {"skills": ["python", "java"]}
        })

        call_body = mock_es_client.search.call_args[1]["body"]
        should = call_body["query"]["bool"].get("should", [])
        # 2 match clauses, une par skill
        skill_matches = [s for s in should if "match" in s and "skills" in s["match"]]
        assert len(skill_matches) == 2
        skill_values = {s["match"]["skills"]["query"] for s in skill_matches}
        assert skill_values == {"python", "java"}

    def test_years_experience_uses_range_gte(self, app_client, mock_es_client):
        """years_experience → range gte (pas term exact)."""
        mock_es_client.search.return_value = _make_es_response([])

        app_client.post("/search/candidates", json={
            "filters": {"years_experience": 3}
        })

        call_body = mock_es_client.search.call_args[1]["body"]
        range_filter = next(
            f for f in call_body["query"]["bool"]["filter"]
            if "range" in f
        )
        assert range_filter["range"]["years_experience"]["gte"] == 3

    def test_location_uses_fuzzy_match(self, app_client, mock_es_client):
        """location → match avec fuzziness dans filter (pas term exact)."""
        mock_es_client.search.return_value = _make_es_response([])

        app_client.post("/search/candidates", json={
            "filters": {"location": "Tunis"}
        })

        call_body = mock_es_client.search.call_args[1]["body"]
        filters = call_body["query"]["bool"]["filter"]
        loc_filter = next(
            (f for f in filters if "match" in f and "location" in f["match"]),
            None,
        )
        assert loc_filter is not None
        assert loc_filter["match"]["location"]["query"] == "Tunis"
        assert loc_filter["match"]["location"]["fuzziness"] == "AUTO"

    # --- Nouveaux paramètres ---

    def test_query_text_adds_multi_match_in_should(self, app_client, mock_es_client):
        """query libre → multi_match sur skills+education dans should."""
        mock_es_client.search.return_value = _make_es_response([])

        app_client.post("/search/candidates", json={
            "filters": {"query": "développeur python expérimenté"}
        })

        call_body = mock_es_client.search.call_args[1]["body"]
        should = call_body["query"]["bool"].get("should", [])
        multi_matches = [s for s in should if "multi_match" in s]
        assert len(multi_matches) == 1
        assert multi_matches[0]["multi_match"]["query"] == "développeur python expérimenté"
        assert "skills" in " ".join(multi_matches[0]["multi_match"]["fields"])

    def test_query_text_sets_minimum_should_match(self, app_client, mock_es_client):
        """Quand query ou should existe → minimum_should_match=1."""
        mock_es_client.search.return_value = _make_es_response([])

        app_client.post("/search/candidates", json={
            "filters": {"query": "comptable"}
        })

        call_body = mock_es_client.search.call_args[1]["body"]
        assert call_body["query"]["bool"]["minimum_should_match"] == 1

    def test_from_pagination_transmitted_to_es(self, app_client, mock_es_client):
        """Le paramètre from_ est transmis à ES pour la pagination."""
        mock_es_client.search.return_value = _make_es_response([])

        app_client.post("/search/candidates", json={
            "filters": {"from_": 40, "size": 20}
        })

        call_body = mock_es_client.search.call_args[1]["body"]
        assert call_body["from"] == 40
        assert call_body["size"] == 20

    def test_query_combined_with_skills_filter(self, app_client, mock_es_client):
        """query + skills → tous deux présents dans should."""
        mock_es_client.search.return_value = _make_es_response([])

        app_client.post("/search/candidates", json={
            "filters": {
                "query": "ingénieur data",
                "skills": ["python", "spark"],
            }
        })

        call_body = mock_es_client.search.call_args[1]["body"]
        should = call_body["query"]["bool"].get("should", [])
        # 1 multi_match (query) + 2 match (skills)
        assert len(should) == 3

    def test_unauthorized_without_api_key(self, app_client):
        r = app_client.post(
            "/search/candidates",
            json={"filters": {}},
            headers={"X-Api-Key": "bad"},
        )
        assert r.status_code == 401

    def test_es_error_returns_503(self, app_client, mock_es_client):
        mock_es_client.search.side_effect = ConnectionError("ES down")
        r = app_client.post("/search/candidates", json={"filters": {}})
        assert r.status_code == 503
