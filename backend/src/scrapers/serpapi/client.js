import { _fetch, _fetchLocations } from "./api.js";
import { parseBusinessResult, parseLocationResult, formatGoogleReviewsForLLM, formatYelpReviewsForLLM, formatTripAdvisorReviewsForLLM } from "./parsers.js";

/**
 * Search for locations by name, returns a list for a location dropdown.
 * Pass the chosen location object into searchBusiness().
 *
 * @param {string} query - Partial or full location name e.g. "San Luis"
 * @returns {Promise<Array>} - List of matching locations
 */
export async function searchLocations(query) {
  const data = await _fetchLocations(query);
  return data.map(parseLocationResult);
}

/**
 * Search for businesses by name near a location.
 * Pass a location object from searchLocations() as the second argument.
 * Returns a list of results for a search dropdown.
 *
 * @param {string} name         - Business name e.g. "Starbucks"
 * @param {object} location     - Location object from searchLocations()
 * @returns {Promise<Array>}    - List of matching businesses
 */
export async function searchBusiness(name, location) {
  const { lat, lng } = location.gps;
  const data = await _fetch("google_maps", {
    q: name,
    ll: `@${lat},${lng},14z`,
    type: "search",
    hl: "en",
  });

  const results = data.local_results ?? [];
  return results.map(parseBusinessResult);
}

// --- Private helpers ---

async function _googleReviews(placeId, sortBy) {
  const data = await _fetch("google_maps_reviews", { place_id: placeId, sort_by: sortBy, hl: "en" });
  return data.reviews ?? [];
}

async function _findYelpId(name, address) {
  const data = await _fetch("yelp", { find_desc: name, find_loc: address });
  return data.organic_results?.[0]?.place_ids?.[0] ?? null;
}

async function _yelpReviews(yelpId, sortby) {
  const data = await _fetch("yelp_reviews", { place_id: yelpId, sortby });
  return data.reviews ?? [];
}

async function _findTripAdvisorId(name, gps) {
  const data = await _fetch("tripadvisor", { q: name, lat: gps.lat, lon: gps.lng });
  return data.places?.[0]?.place_id ?? null;
}

async function _tripAdvisorReviews(taId, params) {
  const data = await _fetch("tripadvisor_reviews", { place_id: taId, limit: 16, ...params });
  return data.reviews ?? [];
}

/**
 * Fetch a balanced mix of reviews from Google, Yelp, and TripAdvisor.
 * Makes 11 total API calls: newest, positive, and critical reviews from each source.
 *
 * @param {object} business - Business object from searchBusiness()
 * @returns {Promise<object>}
 */
export async function getReviews(business) {
  // Step 1: find Yelp + TripAdvisor place_ids in parallel (2 calls)
  const [yelpId, taId] = await Promise.all([
    _findYelpId(business.name, business.address),
    _findTripAdvisorId(business.name, business.gps),
  ]);

  // Step 2: fire all 9 review calls in parallel
  const [
    gNewest, gPositive, gCritical,
    yNewest, yPositive, yCritical,
    taNewest, taPositive, taCritical,
  ] = await Promise.all([
    _googleReviews(business.place_id, "newestFirst"),
    _googleReviews(business.place_id, "ratingHigh"),
    _googleReviews(business.place_id, "ratingLow"),
    yelpId ? _yelpReviews(yelpId, "date_desc")   : [],
    yelpId ? _yelpReviews(yelpId, "rating_desc")  : [],
    yelpId ? _yelpReviews(yelpId, "rating_asc")   : [],
    taId   ? _tripAdvisorReviews(taId, { sort_by: "most_recent" })            : [],
    taId   ? _tripAdvisorReviews(taId, { sort_by: "most_recent", rating: "4,5" }) : [],
    taId   ? _tripAdvisorReviews(taId, { sort_by: "most_recent", rating: "1,2" }) : [],
  ]);

  const googleReviews      = { newest: gNewest, positive: gPositive, critical: gCritical };
  const yelpReviews        = { newest: yNewest, positive: yPositive, critical: yCritical };
  const tripAdvisorReviews = { newest: taNewest, positive: taPositive, critical: taCritical };

  const llm_format = [
    "=== Google Reviews - Newest ===",      formatGoogleReviewsForLLM(gNewest),
    "=== Google Reviews - Most Positive ===", formatGoogleReviewsForLLM(gPositive),
    "=== Google Reviews - Most Critical ===", formatGoogleReviewsForLLM(gCritical),
    "=== Yelp Reviews - Newest ===",        formatYelpReviewsForLLM(yNewest),
    "=== Yelp Reviews - Most Positive ===", formatYelpReviewsForLLM(yPositive),
    "=== Yelp Reviews - Most Critical ===", formatYelpReviewsForLLM(yCritical),
    "=== TripAdvisor Reviews - Newest ===",        formatTripAdvisorReviewsForLLM(taNewest),
    "=== TripAdvisor Reviews - Most Positive ===", formatTripAdvisorReviewsForLLM(taPositive),
    "=== TripAdvisor Reviews - Most Critical ===", formatTripAdvisorReviewsForLLM(taCritical),
  ].join("\n\n");

  return {
    google_reviews:      googleReviews,
    yelp_reviews:        yelpReviews,
    tripadvisor_reviews: tripAdvisorReviews,
    llm_format,
  };
}
