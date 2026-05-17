/**
 * Takes a single raw result from SerpAPI locations API
 * and returns a clean object for the location dropdown.
 */
export function parseLocationResult(raw) {
  return {
    canonical_name: raw.canonical_name ?? null,
    name:           raw.name           ?? null,
    type:           raw.target_type    ?? null,
    gps: raw.gps ? { lat: raw.gps[1], lng: raw.gps[0] } : null,
  };
}

/**
 * Takes the raw google_maps_reviews array and returns a single
 * plain text string formatted for LLM consumption.
 */
export function formatGoogleReviewsForLLM(reviews) {
  return reviews.map((r, i) => {
    const author = r.user?.name ?? "Anonymous";
    const rating = r.rating ? `${r.rating}/5` : "No rating";
    const date   = r.iso_date ? r.iso_date.split("T")[0] : "Unknown date";
    const text   = r.snippet ?? "No text";
    return `Review ${i + 1} — ${author} | ${rating} | ${date}\n${text}`;
  }).join("\n\n");
}

/**
 * Takes the raw yelp_reviews array and returns a single
 * plain text string formatted for LLM consumption.
 */
export function formatYelpReviewsForLLM(reviews) {
  return reviews.map((r, i) => {
    const author = r.user?.name ?? "Anonymous";
    const rating = r.rating ? `${r.rating}/5` : "No rating";
    const date   = r.date ?? "Unknown date";
    const text   = r.comment?.text ?? "No text";
    return `Review ${i + 1} — ${author} | ${rating} | ${date}\n${text}`;
  }).join("\n\n");
}

/**
 * Takes a single raw result from SerpAPI google_maps local_results[]
 * and returns a clean object for the business search dropdown.
 */
export function parseBusinessResult(raw) {
  return {
    place_id: raw.place_id                        ?? null,
    name:     raw.title                           ?? null,
    address:  raw.address                         ?? null,
    type:     raw.type                            ?? null,
    gps:      raw.gps_coordinates ? { lat: raw.gps_coordinates.latitude, lng: raw.gps_coordinates.longitude } : null,
  };
}

/**
 * Takes the raw tripadvisor_reviews array and returns a single
 * plain text string formatted for LLM consumption.
 */
export function formatTripAdvisorReviewsForLLM(reviews) {
  return reviews.map((r, i) => {
    const author = r.display_name ?? r.username ?? "Anonymous";
    const rating = r.rating ? `${r.rating}/5` : "No rating";
    const date   = r.date ?? "Unknown date";
    const text   = r.snippet ?? r.title ?? "No text";
    return `Review ${i + 1} — ${author} | ${rating} | ${date}\n${text}`;
  }).join("\n\n");
}
