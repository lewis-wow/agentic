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
RUN pnpm install --frozen-lockfile

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
COPY --from=builder --chown=nodejs:nodejs /app/apps/dashboard/.next/standalone ./
COPY --from=builder --chown=nodejs:nodejs /app/apps/dashboard/.next/static ./.next/static
COPY --from=builder --chown=nodejs:nodejs /app/apps/dashboard/public ./public
COPY --from=builder --chown=nodejs:nodejs /app/apps/dashboard/.env.production ./.env.production
USER nodejs
CMD ["dotenvx", "run", "--env-file=.env.production", "--", "node", "server.js"]
