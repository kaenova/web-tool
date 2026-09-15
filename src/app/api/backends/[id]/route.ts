import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/backends/:id — update name/base_url/api_key/enabled
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as
    | { name?: string; base_url?: string; api_key?: string | null; enabled?: boolean }
    | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const db = getDb();
  const existing = db.prepare("SELECT * FROM backends WHERE id = ?").get(Number(id));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.name !== undefined) db.prepare("UPDATE backends SET name = ? WHERE id = ?").run(body.name, Number(id));
  if (body.base_url !== undefined) db.prepare("UPDATE backends SET base_url = ? WHERE id = ?").run(body.base_url, Number(id));
  if (body.api_key !== undefined) db.prepare("UPDATE backends SET api_key = ? WHERE id = ?").run(body.api_key || null, Number(id));
  if (body.enabled !== undefined) db.prepare("UPDATE backends SET enabled = ? WHERE id = ?").run(body.enabled ? 1 : 0, Number(id));

  const backend = db.prepare("SELECT * FROM backends WHERE id = ?").get(Number(id));
  return NextResponse.json({ backend });
}

// DELETE /api/backends/:id
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const db = getDb();
  db.prepare("DELETE FROM backends WHERE id = ?").run(Number(id));

  // Remove from all routes
  const routes = db.prepare("SELECT endpoint, backend_order FROM endpoint_routes").all() as Array<{ endpoint: string; backend_order: string }>;
  for (const r of routes) {
    const order: number[] = JSON.parse(r.backend_order);
    const filtered = order.filter((x) => x !== Number(id));
    if (filtered.length !== order.length) {
      db.prepare("UPDATE endpoint_routes SET backend_order = ? WHERE endpoint = ?").run(JSON.stringify(filtered), r.endpoint);
    }
  }
  return NextResponse.json({ ok: true });
}
