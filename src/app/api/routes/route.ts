import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

const ENDPOINTS = ["searxng_search", "firecrawl_search", "firecrawl_scrape"];

// GET /api/routes — all endpoint routes with resolved backend info
export async function GET() {
  const db = getDb();
  const routes = db.prepare("SELECT * FROM endpoint_routes").all() as Array<{
    endpoint: string;
    backend_order: string;
    enabled: number;
  }>;
  const backends = db.prepare("SELECT id, type, name, enabled FROM backends").all();

  return NextResponse.json({
    routes: routes.map((r) => ({
      ...r,
      backend_order: JSON.parse(r.backend_order) as number[],
    })),
    backends,
  });
}

// PUT /api/routes — update one endpoint's order/enabled
export async function PUT(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { endpoint?: string; backend_order?: number[]; enabled?: boolean }
    | null;

  if (!body?.endpoint || !ENDPOINTS.includes(body.endpoint)) {
    return NextResponse.json({ error: `endpoint must be one of ${ENDPOINTS.join(",")}` }, { status: 400 });
  }

  const db = getDb();
  if (body.backend_order !== undefined) {
    if (!Array.isArray(body.backend_order) || body.backend_order.some((n) => !Number.isInteger(n))) {
      return NextResponse.json({ error: "backend_order must be an array of backend ids" }, { status: 400 });
    }
    db.prepare("UPDATE endpoint_routes SET backend_order = ? WHERE endpoint = ?").run(
      JSON.stringify(body.backend_order),
      body.endpoint
    );
  }
  if (body.enabled !== undefined) {
    db.prepare("UPDATE endpoint_routes SET enabled = ? WHERE endpoint = ?").run(body.enabled ? 1 : 0, body.endpoint);
  }

  const route = db.prepare("SELECT * FROM endpoint_routes WHERE endpoint = ?").get(body.endpoint);
  return NextResponse.json({ route });
}
