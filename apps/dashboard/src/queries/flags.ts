import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export type FlagStatus = 'active' | 'inactive' | 'archived';

export type FlagListItem = {
  id: string;
  key: string;
  name: string;
  status: FlagStatus;
  createdAt: string;
  updatedAt: string;
};

export type FlagState = {
  id: string;
  environmentId: string;
  environmentName: string;
  status: FlagStatus;
};

export type AuditLogEntry = {
  id: string;
  action: string;
  meta: Record<string, unknown>;
  createdAt: string;
  userId: string;
  userName: string;
};

export type FlagDetail = {
  id: string;
  key: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  states: FlagState[];
  auditLog: AuditLogEntry[];
};

export type Environment = {
  id: string;
  name: string;
};

export const flagKeys = {
  all: (projectId: string) => ['projects', projectId, 'flags'] as const,
  byEnv: (projectId: string, environmentId: string) =>
    ['projects', projectId, 'flags', { environmentId }] as const,
  detail: (projectId: string, flagId: string) =>
    ['projects', projectId, 'flags', flagId] as const,
  environments: (projectId: string) =>
    ['projects', projectId, 'environments'] as const,
} as const;

export const useEnvironments = (projectId: string) =>
  useQuery({
    queryKey: flagKeys.environments(projectId),
    queryFn: async (): Promise<Environment[]> => {
      const res = await fetch(`/api/projects/${projectId}/flags/environments`);
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { environments: Environment[] };
      return data.environments;
    },
  });

export const useFlags = (projectId: string, environmentId: string | null) =>
  useQuery({
    queryKey: flagKeys.byEnv(projectId, environmentId ?? ''),
    queryFn: async (): Promise<FlagListItem[]> => {
      const res = await fetch(
        `/api/projects/${projectId}/flags?environmentId=${environmentId}`,
      );
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { flags: FlagListItem[] };
      return data.flags;
    },
    enabled: !!environmentId,
  });

type CreateFlagArgs = {
  key: string;
  name: string;
};

export const useCreateFlag = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: CreateFlagArgs): Promise<FlagListItem> => {
      const res = await fetch(`/api/projects/${projectId}/flags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { flag: FlagListItem };
      return data.flag;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: flagKeys.all(projectId) });
    },
  });
};

type ToggleFlagArgs = {
  flagId: string;
  environmentId: string;
  status: 'active' | 'inactive';
};

export const useToggleFlag = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: ToggleFlagArgs): Promise<FlagState> => {
      const res = await fetch(
        `/api/projects/${projectId}/flags/${args.flagId}/environments/${args.environmentId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: args.status }),
        },
      );
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { flagState: FlagState };
      return data.flagState;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: flagKeys.byEnv(projectId, variables.environmentId),
      });
      void queryClient.invalidateQueries({
        queryKey: flagKeys.detail(projectId, variables.flagId),
      });
    },
  });
};

export const useFlagDetail = (projectId: string, flagId: string) =>
  useQuery({
    queryKey: flagKeys.detail(projectId, flagId),
    queryFn: async (): Promise<FlagDetail> => {
      const res = await fetch(`/api/projects/${projectId}/flags/${flagId}`);
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { flag: FlagDetail };
      return data.flag;
    },
  });

type RenameFlagArgs = {
  name: string;
};

export const useRenameFlag = (projectId: string, flagId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: RenameFlagArgs): Promise<FlagDetail> => {
      const res = await fetch(`/api/projects/${projectId}/flags/${flagId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: args.name }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { flag: FlagDetail };
      return data.flag;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: flagKeys.detail(projectId, flagId),
      });
    },
  });
};

export const useArchiveFlag = (projectId: string, flagId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const res = await fetch(
        `/api/projects/${projectId}/flags/${flagId}/archive`,
        { method: 'POST' },
      );
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: flagKeys.all(projectId) });
    },
  });
};

export const useUnarchiveFlag = (projectId: string, flagId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const res = await fetch(
        `/api/projects/${projectId}/flags/${flagId}/unarchive`,
        { method: 'POST' },
      );
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: flagKeys.all(projectId) });
    },
  });
};

export const useDeleteFlag = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (flagId: string): Promise<void> => {
      const res = await fetch(`/api/projects/${projectId}/flags/${flagId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: flagKeys.all(projectId) });
    },
  });
};
