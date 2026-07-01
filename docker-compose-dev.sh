#!/usr/bin/env bash
set -euo pipefail

# Start only postgres, then run migrations locally.
# Run `pnpm dev` separately to start the app.

docker compose -f docker-compose.yml -f docker-compose.dev.yml up postgres --wait

echo "Running database migrations..."
cd packages/prisma && DATABASE_URL=postgresql://postgres:postgres@postgres:5432/featureflags pnpm db:migrate

echo ""
echo "External dependencies are ready. Run 'pnpm dev' to start the app."
