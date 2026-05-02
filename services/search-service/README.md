# Search Service — Integration & Architecture Guide

A hybrid search engine built on FastAPI + Elasticsearch + SentenceTransformers.  
It powers two distinct search flows: **semantic + keyword search for job offers** and **structured filter search for candidates**.

---

## Table of Contents

1. [Service Overview](#1-service-overview)
2. [Repository Structure](#2-repository-structure)
3. [Elasticsearch Setup & Configuration](#3-elasticsearch-setup--configuration)
4. [Environment Configuration](#4-environment-configuration)
5. [Running the Service](#5-running-the-service)
6. [Initial Data Sync](#6-initial-data-sync)
7. [API Reference](#7-api-reference)
8. [Offer Search — Complete Logic](#8-offer-search--complete-logic)
9. [Candidate Search — Complete Logic](#9-candidate-search--complete-logic)
10. [Incremental Sync Pipeline](#10-incremental-sync-pipeline)
11. [Production Features](#11-production-features)
12. [API Gateway Integration](#12-api-gateway-integration)
13. [Frontend Integration](#13-frontend-integration)
14. [Security](#14-security)
15. [Troubleshooting](#15-troubleshooting)
16. [Quick Start — Colleague Testing Guide](#16-quick-start--colleague-testing-guide)

---

## 1. Service Overview

The Search Service runs on port **8020** and exposes the following endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/search/offers` | Hybrid semantic + keyword search on job offers |
| `POST` | `/search/candidates` | Structured filter search on candidates |
| `GET` | `/offers/{offer_id}` | Full offer detail fetched directly from PostgreSQL |
| `GET` | `/health` | Service liveness check |
| `POST` | `/admin/sync` | Trigger a manual incremental sync |

All endpoints require the `X-Api-Key` header.

**Technology stack:**

| Component | Technology |
|-----------|------------|
| API framework | FastAPI 0.115 + Uvicorn |
| Search engine | Elasticsearch 8.16 |
| Embedding model | `paraphrase-multilingual-MiniLM-L12-v2` (384 dims, 50+ languages) |
| Source of truth | PostgreSQL 16 (Docker, port 5433) |
| Background sync | APScheduler (cron every 60 seconds) |
| Auth | Static API key via `X-Api-Key` header |
| Rate limiting | In-memory sliding window (60 req/60s per IP) |
| PG connections | `ThreadedConnectionPool` (min=2, max=10) |

---

## 2. Repository Structure

```
services/search-service/
├── app/
│   ├── main.py              # FastAPI app, lifespan, router registration, rate limiting
│   ├── config.py            # All settings via pydantic-settings + .env
│   ├── auth.py              # X-Api-Key header validation dependency
│   ├── embeddings.py        # SentenceTransformer singleton + timeout wrapper
│   ├── es_client.py         # ES client singleton + index mappings + bulk_index()
│   ├── pg_pool.py           # ThreadedConnectionPool for PostgreSQL
│   ├── rate_limit.py        # Sliding window rate limiter (in-memory, per IP)
│   ├── queries/
│   │   ├── offers.py        # ES query builders for offer search (hybrid + keyword-only)
│   │   └── candidates.py    # ES query builders for candidate search
│   ├── routers/
│   │   ├── offers.py        # POST /search/offers + GET /offers/{id}
│   │   └── candidates.py    # POST /search/candidates
│   └── sync/
│       ├── pg_reader.py     # PostgreSQL extraction (batched generators)
│       └── indexer.py       # Sync orchestration + ES-based checkpoint
├── tests/
│   ├── conftest.py          # Shared fixtures (mocked ES, mocked embeddings)
│   ├── test_routes.py       # Integration tests for all endpoints + new parameters
│   ├── test_queries.py      # Unit tests for ES query builders
│   ├── test_indexer.py      # Sync pipeline tests
│   └── test_embeddings.py   # Embedding helper tests
├── docker-compose.yml       # Elasticsearch + Kibana stack
├── requirements.txt
└── .env
```

---

## 3. Elasticsearch Setup & Configuration

### 3.1 Start Elasticsearch with Docker

```bash
cd services/search-service
docker compose up -d
```

This starts:
- **Elasticsearch** on `http://localhost:9200` — no auth, single node
- **Kibana** on `http://localhost:5601` — optional, for inspecting indices

Wait for the cluster to be healthy:

```bash
curl http://localhost:9200/_cluster/health?pretty
# "status": "green" or "yellow" (yellow is fine for single-node)
```

### 3.2 Elasticsearch Index Mappings

Both indices are created automatically on service startup. The mappings are defined in `app/es_client.py`.

#### Offers Index (`offers`)

```json
{
  "settings": {
    "analysis": {
      "filter": {
        "tech_synonyms": {
          "type": "synonym",
          "synonyms": [
            "ingénieur, engineer, ingenieur",
            "développeur, developer, developpeur",
            "analyste, analyst",
            "responsable, manager",
            "chef, lead, head",
            "stagiaire, intern, stage",
            "comptable, accountant",
            "infirmier, nurse"
          ]
        }
      },
      "analyzer": {
        "text_fr_en": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": ["lowercase", "asciifolding", "tech_synonyms", "stop"]
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "offer_id":      { "type": "keyword" },
      "company_id":    { "type": "keyword" },
      "status":        { "type": "keyword" },
      "contract_type": { "type": "keyword" },
      "work_mode":     { "type": "keyword" },
      "governorate":   { "type": "keyword" },
      "location":      { "type": "keyword" },
      "salary_min":    { "type": "float" },
      "salary_max":    { "type": "float" },
      "title":         { "type": "text", "analyzer": "text_fr_en", "fields": { "keyword": { "type": "keyword" } } },
      "description":   { "type": "text", "analyzer": "text_fr_en" },
      "skills":        { "type": "text", "analyzer": "text_fr_en", "fields": { "keyword": { "type": "keyword" } } },
      "occupations":   { "type": "text", "analyzer": "text_fr_en", "fields": { "keyword": { "type": "keyword" } } },
      "languages":     { "type": "keyword" },
      "created_at":    { "type": "date" },
      "updated_at":    { "type": "date" },
      "embedding": {
        "type": "dense_vector",
        "dims": 384,
        "index": true,
        "similarity": "cosine"
      }
    }
  }
}
```

Key design decisions:
- `skills` and `occupations` use `text` (not `keyword`) so fuzzy search and the synonym analyzer work. The `.keyword` sub-field allows exact aggregations.
- The `text_fr_en` analyzer applies `lowercase + asciifolding + tech_synonyms + stop`. This means `"ingenieur"` matches `"ingénieur"` and `"engineer"`.
- `governorate`, `contract_type`, `work_mode` are `keyword` for exact filtering.

#### Candidates Index (`candidates`)

```json
{
  "settings": {
    "analysis": {
      "analyzer": {
        "text_fr_en": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": ["lowercase", "asciifolding"]
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "candidate_id":     { "type": "keyword" },
      "status":           { "type": "keyword" },
      "education":        { "type": "keyword" },
      "primary_lang":     { "type": "keyword" },
      "years_experience": { "type": "integer" },
      "location":  { "type": "text", "analyzer": "text_fr_en", "fields": { "keyword": { "type": "keyword" } } },
      "skills":    { "type": "text", "analyzer": "text_fr_en", "fields": { "keyword": { "type": "keyword" } } },
      "created_at": { "type": "date" },
      "updated_at": { "type": "date" }
    }
  }
}
```

Key design decisions:
- `education` is `keyword` — values are normalized to lowercase at indexation. Filtering uses a `term` query (exact, case-sensitive).
- `skills` and `location` are `text` with `lowercase + asciifolding` only — **no synonyms**. Synonym expansion on candidate skills would produce incorrect cross-domain matches.
- No `embedding` field — candidate search is filter-based only at MVP.

### 3.3 Verify Indices After Sync

```bash
# List indices and doc counts
curl http://localhost:9200/_cat/indices?v

# Check mapping is correct (status should be keyword, not text)
curl http://localhost:9200/offers/_mapping?pretty

# Inspect a sample offer document
curl http://localhost:9200/offers/_search?pretty&size=1

# Check sync checkpoint
curl http://localhost:9200/.sync_state/_source/checkpoint?pretty
```

---

## 4. Environment Configuration

```ini
# PostgreSQL (Docker, port 5433)
POSTGRES_DSN=postgresql://admin:change_me@localhost:5433/matching?client_encoding=utf8

# Elasticsearch
ES_URL=http://localhost:9200
ES_API_KEY=                          # Leave empty if ES has no auth
ES_INDEX_OFFERS=offers
ES_INDEX_CANDIDATES=candidates

# Embedding model (multilingual, 384 dims)
# Do NOT change after first sync — invalidates all stored embeddings
EMBEDDING_MODEL=paraphrase-multilingual-MiniLM-L12-v2
EMBEDDING_DIM=384

# Embedding timeout (seconds) — fallback to keyword-only if exceeded
EMBED_TIMEOUT_SECONDS=15.0

# Background sync
SYNC_INTERVAL_SECONDS=60
SYNC_BATCH_SIZE=500

# PostgreSQL connection pool
PG_POOL_MIN=2
PG_POOL_MAX=10

# Rate limiting (per IP, sliding window)
RATE_LIMIT_CALLS=60
RATE_LIMIT_PERIOD=60

# API authentication
API_KEY=changeme
```

> **Critical**: `EMBEDDING_MODEL` must stay the same across the lifetime of the index. Changing it requires deleting the `offers` index and running a full re-sync.

---

## 5. Running the Service

### Install dependencies

```bash
cd services/search-service
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### Start the server

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8020 --reload
```

On startup the service will:
1. Connect to Elasticsearch and create missing indices with their mappings
2. Initialize the PostgreSQL connection pool (min=2 connections)
3. Start APScheduler background job for incremental sync (every 60s)
4. Begin serving requests

### Verify it is running

```bash
curl -H "X-Api-Key: changeme" http://localhost:8020/health
```

### Run tests

```bash
pytest tests/ -v
```

Tests use mocked ES and mocked SentenceTransformer — no running services required.

### Swagger UI

Navigate to `http://localhost:8020/docs` → click **Authorize** → enter the API key.

---

## 6. Initial Data Sync

Before any search works, populate the Elasticsearch indices from PostgreSQL.

### Option A — Standalone script

```bash
cd services/search-service
python -m app.sync.indexer
```

### Option B — API endpoint (after service is running)

```bash
curl -X POST http://localhost:8020/admin/sync -H "X-Api-Key: changeme"
```

The full sync will:
1. Call `bootstrap_indices()` to ensure index mappings are correct
2. Fetch all `PUBLISHED` offers from `aneti.job_offer` + `aneti.job_offer_requirement`
3. Generate 384-dim embeddings per offer (batches of 500)
4. Bulk-index into the `offers` ES index
5. Fetch all `ACTIVE` candidates from `aneti.job_seeker` + related tables
6. Bulk-index into the `candidates` ES index
7. Save the sync timestamp to ES `.sync_state` index (persists across container restarts)

### What gets indexed per offer

| Field | Source |
|-------|--------|
| `offer_id`, `company_id`, `status` | `aneti.job_offer` |
| `title`, `description` | `aneti.job_offer` |
| `governorate`, `work_mode`, `salary_min`, `salary_max` | `aneti.job_offer` |
| `location` | Computed: `governorate + delegation` |
| `contract_type` | `aneti.job_offer` |
| `skills` | `aneti.job_offer_requirement` WHERE `criterion_type = 'SKILL'` |
| `occupations` | `aneti.job_offer_requirement` WHERE `criterion_type = 'OCCUPATION'` |
| `languages` | `aneti.job_offer_requirement` WHERE `criterion_type = 'LANGUAGE'` |
| `embedding` | Generated by `paraphrase-multilingual-MiniLM-L12-v2` |

Text embedded per offer:
```python
f"{title} {' '.join(occupations)} {' '.join(skills)} {description[:800]}"
```

### What gets indexed per candidate

| Field | Source |
|-------|--------|
| `candidate_id`, `status`, `primary_lang` | `aneti.job_seeker` |
| `location` | `aneti.job_seeker_contact` (governorate + delegation) |
| `years_experience` | Computed from `aneti.job_seeker_experience` (sum of months / 12) |
| `education` | `aneti.job_seeker_education.level_code` (most recent, stored lowercase) |
| `skills` | `aneti.job_seeker_skill.skill_label_raw` |

`education` is stored lowercase. To see valid values in your database:

```bash
docker exec matching-postgres psql -U admin -d matching -c \
  "SELECT DISTINCT level_code, COUNT(*) FROM aneti.job_seeker_education GROUP BY level_code ORDER BY COUNT(*) DESC;"
```

---

## 7. API Reference

### Authentication

All requests must include:
```
X-Api-Key: <your-api-key>
```

### Rate Limiting

60 requests per 60 seconds per IP. Exceeded requests return `HTTP 429`.

---

### POST /search/offers

Hybrid semantic + keyword search on job offers.

**Request:**
```json
{
  "query": "Développeur Python backend FastAPI",
  "size": 10,
  "from_": 0,
  "contract_type": "CDI",
  "work_mode": "REMOTE",
  "governorate": "Tunis",
  "salary_min": 1500,
  "salary_max": 4000
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `query` | string | Yes | — | Free text query (1–500 chars) |
| `size` | int | No | 20 | Number of results (1–100) |
| `from_` | int | No | 0 | Pagination offset |
| `contract_type` | string | No | null | Exact match: `CDI`, `CDD`, `STAGE`, `SIVP` |
| `work_mode` | string | No | null | Exact match: `REMOTE`, `HYBRID`, `ONSITE` |
| `governorate` | string | No | null | Fuzzy match on governorate field |
| `salary_min` | int | No | null | Minimum salary filter (DT) |
| `salary_max` | int | No | null | Maximum salary filter (DT) |

**Response:**
```json
{
  "total": 3,
  "results": [
    {
      "offer_id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Développeur Python — FastAPI & PostgreSQL",
      "description": "Nous recherchons un développeur Python...",
      "skills": ["Python", "FastAPI", "PostgreSQL"],
      "location": "Tunis, Lac 2",
      "contract_type": "CDI",
      "company_id": "abc123",
      "score": 94.2,
      "created_at": "2025-11-01T10:00:00"
    }
  ],
  "query": "Développeur Python backend FastAPI",
  "mode": "hybrid"
}
```

`score` is 0–100, normalized so the top result in the response is always 100.  
`mode` is `"hybrid"` or `"keyword_only"` (automatic fallback if embedding times out).

---

### POST /search/candidates

Filter-based candidate search.

**Request:**
```json
{
  "filters": {
    "query": "développeur python expérimenté",
    "skills": ["Python", "Docker"],
    "location": "Tunis",
    "years_experience": 3,
    "education": "master",
    "size": 20,
    "from_": 0
  }
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `query` | string | No | null | Free text on skills (fuzzy, OR) |
| `skills` | list[string] | No | null | At least 1 skill must match (fuzzy, OR) |
| `location` | string | No | null | Fuzzy match on location |
| `years_experience` | int | No | null | Minimum years (≥ N) |
| `education` | string | No | null | **Strict** — must match `level_code` exactly (lowercase) |
| `size` | int | No | 20 | Number of results |
| `from_` | int | No | 0 | Pagination offset |

> **`education` filter**: Uses a strict `term` query. Pass the exact lowercase `level_code` stored in the DB (e.g. `"master"`, not `"Master"` or `"MSc"`). Run the SQL above to see valid values.

**Response:**
```json
{
  "total": 5,
  "results": [
    {
      "candidate_id": "abc-123",
      "location": "Tunis, Lac 2",
      "education": "master",
      "years_experience": 5,
      "skills": ["Python", "Docker", "FastAPI"],
      "primary_lang": "fr",
      "created_at": "2025-01-10T08:00:00"
    }
  ],
  "filters_applied": {
    "skills": ["Python", "Docker"],
    "location": "Tunis",
    "years_experience": 3,
    "education": "master"
  }
}
```

---

### GET /offers/{offer_id}

Full offer detail from PostgreSQL (not Elasticsearch).  
Returns `404` if not found, `503` if PostgreSQL is unavailable.

---

### GET /health

```json
{"status": "ok", "service": "search-service"}
```

---

### POST /admin/sync

Triggers an immediate incremental sync.

```json
{"status": "done"}
```

Block from public access at the gateway level.

---

## 8. Offer Search — Complete Logic

### 8.1 Request Flow

```
POST /search/offers {query, filters...}
        │
        ▼
embed_text(query)  →  384-dim vector      [timeout: 15s → fallback keyword-only]
        │
        ▼
build_offers_search_query(text, vector, filters)
        │
        ▼
Elasticsearch: kNN (cosine ≥ 0.60) + BM25 combined
        │
        ▼
Score normalization: (hit_score / max_score) × 100
        │
        ▼
Return ranked OfferHit list (embedding field excluded)
```

### 8.2 Hybrid Query Structure

```json
{
  "size": 10,
  "from": 0,
  "min_score": 0.5,
  "knn": {
    "field": "embedding",
    "query_vector": [...],
    "k": 20,
    "num_candidates": 100,
    "similarity": 0.60,
    "boost": 4.0,
    "filter": {
      "bool": {
        "filter": [
          { "term": { "status": "PUBLISHED" } },
          { "exists": { "field": "skills" } },
          { "term": { "contract_type": "CDI" } }
        ]
      }
    }
  },
  "query": {
    "bool": {
      "filter": [
        { "term": { "status": "PUBLISHED" } },
        { "exists": { "field": "skills" } },
        { "term": { "contract_type": "CDI" } }
      ],
      "should": [{
        "multi_match": {
          "query": "Développeur Python FastAPI",
          "fields": ["title^2", "skills^1.5", "occupations^1.5", "description^1"],
          "type": "best_fields",
          "fuzziness": "AUTO",
          "prefix_length": 1,
          "max_expansions": 50,
          "minimum_should_match": "70%",
          "boost": 3.0
        }
      }]
    }
  },
  "_source": { "excludes": ["embedding"] }
}
```

### 8.3 Score Calibration

```
Final Score = (cosine_score × 4.0) + (BM25_score × 3.0)

vec_boost = 4.0  →  semantic contribution max = 4.0
kw_boost  = 3.0  →  keyword contribution max  ≈ 9.0 (BM25 range ~0–3)

Normalization (dynamic per response):
  score_percent = (hit_raw_score / max_raw_score_in_response) × 100
  → Top result is always 100%, others are relative to it.
```

Dynamic normalization avoids fixed-scale issues — if a query returns only weak matches, they still display a meaningful relative ranking rather than all clustering near 0.

### 8.4 Filters

All filters apply to **both** the kNN pre-filter and the BM25 bool filter:

| Filter param | ES clause | Behavior |
|---|---|---|
| Always | `term: {status: "PUBLISHED"}` | Hard AND |
| Always | `exists: {field: "skills"}` | Hard AND — excludes offers with no skills |
| `contract_type` | `term` | Hard AND exact match |
| `work_mode` | `term` | Hard AND exact match |
| `governorate` | `match` with `fuzziness: AUTO` | Hard AND fuzzy match |
| `salary_min/max` | `range ≥/≤` on `salary_min` field | Hard AND |

### 8.5 Synonym Support (Offers Only)

The `text_fr_en` analyzer on the `offers` index includes cross-language synonyms:

- `"ingénieur"` ↔ `"engineer"` ↔ `"ingenieur"`
- `"développeur"` ↔ `"developer"` ↔ `"developpeur"`
- `"analyste"` ↔ `"analyst"`
- `"comptable"` ↔ `"accountant"`

Searching `"developer"` matches offers with `"développeur"` in the title.  
Candidates index does **not** have synonyms — only `lowercase + asciifolding`.

### 8.6 Multilingual Support

`paraphrase-multilingual-MiniLM-L12-v2` operates in a shared embedding space for 50+ languages:

- Query `"Machine Learning Engineer"` matches `"Ingénieur en apprentissage automatique"` (cosine ~0.78)
- No translation layer needed
- Works for FR, EN, AR simultaneously

### 8.7 Fallback (Keyword-Only Mode)

If `embed_text()` times out (> 15s) or raises an exception, the service falls back automatically to BM25-only search and returns `"mode": "keyword_only"`. No service interruption.

---

## 9. Candidate Search — Complete Logic

### 9.1 Design Decision

Candidate search uses **structured filters only** (no semantic embeddings). Recruiters searching for candidates know exactly what they need — a 5-year Python developer in Tunis with a master's degree. This is a constraint satisfaction problem, not a semantic retrieval problem.

### 9.2 Query Structure

```json
{
  "size": 20,
  "from": 0,
  "query": {
    "bool": {
      "filter": [
        { "term": { "status": "ACTIVE" } },
        { "range": { "years_experience": { "gte": 3 } } },
        { "match": { "location": { "query": "Tunis", "fuzziness": "AUTO" } } },
        { "term": { "education": "master" } }
      ],
      "should": [
        { "match": { "skills": { "query": "Python", "fuzziness": "AUTO" } } },
        { "match": { "skills": { "query": "Docker", "fuzziness": "AUTO" } } }
      ],
      "minimum_should_match": 1
    }
  },
  "sort": [{ "_score": "desc" }, { "updated_at": "desc" }]
}
```

### 9.3 Filter Logic

| Parameter | Clause | Behavior |
|---|---|---|
| `status = ACTIVE` | `filter > term` | Hard AND — always applied |
| `years_experience` | `filter > range ≥ N` | Hard AND — minimum experience |
| `location` | `filter > match + fuzziness` | Hard AND — fuzzy location match |
| `education` | `filter > term` (lowercase) | **Hard AND strict** — exact `level_code` match |
| `skills` | `should > match` per skill | Soft OR — at least 1 skill must match (fuzzy) |
| `query` (free text) | `should > multi_match` on skills | Soft OR — combined with skill clauses |

**Why `education` is a hard filter**: Selecting "Master" must return only Master candidates. Before this fix, `education` was in `should`, causing it to be ignored when skills already satisfied `minimum_should_match`. It is now in `filter`.

**Why `skills` is in `should`**: Recruiters want to discover partially matching candidates. A candidate with Python but not Docker is still relevant — OR logic prevents zero-result searches.

### 9.4 Valid Education Values

Education is stored as lowercase `level_code`. Always query with lowercase values matching what exists in your DB:

```bash
docker exec matching-postgres psql -U admin -d matching -c \
  "SELECT DISTINCT level_code, COUNT(*) FROM aneti.job_seeker_education GROUP BY level_code;"
```

Build your frontend dropdown from these actual values, not from a hardcoded list.

---

## 10. Incremental Sync Pipeline

### 10.1 How It Works

APScheduler runs every 60 seconds:

```
APScheduler (every 60s)
        │
        ▼
_get_last_sync("offers")  →  reads from ES .sync_state index
        │
        ▼
fetch_offers(since=last_timestamp)  →  batches from PostgreSQL
        │
        ▼
_enrich_offers_with_embeddings()   →  embed_batch() → attach vectors
        │
        ▼
bulk_index(es_index_offers, batch) →  upsert into Elasticsearch
        │
        ▼
_set_last_sync("offers")  →  write new timestamp to ES .sync_state
```

Same flow for candidates (no embedding step).

### 10.2 Checkpoint Storage

The sync checkpoint is stored in Elasticsearch, not a local file:

```
Index:  .sync_state
Doc ID: checkpoint
{
  "offers":     "2026-04-30T10:15:42.123456+00:00",
  "candidates": "2026-04-30T10:15:43.456789+00:00"
}
```

Survives container restarts as long as ES data is on a persistent volume. If missing (first run or ES data wiped), the next sync performs a full sync automatically.

### 10.3 Upsert Behavior

Bulk indexing uses `offer_id` / `candidate_id` as the ES `_id`. Existing documents are overwritten — no duplicates. Incremental sync is safe to re-run.

---

## 11. Production Features

### 11.1 PostgreSQL Connection Pool (`app/pg_pool.py`)

`ThreadedConnectionPool` shared across all FastAPI workers. Connections are borrowed and returned via a context manager:

```python
with get_conn() as conn:
    with conn.cursor() as cur:
        cur.execute(query)
```

- Pool initialized lazily on first use, closed cleanly at shutdown
- Configuration: `PG_POOL_MIN=2`, `PG_POOL_MAX=10`

### 11.2 Embedding Timeout (`app/embeddings.py`)

`embed_text()` runs SentenceTransformer inference in a `ThreadPoolExecutor`. If it takes longer than `EMBED_TIMEOUT_SECONDS` (default 15s), it raises `RuntimeError` which triggers keyword-only fallback in the router. Prevents slow CPU inference from blocking workers indefinitely.

### 11.3 Rate Limiting (`app/rate_limit.py`)

Sliding window counter per client IP, applied as a global FastAPI dependency:
- Default: 60 requests per 60 seconds
- Exceeded: `HTTP 429 Too Many Requests`
- In-memory (single instance) — replace with Redis-backed rate limiting for multi-instance deployments

### 11.4 Sync Checkpoint in ES

Checkpoint stored in `ES .sync_state` index instead of `sync_state.json`. Survives container restarts without filesystem mounts.


---

