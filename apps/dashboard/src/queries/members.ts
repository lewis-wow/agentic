import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { projectKeys } from './projects';

export type AddableUser = {
  id: string;
  name: string;
  email: string;
};

export const memberKeys = {
  addable: (projectId: string, query: string) =>
    ['projects', projectId, 'members', 'addable', query] as const,
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
    },
  });
};
