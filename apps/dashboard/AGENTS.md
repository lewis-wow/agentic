# AGENTS.md — apps/dashboard

## Role

`apps/dashboard` is the **browser UI** — a Next.js app. It never accesses the database directly and contains no business logic. All data operations go through `apps/api` via the Next.js API routes.

## Required Context Loading

Before writing, refactoring, or reviewing any code here, read:

- @docs/standards/typescript.md
- @docs/standards/react.md
- @docs/standards/tanstack-query.md
- @docs/standards/shadcnui.md

## Data Rules

- **Client components use TanStack Query** (`useQuery` / `useMutation`) to call the Next.js API routes at `/api/...`. Never fetch from client components directly to `apps/api` or `apps/bff`.
- **The catch-all route does no authentication of its own.** `src/app/api/[...path]/route.ts` forwards the incoming request unchanged (all headers intact, via `@repo/bff`'s `forwardRequest`) to `apps/bff`, which validates the Trusted Proxy Authentication headers (set by the operator's reverse proxy — oauth2-proxy, Authelia, Pomerium, ...), mints the RS256 JWT, and forwards on to `apps/api`. No business logic, no credential exchange, here. Adding a new `apps/api` resource never requires a new Next.js route file — it proxies automatically once the resource exists server-side and a `src/queries/<resource>.ts` hook calls `/api/<path>`.
- **No server actions for data.** All business-data reads and writes (projects, environments, flags, ...) go through TanStack Query + the catch-all proxy. Never introduce a server action (`'use server'`, `useActionState`) for data fetching or mutation.
- **No direct Prisma access for business data.** Never import `@repo/prisma` to read or write projects, environments, flags, or any other domain data.

### The one sanctioned Prisma exception: Trusted Proxy Authentication

A small, fixed set of files exist purely to resolve the Trusted Proxy Authentication headers into the identity used for page gating — this **is** the "authorize the user" mechanism for server-rendered pages, not business-data access, so it is allowed to import `@repo/prisma`:

- `src/lib/guards.ts` — `resolveAuthedUser()` (the underlying resolution: validates the Trusted Proxy Secret + Identity Header via `@repo/bff`'s `resolveTrustedProxyUser`, JIT-provisioning the `User` via an upsert with an empty `update` clause so an existing user's role is never overwritten) plus `requireSession()` / `requireOwner()` / `requireProjectAccess()` built on top. Used by server components purely to gate rendering (`unauthorized()`, `forbidden()`) and to read `projectRole` for conditional UI (`canManage`) — never to fetch data that gets rendered. Note this app never mints or verifies a JWT itself — that's `apps/bff`'s job for the actual data path; this is a separate, UX-level gate.
- `src/app/(public)/setup/**` — the pre-auth bootstrap flow (checking whether any project exists yet, creating the first project once the designated owner — `TRUSTED_PROXY_OWNER_EMAIL` — has been seen). This runs before any project exists, so treat it as a narrow, separate exception from ordinary business-data CRUD, not a precedent to extend elsewhere.
- `src/app/page.tsx`, `src/app/(dashboard)/layout.tsx` — check `Project.count()` to redirect to `/setup` on a fresh install.

Every other file that needs project/environment/member/user/flag data must go through `src/queries/<resource>.ts` + `apps/api`, even inside pages and layouts that are otherwise server components — see the pattern below.

### Server pages that need business data

Server components (`page.tsx`, `layout.tsx`) still call `guards.ts` to gate access, but never fetch business data themselves. Instead they render a `'use client'` child that calls the relevant `useX()` query hook, so the data flows through the same TanStack Query + `apps/api` path as everything else. See `AppSidebar.tsx` (calls `useProjects()` itself instead of receiving projects as a prop from `layout.tsx`) and `ProjectHeader.tsx` / `DeleteProjectForm.tsx` (call `useProject(projectId)` instead of receiving `project` as a prop from `page.tsx`).

## Form Conventions

Every form uses **react-hook-form** with the **Effect Schema resolver** (`effectTsResolver` from `@hookform/resolvers/effect-ts`). Never manage form fields with `useState` + manual `onChange`/`onSubmit` validation.

Colocate form validation schemas in `src/schemas/<resource>.ts`, mirroring the `src/queries/<resource>.ts` convention:

```ts
// schemas/flags.ts
import { Schema } from 'effect';

export const RenameFlagFormSchema = Schema.Struct({
  name: Schema.String.pipe(
    Schema.minLength(1, { message: () => 'Name is required' }),
  ),
});
export type RenameFlagFormValues = Schema.Schema.Type<
  typeof RenameFlagFormSchema
>;
```

Wire the schema up with `effectTsResolver` and render fields through the shared `Form` primitives from `@repo/ui/components/ui/form` (`Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`) instead of raw `<input>` elements bound to local state:

```tsx
'use client';

import { effectTsResolver } from '@hookform/resolvers/effect-ts';
import { Button } from '@repo/ui/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@repo/ui/components/ui/form';
import { Input } from '@repo/ui/components/ui/input';
import { useForm } from 'react-hook-form';

import { useRenameFlag } from '../queries/flags';
import {
  RenameFlagFormSchema,
  type RenameFlagFormValues,
} from '../schemas/flags';

const RenameForm = ({ projectId, flagId, currentName }: Props) => {
  const mutation = useRenameFlag(projectId, flagId);
  const form = useForm<RenameFlagFormValues>({
    resolver: effectTsResolver(RenameFlagFormSchema),
    defaultValues: { name: currentName },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Save</Button>
      </form>
    </Form>
  );
};
```

- Dynamic lists of rows (e.g. targeting rules) use `useFieldArray`, never manual `useState<T[]>` array manipulation.
- On successful mutation, call `form.reset()` (and close/reset any dialog state) instead of resetting individual `useState` fields.
- Fields whose validity depends on external props (e.g. a delete-confirmation input that must match a name) build their schema with a factory function, e.g. `makeDeleteFlagFormSchema(flagName)`, and pass it straight to `effectTsResolver`.
- This does not apply to instant-mutation controls that save on every change without a submit step (toggles, inline selects, blur-to-save number inputs) — those are not "forms" in this sense and stay as plain controlled inputs wired directly to a mutation.

## Query Conventions

Existing resource files: `src/queries/flags.ts`, `projects.ts`, `environments.ts`, `apiKeys.ts`. Add a new one per resource rather than growing an existing file across domains.

**All fetching goes through `apiFetch` in `src/lib/apiFetch.ts`** — never call `fetch` directly inside a `queryFn`/`mutationFn`, and never write `if (!res.ok) throw new Error(await res.text())` by hand:

```ts
import { apiFetch } from '../lib/apiFetch';

type FetchFlagsArgs = {
  path: string;
  init?: RequestInit;
};

const data = await apiFetch<{ flags: FlagListItem[]; total: number }>({
  path: `/api/projects/${projectId}/flags?${params.toString()}`,
});
```

`apiFetch<T>(args: ApiFetchArgs)` throws a typed `HttpException` on any non-ok response — reconstructed via `HttpException.fromResponse`, falling back to `UnknownError` (from `@repo/exception`) when the body isn't a structured API error. `query.error` / `mutation.error` are therefore always `HttpException`, never a bare `Error`; check `error.code` or `error instanceof SomeSpecificException` rather than parsing `error.message`.

Colocate query key factories, fetcher functions, and mutation hooks in `src/queries/<resource>.ts`:

```ts
export const flagKeys = {
  all: (projectId: string) => ['projects', projectId, 'flags'] as const,
  detail: (projectId: string, flagId: string) =>
    ['projects', projectId, 'flags', flagId] as const,
} as const;
```

Invalidate by prefix in `onSuccess` to catch all variants:

```ts
void queryClient.invalidateQueries({ queryKey: flagKeys.all(projectId) });
```

## Commands

```bash
pnpm dev          # start Next.js dev server (from repo root)
pnpm build        # Next.js production build
pnpm lint
pnpm check-types
```
