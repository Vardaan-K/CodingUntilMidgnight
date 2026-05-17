import "dotenv/config";

const BASE_URL = "https://serpapi.com/search.json";
const LOCATIONS_URL = "https://serpapi.com/locations.json";

export async function _fetch(engine, params) {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) throw new Error("SERPAPI_KEY not set in .env");

  const url = new URL(BASE_URL);
  url.searchParams.set("engine", engine);
  url.searchParams.set("api_key", apiKey);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SerpAPI error: ${res.status} ${res.statusText} — ${body}`);
  }

  const data = await res.json();
  if (data.error) throw new Error(`SerpAPI: ${data.error}`);

  return data;
}

export async function _fetchLocations(query, limit = 5) {
  const url = new URL(LOCATIONS_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", limit);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`SerpAPI locations error: ${res.status} ${res.statusText}`);

  return res.json();
}
