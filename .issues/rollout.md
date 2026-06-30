# Slice 8 — Percentage Rollout Flag Type

## Design decisions

These decisions were finalised in the grilling session before these issues were written. Do not re-litigate them; refer to the ADRs if you want to understand the trade-offs.

| Decision                                           | Value                                                                                                                                                             |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Evaluation location                                | Client-side in the SDK — see [ADR-0001](docs/adr/0001-client-side-flag-evaluation.md)                                                                             |
| Hash algorithm                                     | `crypto.createHash('sha256')` over `flagKey + "/" + userId`, first 4 bytes as big-endian uint32, `% 100` — see [ADR-0002](docs/adr/0002-sha256-bucketing-hash.md) |
| `FLAG_TYPE` definition                             | `as const` object in `packages/api/src/schemas/flags.ts`, following `.docs/typescript.md` enum rules                                                              |
| `FlagConfig` shape                                 | Always-present fields: `{ key, enabled, type, rollout }`. `enabled` = `status === active` for all types.                                                          |
| Type granularity                                   | Per-environment on `FlagState` — see [ADR-0003](docs/adr/0003-flag-type-per-environment.md)                                                                       |
| `isEnabled()` when `userId` absent on rollout flag | Return `false` — safe default, consistent with `?? false` for unknown keys                                                                                        |
| Rollout value on type switch to `boolean`          | Preserved in DB; SDK ignores `rollout` when `type = boolean`                                                                                                      |
| API endpoint for type/rollout                      | Extend existing `PATCH /:flagId/environments/:environmentId` to accept `type` and `rollout`                                                                       |
| SSE `flag_updated` payload                         | Extended from `{ key, enabled }` to `{ key, enabled, type, rollout }`                                                                                             |
| Audit log action                                   | Single `flag.rollout_updated` with meta `{ environmentId, type, rollout }`                                                                                        |
| Rollout validation                                 | Integer 0–100 inclusive                                                                                                                                           |
| Dashboard type selector scope                      | `boolean` and `percentage_rollout` only — `targeted` hidden until its own slice                                                                                   |

## Updated event taxonomy

The `flag_updated` SSE event payload is extended in this slice. All other event shapes from Slice 7 are unchanged.

| SSE `event:` field | Trigger                                      | Payload shape                                                                          |
| ------------------ | -------------------------------------------- | -------------------------------------------------------------------------------------- |
| `snapshot`         | connect or stale reconnect                   | `{ flags: Array<{ key: string; enabled: boolean; type: FlagType; rollout: number }> }` |
| `flag_created`     | `POST /projects/:projectId/flags`            | `{ key: string; enabled: boolean; type: FlagType; rollout: number }`                   |
| `flag_updated`     | `PATCH /:flagId/environments/:environmentId` | `{ key: string; enabled: boolean; type: FlagType; rollout: number }` ← **extended**    |
| `flag_archived`    | `POST /:flagId/archive`                      | `{ key: string }`                                                                      |
| `flag_unarchived`  | `POST /:flagId/unarchive`                    | `{ key: string; enabled: boolean; type: FlagType; rollout: number }`                   |
| `flag_deleted`     | `DELETE /:flagId`                            | `{ key: string }`                                                                      |

## Schema additions (`packages/api`)

Add to `packages/api/src/schemas/flags.ts`:

```ts
export const FLAG_TYPE = {
  BOOLEAN: 'boolean',
  PERCENTAGE_ROLLOUT: 'percentage_rollout',
} as const;

export type FlagType = ValueOfEnum<typeof FLAG_TYPE>;

// Replace the existing FlagConfigSchema
export const FlagConfigSchema = Schema.Struct({
  key: Schema.String,
  enabled: Schema.Boolean,
  type: Schema.Literal(FLAG_TYPE.BOOLEAN, FLAG_TYPE.PERCENTAGE_ROLLOUT),
  rollout: Schema.Number,
});

export type FlagConfig = Schema.Schema.Type<typeof FlagConfigSchema>;
```

Update `FlagUpdatedEventSchema` and `FlagCreatedEventSchema` / `FlagUnarchivedEventSchema` in the same file to carry `type` and `rollout`:

```ts
export const FlagUpdatedEventSchema = Schema.Struct({
  key: Schema.String,
  enabled: Schema.Boolean,
  type: Schema.Literal(FLAG_TYPE.BOOLEAN, FLAG_TYPE.PERCENTAGE_ROLLOUT),
  rollout: Schema.Number,
});
export type FlagUpdatedEvent = Schema.Schema.Type<
  typeof FlagUpdatedEventSchema
>;
```

Export `FLAG_TYPE` and `FlagType` from `packages/api/src/index.ts`.

---

## Issue 1 — Extend snapshot contract + SDK storage

### What to build

Extend the flag configuration contract end-to-end so that `type` and `rollout` flow from the database through the API snapshot and SSE events into the SDK's in-memory store. No evaluation logic changes in this issue — `isEnabled()` continues to return the boolean `enabled` value directly.

**`packages/api` schema changes** (`src/schemas/flags.ts`):

- Add `FLAG_TYPE` as-const object (`BOOLEAN: 'boolean'`, `PERCENTAGE_ROLLOUT: 'percentage_rollout'`) and derive `FlagType` with `ValueOfEnum`.
- Extend `FlagConfigSchema` to always include `type` and `rollout` alongside `key` and `enabled`.
- Extend `FlagUpdatedEventSchema`, `FlagCreatedEventSchema`, and `FlagUnarchivedEventSchema` to carry `type` and `rollout`.
- Export `FLAG_TYPE` and `FlagType` from the barrel.

**`apps/api` snapshot route** (`src/routes/sdk.ts`):

- Update both `GET /v1/flags` and the `snapshot` SSE frame in `GET /v1/flags/stream` to select `type` and `rollout` from `FlagState` and include them in every `FlagConfig` entry.
- Update `emitFlagEvent` calls for `flag_updated`, `flag_created`, and `flag_unarchived` to include `type` and `rollout` in the payload (read them from the `FlagState` row already fetched in those handlers).

**`packages/sdk-node` storage** (`src/SdkClient.ts`):

- Change the internal cache from `Map<string, boolean>` to `Map<string, { enabled: boolean; type: FlagType; rollout: number }>`.
- `isEnabled()` continues to return `this.flags.get(key)?.enabled ?? false` — no hash evaluation yet.

### Acceptance criteria

- [ ] `GET /v1/flags` response includes `type` and `rollout` on every flag entry
- [ ] `snapshot` SSE event payload includes `type` and `rollout` on every flag entry
- [ ] `flag_updated`, `flag_created`, and `flag_unarchived` SSE event payloads include `type` and `rollout`
- [ ] `FLAG_TYPE` and `FlagType` are exported from `packages/api`
- [ ] `SdkClient` internal cache stores `type` and `rollout` per flag
- [ ] Existing `isEnabled()` behaviour is unchanged (returns `enabled` boolean)
- [ ] Existing unit tests in `packages/api` and `packages/sdk-node` are updated to pass the new shape
- [ ] `pnpm check-types`, `pnpm lint`, `pnpm test`, `pnpm build` all pass

### Blocked by

None — can start immediately.

---

## Issue 2 — SDK hash evaluation + sticky bucketing tests

### What to build

Implement client-side percentage rollout evaluation in `packages/sdk-node`. When `isEnabled()` is called for a `percentage_rollout` flag, the SDK hashes the flag key and user ID to determine whether the user falls within the rollout.

**Hash function** (new module `src/bucket.ts`):

```ts
import { createHash } from 'node:crypto';

export const bucket = (flagKey: string, userId: string): number => {
  const hash = createHash('sha256').update(`${flagKey}/${userId}`).digest();
  const uint32 = hash.readUInt32BE(0);
  return uint32 % 100;
};
```

**`isEnabled()` update** (`src/SdkClient.ts`):

```ts
isEnabled(key: string, context?: Record<string, string>): boolean {
  if (!this.connected) throw new ClientNotConnected();
  const flag = this.flags.get(key);
  if (!flag) return false;
  if (!flag.enabled) return false;
  if (flag.type === FLAG_TYPE.PERCENTAGE_ROLLOUT) {
    const userId = context?.['userId'];
    if (!userId) return false;
    return bucket(key, userId) < flag.rollout;
  }
  return flag.enabled;
}
```

**Unit tests** (extend `__tests__/unit/sdk-client.test.ts`):

- A user in the rollout returns `true` (compute expected bucket from `flagKey + "/" + userId` and verify `< rollout`)
- A user outside the rollout returns `false`
- `rollout = 0` → always `false` for any user
- `rollout = 100` → always `true` for any user (bucket is always 0–99)
- Missing `userId` in context → `false`
- Empty context object `{}` → `false`
- Same `(flagKey, userId)` pair always produces the same bucket (sticky bucketing — assert twice)
- Boolean flag is unaffected (no context needed, returns `enabled` directly)

### Acceptance criteria

- [ ] `bucket(flagKey, userId)` returns a stable integer in `[0, 99]` for any input
- [ ] `isEnabled()` returns `false` when `context?.userId` is absent and type is `percentage_rollout`
- [ ] `isEnabled()` returns `false` when `!flag.enabled` regardless of type
- [ ] `isEnabled()` for a `boolean` flag is unchanged — no context required
- [ ] All sticky bucketing unit test cases pass
- [ ] `bucket.ts` is not exported from the public barrel (internal implementation detail)
- [ ] `pnpm check-types`, `pnpm lint`, `pnpm test`, `pnpm build` all pass

### Blocked by

Issue 1 (needs the extended `FlagConfig` shape with `type` and `rollout`).

---

## Issue 3 — API PATCH extension for type and rollout

### What to build

Extend `PATCH /:flagId/environments/:environmentId` in `apps/api` to accept `type` and `rollout` fields alongside the existing `status` field. Add the corresponding audit event and update the SSE `flag_updated` payload to carry the full configuration.

**Request body** (any subset of fields is valid; omitting a field leaves it unchanged):

```ts
{
  status?: 'active' | 'inactive';
  type?: FlagType;          // 'boolean' | 'percentage_rollout'
  rollout?: number;         // integer 0–100 inclusive
}
```

**Validation rules:**

- `type` — must be a valid `FLAG_TYPE` value if present; unknown values → `InvalidFlagType` exception
- `rollout` — must be an integer, 0 ≤ value ≤ 100, if present; invalid values → `InvalidRollout` exception
- At least one field must be provided (empty body → `BadRequest`)
- Archived flag → `FlagIsArchived` (existing behaviour preserved)

**DB write:** a single `prisma.flagState.update` applying whichever subset of `{ status, type, rollout }` was provided.

**Audit event:** emit `flag.rollout_updated` whenever `type` or `rollout` is changed, with meta `{ environmentId, type, rollout }` reflecting the post-update values. Continue emitting `flag.toggled` for `status`-only changes.

**SSE event:** `emitFlagEvent` for `flag_updated` must now include `type` and `rollout` from the updated `FlagState`. Read these from the row returned by `prisma.flagState.update`.

**New exception classes** (in `apps/api/src/exceptions/`):

- `InvalidFlagType` — `400`, code `InvalidFlagType`, message `"Invalid flag type."`
- `InvalidRollout` — `400`, code `InvalidRollout`, message `"Rollout must be an integer between 0 and 100."`

### Acceptance criteria

- [ ] `PATCH` with `{ type: 'percentage_rollout', rollout: 42 }` updates both fields and returns the updated `FlagState`
- [ ] `PATCH` with only `{ status: 'active' }` continues to work as before (no regression)
- [ ] `PATCH` with an unknown `type` value returns `400 InvalidFlagType`
- [ ] `PATCH` with `rollout` outside 0–100 returns `400 InvalidRollout`
- [ ] `PATCH` with an empty body returns `400`
- [ ] `PATCH` on an archived flag returns the existing `FlagIsArchived` error
- [ ] `flag_updated` SSE event carries `{ key, enabled, type, rollout }`
- [ ] Audit log contains `flag.rollout_updated` with correct meta when `type` or `rollout` changes
- [ ] `InvalidFlagType` and `InvalidRollout` exported from `apps/api/src/exceptions/index.ts`
- [ ] Integration tests cover the above cases
- [ ] `pnpm check-types`, `pnpm lint`, `pnpm test`, `pnpm build` all pass

### Blocked by

Issue 1 (needs `FLAG_TYPE` from `packages/api` and the extended SSE event shape).

---

## Issue 4 — Dashboard rollout editor

### What to build

Add a type selector and conditional rollout percentage input to the per-environment rows on the flag detail page. Users can switch a flag between `boolean` and `percentage_rollout` per environment and set the rollout percentage when the rollout type is active.

**UX:**

- Each environment row on the flag detail page shows a segmented control or dropdown with two options: `Boolean` and `Rollout %`.
- Selecting `Rollout %` reveals a numeric input (0–100). The input is hidden when `Boolean` is selected.
- Changing the type selector or editing the rollout % fires `PATCH /api/projects/:projectId/flags/:flagId/environments/:environmentId` with `{ type, rollout }`.
- The rollout % input is a controlled input; the PATCH fires on blur (not on every keystroke).
- `isPending` from `useMutation` disables the selector and input while the request is in flight.
- Errors surface inline below the environment row (same pattern as other mutations in the dashboard).

**TanStack Query mutation** (add to `apps/dashboard/src/queries/flags.ts`):

```ts
type UpdateFlagEnvironmentArgs = {
  flagId: string;
  environmentId: string;
  type?: FlagType;
  rollout?: number;
  status?: 'active' | 'inactive';
};
```

`onSuccess` should invalidate both `flagKeys.detail(projectId, flagId)` and `flagKeys.all(projectId)`.

**Type selector scope:** only `boolean` and `percentage_rollout` are rendered as options. The `targeted` value is not shown.

### Acceptance criteria

- [ ] Each environment row on the flag detail page shows a type selector with `Boolean` and `Rollout %` options
- [ ] Selecting `Rollout %` reveals a numeric input constrained to 0–100
- [ ] The numeric input is hidden when `Boolean` is selected
- [ ] Changing type fires the PATCH and optimistically updates the UI
- [ ] Editing the rollout % and blurring fires the PATCH
- [ ] The selector and input are disabled while a mutation is in flight
- [ ] Server-side errors (e.g. `InvalidRollout`) are displayed inline
- [ ] Switching back to `Boolean` preserves the rollout % value (input pre-fills with last value if type switches back)
- [ ] `targeted` does not appear in the type selector
- [ ] `pnpm check-types`, `pnpm lint`, `pnpm test`, `pnpm build` all pass

### Blocked by

Issue 3 (needs the extended PATCH endpoint).
