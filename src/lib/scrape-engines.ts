import { getDb, type Backend } from "./db";

export interface ScrapeRequest {
  url: string;
  formats?: ("markdown" | "html" | "rawHtml" | "screenshot")[];
  waitFor?: number;
  timeout?: number;
  mobile?: boolean;
  headers?: Record<string, string>;
  skipTlsVerification?: boolean;
  onlyMainContent?: boolean;
}

export interface ScrapeSuccess {
  success: true;
  data: {
    metadata: {
      title?: string;
      description?: string;
      sourceURL: string;
      statusCode?: number;
    };
    markdown?: string;
    html?: string;
    rawHtml?: string;
    screenshot?: string;
  };
}

export interface ScrapeError {
  success: false;
  error: string;
}

export type ScrapeResponse = ScrapeSuccess | ScrapeError;

/* ---------------- Crawl4AI ---------------- */

interface Crawl4aiTask {
  status: string;
  result?: {
    success?: boolean;
    results?: Array<{
      url?: string;
      html?: string;
      // Crawl4AI new API returns markdown as { raw_markdown, markdown_with_citations, fit_html, ... }
      markdown?: string | { raw_markdown?: string; [k: string]: unknown };
      metadata?: Record<string, unknown>;
      status_code?: number;
    }>;
  };
  error?: string;
}

// ponytail: normalize Crawl4AI markdown dict → string; revisit if upstream ships typed field
function normalizeMarkdown(m: unknown): string | undefined {
  if (typeof m === "string") return m;
  if (m && typeof m === "object") {
    const obj = m as Record<string, unknown>;
    if (typeof obj.raw_markdown === "string") return obj.raw_markdown;
    if (typeof obj.markdown === "string") return obj.markdown;
  }
  return undefined;
}

export async function scrapeCrawl4ai(backend: Backend, req: ScrapeRequest): Promise<ScrapeResponse> {
  const base = backend.base_url.replace(/\/$/, "");
  const auth: Record<string, string> = backend.api_key ? { Authorization: `Bearer ${backend.api_key}` } : {};
  const timeoutSec = Math.min(req.timeout ?? 60, 55);
  const deadline = Date.now() + timeoutSec * 1000;

  const body: Record<string, unknown> = {
    urls: [req.url],
    cache_mode: "bypass",
  };
  if (req.waitFor) body.wait_for = req.waitFor;
  if (req.mobile) body.mobile = true;
  if (req.headers) body.headers = req.headers;
  if (req.skipTlsVerification) body.skip_tls_verification = true;
  if (req.onlyMainContent !== undefined) body.only_main_content = req.onlyMainContent;

  try {
    let taskId: string;
    const submit = await fetch(`${base}/crawl/job`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify(body),
    });
    if (!submit.ok) {
      const text = await submit.text().catch(() => "");
      return { success: false, error: `Crawl4AI submit failed: ${submit.status} ${text.slice(0, 200)}` };
    }
    taskId = ((await submit.json()) as { task_id: string }).task_id;

    // Poll
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1000));
      const poll = await fetch(`${base}/crawl/job/${taskId}`, { headers: auth });
      if (!poll.ok) return { success: false, error: `Crawl4AI poll failed: ${poll.status}` };
      const task = (await poll.json()) as Crawl4aiTask;

      if (task.status === "failed" || task.error) {
        return { success: false, error: task.error || "Crawl4AI task failed" };
      }
      if (task.status === "completed" || task.status === "success") {
        const first = task.result?.results?.[0];
        if (!first) return { success: false, error: "Crawl4AI task completed but result is missing" };

        const meta = (first.metadata ?? {}) as Record<string, unknown>;
        return {
          success: true,
          data: {
            metadata: {
              title: meta["title"] as string | undefined,
              description: meta["description"] as string | undefined,
              sourceURL: first.url ?? req.url,
              statusCode: first.status_code ?? (meta["status_code"] as number | undefined),
            },
            markdown: normalizeMarkdown(first.markdown),
            html: first.html,
            rawHtml: first.html,
            screenshot: undefined,
          },
        };
      }
    }
    return { success: false, error: "Scrape timed out" };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Crawl4AI failed" };
  }
}

/* ---------------- Firecrawl (scrape passthrough) ---------------- */

export async function scrapeFirecrawl(backend: Backend, req: ScrapeRequest): Promise<ScrapeResponse> {
  try {
    const res = await fetch(`${backend.base_url.replace(/\/$/, "")}/v2/scrape`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(backend.api_key ? { Authorization: `Bearer ${backend.api_key}` } : {}),
      },
      body: JSON.stringify(req),
    });
    if (!res.ok) return { success: false, error: `Firecrawl HTTP ${res.status}` };
    return (await res.json()) as ScrapeResponse;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Firecrawl failed" };
  }
}

/* ---------------- Routing ---------------- */

const SCRAPE_ADAPTERS: Record<string, (b: Backend, r: ScrapeRequest) => Promise<ScrapeResponse>> = {
  crawl4ai: scrapeCrawl4ai,
  firecrawl: scrapeFirecrawl,
};

export function isScrapeCapable(type: string): boolean {
  return type in SCRAPE_ADAPTERS;
}

export async function routeScrape(
  endpoint: string,
  req: ScrapeRequest
): Promise<ScrapeResponse & { _backend?: { id: number; name: string } }> {
  const db = getDb();
  const route = db.prepare("SELECT backend_order, enabled FROM endpoint_routes WHERE endpoint = ?").get(endpoint) as
    | { backend_order: string; enabled: number }
    | undefined;

  if (!route || !route.enabled) {
    return { success: false, error: `Endpoint ${endpoint} is disabled` };
  }

  const order: number[] = JSON.parse(route.backend_order);
  if (order.length === 0) {
    return { success: false, error: "No backends configured for this endpoint" };
  }

  const backends = db.prepare(`SELECT * FROM backends WHERE enabled = 1`).all() as unknown as Backend[];
  const byId = new Map(backends.map((b) => [b.id, b]));

  let lastError = "";
  for (const id of order) {
    const backend = byId.get(id);
    if (!backend || !isScrapeCapable(backend.type)) continue;
    const adapter = SCRAPE_ADAPTERS[backend.type]!;
    const result = await adapter(backend, req);
    if (result.success) {
      return { ...result, _backend: { id: backend.id, name: backend.name } };
    }
    lastError = result.error;
  }
  return { success: false, error: lastError || "No enabled scrape backends" };
}
