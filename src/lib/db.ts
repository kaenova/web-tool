import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DB_PATH = process.env.ACTIVITY_DB_PATH || path.join(process.cwd(), "data", "webtool.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS backends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK (type IN ('searxng','dgoog','fourget','whoogle','firecrawl','crawl4ai')),
      name TEXT NOT NULL UNIQUE,
      base_url TEXT NOT NULL,
      api_key TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS endpoint_routes (
      endpoint TEXT NOT NULL CHECK (endpoint IN ('searxng_search','firecrawl_search','firecrawl_scrape')),
      backend_order TEXT NOT NULL DEFAULT '[]',
      enabled INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (endpoint)
    );

    CREATE TABLE IF NOT EXISTS request_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      endpoint TEXT NOT NULL,
      backend_id INTEGER,
      backend_name TEXT,
      status INTEGER NOT NULL,
      latency_ms INTEGER NOT NULL,
      req_body TEXT,
      res_body TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_logs_ts ON request_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_logs_endpoint ON request_logs(endpoint);

    INSERT OR IGNORE INTO endpoint_routes (endpoint, backend_order) VALUES
      ('searxng_search', '[]'),
      ('firecrawl_search', '[]'),
      ('firecrawl_scrape', '[]');
  `);
  return db;
}

export interface Backend {
  id: number;
  type: "searxng" | "dgoog" | "fourget" | "whoogle" | "firecrawl" | "crawl4ai";
  name: string;
  base_url: string;
  api_key: string | null;
  enabled: number;
  created_at: string;
}

export interface RequestLog {
  id: number;
  timestamp: string;
  endpoint: string;
  backend_id: number | null;
  backend_name: string | null;
  status: number;
  latency_ms: number;
  req_body: string | null;
  res_body: string | null;
}

const TRUNCATE = 4000;

export function logRequest(entry: {
  endpoint: string;
  backend_id: number | null;
  backend_name: string | null;
  status: number;
  latency_ms: number;
  req_body?: string | null;
  res_body?: string | null;
}): void {
  try {
    getDb()
      .prepare(
        `INSERT INTO request_logs (endpoint, backend_id, backend_name, status, latency_ms, req_body, res_body)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        entry.endpoint,
        entry.backend_id,
        entry.backend_name,
        entry.status,
        entry.latency_ms,
        entry.req_body?.slice(0, TRUNCATE) ?? null,
        entry.res_body?.slice(0, TRUNCATE) ?? null
      );
  } catch {
    // logging must never break requests
  }
}
