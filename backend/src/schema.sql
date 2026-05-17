CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id TEXT NOT NULL,
  type TEXT NOT NULL,
  comment TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Final analysis result, keyed by place_id when available, "str:..." fallback otherwise.
CREATE TABLE IF NOT EXISTS cache (
  place_id TEXT PRIMARY KEY,
  data TEXT NOT NULL
);

-- Intermediate classified findings, same key namespace as `cache`.
CREATE TABLE IF NOT EXISTS classified_cache (
  query TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- (normalized_query, normalized_location) -> place_id
-- Skip the paid Google Places lookup on every cache hit.
-- place_id = '' means "we tried, no match" — cached so no re-call.
CREATE TABLE IF NOT EXISTS resolution_cache (
  query_norm TEXT NOT NULL,
  location_norm TEXT NOT NULL,
  place_id TEXT NOT NULL,
  resolved_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (query_norm, location_norm)
);
