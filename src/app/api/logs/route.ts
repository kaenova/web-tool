import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// GET /api/logs?endpoint=&status=&limit=&offset=&q=
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Number(sp.get("limit") ?? 50), 200);
  const offset = Number(sp.get("offset") ?? 0);
  const endpoint = sp.get("endpoint");
  const status = sp.get("status");
  const q = sp.get("q");

  const db = getDb();
  const where: string[] = [];
  const params: unknown[] = [];

  if (endpoint) {
    where.push("endpoint = ?");
    params.push(endpoint);
  }
  if (status) {
    where.push("status = ?");
    params.push(Number(status));
  }
  if (q) {
    where.push("(req_body LIKE ? OR res_body LIKE ? OR backend_name LIKE ?)");
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT * FROM request_logs ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);
  const total = (db.prepare(`SELECT COUNT(*) as c FROM request_logs ${whereSql}`).get(...params) as { c: number }).c;

  return NextResponse.json({ logs: rows, total, limit, offset });
}
