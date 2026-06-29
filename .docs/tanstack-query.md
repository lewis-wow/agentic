# TanStack Query — Data Fetching in the Dashboard

TanStack Query v5 is the **only** mechanism for data fetching and mutation in `apps/dashboard`. Client components use `useQuery` and `useMutation`; they never call Prisma directly, never use Next.js server actions for data, and never call `apps/api` or `apps/bff` directly.

All fetch calls target the **Next.js API routes** at `/api/...` (same-origin). Those routes handle session → JWT exchange and forward to `apps/api`.

## Setup

Wrap the app in a `QueryClientProvider`. In `apps/dashboard`, create the client once at the provider boundary:

```tsx
// apps/dashboard/src/app/(dashboard)/layout.tsx or a dedicated providers.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

const QueryProvider = ({ children }: { children: React.ReactNode }): React.ReactNode => {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000 },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};
```

## Query Keys

Query keys are arrays. Structure them hierarchically: `[resource, ...scope, ...filters]`. Colocate key factories with their fetcher functions so invalidation and fetching stay in sync.

```ts
// queries/flags.ts
export const flagKeys = {
  all:        (projectId: string)                        => ['projects', projectId, 'flags'] as const,
  byEnv:      (projectId: string, envId: string)         => ['projects', projectId, 'flags', { envId }] as const,
  detail:     (projectId: string, flagId: string)        => ['projects', projectId, 'flags', flagId] as const,
  auditLog:   (projectId: string, flagId: string)        => ['projects', projectId, 'flags', flagId, 'audit'] as const,
} as const;
```

Use prefix matching for invalidation: invalidating `flagKeys.all(projectId)` marks all flag queries for that project stale.

## useQuery

```ts
import { useQuery } from '@tanstack/react-query';

type FlagsQueryPayload = {
  flags: Flag[];
};

const useFlags = (projectId: string, environmentId: string): FlagsQueryPayload | undefined => {
  const { data } = useQuery({
    queryKey: flagKeys.byEnv(projectId, environmentId),
    queryFn: async (): Promise<FlagsQueryPayload> => {
      const res = await fetch(`/api/projects/${projectId}/flags?environmentId=${environmentId}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<FlagsQueryPayload>;
    },
  });
  return data;
};
```

- Always type the `queryFn` return explicitly.
- Throw on non-ok responses so TanStack Query treats them as errors.
- Use `isPending` / `isError` / `data` from `useQuery` to drive loading and error states.

## useMutation

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

type CreateFlagArgs = {
  projectId: string;
  key: string;
  name: string;
};

type CreateFlagPayload = {
  flagId: string;
};

const useCreateFlag = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: CreateFlagArgs): Promise<CreateFlagPayload> => {
      const res = await fetch(`/api/projects/${projectId}/flags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<CreateFlagPayload>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: flagKeys.all(projectId) });
    },
  });
};
```

- One `args` object as the single mutation parameter (matches the `Args` suffix TypeScript convention).
- Always invalidate the relevant query key in `onSuccess`.
- Use `mutation.isPending` for loading state; never manage a separate `isLoading` boolean.

## Invalidation

Invalidate by prefix to catch all variants:

```ts
// Invalidate all flag queries for a project (all environments, all details)
void queryClient.invalidateQueries({ queryKey: flagKeys.all(projectId) });

// Invalidate only a specific flag's detail
void queryClient.invalidateQueries({ queryKey: flagKeys.detail(projectId, flagId) });
```

## Error Handling

Errors surface through `mutation.error` / `query.error`. Display them inline near the action that caused them. Do not use global error boundaries for expected API errors (validation failures, 409 conflicts). Use error boundaries only for unexpected rendering errors.

```tsx
const { mutate, isPending, error } = useCreateFlag(projectId);

return (
  <>
    <button disabled={isPending} onClick={() => mutate(args)}>
      {isPending ? 'Creating…' : 'Create'}
    </button>
    {error && <p className="text-sm text-red-700">{error.message}</p>}
  </>
);
```

## Rules

- **Never call `apps/api` or `apps/bff` directly from the dashboard.** Always go through `/api/...` Next.js API routes.
- **Never use server actions for data.** TanStack Query + fetch is the only data pattern.
- **Never use `any` in query or mutation types.** Type both the payload and the args explicitly.
- Colocate query key factories, fetcher functions, and mutation hooks in a `queries/` directory per resource (e.g., `apps/dashboard/src/queries/flags.ts`).
- Set a sensible `staleTime` default (30 s) in the `QueryClient`; override per-query only when the data freshness requirement differs significantly.
