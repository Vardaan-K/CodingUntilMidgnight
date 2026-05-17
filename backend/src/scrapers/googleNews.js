/**
 * Google News scraper — fetches recent articles mentioning a business.
 * Uses Google News RSS (free, no API key).
 */
import { XMLParser } from "fast-xml-parser";

const RSS_URL = "https://news.google.com/rss/search";
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

function parsePubDate(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? raw : d.toISOString();
}

/**
 * Search Google News RSS for articles mentioning the business.
 * @param {string} businessName
 * @param {string} [location]
 * @param {number} [maxResults=20]
 * @returns {Promise<{source:"google_news", business_name:string, query:string, total_results:number, articles:object[], error?:string}>}
 */
export async function searchGoogleNews(businessName, location = "", maxResults = 20) {
  const query = location ? `"${businessName}" ${location}` : `"${businessName}"`;
  const url = `${RSS_URL}?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;

  try {
    const ctrl = AbortSignal.timeout(15_000);
    const resp = await fetch(url, { headers: HEADERS, signal: ctrl });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const xml = await resp.text();
    const doc = parser.parse(xml);
    const items = doc?.rss?.channel?.item ?? [];
    const list = Array.isArray(items) ? items : [items];

    const articles = list.slice(0, maxResults).map((it) => ({
      title: typeof it.title === "string" ? it.title : it.title?.["#text"] ?? null,
      description:
        typeof it.description === "string"
          ? it.description
          : it.description?.["#text"] ?? null,
      source: typeof it.source === "string" ? it.source : it.source?.["#text"] ?? null,
      url: it.link ?? null,
      published_at: parsePubDate(it.pubDate),
    }));

    return {
      source: "google_news",
      business_name: businessName,
      query,
      total_results: articles.length,
      articles,
    };
  } catch (err) {
    return {
      source: "google_news",
      business_name: businessName,
      query,
      error: err.message,
      articles: [],
    };
  }
}
