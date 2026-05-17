import OpenAI from "openai";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { aggregateBusinessData, aggregateToBlocks } from "./scrapers/index.js";

let _client;
function client() {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

mkdirSync(new URL("../logs", import.meta.url), { recursive: true });

const GATHER_PROMPT = readFileSync(new URL("./prompts/gather.txt", import.meta.url), "utf-8");

// Searches organized by category — deterministic scrapers feed in alongside these.
const SEARCHES = [
  // Identity
  q => `${q} LGBTQ+ inclusive diversity employee reviews`,
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

/**
 * Gather research for a query.
 *
 * Runs the LLM web-search probes and the deterministic scrapers concurrently,
 * folds them into a single `{text, sources}` payload suitable for classify().
 *
 * @param {string} query              Free-text query / business name.
 * @param {object} [opts]
 * @param {string} [opts.location]    City/state/zip, threaded into scrapers.
 * @param {boolean} [opts.useScrapers=true]
 */
export async function gather(query, opts = {}) {
  const { location = "", useScrapers = true } = opts;

  // Kick off web searches and deterministic scrapers in parallel.
  const webPromise = runWithConcurrency(
    SEARCHES.map(fn => () => webSearch(fn(query))),
    MAX_CONCURRENT
  );
  const scraperPromise = useScrapers
    ? aggregateBusinessData(query, location).catch(e => ({ error: e.message }))
    : Promise.resolve(null);

  const [webResults, scraperData] = await Promise.all([webPromise, scraperPromise]);

  // Web search blocks come first (LLM prose), scraper blocks are appended as
  // additional `--- Search N ---` chunks so classify.js can still split by
  // that delimiter.
  const blocks = webResults.map((r, i) => ({
    label: `Web Search ${i + 1}`,
    text: r.text,
    sources: r.sources,
  }));

  if (scraperData && !scraperData.error) {
    for (const b of aggregateToBlocks(scraperData)) blocks.push(b);
  }

  // Keep the `--- Search N ---` delimiter exactly as classify.js expects;
  // put the label on the next line so the regex split still works.
  const allText = blocks
    .map((b, i) => `--- Search ${i + 1} ---\n[${b.label}]\n${b.text}`)
    .join("\n\n");
  const allSources = blocks.flatMap(b => b.sources);

  const seen = new Set();
  const sources = allSources.filter(s => {
    if (!s?.url || seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });

  // Log
  const slug = query.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase().slice(0, 50);
  const logFile = new URL(`../logs/${slug}_${Date.now()}.txt`, import.meta.url);
  let log = `Query: "${query}"\nLocation: "${location}"\nTimestamp: ${new Date().toISOString()}\nWeb searches: ${SEARCHES.length}\nScraper blocks: ${blocks.length - SEARCHES.length}\nSources found: ${sources.length}\n${"=".repeat(60)}\n\n`;
  log += allText;
  log += `\n\n${"=".repeat(60)}\nSOURCES (${sources.length}):\n`;
  for (const s of sources) log += `  • ${s.title}: ${s.url}\n`;
  writeFileSync(logFile, log);
  console.log(`  → Gathered ${blocks.length} blocks / ${sources.length} sources, log: logs/${slug}_*.txt`);

  return { text: allText, sources, scraper: scraperData ?? null };
}
