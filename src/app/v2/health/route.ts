// Firecrawl-compatible health endpoint: GET /v2/health
export async function GET() {
  return Response.json({ status: "ok" });
}
