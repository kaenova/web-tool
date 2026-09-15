"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Line, LineChart, Area, AreaChart } from "recharts";
import { Activity, AlertTriangle, Clock, Gauge } from "lucide-react";

interface Stats {
  total: number;
  success: number;
  errorRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  perEndpoint: Array<{ endpoint: string; count: number; ok: number; avg_latency: number }>;
  perBackend: Array<{ backend_name: string; count: number; ok: number; avg_latency: number }>;
  timeSeries: Array<{ bucket: string; count: number; errors: number }>;
  statusCodes: Array<{ code: string; count: number }>;
  latencyBuckets: Array<{ bucket: string; count: number }>;
  dailySeries: Array<{ bucket: string; count: number; errors: number; avg_latency: number }>;
  endpointHourly: Array<{ bucket: string; endpoint: string; count: number }>;
  topErrors: Array<{ status: number; count: number; last_seen: string }>;
  backends: Array<{ id: number; type: string; name: string; enabled: number; base_url: string }>;
}

const ENDPOINT_COLORS: Record<string, string> = {
  firecrawl_search: "var(--chart-1)",
  firecrawl_scrape: "var(--chart-2)",
  searxng_search: "var(--chart-3)",
};

function shortBucket(b: string) {
  // "2026-09-15 09:00:00" → "09:00"; date-only passes through
  const m = b?.match(/(\d{2}:\d{2}):\d{2}$/);
  return m ? m[1] : b;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const load = () => fetch("/api/stats").then((r) => r.json()).then(setStats).catch(() => {});
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  if (!stats) return <p className="text-muted-foreground">Loading…</p>;

  const cards = [
    { title: "Total Requests", value: stats.total, icon: Activity },
    { title: "Error Rate", value: `${stats.errorRate.toFixed(1)}%`, icon: AlertTriangle },
    { title: "Avg Latency", value: `${stats.avgLatencyMs} ms`, icon: Clock },
    { title: "P95 Latency", value: `${stats.p95LatencyMs} ms`, icon: Gauge },
  ];

  const hourlyConfig = {} as ChartConfig;
  const endpointNames = [...new Set(stats.endpointHourly.map((e) => e.endpoint))];
  for (const ep of endpointNames) {
    hourlyConfig[ep] = { label: ep, color: ENDPOINT_COLORS[ep] ?? "var(--chart-4)" };
  }

  const hourlyData = Object.values(
    stats.endpointHourly.reduce<Record<string, Record<string, unknown>>>((acc, row) => {
      const key = row.bucket;
      acc[key] ??= { bucket: shortBucket(row.bucket) };
      acc[key][row.endpoint] = row.count;
      return acc;
    }, {})
  );

  const statusConfig: ChartConfig = {
    count: { label: "Requests" },
  };

  const dailyConfig: ChartConfig = {
    count: { label: "Requests", color: "var(--chart-1)" },
    errors: { label: "Errors", color: "var(--chart-5)" },
  };

  const maxStatus = Math.max(1, ...stats.statusCodes.map((s) => s.count));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">auto-refresh 10s</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.title}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <c.icon className="h-4 w-4" />
                {c.title}
              </CardTitle>
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
            <CardTitle>Requests per Hour (24h)</CardTitle>
            <CardDescription>stacked by endpoint</CardDescription>
          </CardHeader>
          <CardContent>
            {hourlyData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <ChartContainer config={hourlyConfig} className="h-56 w-full">
                <BarChart data={hourlyData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="bucket" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
                  <YAxis tickLine={false} axisLine={false} width={30} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  {endpointNames.map((ep) => (
                    <Bar key={ep} dataKey={ep} stackId="a" fill={ENDPOINT_COLORS[ep] ?? "var(--chart-4)"} radius={[2, 2, 0, 0]} />
                  ))}
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daily Volume (14d)</CardTitle>
            <CardDescription>requests vs errors</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.dailySeries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <ChartContainer config={dailyConfig} className="h-56 w-full">
                <LineChart data={stats.dailySeries.map((d) => ({ ...d, bucket: d.bucket.slice(5) }))}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="bucket" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} width={30} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line dataKey="count" stroke="var(--color-count)" strokeWidth={2} dot={false} />
                  <Line dataKey="errors" stroke="var(--color-errors)" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status Code Distribution</CardTitle>
            <CardDescription>all time</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.statusCodes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <ChartContainer config={statusConfig} className="h-48 w-full">
                <BarChart data={stats.statusCodes} layout="vertical">
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis dataKey="code" type="category" tickLine={false} axisLine={false} width={44} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {stats.statusCodes.map((s) => (
                      <defs key={s.code}>
                        <linearGradient id={`grad-${s.code}`} x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor={s.code === "2xx" || s.code === "3xx" ? "var(--chart-1)" : "var(--chart-5)"} stopOpacity={0.9} />
                          <stop offset="100%" stopColor={s.code === "2xx" || s.code === "3xx" ? "var(--chart-1)" : "var(--chart-5)"} stopOpacity={0.55} />
                        </linearGradient>
                      </defs>
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latency Distribution</CardTitle>
            <CardDescription>requests per bucket</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.latencyBuckets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <ChartContainer config={statusConfig} className="h-48 w-full">
                <AreaChart data={stats.latencyBuckets}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="bucket" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} width={30} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area dataKey="count" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.25} />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
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

        <Card>
          <CardHeader>
            <CardTitle>Per Backend</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Backend</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="text-right">OK</TableHead>
                  <TableHead className="text-right">Avg</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.perBackend.map((b) => (
                  <TableRow key={b.backend_name}>
                    <TableCell className="font-mono text-xs">{b.backend_name}</TableCell>
                    <TableCell className="text-right">{b.count}</TableCell>
                    <TableCell className="text-right">{b.ok}</TableCell>
                    <TableCell className="text-right">{Math.round(b.avg_latency)}ms</TableCell>
                  </TableRow>
                ))}
                {stats.perBackend.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">No routed requests yet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {stats.topErrors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Top Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats.topErrors.map((e) => (
                <Badge key={e.status} variant="destructive">
                  {e.status} × {e.count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Backends</CardTitle>
          <Link href="/backends" className="text-sm text-muted-foreground hover:text-foreground">manage →</Link>
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
                No backends configured — add one under <Link href="/backends" className="underline">Backends</Link>.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
