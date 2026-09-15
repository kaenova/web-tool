"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface LogRow {
  id: number;
  timestamp: string;
  endpoint: string;
  backend_name: string | null;
  status: number;
  latency_ms: number;
  req_body: string | null;
  res_body: string | null;
}

const PAGE_SIZE = 50;

export default function LogsPage() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [endpoint, setEndpoint] = useState("all");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<LogRow | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    if (endpoint !== "all") params.set("endpoint", endpoint);
    if (status !== "all") params.set("status", status);
    if (q) params.set("q", q);
    fetch(`/api/logs?${params}`).then((r) => r.json()).then((d) => {
      setLogs(d.logs ?? []);
      setTotal(d.total ?? 0);
    });
  }, [endpoint, status, q, offset]);

  useEffect(load, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={endpoint} onValueChange={(v) => { setEndpoint(v); setOffset(0); }}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All endpoints</SelectItem>
            <SelectItem value="searxng_search">searxng_search</SelectItem>
            <SelectItem value="firecrawl_search">firecrawl_search</SelectItem>
            <SelectItem value="firecrawl_scrape">firecrawl_scrape</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v); setOffset(0); }}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="200">200</SelectItem>
            <SelectItem value="400">400</SelectItem>
            <SelectItem value="502">502</SelectItem>
            <SelectItem value="504">504</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Search bodies…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOffset(0); }}
          className="w-64"
        />
        <span className="text-sm text-muted-foreground ml-auto">{total} total</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Request Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Backend</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Latency</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id} className="cursor-pointer" onClick={() => setDetail(l)}>
                  <TableCell className="text-xs whitespace-nowrap">{l.timestamp} UTC</TableCell>
                  <TableCell className="font-mono text-xs">{l.endpoint}</TableCell>
                  <TableCell>{l.backend_name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={l.status < 400 ? "default" : "destructive"}>{l.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{l.latency_ms}ms</TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">No logs.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="flex justify-between mt-4">
            <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset(offset + PAGE_SIZE)}>
              Next
            </Button>
          </div>
        </CardContent>
      </Card>

      {detail && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Log #{detail.id} — {detail.endpoint}</CardTitle>
            <button className="text-muted-foreground text-sm" onClick={() => setDetail(null)}>✕ close</button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-medium mb-1">Request</p>
              <pre className="text-xs bg-muted rounded p-3 overflow-auto max-h-48 whitespace-pre-wrap">{detail.req_body ?? "—"}</pre>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Response (truncated)</p>
              <pre className="text-xs bg-muted rounded p-3 overflow-auto max-h-48 whitespace-pre-wrap">{detail.res_body ?? "—"}</pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
