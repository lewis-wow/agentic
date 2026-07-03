# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS pruner
WORKDIR /app
RUN npm install -g turbo@^2
COPY . .
RUN turbo prune @repo/dashboard --docker

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
# packages/prisma's postinstall runs `prisma generate`, which needs the schema
# file present — out/json only has package.jsons, so copy the schema in too.
COPY --from=pruner /app/out/full/packages/prisma/prisma ./packages/prisma/prisma
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM installer AS builder
COPY --from=pruner /app/out/full/ .
# NEXT_PUBLIC_* vars are baked into the client bundle at build time — dotenvx at startup is too late
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
RUN SKIP_ENV_VALIDATION=true pnpm turbo build --filter=@repo/dashboard

FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nodejs
RUN npm install -g @dotenvx/dotenvx --quiet
# In a monorepo, Next's standalone output nests the server entrypoint at
# apps/dashboard/server.js (mirroring the workspace layout) instead of at the
# standalone root — copy the whole tree as-is rather than flattening it.
COPY --from=builder --chown=nodejs:nodejs /app/apps/dashboard/.next/standalone ./
COPY --from=builder --chown=nodejs:nodejs /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=builder --chown=nodejs:nodejs /app/apps/dashboard/public ./apps/dashboard/public
COPY --from=builder --chown=nodejs:nodejs /app/apps/dashboard/.env.production ./apps/dashboard/.env.production
USER nodejs
WORKDIR /app/apps/dashboard
# Next's standalone server.js binds to process.env.HOSTNAME, and Docker
# auto-injects HOSTNAME=<container-id> — without this override the server
# only listens on the container's bridge IP, unreachable via the published port.
ENV HOSTNAME=0.0.0.0
CMD ["dotenvx", "run", "--env-file=.env.production", "--", "node", "server.js"]
