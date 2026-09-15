import { NextRequest, NextResponse } from "next/server";
import { getDb, type Backend } from "@/lib/db";
import { isSearchCapable, searchSearxng, searchDgoog, searchFourget, searchWhoogle } from "@/lib/search-engines";
import { scrapeCrawl4ai } from "@/lib/scrape-engines";

const SEARCH_PROBES: Record<string, (b: Backend, r: { query: string; limit: number }) => Promise<{ success: boolean; error?: string }>> = {
  searxng: searchSearxng,
  dgoog: searchDgoog,
  fourget: searchFourget,
  whoogle: searchWhoogle,
};

// POST /api/backends/:id/test — ping the backend with a real request
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  const backend = db.prepare("SELECT * FROM backends WHERE id = ?").get(Number(id)) as Backend | undefined;
  if (!backend) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const startedAt = Date.now();
  let ok = false;
  let detail = "";

  if (backend.type in SEARCH_PROBES) {
    const res = await SEARCH_PROBES[backend.type]!(backend, { query: "test", limit: 1 });
    ok = res.success === true;
    detail = ok ? "search ok" : res.error ?? "failed";
  } else if (backend.type === "crawl4ai") {
    const res = await scrapeCrawl4ai(backend, { url: "https://example.com", formats: ["markdown"], timeout: 20 });
    ok = res.success === true;
    detail = ok ? "scrape ok" : (res as { error?: string }).error ?? "failed";
  } else if (backend.type === "firecrawl") {
    // ponytail: firecrawl probe = plain HTTP health hit; upgrade path: token-scoped whoami
    try {
      const res = await fetch(`${backend.base_url.replace(/\/$/, "")}/v2/health`, {
        headers: backend.api_key ? { Authorization: `Bearer ${backend.api_key}` } : {},
      });
      ok = res.ok;
      detail = `HTTP ${res.status}`;
    } catch (err) {
      detail = err instanceof Error ? err.message : "failed";
    }
  } else {
    return NextResponse.json({ error: `Unknown type ${backend.type}` }, { status: 400 });
  }

  return NextResponse.json({
    ok,
    detail,
    latency_ms: Date.now() - startedAt,
    capable: { search: isSearchCapable(backend.type), scrape: backend.type === "crawl4ai" || backend.type === "firecrawl" },
  });
}
