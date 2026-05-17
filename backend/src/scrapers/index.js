/**
 * Scraper aggregator — runs all deterministic scrapers in parallel and
 * also exposes a helper to fold their structured output into the
 * text+sources shape the LLM gather/classify pipeline expects.
 */
import { searchGoogleNews } from "./googleNews.js";
import { getGoogleReviewsData } from "./googleReviews.js";
import { getTripadvisorData } from "./tripadvisor.js";
import { getSerpApiReviewsData } from "./serpapi.js";

/**
 * Run all scrapers concurrently for a business.
 * Each returns its own `{source, ...}` object — never throws.
 *
 * @param {string} businessName
 * @param {string} [location]
 * @returns {Promise<{business_name:string, location:string, timestamp:string,
 *                    google_news:object, google_reviews:object, tripadvisor:object,
 *                    serpapi:object}>}
 */
export async function aggregateBusinessData(businessName, location = "") {
  const tasks = {
    google_news: searchGoogleNews(businessName, location).catch((e) => ({
      source: "google_news",
      error: e.message,
      articles: [],
    })),
    google_reviews: getGoogleReviewsData(businessName, location).catch((e) => ({
      source: "google_reviews",
      error: e.message,
      reviews: [],
    })),
    tripadvisor: getTripadvisorData(businessName, location).catch((e) => ({
      source: "tripadvisor",
      error: e.message,
      reviews: [],
    })),
    serpapi: getSerpApiReviewsData(businessName, location).catch((e) => ({
      source: "serpapi",
      error: e.message,
      google_reviews: { newest: [], positive: [], critical: [] },
      yelp_reviews: { newest: [], positive: [], critical: [] },
      tripadvisor_reviews: { newest: [], positive: [], critical: [] },
    })),
  };

  const entries = await Promise.all(
    Object.entries(tasks).map(async ([k, p]) => [k, await p])
  );

  return {
    business_name: businessName,
    location,
    timestamp: new Date().toISOString(),
    ...Object.fromEntries(entries),
  };
}

const truncate = (s, n = 600) => {
  if (!s) return "";
  const clean = String(s).replace(/\s+/g, " ").trim();
  return clean.length > n ? clean.slice(0, n) + "…" : clean;
};

function googleNewsToBlock(data) {
  if (!data || data.error || !data.articles?.length) return null;
  const lines = [`Google News results for "${data.query ?? data.business_name}":`];
  const sources = [];
  for (const a of data.articles) {
    const title = truncate(a.title, 200);
    const desc = truncate(a.description, 400);
    const date = a.published_at ? ` (${a.published_at.slice(0, 10)})` : "";
    const src = a.source ? ` — ${a.source}` : "";
    lines.push(`• ${title}${date}${src}`);
    if (desc && desc !== title) lines.push(`  ${desc}`);
    if (a.url) {
      lines.push(`  ${a.url}`);
      sources.push({ url: a.url, title: title || a.source || "Google News article" });
    }
  }
  return { text: lines.join("\n"), sources };
}

function googleReviewsToBlock(data) {
  if (!data || data.error) return null;
  const lines = [
    `Google Places listing for "${data.name ?? data.business_name}":`,
    `Address: ${data.address ?? "n/a"}`,
    `Overall rating: ${data.rating ?? "n/a"}/5 from ${data.total_reviews ?? "?"} reviews`,
    `Status: ${data.status ?? "n/a"}${data.price ? ` | Price: ${data.price}` : ""}`,
  ];
  const sources = [];
  if (data.website) {
    lines.push(`Website: ${data.website}`);
    sources.push({ url: data.website, title: `${data.name ?? "Business"} website` });
  }
  if (data.reviews?.length) {
    lines.push("", "Recent Google reviews:");
    for (const r of data.reviews) {
      const stars = r.rating != null ? `${r.rating}★` : "?★";
      const when = r.relative_time ? ` (${r.relative_time})` : "";
      const author = r.author ? ` — ${r.author}` : "";
      lines.push(`• [${stars}${author}${when}] ${truncate(r.text, 600)}`);
    }
  }
  // Synthetic source URL anchored to the place_id for traceability.
  if (data.place_id) {
    const url = `https://www.google.com/maps/place/?q=place_id:${data.place_id}`;
    sources.push({ url, title: `${data.name ?? data.business_name} on Google Maps` });
  }
  return { text: lines.join("\n"), sources };
}

function tripadvisorToBlock(data) {
  if (!data || data.error) return null;
  const info = data.business_info ?? {};
  const lines = [
    `TripAdvisor listing for "${data.business_name}":`,
    `Rating: ${data.rating ?? "n/a"}/5 from ${data.total_reviews ?? "?"} reviews`,
  ];
  if (info.address) lines.push(`Address: ${info.address}`);
  if (info.categories?.length) lines.push(`Categories: ${info.categories.join(", ")}`);
  if (info.price_level) lines.push(`Price level: ${info.price_level}`);
  if (info.description) lines.push(`About: ${truncate(info.description, 500)}`);

  const sources = [];
  if (info.url) sources.push({ url: info.url, title: `${data.business_name} on TripAdvisor` });
  if (info.website) sources.push({ url: info.website, title: `${data.business_name} website` });

  if (data.reviews?.length) {
    lines.push("", "Recent TripAdvisor reviews:");
    for (const r of data.reviews) {
      const stars = r.rating != null ? `${r.rating}★` : "?★";
      const author = r.author ? ` — ${r.author}` : "";
      const date = r.date ? ` (${r.date})` : "";
      const title = r.title ? `${r.title}: ` : "";
      lines.push(`• [${stars}${author}${date}] ${title}${truncate(r.text, 500)}`);
      if (r.url) sources.push({ url: r.url, title: r.title || "TripAdvisor review" });
    }
  }
  return { text: lines.join("\n"), sources };
}

/**
 * Convert aggregated scraper output to the same `{text, sources}` shape that
 * `gather.js` produces from web search results, so it can be folded in
 * before classify/analyze.
 *
 * @param {object} aggregate Output of {@link aggregateBusinessData}.
 * @returns {Array<{label:string, text:string, sources:Array<{url:string, title:string}>}>}
 */
export function aggregateToBlocks(aggregate) {
  const blocks = [];
  const tryAdd = (label, fn, data) => {
    const b = fn(data);
    if (b && b.text) blocks.push({ label, text: b.text, sources: b.sources });
  };
  tryAdd("Google News", googleNewsToBlock, aggregate.google_news);
  tryAdd("Google Reviews", googleReviewsToBlock, aggregate.google_reviews);
  tryAdd("TripAdvisor", tripadvisorToBlock, aggregate.tripadvisor);
  tryAdd("SerpAPI Reviews", serpapiToBlock, aggregate.serpapi);
  return blocks;
}

function serpapiToBlock(data) {
  if (!data || data.error || !data.llm_format) return null;
  const header = [
    `SerpAPI multi-source reviews for "${data.business_name}":`,
    data.address ? `Address: ${data.address}` : null,
    data.place_id ? `Google place_id: ${data.place_id}` : null,
  ].filter(Boolean);

  const sources = [];
  if (data.place_id) {
    sources.push({
      url: `https://www.google.com/maps/place/?q=place_id:${data.place_id}`,
      title: `${data.business_name} on Google Maps`,
    });
  }

  return { text: [...header, "", data.llm_format].join("\n"), sources };
}
