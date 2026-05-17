/**
 * Two-tier cache resolver.
 *
 *   (query, location)  ──▶  resolution_cache  ──▶  place_id
 *                                                     │
 *                                                     ▼
 *                                          cache / classified_cache
 *
 * `resolvePlaceId` returns a stable place_id for the same business
 * regardless of casing, whitespace, or extra address detail in the
 * user's input. The first call to a (query, location) pair pays one
 * Google Places `findplacefromtext` request (~$0.017); every subsequent
 * call is a sub-millisecond SQLite hit.
 *
 * If Places returns no match we cache that null result too (as ""),
 * so we don't repeatedly burn a Places call on the same dead query.
 *
 * If the Places key is missing or the API errors, we DON'T cache —
 * the caller falls back to a string key for that one request and we
 * try again next time.
 */
import { findPlaceId } from "./scrapers/googleReviews.js";
import { db } from "./db.js";

function normalize(s) {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * @param {string} query     business name or free-text query
 * @param {string} [location] city / state / zip
 * @returns {Promise<string|null>}  place_id, or null if unresolvable
 */
export async function resolvePlaceId(query, location = "") {
  const qn = normalize(query);
  const ln = normalize(location);
  if (!qn) return null;

  const cached = db.getResolution(qn, ln);
  if (cached !== undefined) {
    // "" means "tried, no match" — return null without re-calling Places.
    return cached || null;
  }

  let placeId = null;
  try {
    placeId = await findPlaceId(query, location);
  } catch (err) {
    // No key configured / network / quota — don't cache, let next call retry.
    console.warn(`[resolve] ${err.message} (query="${query}", location="${location}")`);
    return null;
  }

  db.setResolution(qn, ln, placeId);
  return placeId;
}

/**
 * Build a stable cache key for the analysis result tables.
 * Prefers place_id; falls back to a namespaced string so we never
 * collide with real place_ids (which never start with "str:").
 */
export function buildCacheKey(placeId, query, location) {
  if (placeId) return placeId;
  const tail = location ? `${query}|${location}` : query;
  return `str:${tail}`;
}
