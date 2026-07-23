#!/usr/bin/env bash
set -euo pipefail

PASS=0
FAIL=0
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }

build() {
  local tag=$1; shift
  if docker build -q -t "$tag" "$@" "$ROOT" > /dev/null 2>&1; then
    pass "build $tag"
  else
    fail "build $tag"
    echo "    (re-running with output for diagnosis)"
    docker build -t "$tag" "$@" "$ROOT" || true
  fi
}

echo ""
echo "=== BUILD TESTS ==="

build repo-api        -f apps/api/Dockerfile
build repo-migrator   -f packages/prisma/Dockerfile
build repo-dashboard  -f apps/dashboard/Dockerfile --build-arg NEXT_PUBLIC_APP_URL=http://localhost:3000
build repo-selfhosted -f Dockerfile.selfhosted --build-arg NEXT_PUBLIC_APP_URL=http://localhost:3000

echo ""
echo "=== COMPOSE TEST ==="

cd "$ROOT"
if docker compose up --wait --quiet-pull 2>&1 | tail -5; then
  pass "docker compose up --wait"

  if node -e "fetch('http://localhost:3001/').then(r => { process.exit(r.ok ? 0 : 1) }).catch(() => process.exit(1))" 2>/dev/null; then
    pass "api GET / → 200"
  else
    fail "api GET / → 200"
  fi

  docker compose down --volumes > /dev/null 2>&1
else
  fail "docker compose up --wait"
  docker compose down --volumes > /dev/null 2>&1 || true
fi

echo ""
echo "=== SELF-HOSTED COMPOSE TEST ==="

if docker compose -f docker-compose.selfhosted.yml up --wait --quiet-pull 2>&1 | tail -5; then
  pass "docker compose -f docker-compose.selfhosted.yml up --wait"

  if node -e "fetch('http://localhost:3002/health').then(r => { process.exit(r.ok ? 0 : 1) }).catch(() => process.exit(1))" 2>/dev/null; then
    pass "bff GET /health → 200"
  else
    fail "bff GET /health → 200"
  fi

  # dashboard enforces Trusted Proxy Authentication regardless of what's in
  # front of it, so a direct hit with no proxy-asserted identity is a 401,
  # not a 200 — that 401 IS the expected/correct response here.
  if node -e "fetch('http://localhost:3000/').then(r => { process.exit(r.status === 401 ? 0 : 1) }).catch(() => process.exit(1))" 2>/dev/null; then
    pass "dashboard GET / → 401 (unauthenticated, as expected)"
  else
    fail "dashboard GET / → 401 (unauthenticated, as expected)"
  fi

  docker compose -f docker-compose.selfhosted.yml down --volumes > /dev/null 2>&1
else
  fail "docker compose -f docker-compose.selfhosted.yml up --wait"
  docker compose -f docker-compose.selfhosted.yml down --volumes > /dev/null 2>&1 || true
fi

echo ""
echo "=== SELF-HOSTED FAIL-FAST TEST (ADR-0027) ==="

docker rm -f selfhosted-unreachable-db-test > /dev/null 2>&1 || true
exit_code=0
docker run --name selfhosted-unreachable-db-test \
  -e DATABASE_URL="postgresql://postgres:postgres@unreachable-host-for-smoke-test:5432/featureflags" \
  repo-selfhosted > /tmp/selfhosted-unreachable-db-test.log 2>&1 || exit_code=$?
docker rm selfhosted-unreachable-db-test > /dev/null 2>&1 || true

if [ "$exit_code" -ne 0 ]; then
  pass "unreachable DATABASE_URL → container exits non-zero"
else
  fail "unreachable DATABASE_URL → container exits non-zero"
  cat /tmp/selfhosted-unreachable-db-test.log
fi

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
