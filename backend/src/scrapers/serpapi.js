/**
 * SerpAPI adapter — wraps the 3-step SerpAPI client (searchLocations →
 * searchBusiness → getReviews) into a single `(businessName, location)`
 * call so it can slot into the aggregator alongside the other scrapers.
 *
 * Returns a balanced mix of Google, Yelp, and TripAdvisor reviews
 * (newest / most positive / most critical) plus a pre-formatted
 * `llm_format` string ready for classify().
 *
 * Set env var: SERPAPI_KEY=your_key_here
 * Get a key at https://serpapi.com/
 *
 * Cost note: a successful call burns ~13 SerpAPI requests (1 free
 * locations lookup + 1 google_maps search + 11 review calls). The
 * upstream cache layer in resolve.js / db.js prevents repeats.
 */
import { searchLocations, searchBusiness, getReviews } from "./serpapi/client.js";

function errorResult(businessName, message) {
  return {
    source: "serpapi",
    business_name: businessName,
    error: message,
    google_reviews: { newest: [], positive: [], critical: [] },
    yelp_reviews: { newest: [], positive: [], critical: [] },
    tripadvisor_reviews: { newest: [], positive: [], critical: [] },
  };
}

/**
 * Fetch a balanced mix of reviews from Google, Yelp, and TripAdvisor
 * via SerpAPI. Never throws — errors are returned in the `error` field.
 *
 * @param {string} businessName
 * @param {string} [location]    City / state / zip (required for accurate local results)
 * @returns {Promise<object>}
 */
export async function getSerpApiReviewsData(businessName, location = "") {
  if (!process.env.SERPAPI_KEY) {
    return errorResult(businessName, "SERPAPI_KEY not set");
  }
  if (!location) {
    return errorResult(businessName, "location required for SerpAPI scraper");
  }

  try {
    // 1. Resolve location → gps coords. This hits SerpAPI's free locations.json
    //    endpoint (no API key required, no quota cost).
    const locations = await searchLocations(location);
    const gps = locations[0]?.gps ?? null;
    if (!gps) {
      return errorResult(businessName, `Could not resolve location "${location}" via SerpAPI`);
    }

    // 2. Find businesses matching `name` near those coords (1 paid call).
    const candidates = await searchBusiness(businessName, { gps });
    const business = candidates[0];
    if (!business) {
      return errorResult(
        businessName,
        `No SerpAPI Google Maps result for "${businessName}" near "${location}"`
      );
    }

    // 3. Fetch all review buckets (11 paid calls, mostly in parallel).
    const reviews = await getReviews(business);

    return {
      source: "serpapi",
      business_name: business.name ?? businessName,
      place_id: business.place_id ?? null,
      address: business.address ?? null,
      type: business.type ?? null,
      gps: business.gps ?? null,
      google_reviews: reviews.google_reviews,
      yelp_reviews: reviews.yelp_reviews,
      tripadvisor_reviews: reviews.tripadvisor_reviews,
      llm_format: reviews.llm_format,
    };
  } catch (err) {
    return errorResult(businessName, err.message);
  }
}
