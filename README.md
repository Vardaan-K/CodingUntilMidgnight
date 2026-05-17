# Whistleblower

A safe-space business assessment service. Given a business name and location,
it gathers reviews and news from multiple sources, classifies the findings
into **identity / operations / safety** signals, and produces an LLM-scored
report so users can decide whether a place is likely to be welcoming.

## How it works

```
GET /search?query=…&location=…
        │
        ▼
  resolve.js  ─── (query, location) → place_id (cached)
        │
        ▼
  gather.js   ─── runs in parallel:
        │           • 6 LLM web searches (employee reviews, Reddit, news, etc.)
        │           • 4 deterministic scrapers (see below)
        │         …merged into one text+sources payload.
        ▼
  classify.js ─── LLM tags each finding as identity / operations / safety
        │         with a sentiment, returns structured items.
        ▼
  analyze.js  ─── LLM scores each category, writes a final summary.
        │
        ▼
  cached → JSON response
```

Everything is keyed by Google `place_id` when one can be resolved, so
"Raku Ramen SLO" and "raku ramen, san luis obispo" share the same cache
entry and `POST /report` correctly invalidates it.

## Scrapers

Four sources run in parallel inside `aggregateBusinessData()`. Each one
catches its own errors and degrades to an `{error: …}` payload, so the
pipeline keeps working with whatever keys you provide.

| Scraper | Key required | What it adds |
|---|---|---|
| `googleNews.js`     | none (Google News RSS)        | Up to 20 recent news articles mentioning the business. |
| `googleReviews.js`  | `GOOGLE_PLACES_API_KEY`       | Rich Google business metadata (address, phone, website, hours, price level) + 5 reviews. Also provides `findPlaceId` for the cache resolver. |
| `tripadvisor.js`    | `TRIPADVISOR_API_KEY`         | Rich TripAdvisor business info (description, categories, price level) + up to 20 reviews. |
| `serpapi.js`        | `SERPAPI_KEY`                 | **Yelp coverage** + sorted review buckets (newest / most positive / most critical) for Google, Yelp, and TripAdvisor — many more reviews than the native APIs alone. |

The native `googleReviews` / `tripadvisor` scrapers and the SerpAPI scraper
overlap on review fetching but give complementary metadata, so they're left
running side-by-side. See [Cost note](#cost-note) below.

## Repository layout

```
backend/                       — Node/Express API
  index.js                     — HTTP routes (/search, /scrape, /report, /health)
  src/
    db.js, schema.sql          — SQLite (sql.js): cache, classified_cache,
                                 resolution_cache, reports
    resolve.js                 — query+location → place_id resolver (two-tier cache)
    gather.js                  — fan-out: LLM web searches + scrapers, merged for classify
    classify.js                — LLM tagging pass (identity / operations / safety)
    analyze.js                 — LLM scoring pass, returns final report
    scrapers/
      index.js                 — aggregator + LLM block formatters
      googleNews.js            — Google News RSS (free)
      googleReviews.js         — Google Places API
      tripadvisor.js           — TripAdvisor Content API
      serpapi.js               — SerpAPI adapter (entry point)
      serpapi/
        api.js                 — fetch helper
        parsers.js             — response → clean object
        client.js              — searchLocations / searchBusiness / getReviews
    prompts/                   — LLM system prompts
  scripts/
    test.sh                    — curl /search and pretty-print
    test-serpapi.js            — manual SerpAPI smoke test
    clear-cache.sh             — wipe DB + logs, kill running server
```

## Setup

```sh
cd backend
cp .env.example .env       # fill in keys (see below)
npm install
npm run dev                # node --watch index.js, listens on PORT (default 3001)
```

## Environment variables

| Var                      | Purpose                                              | Required?   |
|--------------------------|------------------------------------------------------|-------------|
| `OPENAI_API_KEY`         | classify + analyze + LLM web search in `gather`      | Yes         |
| `GOOGLE_PLACES_API_KEY`  | `place_id` resolution + Google reviews scraper       | Recommended |
| `SERPAPI_KEY`            | Google + Yelp + TripAdvisor reviews via SerpAPI      | Optional    |
| `TRIPADVISOR_API_KEY`    | TripAdvisor Content API scraper (rich metadata)      | Optional    |
| `PORT`                   | HTTP listen port (default `3001`)                    | Optional    |

Without `GOOGLE_PLACES_API_KEY`, `resolve.js` falls back to a string-based
cache key (`str:query|location`) — equivalent queries with different casing
or whitespace then become separate cache entries.

## Endpoints

| Method | Path                          | Description |
|--------|-------------------------------|-------------|
| GET    | `/health`                     | Liveness probe — `{ok:true}`. |
| GET    | `/search?query=…&location=…`  | Full pipeline (gather → classify → analyze), cached by `place_id`. |
| GET    | `/scrape?name=…&location=…`   | Raw aggregated scraper output, no LLM. Useful for debugging or for the frontend to render structured cards. |
| POST   | `/report`                     | Body `{placeId, type: "positive"\|"negative", comment?}`. Records a user signal and invalidates the cache for that `place_id`. |
| GET    | `/reports/:placeId`           | Up to 20 most recent reports for a business. |

### Example

```sh
# warm path: full pipeline (slow, hits LLMs and all scrapers on cache miss)
curl "http://localhost:3001/search?query=Raku+Ramen&location=San+Luis+Obispo" | jq

# raw scraper output, no LLM
curl "http://localhost:3001/scrape?name=Raku+Ramen&location=San+Luis+Obispo" | jq '.serpapi.business_name, .google_news.articles | length'

# convenience wrapper around /search
backend/scripts/test.sh "Raku Ramen San Luis Obispo"

# manual SerpAPI smoke test, bypasses Express
node backend/scripts/test-serpapi.js

# nuke the cache + logs
backend/scripts/clear-cache.sh
```

## Cost note

A cold `/search` call with all four keys set burns roughly:

- 6 OpenAI Responses-API calls with `web_search` (gather)
- ~3 OpenAI chat-completions calls (classify, concurrency-capped at 3)
- 1 OpenAI chat-completions call (analyze)
- 1 Google Places `findplacefromtext` (resolve, cached after first hit)
- 1 Google Places `details` (native Google Reviews scraper)
- 1–2 TripAdvisor Content-API calls (skipped on no-match)
- ~13 SerpAPI calls (1 Maps search + 11 review fetches; the locations
  endpoint is free)
- 1 Google News RSS fetch (free)

The two-tier cache (`resolution_cache` → `cache` / `classified_cache`) makes
repeats of the same business essentially free.

## Database

SQLite via `sql.js`, stored at `backend/safe_space.db`. Schema in
`backend/src/schema.sql`:

- `cache` — final analysis result, keyed by `place_id` (or `str:…` fallback).
- `classified_cache` — intermediate classified findings, same key namespace.
- `resolution_cache` — `(query_norm, location_norm) → place_id`, with `""`
  marking "tried, no match" so we don't re-call Places.
- `reports` — user-submitted positive/negative signals per `place_id`.

Wipe with `backend/scripts/clear-cache.sh`.
