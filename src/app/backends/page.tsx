"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Backend {
  id: number;
  type: string;
  name: string;
  base_url: string;
  api_key: string | null;
  enabled: number;
}

const TYPES = [
  { value: "searxng", label: "SearXNG (search)" },
  { value: "dgoog", label: "dgoog (search)" },
  { value: "fourget", label: "4get (search)" },
  { value: "whoogle", label: "Whoogle (search)" },
  { value: "firecrawl", label: "Firecrawl (search+scrape)" },
  { value: "crawl4ai", label: "Crawl4AI (scrape)" },
];

export default function BackendsPage() {
  const [backends, setBackends] = useState<Backend[]>([]);
  const [type, setType] = useState("searxng");
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [testing, setTesting] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<Record<number, string>>({});

  const load = useCallback(() => {
    fetch("/api/backends").then((r) => r.json()).then((d) => setBackends(d.backends ?? []));
  }, []);

  useEffect(load, [load]);

  async function add() {
    const res = await fetch("/api/backends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, name, base_url: baseUrl, api_key: apiKey || null }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "failed");
      return;
    }
    setName("");
    setBaseUrl("");
    setApiKey("");
    load();
  }

  async function toggle(b: Backend) {
    await fetch(`/api/backends/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !b.enabled }),
    });
    load();
  }

  async function remove(b: Backend) {
    if (!confirm(`Delete backend "${b.name}"? It will be removed from all routes.`)) return;
    await fetch(`/api/backends/${b.id}`, { method: "DELETE" });
    load();
  }

  async function test(b: Backend) {
    setTesting(b.id);
    setTestResult((prev) => ({ ...prev, [b.id]: "testing…" }));
    try {
      const res = await fetch(`/api/backends/${b.id}/test`, { method: "POST" });
      const data = await res.json();
      setTestResult((prev) => ({
        ...prev,
        [b.id]: data.ok ? `✓ ${data.detail} (${data.latency_ms}ms)` : `✗ ${data.detail}`,
      }));
    } catch {
      setTestResult((prev) => ({ ...prev, [b.id]: "✗ request failed" }));
    }
    setTesting(null);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add Backend</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-searxng" />
          </div>
          <div className="space-y-1.5">
            <Label>Base URL</Label>
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://search.example.com" />
          </div>
          <div className="space-y-1.5">
            <Label>API Key (optional)</Label>
            <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} type="password" placeholder="bearer token" />
          </div>
          <Button onClick={add} disabled={!name || !baseUrl}>Add</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configured Backends</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Base URL</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead>Test</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {backends.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell><Badge variant="outline">{b.type}</Badge></TableCell>
                  <TableCell className="font-mono text-xs max-w-48 truncate">{b.base_url}</TableCell>
                  <TableCell>
                    <Switch checked={!!b.enabled} onCheckedChange={() => toggle(b)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => test(b)} disabled={testing === b.id}>
                        {testing === b.id ? "…" : "Test"}
                      </Button>
                      <span className="text-xs">{testResult[b.id]}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="destructive" size="sm" onClick={() => remove(b)}>Delete</Button>
                  </TableCell>
                </TableRow>
              ))}
              {backends.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">No backends yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
