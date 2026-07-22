# CONTEXT.md

Precise definitions for this project's domain terms — a living glossary and domain model, kept in sync as the project evolves so AI coding agents and humans stay aligned on vocabulary and architectural rules. When a term is coined, renamed, or redefined, update its entry here in the same change. If a term already has a dedicated spec doc (e.g. [Environment API Keys](docs/specification/api-keys.md)), that doc is the source of truth and this file only links to it, so the definition never drifts out of sync in two places.

## Architecture

This platform is a self-hosted feature flag service: a dashboard for managing flags/environments/projects, an API that serves flag evaluations to SDKs, and a BFF that exchanges credentials (proxy-asserted user identity, or an environment API key) for short-lived JWTs.

This is a **Turborepo monorepo** with two workspace groups:

- `apps/*` — runnable services
- `packages/*` — shared internal tooling (not published)

### Data Flow — API is the Single Source of Truth

**`apps/api` is the only service that reads or writes data.** All reads and writes from every other layer go through `apps/api` via a credential-exchange layer. See [ADR-0010](docs/adr/0010-api-is-single-source-of-truth.md) for why.

Each layer has its own `AGENTS.md` with layer-specific rules. Read the relevant one before working in that layer.

**Within the `apps/api` / `packages/api` pair, the split is by framework dependency, not by "app vs package."** `packages/api` is framework-agnostic — schemas, exceptions, business-logic services, validation helpers, none of it importing Hono — and `apps/api` is Hono-only: routes, middleware, the server entrypoint. See [App-Scoped Packages](docs/specification/app-scoped-packages.md) and `packages/api/AGENTS.md`.

### Startup Logging

Every runnable app in `apps/*` must print the URL it's listening on to the console once it starts. For Hono services this means passing a `listeningListener` callback to `serve(...)` (see `apps/api/src/index.ts` and `apps/bff/src/index.ts`); frameworks that already print their own URL on startup (e.g. Next.js's `next dev`/`next start`) satisfy this automatically.

## Services & Layers

**API** (`apps/api`): The only service that reads or writes the database. Every other layer reaches data through it. See [ADR-0010](docs/adr/0010-api-is-single-source-of-truth.md).
_Avoid_: Backend (too generic — this repo has three backend-ish services; say "the API" specifically).

**BFF** (`apps/bff`): "Backend For Frontend" for SDK clients. Validates Environment API Keys, mints short-lived RS256 JWTs, and reverse-proxies to the API. Contains no business logic. SDKs never call the API directly — see [ADR-0001](docs/adr/0001-sdk-routes-through-bff.md).

**Dashboard** (`apps/dashboard`): The browser UI (Next.js). Never queries Prisma for business data and contains no business logic; all data flows through a Next.js catch-all route that forwards to the BFF, which forwards to the API.
_Avoid_: Frontend, client (ambiguous with SDK client — say "the dashboard").

**SDK**: The client libraries (`packages/sdk-node`, `packages/sdk-browser`, shared core in `packages/sdk-core`) that customer applications embed to evaluate flags. Authenticates with an Environment API Key against the BFF, not the API. See **Flag Snapshot** and **SDK client** below.

**SDK client**: A running instance of the SDK inside a customer's application — i.e. one connected consumer of the flag stream, as distinct from "the SDK" (the library/package itself).

## Identity & Access

**Trusted Proxy Authentication**: The platform's only auth mechanism — there is no built-in login, password, or session. An operator-supplied reverse proxy (Pomerium, or any other proxy that can present a signed JWT identity assertion) authenticates the user and asserts identity via a Proxy Identity JWT, which the platform cryptographically verifies rather than trusting blindly. See [ADR-0014](docs/adr/0014-trusted-proxy-authentication.md) (delegating auth to a proxy at all) and [ADR-0024](docs/adr/0024-jwt-verified-trusted-proxy-identity.md) (JWT verification, superseding 0014's shared-secret/plain-header mechanism). Proxies that can't present a signed JWT (plain oauth2-proxy/Authelia header-only setups) are not directly supported — an operator on one of those puts a JWT-issuing proxy in front instead.
_Avoid_: Login, auth system (implies the platform owns credential storage — it deliberately doesn't).

**Proxy Identity JWT**: The signed JWT the reverse proxy sets on a configurable header (e.g. Pomerium's `X-Pomerium-Jwt-Assertion`) asserting the authenticated user's identity. Verified via JWKS Verification before any claim in it is trusted. Replaces the old Trusted Proxy Secret + Identity Header pair — see [ADR-0024](docs/adr/0024-jwt-verified-trusted-proxy-identity.md).

**JWKS Verification**: How a Proxy Identity JWT is checked — signature against a key fetched from an operator-configured JWKS URL (via `jose`'s `createRemoteJWKSet`), `alg` restricted to an operator-configured allow-list, `iss`/`aud` matched against operator-configured expected values, `exp` not elapsed, and the email resolved at an operator-configured claim path. Any failure fails closed (401), with no fallback. Implemented only by `resolveTrustedProxyUser` in `packages/bff`. See [ADR-0024](docs/adr/0024-jwt-verified-trusted-proxy-identity.md).

**JWT claims**: The decoded payload of the RS256 JWTs the API's auth middleware accepts. Three variants, all part of the `AuthJwtClaims` union (`packages/auth`):

| Variant            | Issued when                                      | Carries                                                   |
| ------------------ | ------------------------------------------------ | --------------------------------------------------------- |
| `ProjectJwtClaims` | Dashboard user acting inside a project           | `userId`, `systemRole`, `projectId`, `projectRole`        |
| `SdkJwtClaims`     | SDK client authenticated via Environment API Key | `projectId`, `environmentId`, `projectRole: 'sdk-client'` |
| `MeJwtClaims`      | Dashboard user at a non-project-scoped endpoint  | `userId`, `systemRole`                                    |

**Role hierarchy**: Three distinct, non-interchangeable role sets — conflating them is a common source of bugs:

| Const             | Scope             | Values                                         | Used on              |
| ----------------- | ----------------- | ---------------------------------------------- | -------------------- |
| `SYSTEM_ROLE`     | Installation-wide | `OWNER` \| `MEMBER`                            | `User.role`          |
| `MEMBERSHIP_ROLE` | Project-level     | `admin` \| `viewer`                            | `ProjectMember.role` |
| `PROJECT_ROLE`    | JWT claim only    | `owner` \| `admin` \| `viewer` \| `sdk-client` | `projectRole` claim  |

Project access today is owner-only (system `OWNER` → `owner`, everyone else → `null`) — there is no per-project membership yet, despite `MEMBERSHIP_ROLE` existing. See `resolveProjectRole` in `packages/bff`.

**Environment API Key** / **Key Prefix**: See [Environment API Keys](docs/specification/api-keys.md).

## Domain Entities

Prisma models (`packages/prisma/prisma/schema.prisma`), single source of truth for shape:

**Project**: Top-level container for environments and flags. The unit installation owners create first (see setup wizard, [ADR-0022](docs/adr/0022-setup-does-not-auto-create-api-keys.md)).

**Environment**: A named deployment context within a project (e.g. `development`, `production`). Owns its own `ApiKey`s and, per flag, its own `FlagState`.

**Flag**: A feature flag's identity — `key` (immutable, see [ADR-0011](docs/adr/0011-flag-key-is-immutable.md)) and `name` (renamable label). Holds no environment-scoped data itself.
_Avoid_: Feature (too generic — always say "flag").

**FlagState**: A `Flag`'s configuration within one `Environment` — `status`, `type`, `rollout`, `rules`. This is where "is the flag on," "what type is it," and "what's its rollout %" actually live; a `Flag` alone has none of these. Created eagerly for every environment at flag-creation time ([ADR-0012](docs/adr/0012-eager-flagstate-initialization.md)). Also carries `eventId`, the durable SSE replay cursor ([ADR-0020](docs/adr/0020-durable-sse-replay-via-postgres.md)).

**FlagStatus**: `active | inactive | archived`, a `FlagState` field. "Archived" is a status value, not a separate flag-level boolean — see [ADR-0013](docs/adr/0013-archive-is-state-level.md).
_Avoid_: "The flag is archived" as a flag-level fact — archiving is per-environment; say "archived in `<environment>`" when precision matters.

**FlagType**: `boolean | percentage_rollout | targeted`, a `FlagState` field (not a `Flag` field — see [ADR-0007](docs/adr/0007-flag-type-per-environment.md)). The same flag can be a plain boolean in one environment and a percentage rollout in another.

**Targeting Rule**: One condition in a `targeted` flag's `rules` array. A rule set uses AND-only semantics — every rule must match, with no per-flag configurable operator ([ADR-0009](docs/adr/0009-targeting-rules-use-and-semantics.md)). OR semantics are expressed as separate flags, not a rule-set option.

**FlagDeletion**: A tombstone row recording that a flag key was deleted from a project — `projectId`, `key`, `id`. Exists solely so SSE reconnect replay can represent "this flag is gone," since a deleted `Flag` leaves no row to query. Never pruned. See [ADR-0020](docs/adr/0020-durable-sse-replay-via-postgres.md).

**AuditEvent**: An immutable log row (`action`, `meta`) for one action against one `Flag`, e.g. `flag.toggled`, `flag.rollout_updated`. `meta` denormalizes `environmentName` at write time rather than joining live, so renamed/deleted environments don't corrupt history — see [ADR-0019](docs/adr/0019-audit-meta-denormalizes-environment-name.md).

**ApiKey**: The persisted record backing an Environment API Key — `apiKeyId` + `apiKeyHash` (bcrypt), never the plaintext secret. See [Environment API Keys](docs/specification/api-keys.md).

**User**: A person, JIT-provisioned on first Trusted Proxy Authentication rather than signed up explicitly. Carries the installation-wide `SYSTEM_ROLE`.

## Flag Evaluation

**Flag Snapshot**: The full flag configuration for a project/environment — including rollout percentage and targeting rule contents — sent to an SDK client once (initial load + SSE stream), so evaluation can happen client-side with no per-check network hop. See [ADR-0005](docs/adr/0005-client-side-flag-evaluation.md).
_Avoid_: "Flag state" for this payload — that collides with the `FlagState` entity, which is the server-side per-environment row, not the wire snapshot.

**Bucketing**: The deterministic assignment of a `(flagKey, userId)` pair to a `[0, 99]` bucket for percentage-rollout evaluation, via SHA-256 of `` `${flagKey}/${userId}` ``. Unsalted and deterministic, so the same pair is always "sticky" to the same bucket. See [ADR-0006](docs/adr/0006-sha256-bucketing-hash.md).

**`isEnabled()`**: The SDK's evaluation entry point. `Promise<boolean>` on every SDK for API parity, even though Node's hashing could be synchronous — see [ADR-0018](docs/adr/0018-async-isenabled-for-sdk-parity.md).

## Contracts & Schemas

**Effect Schema**: The only validation mechanism for request/response shapes — never plain TypeScript types, manual guards, or Zod. See [Effect Schema for Requests and Responses](docs/specification/effect-schema.md).

**Main model vs. DTO** (`<name>.ts` vs `<name>.dto.ts`): A resource's canonical entity/wire shapes live in `<name>.ts`; a specific endpoint's request/response contract (bodies, params, query, envelopes) lives in `<name>.dto.ts`. See [Schema File Organization](docs/specification/schema-file-organization.md).

**`<Thing>FromPrisma`**: An Effect `Schema.transform` that decodes a raw Prisma row directly into its JSON wire shape (flattening relations, converting dates) in one step. See [Effect Schema for Requests and Responses](docs/specification/effect-schema.md).

**`Exception` vs. `HttpException`**: `Exception` is the HTTP-agnostic base (used by, e.g., the SDK, which never produces an HTTP response); `HttpException` adds `.toResponse()` and a status code for anything crossing an HTTP boundary. See [ADR-0002](docs/adr/0002-exception-http-exception-split.md) and [Error Handling](docs/specification/error-handling.md).
_Avoid_: Using "exception" and "error" interchangeably in code — every thrown error in an HTTP path must be a concrete `Exception`/`HttpException` subclass, never a plain `Error`.

## Events & Streaming

**SSE** (Server-Sent Events): The one-way push channel the API uses to notify connected SDK clients of flag changes in near-real-time.

**`flagEmitter`**: The in-process `EventEmitter` singleton (`packages/api`, `@repo/api/events`) that broadcasts flag changes to already-connected SSE clients. Deliberately not constructor-injected like a service — it has nothing to swap or inject. See [ADR-0003](docs/adr/0003-sse-broadcast-in-memory-emitter.md) and [ADR-0021](docs/adr/0021-flag-event-bus-lives-in-packages-api.md).

**`FlagEventService`**: The durable counterpart to `flagEmitter` — reads/writes the `eventId`-ordered replay log (`FlagState.eventId` + `FlagDeletion.id`, sharing one Postgres sequence) so a reconnecting SDK client can catch up on everything it missed via `Last-Event-ID`, with no eviction or bounded buffer. See [ADR-0020](docs/adr/0020-durable-sse-replay-via-postgres.md).
_Avoid_: Confusing this with `flagEmitter` — one is live broadcast to open connections, the other is durable history for reconnects. A change goes through both.
