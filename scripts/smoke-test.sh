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
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
