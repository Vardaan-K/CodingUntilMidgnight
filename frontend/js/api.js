const BASE = "http://localhost:3001";

async function req(url, options) {
  const r = await fetch(url, options);
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(body || `HTTP ${r.status}`);
  }
  return r.json();
}

/** GET /locations?q=... → [{ name, canonical_name, type, gps }] */
export function fetchLocations(q) {
  return req(`${BASE}/locations?q=${encodeURIComponent(q)}`);
}

/** GET /businesses?name=...&lat=...&lng=... → [{ place_id, name, address, type, gps }] */
export function fetchBusinesses(name, lat, lng) {
  const p = new URLSearchParams({ name, lat, lng });
  return req(`${BASE}/businesses?${p}`);
}

/**
 * GET /search?query=...&location=... → full assessment result
 * Returns: { id, place_id, name, address, scores, final, sources }
 * scores.identity / .operations / .safety each have { score, summary, signals[] }
 */
export function fetchSearch(query, location) {
  const p = new URLSearchParams({ query });
  if (location) p.set("location", location);
  return req(`${BASE}/search?${p}`);
}

/** POST /report */
export function postReport(placeId, type, comment) {
  return req(`${BASE}/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ placeId, type, comment }),
  });
}

/** GET /reports/:placeId */
export function fetchReports(placeId) {
  return req(`${BASE}/reports/${encodeURIComponent(placeId)}`);
}
