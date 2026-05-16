import OpenAI from "openai";
import { readFileSync } from "fs";

const SYSTEM_PROMPT = readFileSync(new URL("./prompts/score-reviews.txt", import.meta.url), "utf-8");

let _client;
function client() {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

export async function analyze(query, gathered) {
  const response = await client().chat.completions.create({
    model: "gpt-5.4",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Analyze the following research about "${query}" and produce your XML assessment:\n\n${gathered.text}` }
    ]
  });

  const text = response.choices[0].message.content || "";
  return parseXml(text, query, gathered.sources);
}

function parseXml(text, query, fallbackSources) {
  try {
    const get = (tag) => { const m = text.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`)); return m ? m[1].trim() : ""; };
    const getAll = (tag) => [...text.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g"))].map(m => m[1].trim());

    const score = parseInt(get("score")) || 50;
    const summary = get("summary");
    const name = get("name") || query;
    const address = get("address") || "";
    const signals = getAll("signal");
    const sourceBlocks = getAll("source");
    const sources = sourceBlocks.map(s => {
      const url = s.match(/<url>(.*?)<\/url>/)?.[1] || "";
      const title = s.match(/<title>(.*?)<\/title>/)?.[1] || "";
      return { url, title };
    }).filter(s => s.url);

    return { score, summary, name, address, signals, sources: sources.length ? sources : fallbackSources };
  } catch {
    return { score: 50, summary: text.slice(0, 300), signals: [], name: query, address: "", sources: fallbackSources };
  }
}
