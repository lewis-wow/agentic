import { usePaginatedQuery } from '@repo/pagination';
import type { PagedResponse } from '@repo/pagination';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export type FlagStatus = 'active' | 'inactive' | 'archived';

export type FlagType = 'boolean' | 'percentage_rollout' | 'targeted';

export type FlagListItem = {
  id: string;
  key: string;
  name: string;
  status: FlagStatus;
  type: FlagType;
  rollout: number;
  createdAt: string;
  updatedAt: string;
};

export type TargetingRule = {
  attribute: string;
  operator: 'EQ' | 'NEQ' | 'IN' | 'NOT_IN' | 'CONTAINS';
  value: string[];
};

export type FlagState = {
  id: string;
  environmentId: string;
  environmentName: string;
  status: FlagStatus;
  type: FlagType;
  rollout: number;
  rules: TargetingRule[];
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
  auditLog: (projectId: string, flagId: string) =>
    ['projects', projectId, 'flags', flagId, 'audit-log'] as const,
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
        `/api/projects/${projectId}/flags?environmentId=${environmentId}&includeArchived=true`,
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

type UpdateFlagEnvironmentArgs = {
  flagId: string;
  environmentId: string;
  type?: FlagType;
  rollout?: number;
  status?: 'active' | 'inactive';
};

export const useUpdateFlagEnvironment = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: UpdateFlagEnvironmentArgs): Promise<FlagState> => {
      const body: Record<string, unknown> = {};
      if (args.type !== undefined) body['type'] = args.type;
      if (args.rollout !== undefined) body['rollout'] = args.rollout;
      if (args.status !== undefined) body['status'] = args.status;
      const res = await fetch(
        `/api/projects/${projectId}/flags/${args.flagId}/environments/${args.environmentId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { flagState: FlagState };
      return data.flagState;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: flagKeys.detail(projectId, variables.flagId),
      });
      void queryClient.invalidateQueries({ queryKey: flagKeys.all(projectId) });
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

export const useArchiveFlag = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (flagId: string): Promise<void> => {
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

export const useUnarchiveFlag = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (flagId: string): Promise<void> => {
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

type UpdateFlagRulesArgs = {
  flagId: string;
  environmentId: string;
  rules: TargetingRule[];
};

export const useUpdateFlagRules = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: UpdateFlagRulesArgs): Promise<void> => {
      const res = await fetch(
        `/api/projects/${projectId}/flags/${args.flagId}/environments/${args.environmentId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rules: args.rules }),
        },
      );
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: flagKeys.detail(projectId, variables.flagId),
      });
    },
  });
};

const AUDIT_LOG_LIMIT = 25;

export const useAuditLog = (projectId: string, flagId: string) =>
  usePaginatedQuery<AuditLogEntry>({
    queryKey: [...flagKeys.auditLog(projectId, flagId)],
    queryFn: async (page): Promise<PagedResponse<AuditLogEntry>> => {
      const res = await fetch(
        `/api/projects/${projectId}/flags/${flagId}/audit-log?page=${page}&limit=${AUDIT_LOG_LIMIT}`,
      );
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as {
        events: AuditLogEntry[];
        total: number;
        page: number;
        limit: number;
      };
      return {
        items: data.events,
        total: data.total,
        page: data.page,
        limit: data.limit,
      };
    },
    limit: AUDIT_LOG_LIMIT,
  });

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
