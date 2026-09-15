import { getDb, type Backend } from "./db";

export interface SearchRequest {
  query: string;
  page?: number;
  limit?: number;
  language?: string;
  time_range?: string;
  includeDomains?: string[];
  excludeDomains?: string[];
}

export interface WebResult {
  url: string;
  title: string;
  description: string;
  category?: string;
}

export interface SearchSuccess {
  success: true;
  data: { web: WebResult[] };
}

export interface SearchError {
  success: false;
  error: string;
}

export type SearchResponse = SearchSuccess | SearchError;

function applyDomainFilters(query: string, req: SearchRequest): string {
  let q = query;
  if (req.includeDomains?.length) {
    q += " " + req.includeDomains.map((d) => `site:${d}`).join(" OR ");
  }
  if (req.excludeDomains?.length) {
    q += " " + req.excludeDomains.map((d) => `-site:${d}`).join(" ");
  }
  return q;
}

/* ---------------- SearXNG ---------------- */

interface SearxngResult {
  url?: string;
  title?: string;
  content?: string;
  category?: string;
}

export async function searchSearxng(backend: Backend, req: SearchRequest): Promise<SearchResponse> {
  const params = new URLSearchParams({
    format: "json",
    q: applyDomainFilters(req.query, req),
    pageno: String(req.page ?? 1),
  });
  if (req.language) params.set("language", req.language);
  if (req.time_range) params.set("time_range", req.time_range);

  try {
    const res = await fetch(`${backend.base_url.replace(/\/$/, "")}/search?${params}`);
    if (!res.ok) return { success: false, error: `SearXNG HTTP ${res.status}` };
    const raw = (await res.json()) as { results?: SearxngResult[] };
    const results = (raw.results ?? []).slice(0, req.limit);
    return {
      success: true,
      data: {
        web: results.map((r) => ({
          url: r.url ?? "",
          title: r.title ?? "",
          description: r.content ?? "",
          category: r.category,
        })),
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "SearXNG failed" };
  }
}

/* ---------------- dgoog ---------------- */

interface DgoogResult {
  title?: string;
  url?: string;
  snippet?: string;
}

export async function searchDgoog(backend: Backend, req: SearchRequest): Promise<SearchResponse> {
  const url = new URL("/api/search", backend.base_url);
  url.searchParams.set("q", req.query);
  try {
    const res = await fetch(url);
    if (!res.ok) return { success: false, error: `dgoog HTTP ${res.status}` };
    const raw = (await res.json()) as { results?: DgoogResult[] };
    const results = (raw.results ?? []).slice(0, req.limit);
    return {
      success: true,
      data: {
        web: results.map((r) => ({
          url: r.url ?? "",
          title: r.title ?? "",
          description: r.snippet ?? "",
        })),
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "dgoog failed" };
  }
}

/* ---------------- 4get ---------------- */

interface FourgetResult {
  title?: string;
  description?: string;
  url?: string;
}

export async function searchFourget(backend: Backend, req: SearchRequest): Promise<SearchResponse> {
  const url = new URL("/api/v1/web", backend.base_url);
  url.searchParams.set("s", req.query);
  try {
    const res = await fetch(url);
    if (!res.ok) return { success: false, error: `4get HTTP ${res.status}` };
    const raw = (await res.json()) as { status?: string; web?: FourgetResult[] };
    if (raw.status && raw.status !== "ok") {
      return { success: false, error: `4get error: ${raw.status}` };
    }
    const results = (raw.web ?? []).slice(0, req.limit);
    return {
      success: true,
      data: {
        web: results.map((r) => ({
          url: r.url ?? "",
          title: r.title ?? "",
          description: r.description ?? "",
        })),
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "4get failed" };
  }
}

/* ---------------- Whoogle ---------------- */

interface WhoogleResult {
  href?: string;
  text?: string;
  title?: string;
}

export async function searchWhoogle(backend: Backend, req: SearchRequest): Promise<SearchResponse> {
  const url = new URL("/search", backend.base_url);
  url.searchParams.set("q", req.query);
  url.searchParams.set("format", "json");
  try {
    const res = await fetch(url, { redirect: "manual" });
    if (!res.ok && res.status !== 303) {
      return { success: false, error: `Whoogle HTTP ${res.status}` };
    }
    const raw = (await res.json().catch(() => ({}))) as {
      results?: WhoogleResult[];
      blocked?: boolean;
      error_message?: string;
      redirect?: string;
    };
    if (raw.redirect) {
      return { success: false, error: "Whoogle returned a redirect" };
    }
    if (raw.blocked) {
      return { success: false, error: raw.error_message || "Whoogle blocked (CAPTCHA)" };
    }
    const results = (raw.results ?? []).slice(0, req.limit);
    return {
      success: true,
      data: {
        web: results.map((r) => ({
          url: r.href ?? "",
          title: r.title ?? r.text?.split("\n")[0] ?? "",
          description: r.text ?? "",
        })),
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Whoogle failed" };
  }
}

/* ---------------- Firecrawl (search) ---------------- */

export async function searchFirecrawl(backend: Backend, req: SearchRequest): Promise<SearchResponse> {
  try {
    const res = await fetch(`${backend.base_url.replace(/\/$/, "")}/v2/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(backend.api_key ? { Authorization: `Bearer ${backend.api_key}` } : {}),
      },
      body: JSON.stringify({ query: req.query, limit: req.limit, page: req.page }),
    });
    if (!res.ok) return { success: false, error: `Firecrawl HTTP ${res.status}` };
    const raw = (await res.json()) as SearchResponse;
    return raw;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Firecrawl failed" };
  }
}

/* ---------------- Routing ---------------- */

const SEARCH_ADAPTERS: Record<string, (b: Backend, r: SearchRequest) => Promise<SearchResponse>> = {
  searxng: searchSearxng,
  dgoog: searchDgoog,
  fourget: searchFourget,
  whoogle: searchWhoogle,
  firecrawl: searchFirecrawl,
};

export function isSearchCapable(type: string): boolean {
  return type in SEARCH_ADAPTERS;
}

export async function routeSearch(endpoint: string, req: SearchRequest): Promise<SearchResponse & { _backend?: { id: number; name: string } }> {
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

  const backends = db
    .prepare(`SELECT * FROM backends WHERE enabled = 1`)
    .all() as unknown as Backend[];
  const byId = new Map(backends.map((b) => [b.id, b]));

  let lastError = "";
  for (const id of order) {
    const backend = byId.get(id);
    if (!backend || !isSearchCapable(backend.type)) continue;
    const adapter = SEARCH_ADAPTERS[backend.type]!;
    const result = await adapter(backend, req);
    if (result.success) {
      return { ...result, _backend: { id: backend.id, name: backend.name } };
    }
    lastError = result.error;
  }
  return { success: false, error: lastError || "No enabled search backends" };
}
