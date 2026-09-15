# web-tool

Unified web engine proxy — search & scrape with pluggable backends, all configured via web UI (SQLite-backed, no env vars for backends).

## Compat endpoints

| Endpoint | Shape | Description |
|---|---|---|
| `GET /api/searxng/search?q=&format=json` | SearXNG JSON | SearXNG-compatible search |
| `POST /v2/search` | Firecrawl v2 | `{query, limit, page}` → `{success, data:{web:[{url,title,description}]}}` |
| `POST /v2/scrape` | Firecrawl v2 | `{url, formats:[markdown,html,rawHtml]}` → `{success, data:{markdown, html, rawHtml, metadata}}` |

## Supported backends

- **Search**: SearXNG, dgoog, 4get, Whoogle, Firecrawl
- **Scrape**: Crawl4AI, Firecrawl

## Backends via UI, not env

Backends (type, name, base URL, API key, enabled), routing order per endpoint, and on/off
switches all live in SQLite and are managed from the web dashboard. Only env var:
`PORT` (default 3000) and `ACTIVITY_DB_PATH` (default `./data/webtool.db`).

## Pages

- `/` Dashboard — volume, error rate, latency, 24h chart, per-endpoint stats
- `/backends` — CRUD backends + live "Test connection" probe
- `/routing` — per-endpoint backend fallback chain (drag order via ↑/↓)
- `/logs` — request logs with filters + detail view

## Setup

```bash
bun install
bun run build
PORT=3000 bun run start
```

## Deploy (Coolify)

`webtool.coolify.kaenova.my.id` — mount a volume for `/app/data` so the SQLite DB survives redeploys.
