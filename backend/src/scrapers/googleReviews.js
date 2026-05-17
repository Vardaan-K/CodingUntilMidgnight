/**
 * Google Reviews scraper — fetches business details and reviews via Google Places API.
 * The free tier returns up to 5 reviews per business.
 *
 * Set env var: GOOGLE_PLACES_API_KEY=your_key_here
 * Get a key at https://console.cloud.google.com/
 */
const BASE_URL = "https://maps.googleapis.com/maps/api/place";
const PRICE_MAP = { 1: "$", 2: "$$", 3: "$$$", 4: "$$$$" };

function apiKey() {
  return process.env.GOOGLE_PLACES_API_KEY || "";
}

async function getJson(url, timeoutMs = 15_000) {
  const resp = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

async function findPlaceId(businessName, location) {
  if (!apiKey()) throw new Error("GOOGLE_PLACES_API_KEY not set");
  const params = new URLSearchParams({
    input: `${businessName} ${location}`.trim(),
    inputtype: "textquery",
    fields: "place_id,name",
    key: apiKey(),
  });
  const data = await getJson(`${BASE_URL}/findplacefromtext/json?${params}`);
  if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(`Google Places: ${data.status}`);
  }
  return data.candidates?.[0]?.place_id ?? null;
}

export { findPlaceId };

async function getPlaceDetails(placeId) {
  const params = new URLSearchParams({
    place_id: placeId,
    fields:
      "name,formatted_address,rating,user_ratings_total,reviews,website,formatted_phone_number,price_level,business_status",
    key: apiKey(),
  });
  const data = await getJson(`${BASE_URL}/details/json?${params}`);
  if (data.status && data.status !== "OK") {
    throw new Error(`Google Places: ${data.status}`);
  }
  return data.result ?? {};
}

/**
 * Search Google Places for a business and return its details + reviews.
 * @param {string} businessName
 * @param {string} [location]
 * @returns {Promise<object>}
 */
export async function getGoogleReviewsData(businessName, location = "") {
  if (!apiKey()) {
    return {
      source: "google_reviews",
      business_name: businessName,
      error: "GOOGLE_PLACES_API_KEY not set",
      reviews: [],
    };
  }

  try {
    const placeId = await findPlaceId(businessName, location);
    if (!placeId) {
      return {
        source: "google_reviews",
        business_name: businessName,
        error: "Business not found on Google Places",
        reviews: [],
      };
    }

    const details = await getPlaceDetails(placeId);
    const rawReviews = details.reviews ?? [];
    const reviews = rawReviews.map((r) => ({
      author: r.author_name ?? null,
      rating: r.rating ?? null,
      text: r.text ?? null,
      created_at: r.time ? new Date(r.time * 1000).toISOString() : null,
      relative_time: r.relative_time_description ?? null,
    }));

    return {
      source: "google_reviews",
      business_name: businessName,
      place_id: placeId,
      name: details.name ?? null,
      address: details.formatted_address ?? null,
      rating: details.rating ?? null,
      total_reviews: details.user_ratings_total ?? null,
      phone: details.formatted_phone_number ?? null,
      website: details.website ?? null,
      price: PRICE_MAP[details.price_level] ?? null,
      status: details.business_status ?? null,
      reviews_fetched: reviews.length,
      reviews,
    };
  } catch (err) {
    return {
      source: "google_reviews",
      business_name: businessName,
      error: err.message,
      reviews: [],
    };
  }
}
