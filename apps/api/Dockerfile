FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS pruner
WORKDIR /app
RUN npm install -g turbo@^2
COPY . .
RUN turbo prune @repo/api-server --docker

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

FROM installer AS builder
COPY --from=pruner /app/out/full/ .
RUN pnpm turbo build --filter=@repo/api-server
RUN pnpm --filter=@repo/api-server deploy --prod --legacy /standalone

FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nodejs
RUN npm install -g @dotenvx/dotenvx --quiet
COPY --from=builder --chown=nodejs:nodejs /standalone .
# dist/ is gitignored so pnpm deploy may skip it — copy explicitly
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/dist ./dist
USER nodejs
CMD ["dotenvx", "run", "--env-file=.env.production", "--", "node", "dist/index.js"]
