import { usePaginatedQuery, type PagedResponse } from '@repo/pagination';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '../lib/apiFetch';
import { projectKeys } from './projects';

export type AddableUser = {
  id: string;
  name: string;
  email: string;
};

export type MemberListItem = {
  id: string;
  role: string;
  user: { id: string; name: string; email: string };
};

export const memberKeys = {
  addable: (projectId: string, query: string) =>
    ['projects', projectId, 'members', 'addable', query] as const,
  list: (projectId: string, search: string) =>
    ['projects', projectId, 'members-list', search] as const,
} as const;

export const useAddableUsers = (
  projectId: string,
  query: string,
  enabled: boolean,
) =>
  useQuery({
    queryKey: memberKeys.addable(projectId, query),
    queryFn: async (): Promise<AddableUser[]> => {
      const data = await apiFetch<{ users: AddableUser[] }>({
        path: `/api/projects/${projectId}/members/addable?query=${encodeURIComponent(query)}`,
      });
      return data.users;
    },
    enabled: enabled && query.trim().length > 0,
  });

const MEMBERS_LIMIT = 10;

export const useMembers = (projectId: string, search: string) =>
  usePaginatedQuery<MemberListItem>({
    queryKey: [...memberKeys.list(projectId, search)],
    queryFn: async (page): Promise<PagedResponse<MemberListItem>> => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(MEMBERS_LIMIT),
      });
      if (search) params.set('search', search);

      const data = await apiFetch<{
        members: MemberListItem[];
        total: number;
        page: number;
        limit: number;
      }>({
        path: `/api/projects/${projectId}/members?${params.toString()}`,
      });
      return {
        items: data.members,
        total: data.total,
        page: data.page,
        limit: data.limit,
      };
    },
    limit: MEMBERS_LIMIT,
  });

type AddMemberArgs = {
  userId: string;
  role: 'admin' | 'viewer';
};

export const useAddMember = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: AddMemberArgs): Promise<void> =>
      apiFetch({
        path: `/api/projects/${projectId}/members`,
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args),
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: projectKeys.detail(projectId),
      });
      void queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'members-list'],
      });
    },
  });
};

export const useRemoveMember = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string): Promise<void> =>
      apiFetch({
        path: `/api/projects/${projectId}/members/${memberId}`,
        init: { method: 'DELETE' },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: projectKeys.detail(projectId),
      });
      void queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'members-list'],
      });
    },
  });
};
