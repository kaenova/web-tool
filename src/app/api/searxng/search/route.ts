import { NextRequest, NextResponse } from "next/server";
import { routeSearch, type SearchRequest, type SearchResponse } from "@/lib/search-engines";
import { logRequest } from "@/lib/db";

// SearXNG-compatible JSON search: GET /api/searxng/search?q=&format=json&pageno=&language=&time_range=
export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const sp = req.nextUrl.searchParams;
  const query = sp.get("q") ?? sp.get("query") ?? "";

  if (!query) {
    return NextResponse.json({ error: "query (q) is required" }, { status: 400 });
  }

  const searchReq: SearchRequest = {
    query,
    page: sp.get("pageno") ? Number(sp.get("pageno")) : undefined,
    limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
    language: sp.get("language") ?? undefined,
    time_range: sp.get("time_range") ?? undefined,
  };

  const result = await routeSearch("searxng_search", searchReq);
  const latency = Date.now() - startedAt;

  if (!result.success) {
    logRequest({
      endpoint: "searxng_search",
      backend_id: null,
      backend_name: null,
      status: 502,
      latency_ms: latency,
      req_body: JSON.stringify(searchReq),
      res_body: JSON.stringify({ error: result.error }),
    });
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  logRequest({
    endpoint: "searxng_search",
    backend_id: result._backend?.id ?? null,
    backend_name: result._backend?.name ?? null,
    status: 200,
    latency_ms: latency,
    req_body: JSON.stringify(searchReq),
    res_body: JSON.stringify({ web: result.data.web.slice(0, 3) }),
  });

  // SearXNG JSON shape
  const rows = result.data.web.map((r) => ({
    url: r.url,
    title: r.title,
    content: r.description,
    ...(r.category ? { category: r.category } : {}),
  }));
  return NextResponse.json({ query, results: rows });
}

export type { SearchResponse };
