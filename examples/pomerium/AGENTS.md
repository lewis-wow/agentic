# AGENTS.md — examples/pomerium

## Purpose

Reference implementation of a real **Trusted Proxy Authentication** front-end
for this platform, using [Pomerium](https://www.pomerium.com) as the reverse
proxy. The platform never authenticates users itself — `apps/dashboard` and
`apps/bff` trust an Identity Header (`X-Forwarded-Email`) plus a shared
secret (`X-Trusted-Proxy-Secret`) asserted by whatever sits in front of them.
This example is the real thing; `pnpm dev:proxy`
(`scripts/dev-trusted-proxy.mjs`) is the local-dev stand-in that fakes the
same headers unconditionally.

Read `docs/adr/0014-trusted-proxy-authentication.md` and `apps/bff/AGENTS.md`
before changing anything here — this example exists to demonstrate that
design, not to introduce its own.

Login is backed by a mock OIDC provider
([`oidc-server-mock`](https://github.com/Soluto/oidc-server-mock)) with one
hardcoded test user, so the example runs with zero external accounts.

## Required Context Loading

This folder has no application source code (no TypeScript, no build step) —
it's Docker Compose + Pomerium config. `docs/standards/*.md` generally does not apply
here. What matters instead:

- `docs/adr/0014-trusted-proxy-authentication.md` — why this platform delegates
  authentication to a reverse proxy instead of building its own login.
- `apps/bff/AGENTS.md` — the Trusted Proxy Authentication contract this
  example implements (header names, secret comparison, JWT minting
  downstream).

## Layout

```text
examples/pomerium/
├── docker-compose.yml    # overlay: pomerium + mock-idp + env overrides
├── .env.example          # TRUSTED_PROXY_SECRET / TRUSTED_PROXY_OWNER_EMAIL
├── pomerium/config.yaml  # routes, OIDC settings, header injection
└── certs/generate-certs.sh
```

## How it fits together

```
Browser ──HTTPS──> Pomerium ──OIDC login──> mock-idp
                       │
                       │ injects X-Forwarded-Email + X-Trusted-Proxy-Secret
                       ▼
                   dashboard (guards.ts resolves identity locally)
                       │
                       │ forwards original request + headers, server-side
                       ▼
                     bff (mints RS256 JWT apps/api trusts)
                       │
                       ▼
                     api
```

`bff`/`api`/`postgres`/`migrator` are unmodified from the root
`docker-compose.yml` — only `dashboard`'s browser-facing traffic goes through
Pomerium. `apps/dashboard`'s catch-all route forwards to `apps/bff` directly
over the docker network, so Pomerium never fronts `bff` itself.

`pomerium/config.yaml` maps the OIDC `email` claim onto `X-Forwarded-Email`
via `jwt_claims_headers`, and adds a static `X-Trusted-Proxy-Secret` header
via `set_request_headers` on the `dashboard.localhost` route.

## Rules

- **This is an overlay, not a standalone stack.** It must always be run with
  `-f docker-compose.yml -f examples/pomerium/docker-compose.yml` from the
  repo root — the second file alone has no `dashboard`/`bff`/`postgres`
  service definitions. Relative volume paths in
  `examples/pomerium/docker-compose.yml` resolve against the repo root (the
  first `-f` file's directory), not this folder — keep that in mind if you
  add more mounts.
- **Secrets must stay in sync across three files by hand.**
  `TRUSTED_PROXY_SECRET` in `.env.example`, the `X-Trusted-Proxy-Secret`
  value in `pomerium/config.yaml`, and nothing else — `apps/bff`/
  `apps/dashboard` read it from the env var. `docker-compose.yml`'s
  `mock-idp` `CLIENTS_CONFIGURATION_INLINE` client id/secret must match
  `idp_client_id`/`idp_client_secret` in `pomerium/config.yaml`. Pomerium's
  `config.yaml` is **not** template-substituted — env var changes there do
  nothing. If you change one side, grep for the old value and update the
  other.
- **Secrets checked into this folder are demo-only, on purpose.** They exist
  so the stack boots with zero setup. Never reuse `shared_secret`,
  `cookie_secret`, or `TRUSTED_PROXY_SECRET` from this example anywhere real.
- **Only `dashboard.localhost` is routed through Pomerium.** Don't add a
  route for `bff` or `api` — the architecture intentionally keeps Pomerium
  in front of the dashboard only. `apps/dashboard`'s catch-all route forwards
  to `apps/bff` directly over the docker network (see "How it fits together"
  above), so `bff` never needs its own Pomerium route.
- **The root compose file still publishes `dashboard` on host port 3000**,
  bypassing Pomerium entirely. That's intentional for local convenience —
  the app enforces the same identity check regardless of what's in front of
  it, so hitting port 3000 directly just hits `apps/dashboard`'s
  `unauthorized()` boundary. Don't "fix" this by removing the port mapping;
  if it needs closing off, that's a production deployment concern, not this
  example's.
- **Swapping in a real IdP** only requires changing `idp_provider_url` /
  `idp_client_id` / `idp_client_secret` in `pomerium/config.yaml` and
  dropping the `mock-idp` service — nothing else in the flow changes.
- **TLS is always terminated by Pomerium**, never disabled, even locally —
  `certs/generate-certs.sh` generates a throwaway self-signed cert for
  exactly this reason. A real deployment would use Pomerium's `autocert`
  (Let's Encrypt) instead of that script.

## Common tasks

- **Regenerating the local TLS cert** (e.g. it expired — 365-day validity):
  `./certs/generate-certs.sh`.
- **Adding a second test user to the mock IdP:** extend
  `USERS_CONFIGURATION_INLINE` in `docker-compose.yml`'s `mock-idp` service;
  no changes needed elsewhere unless the new user should be the owner
  (that's controlled by `TRUSTED_PROXY_OWNER_EMAIL` in `.env`, compared
  against the `email` claim).
- **Debugging a login that doesn't inject headers:** check
  `jwt_claims_headers` and the route's `set_request_headers` in
  `pomerium/config.yaml` first — a missing/renamed claim mapping is the most
  common cause, not an `apps/bff`/`apps/dashboard` bug.
