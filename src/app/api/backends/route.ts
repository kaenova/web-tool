import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isSearchCapable } from "@/lib/search-engines";
import { isScrapeCapable } from "@/lib/scrape-engines";

// CRUD backends: GET/POST /api/backends
export async function GET() {
  const db = getDb();
  const backends = db.prepare("SELECT * FROM backends ORDER BY id").all();
  return NextResponse.json({ backends });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { type?: string; name?: string; base_url?: string; api_key?: string | null }
    | null;

  const validTypes = ["searxng", "dgoog", "fourget", "whoogle", "firecrawl", "crawl4ai"];
  if (!body?.type || !validTypes.includes(body.type)) {
    return NextResponse.json({ error: `type must be one of ${validTypes.join(",")}` }, { status: 400 });
  }
  if (!body.name?.trim() || !body.base_url?.trim()) {
    return NextResponse.json({ error: "name and base_url are required" }, { status: 400 });
  }
  if (body.type !== "firecrawl" && body.type !== "crawl4ai" && !/^https?:\/\//.test(body.base_url)) {
    return NextResponse.json({ error: "base_url must start with http:// or https://" }, { status: 400 });
  }

  const db = getDb();
  try {
    const result = db
      .prepare("INSERT INTO backends (type, name, base_url, api_key) VALUES (?, ?, ?, ?)")
      .run(body.type, body.name.trim(), body.base_url.trim(), body.api_key || null);
    const backend = db.prepare("SELECT * FROM backends WHERE id = ?").get(result.lastInsertRowid);
    return NextResponse.json({ backend }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error && err.message.includes("UNIQUE") ? "name already exists" : "insert failed";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}

// Capability helper for UI
export async function OPTIONS() {
  return NextResponse.json({
    search_capable: Object.keys({ searxng: 1, dgoog: 1, fourget: 1, whoogle: 1, firecrawl: 1 }).filter(isSearchCapable),
    scrape_capable: ["crawl4ai", "firecrawl"].filter(isScrapeCapable),
  });
}
