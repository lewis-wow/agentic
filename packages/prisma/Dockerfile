# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS pruner
WORKDIR /app
RUN npm install -g turbo@^2
COPY . .
RUN turbo prune @repo/prisma --docker

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
# postinstall runs `prisma generate`, which needs the schema file present —
# out/json only has package.jsons, so copy the schema in too.
COPY --from=pruner /app/out/full/packages/prisma/prisma ./packages/prisma/prisma
# Install all deps (including devDependencies) — prisma CLI is a devDependency
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nodejs
COPY --from=installer --chown=nodejs:nodejs /app/node_modules ./node_modules
# pnpm (shamefully-hoist=false) puts the prisma CLI bin in the workspace
# package's own node_modules/.bin, not the root one — copy it too, or
# `prisma` resolves to nothing on PATH at runtime.
COPY --from=installer --chown=nodejs:nodejs /app/packages/prisma/node_modules ./packages/prisma/node_modules
COPY --from=pruner --chown=nodejs:nodejs /app/out/full/ .
ENV PATH="/app/packages/prisma/node_modules/.bin:/app/node_modules/.bin:$PATH"
WORKDIR /app/packages/prisma
USER nodejs
CMD ["prisma", "migrate", "deploy"]
