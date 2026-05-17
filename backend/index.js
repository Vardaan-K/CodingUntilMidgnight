import "dotenv/config";
import express from "express";
import cors from "cors";
import { initDb, db } from "./src/db.js";
import { gather } from "./src/gather.js";
import { classify } from "./src/classify.js";
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

    // Step 1 & 2: Check classified cache or gather + classify
    let classified = db.getClassified(query);
    if (!classified) {
      const gathered = await gather(query);
      classified = await classify(gathered);
      db.setClassified(query, classified);
    }

    // Step 3: Analyze classified data with LLM
    const ai = await analyze(query, classified);

    const result = {
      id: query,
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
