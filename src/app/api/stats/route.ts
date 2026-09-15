import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// GET /api/stats — dashboard summary + analytics
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
            SUM(CASE WHEN status < 400 THEN 1 ELSE 0 END) as ok,
            AVG(latency_ms) as avg_latency
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

  // Analytics: status code distribution
  const statusCodes = db.prepare(
    `SELECT CASE
        WHEN status < 300 THEN '2xx'
        WHEN status < 400 THEN '3xx'
        WHEN status < 500 THEN '4xx'
        ELSE '5xx' END as code,
        COUNT(*) as count
     FROM request_logs GROUP BY code`
  ).all();

  // Analytics: latency distribution buckets (ms)
  const latencyBuckets = db.prepare(
    `SELECT bucket, COUNT(*) as count FROM (
        SELECT CASE
          WHEN latency_ms < 500 THEN '<500ms'
          WHEN latency_ms < 1500 THEN '500-1.5s'
          WHEN latency_ms < 5000 THEN '1.5-5s'
          WHEN latency_ms < 15000 THEN '5-15s'
          ELSE '>15s' END as bucket,
          CASE
          WHEN latency_ms < 500 THEN 1
          WHEN latency_ms < 1500 THEN 2
          WHEN latency_ms < 5000 THEN 3
          WHEN latency_ms < 15000 THEN 4
          ELSE 5 END as ord
     FROM request_logs
     ) as b GROUP BY b.bucket, b.ord ORDER BY b.ord`
  ).all();

  // Analytics: daily series last 14 days
  const dailySeries = db.prepare(
    `SELECT date(timestamp) as bucket,
            COUNT(*) as count,
            SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) as errors,
            AVG(latency_ms) as avg_latency
     FROM request_logs
     WHERE timestamp >= datetime('now', '-14 days')
     GROUP BY bucket ORDER BY bucket`
  ).all();

  // Analytics: per-endpoint hourly stacked (24h)
  const endpointHourly = db.prepare(
    `SELECT datetime(timestamp, 'start of hour') as bucket, endpoint, COUNT(*) as count
     FROM request_logs
     WHERE timestamp >= datetime('now', '-24 hours')
     GROUP BY bucket, endpoint ORDER BY bucket`
  ).all();

  // Analytics: top errors
  const topErrors = db.prepare(
    `SELECT status, COUNT(*) as count, MAX(timestamp) as last_seen
     FROM request_logs WHERE status >= 400
     GROUP BY status ORDER BY count DESC LIMIT 5`
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
    statusCodes,
    latencyBuckets,
    dailySeries,
    endpointHourly,
    topErrors,
    backends,
  });
}
