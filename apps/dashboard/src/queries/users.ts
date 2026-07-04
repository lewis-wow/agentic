import type { UserListItem } from '@repo/api';
import { usePaginatedQuery, type PagedResponse } from '@repo/pagination';

import { apiFetch } from '../lib/apiFetch';

export type { UserListItem } from '@repo/api';

export const userKeys = {
  all: (search: string) => ['users', search] as const,
} as const;

const USERS_LIMIT = 10;

export const useUsers = (search: string) =>
  usePaginatedQuery<UserListItem>({
    queryKey: [...userKeys.all(search)],
    queryFn: (page): Promise<PagedResponse<UserListItem>> => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(USERS_LIMIT),
      });
      if (search) params.set('search', search);

      return apiFetch<PagedResponse<UserListItem>>({
        path: `/api/users?${params.toString()}`,
      });
    },
    limit: USERS_LIMIT,
  });
