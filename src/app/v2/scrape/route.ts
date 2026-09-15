import { NextRequest, NextResponse } from "next/server";
import { routeScrape, type ScrapeRequest } from "@/lib/scrape-engines";
import { logRequest } from "@/lib/db";

// Firecrawl-compatible scrape: POST /v2/scrape
export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  let body: ScrapeRequest;
  try {
    body = (await req.json()) as ScrapeRequest;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.url || typeof body.url !== "string") {
    return NextResponse.json({ success: false, error: "url is required" }, { status: 400 });
  }

  const result = await routeScrape("firecrawl_scrape", body);
  const latency = Date.now() - startedAt;

  if (!result.success) {
    const status = result.error.includes("timed out") ? 504 : 502;
    logRequest({
      endpoint: "firecrawl_scrape",
      backend_id: null,
      backend_name: null,
      status,
      latency_ms: latency,
      req_body: JSON.stringify(body),
      res_body: JSON.stringify({ error: result.error }),
    });
    return NextResponse.json({ success: false, error: result.error }, { status });
  }

  logRequest({
    endpoint: "firecrawl_scrape",
    backend_id: result._backend?.id ?? null,
    backend_name: result._backend?.name ?? null,
    status: 200,
    latency_ms: latency,
    req_body: JSON.stringify(body),
    res_body: JSON.stringify({ ok: true }),
  });

  const { _backend, ...response } = result;
  return NextResponse.json(response, { status: 200 });
}
