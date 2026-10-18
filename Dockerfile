# Multi-arch (linux/arm64 for the NAS, linux/amd64 for CI); every base image is official and multi-arch.
FROM node:22-alpine AS build
RUN apk add --no-cache postgresql16 && corepack enable
ENV PATH=/usr/libexec/postgresql16:$PATH NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY . .
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
ARG HG_SHA=local
ENV HG_SHA=$HG_SHA
# data-flow.json is baked in: migrations run against a throwaway Postgres, then information_schema is read.
RUN sh core/bin/bake-data-flow.sh && pnpm build

FROM node:22-alpine
RUN corepack enable
WORKDIR /app
COPY --from=build --chown=node:node /app /app
ARG HG_SHA=local
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HG_SHA=$HG_SHA COREPACK_HOME=/app/.corepack
RUN pnpm --version >/dev/null && chown -R node:node /app/.corepack
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/health >/dev/null || exit 1
CMD ["pnpm", "start"]
