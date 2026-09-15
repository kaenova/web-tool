FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# DATABASE_URL dummy: build-time prerender never touches sqlite, but import is module-level safe
RUN bun run build

FROM oven/bun:1
WORKDIR /app

COPY --from=builder /app/package.json bun.lock ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./

RUN mkdir -p /app/data
ENV NODE_ENV=production
ENV PORT=3000
ENV ACTIVITY_DB_PATH=/app/data/webtool.db
EXPOSE 3000

CMD ["bun", "run", "start"]
