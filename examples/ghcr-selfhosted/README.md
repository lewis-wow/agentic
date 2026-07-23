# GHCR self-hosted quickstart

Runs the published [Self-Hosted Release Image](../../CONTEXT.md) —
`ghcr.io/lewis-wow/agentic-selfhosted` — straight from GitHub Container
Registry, no clone or Docker build required. This is a `docker pull`-and-run
alternative to the repo root's `docker-compose.selfhosted.yml`, which instead
builds `Dockerfile.selfhosted` locally.

## Run it

```bash
cd examples/ghcr-selfhosted
docker compose up
```

Postgres comes up first, then `app` pulls (if not already cached), runs
`prisma migrate deploy`, and starts `apps/api`, `apps/bff`, and
`apps/dashboard` under s6-overlay (see
[ADR-0025](../../docs/adr/0025-combined-image-for-self-hosted-deployment.md) and
[ADR-0028](../../docs/adr/0028-s6-overlay-supervises-the-combined-image.md)).

- Dashboard: http://localhost:3000
- Health check (bff): http://localhost:3002/health

Tear down with `docker compose down` (add `-v` to also drop the Postgres
volume).

## Which image tag

This compose file pins `v0.0.2`, the exact version published by the
[release pipeline](../../.github/workflows/release-selfhosted-image.yml) at
the time this example was written
([run 30034780182](https://github.com/lewis-wow/agentic/actions/runs/30034780182/job/89300638555)).
Swap the tag in `docker-compose.yml` for a newer `vX.Y.Z` release, or use the
floating `latest` tag to always pull the newest release — see
[ADR-0029](../../docs/adr/0029-selfhosted-image-published-to-ghcr-on-tagged-releases.md)
for what "latest" means here (a floating tag re-pushed on every release, not
a rolling build).

## Configuration

The image ships with `NEXT_PUBLIC_APP_URL` unset (same-origin/relative
behavior) — per
[ADR-0017](../../docs/adr/0017-next-public-app-url-is-a-build-arg.md) and
[ADR-0029](../../docs/adr/0029-selfhosted-image-published-to-ghcr-on-tagged-releases.md),
that value is baked into the dashboard's client bundle at `next build` time,
so it can't be changed at container-run time. If you need a different
`NEXT_PUBLIC_APP_URL`, build `Dockerfile.selfhosted` yourself instead of
pulling this image (see the root `docker-compose.selfhosted.yml`).

`DOTENV_PRIVATE_KEY_API` / `_BFF` / `_DASHBOARD` (see `.env.example`) only
matter if you've replaced the image's checked-in `apps/*/.env.production`
files with your own dotenvx-encrypted versions and rebuilt on top of this
image — the versions this image ships with are unencrypted, so the stack
runs with none of them set.

## Not included here

This is a bare quickstart with no reverse proxy or authentication in front of
it — `apps/dashboard` and `apps/bff` trust Trusted Proxy Authentication
headers unconditionally with nothing supplying them, so nothing enforces
identity. See `examples/pomerium` for a real Trusted Proxy Authentication
front-end; that example builds the apps from source rather than pulling this
image, since it needs to run alongside a reverse proxy overlay.
