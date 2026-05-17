import initSqlJs from "sql.js";
import { readFileSync, writeFileSync, existsSync } from "fs";

const DB_PATH = "safe_space.db";
let database;

export async function initDb() {
  const SQL = await initSqlJs();
  database = existsSync(DB_PATH) ? new SQL.Database(readFileSync(DB_PATH)) : new SQL.Database();
  const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf-8");
  database.run(schema);
  save();
}

function save() {
  writeFileSync(DB_PATH, Buffer.from(database.export()));
}

export const db = {
  getCache(key) {
    const res = database.exec("SELECT data FROM cache WHERE place_id = ?", [key]);
    return res.length ? JSON.parse(res[0].values[0][0]) : null;
  },
  setCache(key, data) {
    database.run("INSERT OR REPLACE INTO cache (place_id, data) VALUES (?, ?)", [key, JSON.stringify(data)]);
    save();
  },
  clearCache(key) {
    database.run("DELETE FROM cache WHERE place_id = ?", [key]);
    database.run("DELETE FROM classified_cache WHERE query = ?", [key]);
    save();
  },
  getClassified(key) {
    const res = database.exec("SELECT data FROM classified_cache WHERE query = ?", [key]);
    return res.length ? JSON.parse(res[0].values[0][0]) : null;
  },
  setClassified(key, data) {
    database.run("INSERT OR REPLACE INTO classified_cache (query, data) VALUES (?, ?)", [key, JSON.stringify(data)]);
    save();
  },
  addReport(placeId, type, comment) {
    database.run("INSERT INTO reports (place_id, type, comment) VALUES (?, ?, ?)", [placeId, type, comment]);
    save();
  },
  getReports(placeId) {
    const res = database.exec("SELECT type, comment, created_at FROM reports WHERE place_id = ? ORDER BY created_at DESC LIMIT 20", [placeId]);
    if (!res.length) return [];
    return res[0].values.map(([type, comment, created_at]) => ({ type, comment, created_at }));
  },
  getReportCounts(placeId) {
    const res = database.exec("SELECT type, COUNT(*) as c FROM reports WHERE place_id = ? GROUP BY type", [placeId]);
    if (!res.length) return { pos: 0, neg: 0 };
    const rows = Object.fromEntries(res[0].values);
    return { pos: rows.positive || 0, neg: rows.negative || 0 };
  }
};
