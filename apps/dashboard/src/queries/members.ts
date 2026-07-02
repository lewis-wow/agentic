import { usePaginatedQuery, type PagedResponse } from '@repo/pagination';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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
      const res = await fetch(
        `/api/projects/${projectId}/members/addable?query=${encodeURIComponent(query)}`,
      );
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { users: AddableUser[] };
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

      const res = await fetch(
        `/api/projects/${projectId}/members?${params.toString()}`,
      );
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as {
        members: MemberListItem[];
        total: number;
        page: number;
        limit: number;
      };
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
    mutationFn: async (args: AddMemberArgs): Promise<void> => {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      });
      if (!res.ok) throw new Error(await res.text());
    },
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
    mutationFn: async (memberId: string): Promise<void> => {
      const res = await fetch(
        `/api/projects/${projectId}/members/${memberId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error(await res.text());
    },
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
