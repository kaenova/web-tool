import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// GET /api/stats — dashboard summary
export async function GET() {
  const db = getDb();
  const total = (db.prepare("SELECT COUNT(*) as c FROM request_logs").get() as { c: number }).c;
  const success = (db.prepare("SELECT COUNT(*) as c FROM request_logs WHERE status < 400").get() as { c: number }).c;
  const avgLatency = (db.prepare("SELECT AVG(latency_ms) as a FROM request_logs").get() as { a: number | null }).a ?? 0;
  const p95 = (db.prepare(
    "SELECT latency_ms as l FROM request_logs ORDER BY latency_ms DESC LIMIT 1 OFFSET ?"
  ).get(Math.floor(total * 0.05)) as { l: number } | undefined)?.l ?? 0;

  const perEndpoint = db.prepare(
    `SELECT endpoint, COUNT(*) as count,
            SUM(CASE WHEN status < 400 THEN 1 ELSE 0 END) as ok,
            AVG(latency_ms) as avg_latency
     FROM request_logs GROUP BY endpoint`
  ).all();

  const perBackend = db.prepare(
    `SELECT backend_name, COUNT(*) as count,
            SUM(CASE WHEN status < 400 THEN 1 ELSE 0 END) as ok
     FROM request_logs WHERE backend_name IS NOT NULL GROUP BY backend_name`
  ).all();

  const timeSeries = db.prepare(
    `SELECT datetime(timestamp, 'start of hour') as bucket,
            COUNT(*) as count,
            SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) as errors
     FROM request_logs
     WHERE timestamp >= datetime('now', '-24 hours')
     GROUP BY bucket ORDER BY bucket`
  ).all();

  const backends = db.prepare("SELECT id, type, name, enabled, base_url FROM backends ORDER BY id").all();

  return NextResponse.json({
    total,
    success,
    errorRate: total > 0 ? ((total - success) / total) * 100 : 0,
    avgLatencyMs: Math.round(avgLatency),
    p95LatencyMs: p95,
    perEndpoint,
    perBackend,
    timeSeries,
    backends,
  });
}
