#!/usr/bin/env bash
set -euo pipefail

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
