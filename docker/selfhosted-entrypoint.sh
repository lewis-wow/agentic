#!/usr/bin/env bash
set -euo pipefail

# ADR-0026: migration is a hard precondition, run synchronously before any app
# process starts. Retrying the migrate command itself (rather than a separate
# raw DB-reachability probe) covers both "Postgres isn't up yet" (cold start)
# and "migration genuinely failed" with one mechanism — bounded so a broken
# DATABASE_URL or a broken migration fails loudly instead of hanging forever.
migrate_max_retries=20
migrate_retry_interval_seconds=2

retries=0
until (cd /app/migrate/packages/prisma && prisma migrate deploy); do
  retries=$((retries + 1))
  if [ "$retries" -ge "$migrate_max_retries" ]; then
    echo "entrypoint: prisma migrate deploy did not succeed after ${migrate_max_retries} attempts — giving up" >&2
    exit 1
  fi
  echo "entrypoint: migrate deploy failed (attempt ${retries}/${migrate_max_retries}), retrying in ${migrate_retry_interval_seconds}s..." >&2
  sleep "$migrate_retry_interval_seconds"
done

declare -a child_pids=()

terminate() {
  for pid in "${child_pids[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
}
trap terminate TERM INT

(
  cd /app/api
  export DOTENV_PRIVATE_KEY="${DOTENV_PRIVATE_KEY_API:-}"
  export API_PORT="${API_PORT:-3001}"
  exec dotenvx run --env-file=.env.production -- node dist/index.js
) &
child_pids+=("$!")

(
  cd /app/bff
  export DOTENV_PRIVATE_KEY="${DOTENV_PRIVATE_KEY_BFF:-}"
  export BFF_PORT="${BFF_PORT:-3002}"
  export API_URL="${API_URL:-http://localhost:3001}"
  exec dotenvx run --env-file=.env.production -- node dist/index.js
) &
child_pids+=("$!")

(
  cd /app/dashboard/apps/dashboard
  export DOTENV_PRIVATE_KEY="${DOTENV_PRIVATE_KEY_DASHBOARD:-}"
  export BFF_URL="${BFF_URL:-http://localhost:3002}"
  export HOSTNAME=0.0.0.0
  exec dotenvx run --env-file=.env.production -- node server.js
) &
child_pids+=("$!")

set +e
wait -n "${child_pids[@]}"
exit_code=$?
set -e

terminate
wait
exit "$exit_code"
