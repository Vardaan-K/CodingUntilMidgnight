# SerpAPI Client

A JavaScript client for searching businesses and fetching a balanced mix of reviews from Google, Yelp, and TripAdvisor via SerpAPI.

---

## Setup

Add your SerpAPI key to `.env`:
```
SERPAPI_KEY=your_key_here
```

---

## Files

```
staticScraperMain.js  — three exported functions (see below)
api.js                — low-level fetch helper, handles API key + errors
parsers.js            — shapes raw SerpAPI responses into clean objects
test.js               — test file, edit values at the top to try different businesses
```

---

## Functions

### `searchLocations(query)`

Searches for locations by name. Returns a list for a location dropdown.
The chosen result gets passed into `searchBusiness()`.

```js
const locations = await searchLocations("San Luis Obispo");
// returns: [{ canonical_name, name, type, gps: { lat, lng } }, ...]
```

---

### `searchBusiness(name, location)`

Searches for businesses by name near a location.
Returns a list for a business search dropdown.
Pass the chosen result into `getReviews()`.

```js
const businesses = await searchBusiness("Starbucks", locations[0]);
// returns: [{ place_id, name, address, type, gps }, ...]
```

---

### `getReviews(business)`

Fetches a balanced mix of reviews from Google, Yelp, and TripAdvisor.
Makes **11 API calls** in two parallel waves — 2 to find Yelp/TripAdvisor IDs, then 9 review calls all at once.

```js
const reviews = await getReviews(businesses[0]);
```

**Return shape:**
```js
{
  google_reviews: {
    newest:   [...],  // 8 reviews
    positive: [...],  // 8 reviews, highest rated
    critical: [...],  // 8 reviews, lowest rated
  },
  yelp_reviews: {
    newest:   [...],  // 49 reviews
    positive: [...],  // 49 reviews, highest rated
    critical: [...],  // 49 reviews, lowest rated
  },
  tripadvisor_reviews: {
    newest:   [...],  // 16 reviews
    positive: [...],  // 16 reviews, rating 4-5
    critical: [...],  // 16 reviews, rating 1-2
  },
  llm_format: "..."   // all reviews combined as plain text, ready to send to an LLM
}
```
