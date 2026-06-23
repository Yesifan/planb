ARG BUN_VERSION=1.3.11

FROM oven/bun:${BUN_VERSION}-alpine AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:${BUN_VERSION}-alpine AS build
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN PLANB_SETTINGS_PATH=planb.example.yml \
  HOST=http://localhost:3000 \
  BETTER_AUTH_SECRET=build-only-placeholder-secret-9f4d2a8c7e6b5a1d3c0f \
  GITHUB_CLIENT_ID=docker-build \
  GITHUB_CLIENT_SECRET=docker-build-placeholder \
  bun run build

FROM oven/bun:${BUN_VERSION}-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOST=http://localhost:3000
ENV DB_FILE_NAME=/app/data/planb.sqlite
ENV PLANB_SETTINGS_PATH=/app/planb.yml

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY --from=build --chown=nextjs:nodejs /app/.next ./.next
COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=build --chown=nextjs:nodejs /app/lib ./lib
COPY --from=build --chown=nextjs:nodejs /app/loader ./loader
COPY --from=build --chown=nextjs:nodejs /app/planb ./planb
COPY --from=build --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=build --chown=nextjs:nodejs /app/envConfig.ts ./envConfig.ts
COPY --from=build --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts
COPY --from=build --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json
COPY --from=build --chown=nextjs:nodejs /app/planb.example.yml ./planb.yml

RUN mkdir -p /app/data \
  && chown -R nextjs:nodejs /app/data

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/login || exit 1

CMD ["sh", "-c", "bun run db:migrate && exec bun --bun next start -p \"${PORT:-3000}\""]
