# Example: Pomerium as the reverse proxy

This platform doesn't have its own login page. Instead, it trusts a reverse
proxy sitting in front of it to log the user in and tell it who they are.
This example wires up [Pomerium](https://www.pomerium.com) to do that job for
real — including an actual login screen — using a mock identity provider so
you don't need a real Google/Okta account to try it.

It's an add-on to the repo's normal `docker-compose.yml`, not a separate
project. It adds two services (Pomerium itself, and the mock login provider)
in front of the `dashboard` app you already have.

## Run it

1. From the repo root, make sure the normal stack works first (`pnpm dev` /
   `docker compose up` with your usual `.env` files in place).

2. Set up this example's config and a local HTTPS certificate:

   ```bash
   cp examples/pomerium/.env.example examples/pomerium/.env
   ./examples/pomerium/certs/generate-certs.sh
   ```

3. Make sure these hostnames point to your machine. Most computers already
   resolve `*.localhost` automatically — if yours doesn't, add this line to
   `/etc/hosts`:

   ```
   127.0.0.1 dashboard.localhost authenticate.localhost idp.localhost
   ```

4. Start everything:

   ```bash
   docker compose -f docker-compose.yml -f examples/pomerium/docker-compose.yml \
     --env-file examples/pomerium/.env up --build
   ```

5. Open **https://dashboard.localhost**. Your browser will warn you the
   certificate isn't trusted — that's expected for a self-signed local cert,
   click through it.

6. You'll land on a login form. Use the test account:

   - Username: `owner`
   - Password: `password`

   That's it — you're logged in as the installation's owner, and you'll see
   the first-time setup wizard.

> Heads up: `http://localhost:3000` (the dashboard's normal port) is still
> reachable directly, bypassing Pomerium entirely. Visiting it without going
> through the proxy just shows an "unauthorized" page — the app doesn't trust
> you unless the identity headers are present. In a real deployment you'd
> block that port from the outside so Pomerium is the only way in.

## What's in this folder

```
examples/pomerium/
├── docker-compose.yml    # adds Pomerium + mock login provider
├── Dockerfile            # bakes config.yaml + cert into the Pomerium image
├── .env.example          # shared secret + owner email
├── pomerium/config.yaml  # Pomerium's routing & login settings
└── certs/generate-certs.sh
```

> Config and certs are baked into the Pomerium image at build time (see
> `Dockerfile`) rather than bind-mounted from the host, so Docker Desktop's
> file-sharing allowlist never comes into play. Re-run `docker compose ...
up --build` after editing `pomerium/config.yaml` or regenerating certs so
> the image picks up the change.

## Using this with a real login provider

Swap out the mock provider for a real one (Google, Okta, etc.) by editing
`idp_provider_url` / `idp_client_id` / `idp_client_secret` in
`pomerium/config.yaml`, then remove the `mock-idp` service from
`docker-compose.yml`. Everything else about how the app trusts Pomerium stays
the same.

For a production deployment you'd also want a real TLS certificate (Pomerium
can fetch one automatically via Let's Encrypt) and freshly generated secrets
— see the comments in `pomerium/config.yaml` for which ones are demo-only
placeholders.
