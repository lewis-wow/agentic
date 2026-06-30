# Slice 9 — Targeted flag type + rule builder

## Design decisions

These decisions were finalised in the grilling session before these issues were written. Do not re-litigate them; refer to the ADRs if you want to understand the trade-offs.

| Decision                         | Value                                                                                                                |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Rule matching semantics          | AND — all rules in a set must match; no short-circuit change to result                                               |
| Rule value shape                 | Always `string[]` — even for `EQ`/`NEQ`/`CONTAINS` (`value[0]` is the operand for single-value operators)            |
| Evaluation location              | Client-side in the SDK — rules travel in the snapshot and SSE events                                                 |
| Empty rules (`rules: []`)        | Returns `false` — a `targeted` flag with no rules is incomplete; no user receives it                                 |
| Missing context attribute        | Rule fails → overall result `false` — strict, safe default                                                           |
| `CONTAINS` semantics             | Substring match, case-sensitive, uses `value[0]` as the needle                                                       |
| `RULE_OPERATOR` definition       | `as const` object in `packages/api/src/schemas/flags.ts`, following `.docs/typescript.md` enum rules                 |
| API endpoint for rules           | Extend existing `PATCH /:flagId/environments/:environmentId` — no new endpoint                                       |
| Server-side rule validation      | Effect Schema decode (`Schema.decodeUnknownSync(TargetingRuleSchema)`) before writing                                |
| `targeted` type in PATCH         | Unblocked alongside `boolean`/`percentage_rollout` in the same handler                                               |
| Audit log action                 | `flag.rules_updated` with `meta: { environmentId, rules }` (full new rule set)                                       |
| SSE event for rule changes       | `flag_updated` payload extended to include `rules: TargetingRule[]`                                                  |
| Dashboard rule builder placement | Full-width `RuleBuilderSection` per targeted environment, rendered below `StatesSection`                             |
| Rule reordering in UI            | Up/down buttons — no DnD library added                                                                               |
| Test file structure              | One file `rule-evaluation.test.ts` with a top-level `describe` for shared edge cases and one `describe` per operator |

## Updated event taxonomy

The `flag_updated`, `flag_created`, `flag_unarchived`, and `snapshot` payloads are extended in this slice. `flag_archived` and `flag_deleted` are unchanged.

| SSE `event:` field | Trigger                                      | Payload shape                                                               |
| ------------------ | -------------------------------------------- | --------------------------------------------------------------------------- |
| `snapshot`         | connect or stale reconnect                   | `{ flags: Array<{ key; enabled; type; rollout; rules: TargetingRule[] }> }` |
| `flag_created`     | `POST /projects/:projectId/flags`            | `{ key; enabled; type; rollout; rules: TargetingRule[] }` ← **extended**    |
| `flag_updated`     | `PATCH /:flagId/environments/:environmentId` | `{ key; enabled; type; rollout; rules: TargetingRule[] }` ← **extended**    |
| `flag_archived`    | `POST /:flagId/archive`                      | `{ key }` — unchanged                                                       |
| `flag_unarchived`  | `POST /:flagId/unarchive`                    | `{ key; enabled; type; rollout; rules: TargetingRule[] }` ← **extended**    |
| `flag_deleted`     | `DELETE /:flagId`                            | `{ key }` — unchanged                                                       |

## Schema additions (`packages/api`)

Add to `packages/api/src/schemas/flags.ts`:

```ts
export const RULE_OPERATOR = {
  EQ: 'EQ',
  NEQ: 'NEQ',
  IN: 'IN',
  NOT_IN: 'NOT_IN',
  CONTAINS: 'CONTAINS',
} as const;

export type RuleOperator = ValueOfEnum<typeof RULE_OPERATOR>;

export const TargetingRuleSchema = Schema.Struct({
  attribute: Schema.String,
  operator: Schema.Literal('EQ', 'NEQ', 'IN', 'NOT_IN', 'CONTAINS'),
  value: Schema.Array(Schema.String),
});

export type TargetingRule = Schema.Schema.Type<typeof TargetingRuleSchema>;
```

Extend `FLAG_TYPE` to include `TARGETED`:

```ts
export const FLAG_TYPE = {
  BOOLEAN: 'boolean',
  PERCENTAGE_ROLLOUT: 'percentage_rollout',
  TARGETED: 'targeted',
} as const;
```

Extend `FlagConfigSchema` and all upsert event schemas with `rules`:

```ts
export const FlagConfigSchema = Schema.Struct({
  key: Schema.String,
  enabled: Schema.Boolean,
  type: Schema.Literal(
    FLAG_TYPE.BOOLEAN,
    FLAG_TYPE.PERCENTAGE_ROLLOUT,
    FLAG_TYPE.TARGETED,
  ),
  rollout: Schema.Number,
  rules: Schema.Array(TargetingRuleSchema),
});
```

Export `RULE_OPERATOR`, `RuleOperator`, `TargetingRuleSchema`, and `TargetingRule` from `packages/api/src/index.ts`.

---

## Issue 1 — Schema contract, PATCH extension, and snapshot plumbing

### What to build

Extend the flag configuration contract end-to-end so that `rules` and the `targeted` type flow from the database through the API into the snapshot and SSE events. No SDK evaluation logic changes in this issue.

**`packages/api` schema changes:**

- Add `RULE_OPERATOR` as-const object and derive `RuleOperator` with `ValueOfEnum`.
- Add `TargetingRuleSchema` and `TargetingRule` as described in the schema additions section above.
- Extend `FLAG_TYPE` to include `TARGETED: 'targeted'`.
- Extend `FlagConfigSchema`, `FlagCreatedEventSchema`, `FlagUpdatedEventSchema`, and `FlagUnarchivedEventSchema` with `rules: Schema.Array(TargetingRuleSchema)`.
- Export all new symbols from the barrel.

**`apps/api` PATCH handler:**

- Unblock `targeted` in type validation alongside `boolean` and `percentage_rollout`.
- Accept an optional `rules` field in the request body.
- Validate `rules` using `Schema.decodeUnknownSync(Schema.Array(TargetingRuleSchema))` — invalid structure returns `400 RequestValidationFailed`.
- Write validated rules to `FlagState.rules` via `prisma.flagState.update`.
- Emit `flag.rules_updated` audit event with `meta: { environmentId, rules }` whenever `rules` is present in the body.
- Include `rules` in the `flag_updated` SSE event payload emitted after the update.

**`apps/api` snapshot and SSE stream routes:**

- Both `GET /v1/flags` and the `snapshot` SSE frame must select `rules` from `FlagState` and include it in every `FlagConfig` entry.
- The `toSdkFlagType` helper (or equivalent) must pass through `targeted`.
- `flag_updated`, `flag_created`, and `flag_unarchived` SSE events must carry `rules` read from the `FlagState` row.

### Acceptance criteria

- [ ] `GET /v1/flags` response includes `rules` on every flag entry (empty array for non-targeted flags)
- [ ] `snapshot` SSE event payload includes `rules` on every flag entry
- [ ] `flag_updated`, `flag_created`, and `flag_unarchived` SSE payloads include `rules`
- [ ] `PATCH` with `{ type: 'targeted', rules: [{ attribute: 'plan', operator: 'EQ', value: ['pro'] }] }` writes the rules and returns updated `FlagState`
- [ ] `PATCH` with malformed `rules` (e.g. missing `attribute`) returns `400`
- [ ] `PATCH` with `{ type: 'targeted' }` and no `rules` field leaves existing rules unchanged
- [ ] `RULE_OPERATOR`, `RuleOperator`, `TargetingRuleSchema`, `TargetingRule`, and `FLAG_TYPE.TARGETED` are exported from `packages/api`
- [ ] Existing `boolean` and `percentage_rollout` PATCH behaviour is unchanged
- [ ] `pnpm check-types`, `pnpm lint`, `pnpm test`, `pnpm build` all pass

### Blocked by

None — can start immediately.

---

## Issue 2 — SDK rule evaluation engine + unit tests

### What to build

Implement client-side rule evaluation in `packages/sdk-node`. When `isEnabled()` is called for a `targeted` flag, the SDK evaluates the stored rules against the provided context using AND semantics.

**`SdkClient` storage update:**

Extend the internal cache entry type to store `rules`:

```ts
type FlagEntry = {
  enabled: boolean;
  type: FlagType;
  rollout: number;
  rules: TargetingRule[];
};
```

Populate `rules` from the snapshot and `flag_updated` SSE events (already included in the payload after Issue 1).

**`isEnabled()` evaluation logic:**

```
if (!connected) throw ClientNotConnected
flag = flags.get(key)
if (!flag) return false
if (!flag.enabled) return false
if (flag.type === 'targeted'):
  if (flag.rules.length === 0) return false
  return flag.rules.every(rule => evaluateRule(rule, context ?? {}))
if (flag.type === 'percentage_rollout'):
  // existing bucket logic unchanged
return flag.enabled
```

**`evaluateRule` logic (pure function, not exported):**

- Resolve `actual = context[rule.attribute]`; if `undefined` → `false`
- `EQ`: `actual === rule.value[0]`
- `NEQ`: `actual !== rule.value[0]`
- `IN`: `rule.value.includes(actual)`
- `NOT_IN`: `!rule.value.includes(actual)`
- `CONTAINS`: `actual.includes(rule.value[0])` (case-sensitive substring match)

**Unit tests** (`__tests__/unit/rule-evaluation.test.ts`):

```
describe('targeted evaluation — shared edge cases')
  - flag with empty rules → false
  - flag with enabled: false → false regardless of rules
  - missing context attribute → false
  - no context arg at all → false

describe('EQ')
  - matching value → true
  - non-matching value → false

describe('NEQ')
  - non-matching value → true
  - matching value → false

describe('IN')
  - context value in list → true
  - context value not in list → false
  - empty value array → false

describe('NOT_IN')
  - context value not in list → true
  - context value in list → false

describe('CONTAINS')
  - needle present in context value → true
  - needle absent → false
  - case-sensitive: uppercase needle in lowercase string → false
  - empty needle (value[0] = '') → true (all strings contain '')
```

All tests call `isEnabled()` via a constructed `SdkClient` with a mocked in-memory flag map (do not start a real HTTP server).

### Acceptance criteria

- [ ] `isEnabled()` returns `false` for a `targeted` flag with `rules: []`
- [ ] `isEnabled()` returns `false` when `flag.enabled` is `false`, regardless of rules
- [ ] Missing context attribute causes the rule to fail and `isEnabled()` returns `false`
- [ ] All five operators pass their positive and negative test cases
- [ ] `CONTAINS` is case-sensitive
- [ ] `evaluateRule` is not exported from the package barrel
- [ ] `boolean` and `percentage_rollout` flags are unaffected (existing tests still pass)
- [ ] `pnpm check-types`, `pnpm lint`, `pnpm test`, `pnpm build` all pass

### Blocked by

Issue 1 (needs `TargetingRule`, `TargetingRuleSchema`, and the extended `FlagConfigSchema` from `packages/api`).

---

## Issue 3 — Dashboard rule builder UI

### What to build

Add `targeted` to the per-environment type selector and render a full-width `RuleBuilderSection` below the environments table for every environment whose type is `targeted`.

**Type selector extension:**

- Add `targeted` as a third option in the `<select>` inside `EnvironmentRow` (label: `Targeted`).
- Update `FlagType` in `apps/dashboard/src/queries/flags.ts` to `'boolean' | 'percentage_rollout' | 'targeted'`.
- When type switches to `targeted`, the rollout % input is hidden (same as `boolean`).

**`RuleBuilderSection` component:**

Renders below `StatesSection` in `FlagDetailClient`. One section per environment whose `state.type === 'targeted'`.

Each section shows:

- A heading: `Rules — {environmentName}`
- A list of rule rows, each containing:
  - A text input for `attribute`
  - A `<select>` for `operator` (`EQ`, `NEQ`, `IN`, `NOT_IN`, `CONTAINS`)
  - A text input for `value` — comma-separated for multi-value operators (`IN`, `NOT_IN`); the component splits on `,` and trims whitespace to produce `string[]` before saving
  - `↑` and `↓` buttons to reorder (disabled on first/last row respectively)
  - A `Remove` button
- An `Add rule` button that appends a blank row `{ attribute: '', operator: 'EQ', value: [] }`
- A `Save rules` button that fires the mutation with the current rule list

Rules are held in local component state while editing. The mutation fires only when `Save rules` is clicked. `isPending` disables all inputs and buttons in the section while in flight.

**TanStack Query mutation** (add to `apps/dashboard/src/queries/flags.ts`):

```ts
type UpdateFlagRulesArgs = {
  flagId: string;
  environmentId: string;
  rules: Array<{ attribute: string; operator: string; value: string[] }>;
};
```

`PATCH /api/projects/:projectId/flags/:flagId/environments/:environmentId` with body `{ rules }`.

`onSuccess` invalidates `flagKeys.detail(projectId, flagId)`.

**Validation before save:** if any rule has an empty `attribute` or empty `value` array, show an inline error and do not fire the mutation.

### Acceptance criteria

- [ ] `Targeted` appears as a third option in the per-environment type selector
- [ ] Switching type to `targeted` hides the rollout % input
- [ ] A `RuleBuilderSection` appears for each environment with `type === 'targeted'`, below `StatesSection`
- [ ] The section heading shows the environment name
- [ ] A rule row can be added, removed, and reordered with ↑/↓ buttons
- [ ] `↑` is disabled on the first row; `↓` is disabled on the last row
- [ ] Comma-separated `value` input is split and trimmed before saving (e.g. `"US, CA"` → `["US", "CA"]`)
- [ ] Saving with an empty `attribute` or empty `value` shows an inline validation error without firing the mutation
- [ ] `Save rules` button is disabled while the mutation is in flight
- [ ] Server errors surface inline below the section
- [ ] `pnpm check-types`, `pnpm lint`, `pnpm test`, `pnpm build` all pass

### Blocked by

Issue 1 (needs the extended PATCH endpoint that accepts `rules` and `targeted` type).
