import OpenAI from "openai";
import { readFileSync } from "fs";

const SYSTEM_PROMPT = readFileSync(new URL("./prompts/score-reviews.txt", import.meta.url), "utf-8");

let _client;
function client() {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

export async function analyze(query, classified) {
  // Format classified items for the LLM
  const formatItems = (items) => items.map(i => `[${i.sentiment}] ${i.content} (${i.source})`).join("\n");

  const sourceList = classified.sources.map(s => `${s.title}: ${s.url}`).join("\n");

  const context = `IDENTITY findings:\n${formatItems(classified.byTag.identity)}\n\nOPERATIONS findings:\n${formatItems(classified.byTag.operations)}\n\nSAFETY findings:\n${formatItems(classified.byTag.safety)}\n\nAVAILABLE SOURCES (use exact URLs):\n${sourceList}`;

  const response = await client().chat.completions.create({
    model: "gpt-5.4",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Analyze the following classified research about "${query}" and produce your XML assessment:\n\n${context}` }
    ]
  });

  const text = response.choices[0].message.content || "";
  return parseXml(text, query, classified.sources);
}

function parseCategory(text, tag) {
  const block = text.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1] || "";
  const score = parseInt(block.match(/<score>(.*?)<\/score>/)?.[1]) || 0;
  const summary = block.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.trim() || "";
  const signals = [...block.matchAll(/<signal>([\s\S]*?)<\/signal>/g)].map(m => m[1].trim());
  return { score, summary, signals };
}

function parseXml(text, query, fallbackSources) {
  try {
    const get = (tag) => text.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1]?.trim() || "";

    const name = get("name") || query;
    const address = get("address") || "";
    const discrimination = parseCategory(text, "identity");
    const operations = parseCategory(text, "operations");
    const safety = parseCategory(text, "safety");

    const finalBlock = text.match(/<final>([\s\S]*?)<\/final>/)?.[1] || "";
    const finalScore = parseInt(finalBlock.match(/<score>(.*?)<\/score>/)?.[1]) || Math.round((discrimination.score + operations.score + safety.score) / 3);
    const finalSummary = finalBlock.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.trim() || "";

    const sourceBlocks = [...text.matchAll(/<source>([\s\S]*?)<\/source>/g)].map(m => m[1]);
    const sources = sourceBlocks.map(s => ({
      url: s.match(/<url>(.*?)<\/url>/)?.[1] || "",
      title: s.match(/<title>(.*?)<\/title>/)?.[1] || ""
    })).filter(s => s.url);

    return {
      name, address,
      identity: discrimination, operations, safety,
      final: { score: finalScore, summary: finalSummary },
      sources: sources.length ? sources : fallbackSources
    };
  } catch {
    return {
      name: query, address: "",
      discrimination: { score: 0, summary: "", signals: [] },
      operations: { score: 0, summary: "", signals: [] },
      safety: { score: 0, summary: "", signals: [] },
      final: { score: 0, summary: text.slice(0, 300) },
      sources: fallbackSources
    };
  }
}
