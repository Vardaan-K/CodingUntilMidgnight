import OpenAI from "openai";
import { readFileSync, writeFileSync, mkdirSync } from "fs";

let _client;
function client() {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

mkdirSync(new URL("../logs", import.meta.url), { recursive: true });

const GATHER_PROMPT = readFileSync(new URL("./prompts/gather.txt", import.meta.url), "utf-8");

// Searches organized by category — deterministic scrapers will plug in here
const SEARCHES = [
  // Discrimination
  q => `${q} employee reviews diversity inclusion`,
  q => `${q} Reddit community experience`,
  // Operations
  q => `${q} employee reviews Glassdoor Indeed`,
  q => `${q} working conditions management culture`,
  // Safety
  q => `${q} health inspection reviews`,
  q => `${q} customer experience incidents news`,
];

async function webSearch(searchQuery) {
  const response = await client().responses.create({
    model: "gpt-4.1",
    tools: [{ type: "web_search" }],
    input: [
      { role: "system", content: GATHER_PROMPT },
      { role: "user", content: searchQuery }
    ]
  });

  const sources = [];
  let text = "";
  for (const output of response.output) {
    if (output.type === "message") {
      for (const block of output.content || []) {
        if (block.type === "output_text") text += block.text;
        for (const ann of block.annotations || []) {
          if (ann.type === "url_citation") sources.push({ url: ann.url.replace(/[?&]utm_source=openai$/, ""), title: ann.title || "" });
        }
      }
    }
  }
  return { text, sources };
}

const MAX_CONCURRENT = 3;

async function runWithConcurrency(tasks, limit) {
  const results = [];
  const executing = new Set();
  for (const task of tasks) {
    const p = task().then(r => { executing.delete(p); return r; });
    executing.add(p);
    results.push(p);
    if (executing.size >= limit) await Promise.race(executing);
  }
  return Promise.all(results);
}

export async function gather(query) {
  const results = await runWithConcurrency(
    SEARCHES.map(fn => () => webSearch(fn(query))),
    MAX_CONCURRENT
  );

  // TODO: Add deterministic scraper results here
  // e.g. const yelpData = await scrapeYelp(query);
  //      const redditData = await scrapeReddit(query);
  //      results.push(yelpData, redditData);

  const allText = results.map((r, i) => `--- Search ${i + 1} ---\n${r.text}`).join("\n\n");
  const allSources = results.flatMap(r => r.sources);

  const seen = new Set();
  const sources = allSources.filter(s => { if (seen.has(s.url)) return false; seen.add(s.url); return true; });

  // Log
  const slug = query.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase().slice(0, 50);
  const logFile = new URL(`../logs/${slug}_${Date.now()}.txt`, import.meta.url);
  let log = `Query: "${query}"\nTimestamp: ${new Date().toISOString()}\nSearches: ${SEARCHES.length}\nSources found: ${sources.length}\n${"=".repeat(60)}\n\n`;
  log += allText;
  log += `\n\n${"=".repeat(60)}\nSOURCES (${sources.length}):\n`;
  for (const s of sources) log += `  • ${s.title}: ${s.url}\n`;
  writeFileSync(logFile, log);
  console.log(`  → Gathered ${sources.length} sources, log: logs/${slug}_*.txt`);

  return { text: allText, sources };
}
