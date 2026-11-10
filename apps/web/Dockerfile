# Teire web: the Next.js standalone server. Build context: repository root.
#   docker build -f apps/web/Dockerfile --build-arg TEIRE_PUBLIC_URL=https://… -t teire-web .
# Recipe: coolify skill (node-production) — build stage, small runtime stage, node as PID 1, non-root.

FROM node:24-slim AS build
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /repo
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
COPY packages/engine/package.json packages/engine/
RUN pnpm install --frozen-lockfile --filter @teire/web...
COPY tsconfig.base.json ./
COPY packages packages
# Curated providers and contributed change records (C13), imported by the engine.
COPY catalog catalog
COPY apps/web apps/web
# Static pages are rendered at build time, so their absolute links (Open Graph images, the config
# schema's $id) need the public address now. No secrets are needed to build.
ARG TEIRE_PUBLIC_URL=http://localhost:3000
ENV TEIRE_PUBLIC_URL=$TEIRE_PUBLIC_URL BETTER_AUTH_URL=$TEIRE_PUBLIC_URL NEXT_OUTPUT=standalone
RUN pnpm --filter @teire/web build

FROM node:24-slim AS runtime
# curl for the platform's HTTP health check (GET /live).
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD curl -fsS http://127.0.0.1:3000/live || exit 1
# The heap stays under the container limit (set in Coolify), with room for native memory.
CMD ["node", "--max-old-space-size=768", "apps/web/server.js"]
