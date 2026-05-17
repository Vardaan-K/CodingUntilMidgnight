# Whistleblower — Technical Breakdown

## Overview

Whistleblower is a business accountability scoring platform. A user searches for a business by name, the system aggregates public data from multiple sources, runs it through a three-stage LLM pipeline, and produces a 0–100 score across three categories: Identity, Operations, and Safety.

---

## Architecture

```
Frontend (static HTML/JS)
    ↓ HTTP (localhost:3001)
Backend (Node.js / Express)
    ├── LLM Pipeline (OpenAI)
    │     gather → classify → analyze
    ├── Scrapers (parallel)
    │     SerpAPI · Google News · Google Reviews · TripAdvisor
    └── Database (SQLite via sql.js)
          resolution_cache · classified_cache · cache · reports
```

---

## Frontend

### `frontend/search.html`
The landing and search page.

- **Location**: hardcoded to San Luis Obispo (`lat: 35.2827524, lng: -120.6596156`, canonical name `San Luis Obispo,California,United States`)
- **Autocomplete**: on 3+ characters typed, calls `GET /businesses` → renders live dropdown from SerpAPI
- **Navigation**: on business select, writes `{ query, location }` to `sessionStorage` under key `wb_pending`, then navigates to `business?query=NAME&location=CANONICAL`
- **Recently Scored grid**: on load, fetches `GET /admin/cache` and renders up to 6 real cached businesses; empty slots are invisible placeholders to preserve grid layout
- **Recent searches**: stored in `localStorage` under `wb_recent_searches`; grade/color written back by business page after result loads

### `frontend/business.html`
The result page for a single business.

- **Reads query**: first from URL params (`?query=&location=`), falls back to `sessionStorage.wb_pending` if serve stripped the query string on redirect
- **Loading state**: renders shimmer skeleton while pipeline runs
- **Calls**: `GET /search?query=NAME&location=CANONICAL` → full pipeline result
- **Renders**: score number, grade badge (A–F), final summary, three category columns (Identity / Operations / Safety), each with score bar and signal cards
- **Signal cards**: each card shows sentiment pill, subtag pill (lgbtq, wages, health, etc.), finding text, and source with brand color icon
- **Report form**: `POST /report` with positive/negative type and optional comment
- **Grade write-back**: after result loads, updates `localStorage.wb_recent_searches` entry with real grade and color

### `frontend/admin.html`
Internal cache management page. No auth.

- Fetches `GET /admin/cache` → table of all cached businesses with name, address, score, grade, cache key
- Per-row delete: `DELETE /admin/cache/:key`
- Clear all: `DELETE /admin/cache`
- View link navigates to `business?query=...` for each cached entry

### `frontend/js/api.js`
Fetch wrappers for all backend endpoints. Base URL hardcoded to `http://localhost:3001`.

| Function | Endpoint |
|---|---|
| `fetchLocations(q)` | `GET /locations?q=` |
| `fetchBusinesses(name, lat, lng)` | `GET /businesses?name=&lat=&lng=` |
| `fetchSearch(query, location)` | `GET /search?query=&location=` |
| `postReport(placeId, type, comment)` | `POST /report` |
| `fetchReports(placeId)` | `GET /reports/:placeId` |

### `frontend/js/render.js`
All DOM rendering logic. Imported as ES module by `business.html`.

- `scoreColor(score)` → CSS variable (green ≥80, amber ≥60, red <60)
- `scoreGrade(score)` → A/B/C/D/F
- `renderTagPill(subtag)` → colored pill with icon for all 18 subtags
- `sourceIconData(sourceName)` → brand color + SVG icon matched by keyword (Glassdoor, Google, Yelp, TripAdvisor, Reddit, Indeed, news keywords, gov keywords, globe fallback)
- `renderSignalCard(signal)` → full signal card HTML from `{ text, sentiment, subtag, source_name, source_url }`
- `renderCategoryColumn(key, cat)` → complete category column with score bar and all signal cards
- `renderResult(data)` → fills entire business page from `/search` response
- `renderLoading()` → shimmer skeleton

### `frontend/js/search.js`
Unused module stub (search logic was moved inline into `search.html` for simplicity).

### `frontend/js/report.js`
Report form submission handler with toast notification.

### `frontend/styles.css`
Full design system. CSS custom properties, typography (Instrument Serif, JetBrains Mono, Inter), signal cards, grade badges, score bars, tag pills, search dropdowns, shimmer animation, report form.

---

## Backend

Entry point: `backend/index.js` (Node.js ESM, Express)

### API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness check |
| `GET` | `/locations?q=` | Location autocomplete via SerpAPI |
| `GET` | `/businesses?name=&lat=&lng=` | Business search near coordinates via SerpAPI Google Maps |
| `GET` | `/search?query=&location=` | Full pipeline: gather → classify → analyze (cached) |
| `GET` | `/scrape?name=&location=` | Raw scraper output, bypasses LLM |
| `POST` | `/report` | Submit user signal `{ placeId, type, comment }` |
| `GET` | `/reports/:placeId` | Fetch submitted reports for a business |
| `GET` | `/admin/cache` | List all cached results |
| `DELETE` | `/admin/cache/:key` | Delete one cached result |
| `DELETE` | `/admin/cache` | Clear all cached results |

---

## LLM Pipeline

The core pipeline runs on `GET /search`. Three sequential stages, with two-tier caching.

```
/search request
    │
    ├─ resolvePlaceId(query, location)
    │     resolution_cache hit → return cached place_id
    │     miss → Google Places API → cache result
    │
    ├─ buildCacheKey(placeId, query, location)
    │     place_id if resolved, else "str:query|location"
    │
    ├─ db.getCache(key) → HIT → return immediately
    │
    ├─ db.getClassified(key) → HIT → skip gather+classify
    │
    ├── STAGE 1: gather(query, { location })
    │     6 parallel web searches (gpt-4.1 + web_search tool)
    │     + 4 parallel deterministic scrapers
    │     → { text, sources, scraper }
    │
    ├── STAGE 2: classify(gathered)
    │     Splits text on "--- Search N ---" delimiters → chunks
    │     Each chunk → gpt-4.1-nano → XML <items>
    │     Parses each <item>: content, tags[], sentiment, source
    │     Groups into byTag: { identity[], operations[], safety[] }
    │     → { items, sources, byTag }
    │     Stored in classified_cache
    │
    └── STAGE 3: analyze(query, classified)
          Formats classified findings as context string
          → gpt-5.4 → XML <assessment>
          Parses: name, address, identity{score,summary,signals[]},
                  operations{...}, safety{...}, final{score,summary}, sources[]
          Each signal: { text, sentiment, subtag, source_name, source_url }
          Result stored in cache
          → JSON response to frontend
```

---

## Stage 1: Gather (`src/gather.js`)

Runs 6 targeted web searches in parallel (max 3 concurrent) using `gpt-4.1` with the `web_search` tool:

| # | Search template | Category |
|---|---|---|
| 1 | `{query} employee reviews diversity inclusion` | Identity |
| 2 | `{query} Reddit community experience` | Identity |
| 3 | `{query} employee reviews Glassdoor Indeed` | Operations |
| 4 | `{query} working conditions management culture` | Operations |
| 5 | `{query} health inspection reviews` | Safety |
| 6 | `{query} customer experience incidents news` | Safety |

Simultaneously runs 4 deterministic scrapers and appends them as additional blocks.

Output written to `backend/logs/{slug}_{timestamp}.txt`.

---

## Stage 2: Classify (`src/classify.js`)

Model: `gpt-4.1-nano`

- Splits the gathered text into chunks by `--- Search N ---` delimiter
- Each chunk classified independently (max 3 concurrent)
- XML output: `<items><item><content>...<tag>...<sentiment>...<source>...`
- Tags: `identity`, `operations`, `safety` (multiple per item allowed)
- Sentiments: `positive`, `negative`, `neutral`
- Result grouped into `byTag.identity[]`, `byTag.operations[]`, `byTag.safety[]`

---

## Stage 3: Analyze (`src/analyze.js`)

Model: `gpt-5.4`

System prompt: `src/prompts/score-reviews.txt`

Scoring rules:
- Baseline: 95 (no evidence)
- Ranges: 95–100 exemplary, 80–94 neutral, 60–79 some concerns, 40–59 notable problems, 20–39 serious, 0–19 severe
- Final score = average of identity + operations + safety scores

XML output parsed into:
```
{
  name, address,
  identity:   { score, summary, signals: [{ text, sentiment, subtag, source_name, source_url }] },
  operations: { score, summary, signals: [...] },
  safety:     { score, summary, signals: [...] },
  final:      { score, summary },
  sources:    [{ url, title }]
}
```

Valid subtags:
- Identity: `lgbtq`, `race`, `gender`, `religion`, `disability`, `age`
- Operations: `wages`, `harassment`, `management`, `scheduling`, `hiring`
- Safety: `health`, `food_safety`, `environment`, `materials`, `osha`
- Positive: `recognition`, `improvement`

---

## Scrapers

All scrapers run in parallel inside `gather()`. Each is fault-isolated (catches its own errors).

### `src/scrapers/serpapi/` — Primary review scraper

- **`api.js`**: Base fetch wrapper for SerpAPI. Injects `api_key`, reads `SERPAPI_KEY` from env.
- **`parsers.js`**: Shapes raw SerpAPI responses into clean objects.
- **`client.js`**: Three exported functions:
  - `searchLocations(query)` → hits SerpAPI `/locations.json` (free, no key required) → location objects with `{ name, canonical_name, gps }`
  - `searchBusiness(name, location)` → `google_maps` engine with `ll=@lat,lng,14z` → business objects with `{ place_id, name, address, type, gps }`. Place ID is ChIJ format (required for reviews).
  - `getReviews(business)` → 11 parallel SerpAPI calls:
    - 2 calls: find Yelp place_id + TripAdvisor place_id
    - 3 calls: Google reviews (newest / highest rated / lowest rated)
    - 3 calls: Yelp reviews (newest / highest / lowest)
    - 3 calls: TripAdvisor reviews (newest / highest rated / lowest rated)
    - Returns `{ google_reviews, yelp_reviews, tripadvisor_reviews, llm_format }`

### `src/scrapers/serpapi.js` — Adapter

Wraps `client.js` into the scraper pipeline interface. Calls `searchLocations → searchBusiness → getReviews` and returns a normalized object.

### `src/scrapers/googleNews.js`
Fetches recent news articles mentioning the business.

### `src/scrapers/googleReviews.js`
Fetches Google Places data (rating, review count, recent reviews) and exposes `findPlaceId()` used by `resolve.js`.

### `src/scrapers/tripadvisor.js`
Fetches TripAdvisor business listing and reviews.

### `src/scrapers/index.js` — Aggregator

`aggregateBusinessData()` runs all four scrapers concurrently. `aggregateToBlocks()` converts each scraper's output into the `{ label, text, sources }` shape for the classify pipeline.

---

## Database (`src/db.js` + `src/schema.sql`)

SQLite via `sql.js` (pure JS, no native deps). Saved to `safe_space.db` on disk after every write.

### Tables

| Table | Key | Purpose |
|---|---|---|
| `resolution_cache` | `(query_norm, location_norm)` | Maps normalized query+location → place_id. Empty string = tried, no match. |
| `classified_cache` | `query` (cache key) | Stores classify() output. Skips gather+classify on repeat searches. |
| `cache` | `place_id` (cache key) | Stores final analyze() output. Returns immediately on hit. |
| `reports` | `id` (autoincrement) | User-submitted signals with `place_id`, `type`, `comment`, `created_at`. |

### Cache Key Logic (`src/resolve.js`)

1. Normalize query + location (lowercase, collapse whitespace)
2. Check `resolution_cache` → if found, use cached `place_id`
3. If miss → call Google Places `findplacefromtext` → cache result
4. `buildCacheKey`: use `place_id` if resolved, else `str:query|location` fallback

---

## Data Flow Summary

```
User types "Woodstock's Pizza" on search.html
    ↓
GET /businesses?name=Woodstock's+Pizza&lat=35.28&lng=-120.66
    → SerpAPI google_maps engine → returns business list
    ↓
User clicks result → sessionStorage.wb_pending = { query, location }
    → navigate to business?query=Woodstock's+Pizza&location=San+Luis+Obispo,...
    ↓
business.html loads → reads query from URL params (or sessionStorage fallback)
    ↓
GET /search?query=Woodstock's+Pizza&location=San+Luis+Obispo,...
    ↓
  resolvePlaceId → resolution_cache hit/miss → place_id
  buildCacheKey → "ChIJ..." or "str:..."
  db.getCache → HIT → return cached JSON immediately
               MISS ↓
  db.getClassified → HIT → skip to analyze
                    MISS ↓
  gather()
    ├─ 6 web searches (gpt-4.1 + web_search) [max 3 concurrent]
    └─ 4 scrapers in parallel (SerpAPI, Google News, Google Reviews, TripAdvisor)
    → combined text + sources
    ↓
  classify() [gpt-4.1-nano, max 3 concurrent chunks]
    → byTag: { identity[], operations[], safety[] }
    → stored in classified_cache
    ↓
  analyze() [gpt-5.4]
    → { identity, operations, safety, final, sources }
    → stored in cache
    ↓
JSON response → renderResult() fills business page
    ↓
updateRecentGrade() writes score back to localStorage
```

---

## Environment Variables

```
OPENAI_API_KEY      # Required. Used by gather (gpt-4.1), classify (gpt-4.1-nano), analyze (gpt-5.4)
SERPAPI_KEY         # Required. Used by all SerpAPI scraper calls
GOOGLE_PLACES_API_KEY  # Optional. Used by resolve.js for place_id resolution
TRIPADVISOR_API_KEY    # Optional. Used by tripadvisor.js scraper
PORT                   # Optional. Defaults to 3001
```

---

## Key Design Decisions

- **Two-tier cache**: classified findings cached separately from final analysis — lets you re-run scoring without re-gathering raw data
- **ChIJ place_id**: Google Maps engine returns the correct format for `google_maps_reviews`; `google_local` returns numeric CID which does not work
- **11 SerpAPI calls per business**: newest + positive + critical reviews from each of Google, Yelp, TripAdvisor gives balanced signal coverage
- **sessionStorage query passthrough**: `serve`'s clean-URL redirect strips query params from `.html` URLs, so query is written to sessionStorage before navigation as a fallback
- **sql.js**: SQLite with no native deps — works anywhere Node runs without compilation
- **Fault isolation**: every scraper wrapped in `.catch()` so one failure doesn't block the pipeline
