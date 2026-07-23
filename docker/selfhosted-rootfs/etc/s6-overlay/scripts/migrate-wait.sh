#!/command/with-contenv sh
set -e

pg_wait_max_retries=20
pg_wait_retry_interval_seconds=2

retries=0
until pg_isready -d "$DATABASE_URL" > /dev/null 2>&1; do
  retries=$((retries + 1))
  if [ "$retries" -ge "$pg_wait_max_retries" ]; then
    echo "migrate: Postgres not reachable after ${pg_wait_max_retries} attempts — giving up" >&2
    exit 1
  fi
  echo "migrate: Postgres not reachable yet (attempt ${retries}/${pg_wait_max_retries}), retrying in ${pg_wait_retry_interval_seconds}s..." >&2
  sleep "$pg_wait_retry_interval_seconds"
done

cd /app/migrate/packages/prisma
exec s6-setuidgid nodejs prisma migrate deploy
