#!/usr/bin/env bash
# Boots a given self-hosted image (Dockerfile.selfhosted) against a real
# Postgres instance via docker-compose.selfhosted.yml, waits for it to report
# healthy, then tears everything down. Does not build the image itself —
# callers (local devs, or the release pipeline) pass in whatever tag they
# already built/pulled.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT/docker-compose.selfhosted.yml"
COMPOSE_IMAGE="repo-selfhosted"
IMAGE_REF="${1:-$COMPOSE_IMAGE}"
HEALTH_MAX_RETRIES=24
HEALTH_RETRY_INTERVAL_SECONDS=5

# A dedicated project name, distinct from whatever default (directory-derived)
# project name docker-compose.yml/docker-compose.dev.yml might already be
# running under in this same checkout — without this, `down --volumes` below
# would tear down containers from that unrelated stack too, since Compose
# matches containers to remove by project name, not by which file started
# them (both files declare a `postgres` service).
COMPOSE_PROJECT="agentic-selfhosted-smoketest"
compose() {
  docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" "$@"
}

cd "$ROOT"

cleanup() {
  compose down --volumes > /dev/null 2>&1 || true
}
trap cleanup EXIT

echo "=== SELF-HOSTED SMOKE TEST ($IMAGE_REF) ==="

if [ "$IMAGE_REF" != "$COMPOSE_IMAGE" ]; then
  docker tag "$IMAGE_REF" "$COMPOSE_IMAGE"
fi

compose up -d --quiet-pull

# Checked from inside the app container (not via the host-published port) so
# this works the same whether the caller's shell shares a network namespace
# with the Docker host or not (e.g. Docker Desktop's VM-backed engine).
# Polled with a bounded retry loop (mirroring
# docker/selfhosted-rootfs/etc/s6-overlay/scripts/migrate-wait.sh's
# pg_isready loop) rather than trusting docker compose's own --wait, since
# that would silently depend on the image having a HEALTHCHECK baked in.
retries=0
until compose exec -T app node -e "fetch('http://localhost:3002/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))" > /dev/null 2>&1; do
  retries=$((retries + 1))
  if [ "$retries" -ge "$HEALTH_MAX_RETRIES" ]; then
    echo "FAIL: $IMAGE_REF never reported healthy after ${HEALTH_MAX_RETRIES} attempts" >&2
    compose logs app >&2 || true
    exit 1
  fi
  echo "waiting for $IMAGE_REF to become healthy (attempt ${retries}/${HEALTH_MAX_RETRIES})..."
  sleep "$HEALTH_RETRY_INTERVAL_SECONDS"
done

echo "PASS: $IMAGE_REF is healthy (GET /health -> 200)"
