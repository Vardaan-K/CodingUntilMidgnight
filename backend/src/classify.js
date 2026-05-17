import OpenAI from "openai";
import { readFileSync } from "fs";

const CLASSIFY_PROMPT = readFileSync(new URL("./prompts/classify.txt", import.meta.url), "utf-8");

let _client;
function client() {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

async function classifyChunk(text) {
  const response = await client().chat.completions.create({
    model: "gpt-4.1-nano",
    messages: [
      { role: "system", content: CLASSIFY_PROMPT },
      { role: "user", content: text }
    ]
  });

  const output = response.choices[0].message.content || "";
  return parseItems(output);
}

function parseItems(text) {
  return [...text.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => {
    const block = m[1];
    const content = block.match(/<content>([\s\S]*?)<\/content>/)?.[1]?.trim() || "";
    const tags = [...block.matchAll(/<tag>(.*?)<\/tag>/g)].map(t => t[1].trim());
    const sentiment = block.match(/<sentiment>(.*?)<\/sentiment>/)?.[1]?.trim() || "neutral";
    const source = block.match(/<source>(.*?)<\/source>/)?.[1]?.trim() || "";
    return { content, tags, sentiment, source };
  });
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

export async function classify(gathered) {
  const chunks = gathered.text.split(/---\s*Search\s*\d+\s*---/).filter(Boolean);
  const results = await runWithConcurrency(
    chunks.map(chunk => () => classifyChunk(chunk)),
    MAX_CONCURRENT
  );
  const items = results.flat();

  return {
    items,
    sources: gathered.sources,
    byTag: groupByTag(items),
  };
}

function groupByTag(items) {
  const groups = { identity: [], operations: [], safety: [] };
  for (const item of items) {
    for (const tag of item.tags) {
      if (groups[tag]) groups[tag].push(item);
    }
  }
  return groups;
}
