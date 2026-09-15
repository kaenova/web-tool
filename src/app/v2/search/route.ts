import { NextRequest, NextResponse } from "next/server";
import { routeSearch, type SearchRequest } from "@/lib/search-engines";
import { logRequest } from "@/lib/db";

// Firecrawl-compatible search: POST /v2/search
export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  let body: SearchRequest;
  try {
    body = (await req.json()) as SearchRequest;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.query || typeof body.query !== "string") {
    return NextResponse.json({ success: false, error: "query is required" }, { status: 400 });
  }

  const result = await routeSearch("firecrawl_search", body);
  const latency = Date.now() - startedAt;

  if (!result.success) {
    logRequest({
      endpoint: "firecrawl_search",
      backend_id: null,
      backend_name: null,
      status: 502,
      latency_ms: latency,
      req_body: JSON.stringify(body),
      res_body: JSON.stringify({ error: result.error }),
    });
    return NextResponse.json({ success: false, error: result.error }, { status: 502 });
  }

  logRequest({
    endpoint: "firecrawl_search",
    backend_id: result._backend?.id ?? null,
    backend_name: result._backend?.name ?? null,
    status: 200,
    latency_ms: latency,
    req_body: JSON.stringify(body),
    res_body: JSON.stringify({ web: result.data.web.slice(0, 3) }),
  });

  const { _backend, ...response } = result;
  return NextResponse.json(response, { status: 200 });
}
