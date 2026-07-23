#!/usr/bin/env bash
set -euo pipefail

# ADR-0027: migration is a hard precondition, run synchronously before any app
# process starts. Wait for Postgres to be reachable first, then attempt
# `prisma migrate deploy` exactly once — keeping "Postgres isn't up yet"
# (cold start) and "migration genuinely failed" as distinguishable log output,
# each bounded so a broken DATABASE_URL or a broken migration fails loudly
# instead of hanging forever.
pg_wait_max_retries=20
pg_wait_retry_interval_seconds=2

retries=0
until pg_isready -d "$DATABASE_URL" > /dev/null 2>&1; do
  retries=$((retries + 1))
  if [ "$retries" -ge "$pg_wait_max_retries" ]; then
    echo "entrypoint: Postgres not reachable after ${pg_wait_max_retries} attempts — giving up" >&2
    exit 1
  fi
  echo "entrypoint: Postgres not reachable yet (attempt ${retries}/${pg_wait_max_retries}), retrying in ${pg_wait_retry_interval_seconds}s..." >&2
  sleep "$pg_wait_retry_interval_seconds"
done

if ! (cd /app/migrate/packages/prisma && prisma migrate deploy); then
  echo "entrypoint: prisma migrate deploy failed — giving up" >&2
  exit 1
fi

declare -a child_pids=()

terminate() {
  for pid in "${child_pids[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
}
trap terminate TERM INT

# spawn_child <dir> <dotenv-private-key> [EXTRA_ENV=value ...] -- <command...>
# Each app gets its own subshell so its DOTENV_PRIVATE_KEY and port/URL
# overrides never leak into the other two (they'd otherwise collide, since
# dotenvx looks for one literally-named DOTENV_PRIVATE_KEY env var).
spawn_child() {
  local dir="$1" dotenv_key="$2"
  shift 2
  local -a env_assignments=()
  while [ "$1" != "--" ]; do
    env_assignments+=("$1")
    shift
  done
  shift
  (
    cd "$dir"
    export DOTENV_PRIVATE_KEY="$dotenv_key"
    for assignment in "${env_assignments[@]}"; do
      export "$assignment"
    done
    exec dotenvx run --env-file=.env.production -- "$@"
  ) &
  child_pids+=("$!")
}

spawn_child /app/api "${DOTENV_PRIVATE_KEY_API:-}" \
  "API_PORT=${API_PORT:-3001}" \
  -- node dist/index.js

spawn_child /app/bff "${DOTENV_PRIVATE_KEY_BFF:-}" \
  "BFF_PORT=${BFF_PORT:-3002}" "API_URL=${API_URL:-http://localhost:3001}" \
  -- node dist/index.js

spawn_child /app/dashboard/apps/dashboard "${DOTENV_PRIVATE_KEY_DASHBOARD:-}" \
  "BFF_URL=${BFF_URL:-http://localhost:3002}" "HOSTNAME=0.0.0.0" \
  -- node server.js

set +e
wait -n "${child_pids[@]}"
exit_code=$?
set -e

terminate
wait
exit "$exit_code"
