import "dotenv/config";
import express from "express";
import cors from "cors";
import { initDb, db } from "./src/db.js";
import { gather } from "./src/gather.js";
import { classify } from "./src/classify.js";
import { analyze } from "./src/analyze.js";
import { aggregateBusinessData } from "./src/scrapers/index.js";
import { resolvePlaceId, buildCacheKey } from "./src/resolve.js";
import { searchLocations, searchBusiness } from "./src/scrapers/serpapi/client.js";

const app = express();
app.use(cors());
app.use(express.json());

await initDb();

// Health check — useful for the frontend / monitoring.
app.get("/health", (_req, res) => res.json({ ok: true }));

/**
 * Location autocomplete — returns place suggestions for a query string.
 *
 *   GET /locations?q=San+Luis
 */
app.get("/locations", async (req, res) => {
  const q = (req.query.q || "").toString().trim();
  if (!q) return res.json([]);

  try {
    const results = await searchLocations(q);
    res.json(results);
  } catch (err) {
    console.error("[/locations]", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Business search by name near a lat/lng coordinate.
 *
 *   GET /businesses?name=Raku+Ramen&lat=35.2828&lng=-120.6596
 */
app.get("/businesses", async (req, res) => {
  const name = (req.query.name || "").toString().trim();
  const lat  = parseFloat(req.query.lat);
  const lng  = parseFloat(req.query.lng);
  if (!name || isNaN(lat) || isNaN(lng)) return res.json([]);

  try {
    const results = await searchBusiness(name, { gps: { lat, lng } });
    res.json(results);
  } catch (err) {
    // SerpAPI returns "no results" as an error — treat it as an empty list
    if (err.message?.toLowerCase().includes("no results")) return res.json([]);
    console.error("[/businesses]", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Full pipeline: gather (web search + scrapers) → classify → analyze.
 *
 * Cache key is the Google Places place_id when we can resolve one
 * (so "Raku Ramen SLO" and "raku ramen, san luis obispo" share an
 * entry, and POST /report can correctly invalidate). Falls back to
 * a "str:query|location" key when Places isn't configured or doesn't
 * match anything.
 */
app.get("/search", async (req, res) => {
  const query = (req.query.query || "").toString().trim();
  const location = (req.query.location || "").toString().trim();
  if (!query) return res.status(400).json({ error: "query param required" });

  const placeId = await resolvePlaceId(query, location);
  const cacheKey = buildCacheKey(placeId, query, location);

  try {
    const cached = db.getCache(cacheKey);
    if (cached) return res.json(cached);

    let classified = db.getClassified(cacheKey);
    if (!classified) {
      const gathered = await gather(query, { location });
      classified = await classify(gathered);
      db.setClassified(cacheKey, classified);
    }

    const ai = await analyze(query, classified);

    const result = {
      id: cacheKey,
      place_id: placeId,
      query,
      location: location || null,
      name: ai.name,
      address: ai.address,
      scores: {
        identity: ai.identity,
        operations: ai.operations,
        safety: ai.safety,
      },
      final: ai.final,
      sources: ai.sources,
    };

    db.setCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error("[/search]", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Raw deterministic scraper output for a business — bypasses the LLM pipeline.
 * Useful for the frontend to render structured review/news cards directly.
 *
 *   GET /scrape?name=Raku+Ramen&location=San+Luis+Obispo
 */
app.get("/scrape", async (req, res) => {
  const name = (req.query.name || req.query.query || "").toString().trim();
  const location = (req.query.location || "").toString().trim();
  if (!name) return res.status(400).json({ error: "name (or query) param required" });

  try {
    const data = await aggregateBusinessData(name, location);
    res.json(data);
  } catch (err) {
    console.error("[/scrape]", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Admin endpoints ───────────────────────────────────────────────────────────

app.get("/admin/cache", (_req, res) => {
  res.json(db.listCache());
});

app.delete("/admin/cache/:key", (req, res) => {
  db.clearCache(decodeURIComponent(req.params.key));
  res.json({ success: true });
});

app.delete("/admin/cache", (_req, res) => {
  db.clearAllCache();
  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────

app.post("/report", (req, res) => {
  const { placeId, type, comment } = req.body;
  if (!placeId || !["positive", "negative"].includes(type)) {
    return res.status(400).json({ error: "placeId and type (positive|negative) required" });
  }
  db.addReport(placeId, type, comment || "");
  db.clearCache(placeId);
  res.json({ success: true });
});

app.get("/reports/:placeId", (req, res) => {
  res.json(db.getReports(req.params.placeId));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API running on :${PORT}`));
