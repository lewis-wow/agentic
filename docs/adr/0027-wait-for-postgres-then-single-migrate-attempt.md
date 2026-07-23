# The combined image's entrypoint waits for Postgres readiness, then attempts `prisma migrate deploy` once

> **Superseded by [ADR-0028](0028-s6-overlay-supervises-the-combined-image.md)** for _where_ this logic lives: the bash entrypoint was replaced by an s6-overlay oneshot service, which runs the same `pg_isready`-then-single-migrate-attempt logic verbatim (now in `docker/selfhosted-rootfs/etc/s6-overlay/scripts/migrate-wait.sh`). The decision described below — wait for readiness, then attempt migration exactly once — is unchanged.

Supersedes [ADR-0026](0026-combined-image-runs-migrations-in-its-own-entrypoint.md)'s retry mechanism. The entrypoint still runs migration synchronously before spawning `api`/`bff`/`dashboard` and still exits non-zero without starting any app process if migration doesn't succeed — only _how_ it waits out a cold-starting Postgres changes.

Previously the entrypoint retried `prisma migrate deploy` itself in a bounded loop, deliberately conflating "Postgres isn't reachable yet" with "the migration itself is broken" into one mechanism. In practice that conflation makes the failure logs ambiguous: a broken `DATABASE_URL` and a slow-starting Postgres both show up as N identical "migrate deploy failed, retrying" lines, and there's no way to tell which one is happening from the log alone until the loop finally gives up.

The entrypoint now polls `pg_isready -d "$DATABASE_URL"` in a bounded loop first, then runs `prisma migrate deploy` exactly once. This separates the two failure shapes in the logs — "Postgres isn't reachable" and "migration failed" produce visibly different output — at the cost of one extra tool (`postgresql-client`, for `pg_isready`) in the runner image. `pg_isready` accepts a full connection string via `-d`, so it reads `DATABASE_URL` the same way `prisma` does; no separate host/port parsing is needed.

This exception still applies only to the combined image. The regular multi-container `docker-compose.yml` is unchanged and still uses the dedicated `migrator` container ([ADR-0016](0016-dedicated-migrator-container.md)).
