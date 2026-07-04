import type { TargetingRule } from '@repo/api';
import { usePaginatedQuery } from '@repo/pagination';
import type { PagedResponse } from '@repo/pagination';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '../lib/apiFetch';

export type { TargetingRule } from '@repo/api';

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
  byEnv: (
    projectId: string,
    environmentId: string,
    search: string,
    status: FlagStatus | 'all',
  ) =>
    [
      'projects',
      projectId,
      'flags',
      { environmentId, search, status },
    ] as const,
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
      const data = await apiFetch<{ environments: Environment[] }>({
        path: `/api/projects/${projectId}/flags/environments`,
      });
      return data.environments;
    },
  });

const FLAGS_LIMIT = 10;

export const useFlags = (
  projectId: string,
  environmentId: string | null,
  search = '',
  status: FlagStatus | 'all' = 'all',
) =>
  usePaginatedQuery<FlagListItem>({
    queryKey: [
      ...flagKeys.byEnv(projectId, environmentId ?? '', search, status),
    ],
    queryFn: async (page): Promise<PagedResponse<FlagListItem>> => {
      const params = new URLSearchParams({
        environmentId: environmentId ?? '',
        status,
        page: String(page),
        limit: String(FLAGS_LIMIT),
      });
      if (search) params.set('search', search);

      const data = await apiFetch<{
        flags: FlagListItem[];
        total: number;
        page: number;
        limit: number;
      }>({
        path: `/api/projects/${projectId}/flags?${params.toString()}`,
      });
      return {
        items: data.flags,
        total: data.total,
        page: data.page,
        limit: data.limit,
      };
    },
    limit: FLAGS_LIMIT,
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
      const data = await apiFetch<{ flag: FlagListItem }>({
        path: `/api/projects/${projectId}/flags`,
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args),
        },
      });
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
      const data = await apiFetch<{ flagState: FlagState }>({
        path: `/api/projects/${projectId}/flags/${args.flagId}/environments/${args.environmentId}`,
        init: {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: args.status }),
        },
      });
      return data.flagState;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [
          'projects',
          projectId,
          'flags',
          { environmentId: variables.environmentId },
        ],
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
      const data = await apiFetch<{ flagState: FlagState }>({
        path: `/api/projects/${projectId}/flags/${args.flagId}/environments/${args.environmentId}`,
        init: {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      });
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
      const data = await apiFetch<{ flag: FlagDetail }>({
        path: `/api/projects/${projectId}/flags/${flagId}`,
      });
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
      const data = await apiFetch<{ flag: FlagDetail }>({
        path: `/api/projects/${projectId}/flags/${flagId}`,
        init: {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: args.name }),
        },
      });
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
    mutationFn: (flagId: string): Promise<void> =>
      apiFetch({
        path: `/api/projects/${projectId}/flags/${flagId}/archive`,
        init: { method: 'POST' },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: flagKeys.all(projectId) });
    },
  });
};

export const useUnarchiveFlag = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (flagId: string): Promise<void> =>
      apiFetch({
        path: `/api/projects/${projectId}/flags/${flagId}/unarchive`,
        init: { method: 'POST' },
      }),
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
    mutationFn: (args: UpdateFlagRulesArgs): Promise<void> =>
      apiFetch({
        path: `/api/projects/${projectId}/flags/${args.flagId}/environments/${args.environmentId}`,
        init: {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rules: args.rules }),
        },
      }),
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
      const data = await apiFetch<{
        events: AuditLogEntry[];
        total: number;
        page: number;
        limit: number;
      }>({
        path: `/api/projects/${projectId}/flags/${flagId}/audit-log?page=${page}&limit=${AUDIT_LOG_LIMIT}`,
      });
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
    mutationFn: (flagId: string): Promise<void> =>
      apiFetch({
        path: `/api/projects/${projectId}/flags/${flagId}`,
        init: { method: 'DELETE' },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: flagKeys.all(projectId) });
    },
  });
};
