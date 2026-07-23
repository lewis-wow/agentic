# AGENTS.md — examples/ghcr-selfhosted

## Purpose

Demonstrates the `docker pull`-and-run path the release pipeline
(`.github/workflows/release-selfhosted-image.yml`, ADR-0029) exists to
enable: pulling the published Self-Hosted Release Image
(`ghcr.io/lewis-wow/agentic-selfhosted`) from GHCR and running it against a
plain Postgres container, with zero local build step. This is the
GHCR-image counterpart to the repo root's `docker-compose.selfhosted.yml`,
which builds `Dockerfile.selfhosted` locally instead — read `README.md` in
this folder before changing anything here.

## Required Context Loading

This folder has no application source code (no TypeScript, no build step) —
it's a single Docker Compose file referencing a prebuilt image.
`docs/standards/*.md` does not apply here. What matters instead:

- `docs/adr/0025-combined-image-for-self-hosted-deployment.md` and
  `docs/adr/0028-s6-overlay-supervises-the-combined-image.md` — what's
  packaged inside the image this example runs.
- `docs/adr/0029-selfhosted-image-published-to-ghcr-on-tagged-releases.md` —
  why a prebuilt image exists at all, and why `NEXT_PUBLIC_APP_URL` ships
  unset.

## Rules

- **This is a standalone stack, not an overlay.** Unlike `examples/pomerium`
  (which extends the root `docker-compose.yml` with `-f`), this folder's
  `docker-compose.yml` is self-sufficient — run it directly from within this
  directory. It pulls a released image rather than building any app from
  source, so it has no dependency on the rest of the repo at run time.
- **Never add a `build:` key to the `app` service.** The entire point of
  this example is exercising the published image as a self-hoster would
  receive it. If source-level testing of `Dockerfile.selfhosted` is needed,
  that's the root `docker-compose.selfhosted.yml` / `scripts/smoke-test-selfhosted.sh`'s
  job, not this folder's.
- **Keep the pinned tag in `docker-compose.yml` in sync with the "Which
  image tag" section of `README.md`.** Both currently say `v0.0.2`. Bumping
  one without the other leaves the README's explanation
  (link to the release run it was validated against) pointing at a tag the
  compose file no longer uses.
- **`NEXT_PUBLIC_APP_URL` cannot be configured here.** It's baked into the
  dashboard's client bundle at image build time (ADR-0017), and the
  published image ships with it unset. Don't add a build arg for it to this
  compose file — there's no `build:` step for it to apply to. Point anyone
  needing a custom value at the root `docker-compose.selfhosted.yml` instead.
- **No reverse proxy or auth front-end in this example, on purpose.** It
  exists to prove the image runs, not to demonstrate Trusted Proxy
  Authentication — that's `examples/pomerium`'s job.
