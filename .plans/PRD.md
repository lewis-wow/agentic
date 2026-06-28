# PRD — Self-Hosted Feature Flag Platform

**Date:** 2026-06-28  
**Status:** Draft

---

## 1. Overview

A self-hosted feature flag platform for small-to-mid engineering teams (5–50 developers) who want GrowthBook/Unleash-style flagging without sending data to a third-party SaaS. The entire platform ships as a single `docker-compose` stack — no Kubernetes, no cloud-provider dependency.

---

## 2. Goals

- Teams can create, target, and roll out feature flags without touching code deploys.
- Zero third-party data egress — all flag config and user data stays on the operator's infrastructure.
- Setup time under 5 minutes: `docker compose up` and go.
- SDKs evaluate flags locally (no per-check network hop); real-time updates via SSE.

---

## 3. Non-Goals (v1)

- OAuth / SSO / SAML authentication.
- A/B testing or multivariate (n-variant) flags.
- Webhook or Slack notifications on flag changes.
- Helm charts or bare-metal install guides.
- Per-flag analytics or impression tracking.

---

## 4. Domain Model (Ubiquitous Language)

| Term               | Definition                                                                                                                                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Installation**   | One running instance of the platform (one `docker compose` stack). Shared by all teams using it.                                                                                    |
| **Project**        | A named workspace inside an installation (e.g. "Mobile App", "Web"). Flags and environments belong to a project.                                                                    |
| **Environment**    | A named deployment stage within a project (e.g. `development`, `staging`, `production`). Every flag exists independently in each environment. Each environment has one SDK API key. |
| **Flag**           | A named feature toggle scoped to a project. Its state and rules differ per environment.                                                                                             |
| **Flag Status**    | One of `active` (evaluated normally), `inactive` (always returns `false`), or `archived` (hidden, not evaluated, retained for history).                                             |
| **Flag Type**      | One of: `boolean`, `percentage_rollout`, or `targeted`.                                                                                                                             |
| **Targeting Rule** | A single condition: `attribute` + `operator` + `value`. Rules are evaluated top-to-bottom; first match enables the flag.                                                            |
| **Rollout**        | A percentage (0–100) used with deterministic hashing (`hash(flagKey + userId) % 100`) to produce sticky per-user bucketing.                                                         |
| **SDK API Key**    | A secret token scoped to one environment. Used by SDKs to authenticate against `apps/api`.                                                                                          |
| **Audit Event**    | An append-only record of who changed a flag and how (created, enabled, disabled, rule_added, archived, etc.).                                                                       |
| **Member**         | A user account inside the installation, with role `owner`, `admin`, or `viewer`.                                                                                                    |

---

## 5. Flag Types

### 5.1 Boolean

Always returns `true` or `false` for all users. No targeting or rollout logic.

### 5.2 Percentage Rollout

Returns `true` for a configured percentage of users. Uses deterministic hashing:

```
bucket = hash(flagKey + userId) % 100
enabled = bucket < rolloutPercentage
```

Same user always gets the same result (sticky). No server-side user state required.

### 5.3 Targeted

Evaluates an ordered list of `TargetingRule` objects (see Section 12 for the full type definition).

Supported operators: `EQ`, `NEQ`, `IN`, `NOT_IN`, `CONTAINS`.

Rules evaluated top-to-bottom; first match returns `true`. If no rule matches, falls back to `inactive` (returns `false`).

---

## 6. Architecture

### 6.1 Monorepo Structure

```
apps/
  dashboard/        # Next.js (App Router) admin UI — shadcn/ui components
  api/              # Hono — SDK-facing: flag config fetch + SSE stream
  bff/              # Hono — existing BFF (kept, extended as needed)
packages/
  prisma/           # Prisma schema, client, and migrations (shared)
  sdk-node/         # Node.js SDK
  sdk-browser/      # Browser JS SDK
  typescript-config/
  eslint-config/
  vitest-config/
```

### 6.2 Docker Compose Stack

```
services:
  dashboard     # Next.js app (port 3000)
  api           # Hono SDK API (port 3001)
  bff           # Hono BFF (port 3002)
  postgres      # PostgreSQL 16
```

All services share one Postgres instance. No external dependencies.

### 6.3 Data Flow

```
Dashboard (Next.js)
  └─ server actions / route handlers ──► packages/prisma ──► PostgreSQL
                                              │
                                        on mutation
                                              │
                                              ▼
API (Hono)  ◄── SSE connection ────  sdk-node / sdk-browser
  └─ GET /v1/flags/:envKey        # full config snapshot (initial + polling fallback)
  └─ GET /v1/flags/:envKey/stream # SSE — pushes delta events on flag changes
```

---

## 7. SDK Design

### 7.1 Initialization

```ts
const client = createClient({
  apiUrl: 'https://your-instance.example.com',
  apiKey: 'env_sk_...',
});
await client.connect(); // fetches full config, opens SSE stream
```

### 7.2 Flag Evaluation (client-side)

All evaluation happens locally inside the SDK against the cached config snapshot. No network hop per flag check.

```ts
client.isEnabled('new-checkout'); // boolean flag
client.isEnabled('new-checkout', { userId }); // with context for rollout/targeting
```

### 7.3 Real-time Updates

On SSE connect: server sends a full `snapshot` event with all flags.  
On any flag change: server pushes a `flag_updated` or `flag_deleted` event.  
SDK applies the delta to its local cache. Reconnects automatically on drop.

### 7.4 Offline Resilience

SDK uses last-known-good cache. If SSE drops, it retries with exponential backoff. Evaluation continues uninterrupted from cache.

---

## 8. Admin Dashboard

### 8.1 Authentication

Powered by **better-auth** (email + password). On first boot, a setup wizard creates the **owner** account.

Roles:
| Role | Capabilities |
|---|---|
| `owner` | Everything, including deleting the installation's projects |
| `admin` | Create/edit/delete flags, manage members, manage environments |
| `viewer` | Read-only access to flags and audit log |

Member invite flow: admin enters email → invite link sent → recipient sets password.

### 8.2 Key Screens

| Screen                 | Description                                                                |
| ---------------------- | -------------------------------------------------------------------------- |
| Projects list          | All projects in the installation                                           |
| Project → Environments | Manage environments, reveal/rotate API keys                                |
| Flags list             | All flags in the current project + environment; status badge; quick toggle |
| Flag detail            | Edit flag type, rules, rollout percentage; view audit log timeline         |
| Members                | Invite, role-change, remove members                                        |
| Setup wizard           | First-boot: create owner account, create first project                     |

---

## 9. Data Model (Prisma)

```prisma
model Project {
  id           String        @id @default(cuid())
  name         String
  environments Environment[]
  flags        Flag[]
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
}

model Environment {
  id         String      @id @default(cuid())
  name       String
  apiKey     String      @unique @default(cuid())
  projectId  String
  project    Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  flagStates FlagState[]
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt
}

model Flag {
  id        String       @id @default(cuid())
  key       String
  name      String
  projectId String
  project   Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  states    FlagState[]
  auditLog  AuditEvent[]
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  @@unique([projectId, key])
}

model FlagState {
  id            String      @id @default(cuid())
  flagId        String
  environmentId String
  flag          Flag        @relation(fields: [flagId], references: [id], onDelete: Cascade)
  environment   Environment @relation(fields: [environmentId], references: [id], onDelete: Cascade)
  status        FlagStatus  @default(inactive)
  type          FlagType    @default(boolean)
  rollout       Int         @default(0)   // 0–100, used when type=percentage_rollout
  rules         Json        @default("[]") // TargetingRule[]
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  @@unique([flagId, environmentId])
}

model AuditEvent {
  id        String   @id @default(cuid())
  flagId    String
  flag      Flag     @relation(fields: [flagId], references: [id], onDelete: Cascade)
  userId    String
  action    String   // e.g. "flag_enabled", "rule_added", "status_archived"
  meta      Json     @default("{}")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum FlagStatus {
  active
  inactive
  archived
}

enum FlagType {
  boolean
  percentage_rollout
  targeted
}
```

---

## 10. API Endpoints (`apps/api`)

| Method | Path               | Auth                 | Description                                                                         |
| ------ | ------------------ | -------------------- | ----------------------------------------------------------------------------------- |
| `GET`  | `/v1/flags`        | SDK API key (header) | Returns full flag config snapshot for the environment                               |
| `GET`  | `/v1/flags/stream` | SDK API key (header) | SSE stream; sends `snapshot` on connect, `flag_updated` / `flag_deleted` on changes |

### SSE Event Shape

```ts
// snapshot — sent once on connect
{ type: 'snapshot', flags: FlagConfig[] }

// delta — sent on any flag change
{ type: 'flag_updated', flag: FlagConfig }
{ type: 'flag_deleted', flagKey: string }
```

---

## 11. Audit Log

Every mutation to a flag or its state appends an `AuditEvent`. Actions tracked:

- `flag_created`
- `flag_enabled` / `flag_disabled`
- `flag_archived`
- `rule_added` / `rule_removed` / `rule_reordered`
- `rollout_changed`
- `type_changed`

Displayed in the flag detail view as a chronological timeline. No external log sink in v1.

---

## 12. Targeting Rule Specification

```ts
const OPERATOR = {
  EQ: 'EQ',
  NEQ: 'NEQ',
  IN: 'IN',
  NOT_IN: 'NOT_IN',
  CONTAINS: 'CONTAINS',
} as const;

type Operator = ValueOfEnum<typeof OPERATOR>;

type TargetingRule = {
  attribute: string; // e.g. "plan", "email", "country"
  operator: Operator;
  value: string | string[];
};
```

Evaluation pseudo-code (runs inside SDK, not server):

```ts
for (const rule of flag.rules) {
  const actual = context[rule.attribute]
  if (matches(actual, rule.operator, rule.value)) return true
}
return false
```

---

## 13. Environment Variables

### `apps/dashboard`

```
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=...
NEXT_PUBLIC_API_URL=http://api:3001
```

### `apps/api`

```
DATABASE_URL=postgresql://...
```

---

## 14. Implementation Slices

Vertical tracer-bullet slices in dependency order. Each slice is independently demoable end-to-end.

### Slice 1 — Monorepo scaffold & Prisma baseline

**Blocked by:** None

- Create `packages/prisma` with Prisma schema (all models from Section 9), client export, and initial migration
- Scaffold `apps/api` (Hono + `@hono/node-server`) with Effect Schema env validation matching `apps/bff` pattern
- Rename / reconfigure `apps/web` → `apps/dashboard`
- Update `turbo.json`, `pnpm-workspace.yaml`, `docker-compose.yml` to include all new apps/packages
- All CI checks pass (`format:check`, `lint`, `check-types`, `test`)

### Slice 2 — Auth: setup wizard + email/password login

**Blocked by:** Slice 1

- Wire **better-auth** (email + password) into `apps/dashboard`
- First-boot setup wizard: create `owner` account + first project if no users exist
- Login / logout flow
- Role middleware (`owner` / `admin` / `viewer`) guards all dashboard routes

### Slice 3 — Project & Environment CRUD

**Blocked by:** Slices 1, 2

- Projects list + create / delete (dashboard)
- Environments list + create / delete + reveal / rotate API key (dashboard)
- Server actions → `packages/prisma` → PostgreSQL

### Slice 4 — Boolean flag CRUD + audit events

**Blocked by:** Slice 3

- Flags list per project + environment (status badge, quick active↔inactive toggle)
- Create / rename / archive / delete a flag (`boolean` type)
- Flag detail screen (basic)
- Every mutation appends an `AuditEvent` row

### Slice 5 — SDK API: flag config snapshot

**Blocked by:** Slice 4

- `GET /v1/flags` in `apps/api` authenticated via `X-API-Key` header (environment SDK key)
- Returns full `FlagConfig[]` snapshot for the environment
- 401 on missing / invalid key

### Slice 6 — Node.js SDK: boolean flag evaluation

**Blocked by:** Slice 5

- `packages/sdk-node`: `createClient()`, `connect()` (fetches snapshot), `isEnabled(key)` for boolean flags
- Unit tests covering evaluation logic

### Slice 7 — SSE stream + real-time SDK updates

**Blocked by:** Slice 6

- `GET /v1/flags/stream` in `apps/api` (SSE); sends full `snapshot` event on connect
- Dashboard flag mutations push `flag_updated` / `flag_deleted` events to open SSE connections
- SDK applies delta to local cache; reconnects with exponential backoff on drop

### Slice 8 — Percentage rollout flag type

**Blocked by:** Slice 6

- Dashboard: rollout % editor on flag detail
- SDK: deterministic hash evaluation — `hash(flagKey + userId) % 100 < rollout`
- Unit tests for sticky bucketing (same user always lands in the same bucket)

### Slice 9 — Targeted flag type + rule builder

**Blocked by:** Slice 6

- Dashboard: rule builder UI (attribute / operator / value rows, drag-to-reorder, delete)
- SDK: rule evaluation engine (`EQ`, `NEQ`, `IN`, `NOT_IN`, `CONTAINS`)
- Unit tests per operator

### Slice 10 — Audit log timeline (dashboard)

**Blocked by:** Slice 4

- Flag detail view renders a chronological `AuditEvent` timeline (actor, action, timestamp, meta diff)
- Can run in parallel with Slices 7–9

### Slice 11 — Browser SDK

**Blocked by:** Slice 7

- `packages/sdk-browser`: same `createClient` / `connect` / `isEnabled` API as `sdk-node`
- Uses `EventSource` for SSE instead of Node's `http` module
- Works in all modern browsers; tree-shakeable ESM bundle

### Slice 12 — Docker Compose production stack

**Blocked by:** Slice 7

- Production `docker-compose.yml`: `dashboard`, `api`, `bff`, `postgres` services
- Dockerfiles for `apps/dashboard` and `apps/api`
- DB migrations run automatically on container start
- `docker compose up` brings the full stack live in < 5 minutes

---

## 15. Out of Scope (v2 Candidates)

- SSO / SAML / OAuth login
- Multivariate / A/B flags
- Flag scheduling (enable at time T)
- Webhook / Slack / email notifications on flag changes
- Per-flag impression analytics
- RBAC beyond three roles
- Multiple installations / multi-tenancy at the org level
- Members invite flow
