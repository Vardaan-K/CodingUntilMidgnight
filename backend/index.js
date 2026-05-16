import "dotenv/config";
import express from "express";
import cors from "cors";
import { initDb, db } from "./src/db.js";
import { gather } from "./src/gather.js";
import { analyze } from "./src/analyze.js";

const app = express();
app.use(cors());
app.use(express.json());

await initDb();

app.get("/search", async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: "query param required" });

  try {
    const cached = db.getCache(query);
    if (cached) return res.json(cached);

    // Step 1: Gather sources (web search, future: deterministic scraping)
    const sources = await gather(query);

    // Step 2: Analyze gathered data with LLM
    const ai = await analyze(query, sources);

    // Blend with user reports
    const { pos, neg } = db.getReportCounts(query);
    const reportScore = pos + neg > 0 ? (pos / (pos + neg)) * 100 : ai.score;
    const score = Math.round(ai.score * 0.6 + reportScore * 0.4);
    const badge = score >= 80 ? "safe" : score >= 50 ? "caution" : "danger";

    const result = { id: query, name: ai.name || query, address: ai.address || "", score, badge, summary: ai.summary, signals: ai.signals, sources: ai.sources || sources.sources };
    db.setCache(query, result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/report", (req, res) => {
  const { placeId, type, comment } = req.body;
  if (!placeId || !["positive", "negative"].includes(type)) return res.status(400).json({ error: "placeId and type (positive|negative) required" });
  db.addReport(placeId, type, comment || "");
  db.clearCache(placeId);
  res.json({ success: true });
});

app.get("/reports/:placeId", (req, res) => {
  res.json(db.getReports(req.params.placeId));
});

app.listen(process.env.PORT || 3001, () => console.log("API running on :3001"));
