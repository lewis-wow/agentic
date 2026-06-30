# AGENTS.md — apps/dashboard

## Role

`apps/dashboard` is the **browser UI** — a Next.js app. It never accesses the database directly and contains no business logic. All data operations go through `apps/api` via the Next.js API routes.

## Required Context Loading

Before writing, refactoring, or reviewing any code here, read:

- @.docs/typescript.md
- @.docs/react.md
- @.docs/tanstack-query.md
- @.docs/shadcnui.md

## Data Rules

- **Client components use TanStack Query** (`useQuery` / `useMutation`) to call the Next.js API routes at `/api/...`. Never fetch from client components directly to `apps/api` or `apps/bff`.
- **Next.js API routes do nothing except authenticate and proxy.** A route handler reads the Better Auth session cookie, uses `@repo/bff` to mint an RS256 JWT, then forwards to `apps/api`. No business logic, no Prisma.
- **No server actions for data.** Legacy server actions from earlier slices must be migrated to TanStack Query + API routes. New code must never introduce server actions for data fetching or mutation.
- **No direct Prisma access.** Never import `@repo/prisma` in this app.

## Query Conventions

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
