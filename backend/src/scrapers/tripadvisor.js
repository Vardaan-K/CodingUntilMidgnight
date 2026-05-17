/**
 * TripAdvisor Content API client — business search + reviews.
 *
 * Set env var: TRIPADVISOR_API_KEY=your_key_here
 * Get a key at https://www.tripadvisor.com/developers
 */
const BASE_URL = "https://api.content.tripadvisor.com/api/v1";
const REVIEW_PAGE_SIZE = 5; // Content API returns up to 5 reviews per request

function apiKey() {
  const k = process.env.TRIPADVISOR_API_KEY;
  if (!k) throw new Error("TRIPADVISOR_API_KEY not set");
  return k;
}

async function getJson(url, timeoutMs = 10_000) {
  const resp = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

async function searchLocations(name, location) {
  const query = location ? `${name} ${location}` : name;
  const params = new URLSearchParams({
    key: apiKey(),
    searchQuery: query,
    language: "en",
  });
  const data = await getJson(`${BASE_URL}/location/search?${params}`);
  return data.data ?? [];
}

/**
 * Lightweight similarity ratio (0..1) — Dice's coefficient over character bigrams.
 * Approximates Python's difflib.SequenceMatcher closely enough for matching business names.
 */
function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const grams = (s) => {
    const out = new Map();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      out.set(g, (out.get(g) ?? 0) + 1);
    }
    return out;
  };
  const ag = grams(a);
  const bg = grams(b);
  let intersect = 0;
  for (const [g, count] of ag) {
    const other = bg.get(g);
    if (other) intersect += Math.min(count, other);
  }
  const total =
    [...ag.values()].reduce((s, n) => s + n, 0) +
    [...bg.values()].reduce((s, n) => s + n, 0);
  return total === 0 ? 0 : (2 * intersect) / total;
}

function bestMatch(candidates, query) {
  if (!candidates.length) return null;
  const q = query.toLowerCase();

  const scored = candidates.map((loc) => {
    const name = (loc.name || "").toLowerCase();
    let s = similarity(q, name);
    if (name && (name.includes(q) || q.includes(name))) s = Math.max(s, 0.6);
    return { loc, s };
  });

  scored.sort((a, b) => b.s - a.s);
  return scored[0].s >= 0.4 ? scored[0].loc : null;
}

async function fetchDetails(locationId) {
  const params = new URLSearchParams({ key: apiKey(), language: "en" });
  return getJson(`${BASE_URL}/location/${locationId}/details?${params}`);
}

async function fetchReviews(locationId, maxReviews = 20) {
  const reviews = [];
  let offset = 0;
  while (reviews.length < maxReviews) {
    const params = new URLSearchParams({
      key: apiKey(),
      language: "en",
      offset: String(offset),
    });
    const data = await getJson(`${BASE_URL}/location/${locationId}/reviews?${params}`);
    const page = data.data ?? [];
    if (!page.length) break;
    reviews.push(...page);
    offset += page.length;
    if (page.length < REVIEW_PAGE_SIZE) break;
  }
  return reviews.slice(0, maxReviews);
}

/**
 * Search TripAdvisor and return business info + up to 20 reviews.
 * @param {string} businessName
 * @param {string} [location]
 * @returns {Promise<object>}
 */
export async function getTripadvisorData(businessName, location = "") {
  let candidates;
  try {
    candidates = await searchLocations(businessName, location);
  } catch (err) {
    return { source: "tripadvisor", business_name: businessName, error: `search failed: ${err.message}`, reviews: [] };
  }

  const loc = bestMatch(candidates, businessName);
  if (!loc) {
    return {
      source: "tripadvisor",
      business_name: businessName,
      error: `no close TripAdvisor match for "${businessName}"`,
      reviews: [],
    };
  }

  let details;
  try {
    details = await fetchDetails(loc.location_id);
  } catch (err) {
    return { source: "tripadvisor", business_name: businessName, error: `details fetch failed: ${err.message}`, reviews: [] };
  }

  let rawReviews = [];
  let reviewError = null;
  try {
    rawReviews = await fetchReviews(loc.location_id, 20);
  } catch (err) {
    reviewError = err.message;
  }

  const reviews = rawReviews.map((r) => ({
    text: r.text ?? null,
    title: r.title ?? null,
    rating: r.rating ?? null,
    date: r.published_date ?? null,
    author: r.user?.username ?? null,
    trip_type: r.trip_type ?? null,
    url: r.url ?? null,
  }));

  const ratingRaw = details.rating;
  const rating = ratingRaw == null ? null : Number.isNaN(parseFloat(ratingRaw)) ? ratingRaw : parseFloat(ratingRaw);

  const result = {
    source: "tripadvisor",
    business_name: details.name ?? businessName,
    location_id: loc.location_id,
    rating,
    total_reviews: details.num_reviews ?? null,
    reviews,
    business_info: {
      phone: details.phone ?? null,
      address: details.address_obj?.address_string ?? null,
      url: details.web_url ?? null,
      website: details.website ?? null,
      categories: details.category?.name ? [details.category.name] : [],
      price_level: details.price_level ?? null,
      description: details.description ?? null,
    },
  };
  if (reviewError) result.review_error = reviewError;
  return result;
}
