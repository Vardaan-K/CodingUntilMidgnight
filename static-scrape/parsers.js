/**
 * Takes a single raw result from SerpAPI google_local local_results[]
 * and returns a clean object for the search dropdown.
 */
export function parseBusinessResult(raw) {
  return {
    place_id: raw.place_id ?? null,
    name:     raw.title    ?? null,
    address:  raw.address  ?? null,
    type:     raw.type     ?? null,
  };
}
