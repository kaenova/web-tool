"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Stats {
  total: number;
  success: number;
  errorRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  perEndpoint: Array<{ endpoint: string; count: number; ok: number; avg_latency: number }>;
  perBackend: Array<{ backend_name: string; count: number; ok: number }>;
  timeSeries: Array<{ bucket: string; count: number; errors: number }>;
  backends: Array<{ id: number; type: string; name: string; enabled: number; base_url: string }>;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats").then((r) => r.json()).then(setStats).catch(() => {});
  }, []);

  if (!stats) return <p className="text-muted-foreground">Loading…</p>;

  const cards = [
    { title: "Total Requests", value: stats.total },
    { title: "Error Rate", value: `${stats.errorRate.toFixed(1)}%` },
    { title: "Avg Latency", value: `${stats.avgLatencyMs} ms` },
    { title: "P95 Latency", value: `${stats.p95LatencyMs} ms` },
  ];

  const maxCount = Math.max(1, ...stats.timeSeries.map((t) => t.count));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Requests (24h, hourly)</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.timeSeries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <div className="flex h-28 items-end gap-1">
                {stats.timeSeries.map((t) => (
                  <div key={t.bucket} className="flex-1 flex flex-col justify-end gap-0.5 group relative">
                    <div className="bg-primary/80 rounded-t min-h-[2px]" style={{ height: `${(t.count / maxCount) * 100}%` }} />
                    <div className="absolute bottom-full mb-1 hidden group-hover:block bg-popover text-popover-foreground text-xs rounded p-1 whitespace-nowrap z-10">
                      {t.bucket}: {t.count} req, {t.errors} err
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Per Endpoint</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Endpoint</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="text-right">OK</TableHead>
                  <TableHead className="text-right">Avg</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.perEndpoint.map((e) => (
                  <TableRow key={e.endpoint}>
                    <TableCell className="font-mono text-xs">{e.endpoint}</TableCell>
                    <TableCell className="text-right">{e.count}</TableCell>
                    <TableCell className="text-right">{e.ok}</TableCell>
                    <TableCell className="text-right">{Math.round(e.avg_latency)}ms</TableCell>
                  </TableRow>
                ))}
                {stats.perEndpoint.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">No requests yet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Backends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {stats.backends.map((b) => (
              <Badge key={b.id} variant={b.enabled ? "default" : "outline"}>
                {b.name} · {b.type}
              </Badge>
            ))}
            {stats.backends.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No backends configured — add one under Backends.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
