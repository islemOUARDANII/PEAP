#!/usr/bin/env bash
# Tests manuels curl — lancer après `uvicorn app.main:app --port 8020`
# Usage: bash tests/manual_tests.sh

BASE="http://localhost:8020"
KEY="changeme"

echo ""
echo "═══════════════════════════════════════════════"
echo " 1. Health check"
echo "═══════════════════════════════════════════════"
curl -s "$BASE/health" | python -m json.tool

echo ""
echo "═══════════════════════════════════════════════"
echo " 2. Search offers — hybrid (keyword + vector)"
echo "═══════════════════════════════════════════════"
curl -s -X POST "$BASE/search/offers" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: $KEY" \
  -d '{"query": "python backend fastapi", "size": 5}' \
  | python -m json.tool

echo ""
echo "═══════════════════════════════════════════════"
echo " 3. Search offers — requête sémantique (pas de mot-clé exact)"
echo "═══════════════════════════════════════════════"
curl -s -X POST "$BASE/search/offers" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: $KEY" \
  -d '{"query": "développeur web expérimenté", "size": 5}' \
  | python -m json.tool

echo ""
echo "═══════════════════════════════════════════════"
echo " 4. Search candidates — tous les filtres"
echo "═══════════════════════════════════════════════"
curl -s -X POST "$BASE/search/candidates" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: $KEY" \
  -d '{
    "filters": {
      "years_experience": 3,
      "education": "master",
      "skills": ["python", "fastapi"],
      "location": "Paris",
      "size": 10
    }
  }' | python -m json.tool

echo ""
echo "═══════════════════════════════════════════════"
echo " 5. Search candidates — skills seulement"
echo "═══════════════════════════════════════════════"
curl -s -X POST "$BASE/search/candidates" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: $KEY" \
  -d '{"filters": {"skills": ["java", "spring"]}}' \
  | python -m json.tool

echo ""
echo "═══════════════════════════════════════════════"
echo " 6. Test auth — clé invalide → 401"
echo "═══════════════════════════════════════════════"
curl -s -o /dev/null -w "HTTP %{http_code}\n" \
  -X POST "$BASE/search/offers" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: bad-key" \
  -d '{"query": "python"}'

echo ""
echo "═══════════════════════════════════════════════"
echo " 7. Validation — query vide → 422"
echo "═══════════════════════════════════════════════"
curl -s -o /dev/null -w "HTTP %{http_code}\n" \
  -X POST "$BASE/search/offers" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: $KEY" \
  -d '{"query": ""}'

echo ""
echo "═══════════════════════════════════════════════"
echo " 8. Force sync manuelle"
echo "═══════════════════════════════════════════════"
curl -s -X POST "$BASE/admin/sync" | python -m json.tool

echo ""
echo "Done."
