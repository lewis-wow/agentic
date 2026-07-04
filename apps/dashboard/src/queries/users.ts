import { usePaginatedQuery, type PagedResponse } from '@repo/pagination';

import { apiFetch } from '../lib/apiFetch';

export type UserListItem = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export const userKeys = {
  all: (search: string) => ['users', search] as const,
} as const;

const USERS_LIMIT = 10;

export const useUsers = (search: string) =>
  usePaginatedQuery<UserListItem>({
    queryKey: [...userKeys.all(search)],
    queryFn: async (page): Promise<PagedResponse<UserListItem>> => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(USERS_LIMIT),
      });
      if (search) params.set('search', search);

      const data = await apiFetch<{
        users: UserListItem[];
        total: number;
        page: number;
        limit: number;
      }>({
        path: `/api/users?${params.toString()}`,
      });
      return {
        items: data.users,
        total: data.total,
        page: data.page,
        limit: data.limit,
      };
    },
    limit: USERS_LIMIT,
  });
