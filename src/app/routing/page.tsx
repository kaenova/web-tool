"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

interface BackendLite {
  id: number;
  type: string;
  name: string;
  enabled: number;
}

interface Route {
  endpoint: string;
  backend_order: number[];
  enabled: number;
}

const ENDPOINT_META: Record<string, { label: string; desc: string; method: string }> = {
  searxng_search: { label: "SearXNG-compatible search", desc: "GET /api/searxng/search?q=", method: "GET" },
  firecrawl_search: { label: "Firecrawl-compatible search", desc: "POST /v2/search", method: "POST" },
  firecrawl_scrape: { label: "Firecrawl-compatible scrape", desc: "POST /v2/scrape", method: "POST" },
};

const SEARCH_TYPES = ["searxng", "dgoog", "fourget", "whoogle", "firecrawl"];
const SCRAPE_TYPES = ["crawl4ai", "firecrawl"];

function capableTypes(endpoint: string): string[] {
  return endpoint === "firecrawl_scrape" ? SCRAPE_TYPES : SEARCH_TYPES;
}

export default function RoutingPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [backends, setBackends] = useState<BackendLite[]>([]);
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    fetch("/api/routes").then((r) => r.json()).then((d) => {
      setRoutes(d.routes ?? []);
      setBackends(d.backends ?? []);
    });
  }, []);

  useEffect(load, [load]);

  function capableBackends(endpoint: string): BackendLite[] {
    const types = capableTypes(endpoint);
    return backends.filter((b) => types.includes(b.type));
  }

  function orderedBackends(route: Route): Array<BackendLite | undefined> {
    return route.backend_order.map((id) => backends.find((b) => b.id === id));
  }

  async function toggleEndpoint(route: Route) {
    await fetch("/api/routes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: route.endpoint, enabled: !route.enabled }),
    });
    load();
  }

  function move(route: Route, index: number, dir: -1 | 1) {
    const order = [...route.backend_order];
    const target = index + dir;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    save(route.endpoint, order);
  }

  function addBackend(route: Route, id: number) {
    if (route.backend_order.includes(id)) return;
    save(route.endpoint, [...route.backend_order, id]);
  }

  function removeBackend(route: Route, id: number) {
    save(route.endpoint, route.backend_order.filter((x) => x !== id));
  }

  async function save(endpoint: string, order: number[]) {
    await fetch("/api/routes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint, backend_order: order }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    load();
  }

  return (
    <div className="space-y-4">
      {saved && <p className="text-sm text-green-500">Saved ✓</p>}
      {routes.map((route) => {
        const meta = ENDPOINT_META[route.endpoint];
        const available = capableBackends(route.endpoint).filter((b) => !route.backend_order.includes(b.id));
        return (
          <Card key={route.endpoint}>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-base">{meta.label}</CardTitle>
                <p className="text-sm text-muted-foreground font-mono">{meta.desc}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{route.enabled ? "enabled" : "disabled"}</span>
                <Switch checked={!!route.enabled} onCheckedChange={() => toggleEndpoint(route)} />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                {orderedBackends(route).map((b, i) => (
                  <div key={b?.id ?? i} className="flex items-center gap-2 rounded-md border p-2">
                    <span className="text-xs text-muted-foreground w-6">#{i + 1}</span>
                    <Badge variant="outline">{b?.type}</Badge>
                    <span className="font-medium">{b?.name ?? "unknown"}</span>
                    <div className="ml-auto flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => move(route, i, -1)} disabled={i === 0}>↑</Button>
                      <Button variant="ghost" size="sm" onClick={() => move(route, i, 1)} disabled={i === route.backend_order.length - 1}>↓</Button>
                      <Button variant="ghost" size="sm" onClick={() => b && removeBackend(route, b.id)}>✕</Button>
                    </div>
                  </div>
                ))}
                {route.backend_order.length === 0 && (
                  <p className="text-sm text-muted-foreground">No backends in chain — add one below.</p>
                )}
              </div>
              {available.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {available.map((b) => (
                    <Button key={b.id} variant="outline" size="sm" onClick={() => addBackend(route, b.id)}>
                      + {b.name} ({b.type})
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
