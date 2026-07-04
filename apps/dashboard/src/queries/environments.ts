import { usePaginatedQuery, type PagedResponse } from '@repo/pagination';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '../lib/apiFetch';
import { apiKeyKeys } from './apiKeys';
import { projectKeys, type Environment } from './projects';

export const environmentKeys = {
  all: (projectId: string, search: string) =>
    ['projects', projectId, 'environments-list', search] as const,
} as const;

const ENVIRONMENTS_LIMIT = 10;

export const useEnvironmentsList = (projectId: string, search: string) =>
  usePaginatedQuery<Environment>({
    queryKey: [...environmentKeys.all(projectId, search)],
    queryFn: async (page): Promise<PagedResponse<Environment>> => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(ENVIRONMENTS_LIMIT),
      });
      if (search) params.set('search', search);

      const data = await apiFetch<{
        environments: Environment[];
        total: number;
        page: number;
        limit: number;
      }>({
        path: `/api/projects/${projectId}/environments?${params.toString()}`,
      });
      return {
        items: data.environments,
        total: data.total,
        page: data.page,
        limit: data.limit,
      };
    },
    limit: ENVIRONMENTS_LIMIT,
  });

type CreateEnvironmentArgs = {
  name: string;
};

type CreateEnvironmentPayload = {
  environment: Environment;
};

export const useCreateEnvironment = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      args: CreateEnvironmentArgs,
    ): Promise<CreateEnvironmentPayload> =>
      apiFetch({
        path: `/api/projects/${projectId}/environments`,
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
      void queryClient.invalidateQueries({ queryKey: projectKeys.all() });
      void queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'environments-list'],
      });
    },
  });
};

export const useDeleteEnvironment = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (environmentId: string): Promise<void> =>
      apiFetch({
        path: `/api/projects/${projectId}/environments/${environmentId}`,
        init: { method: 'DELETE' },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: projectKeys.detail(projectId),
      });
      void queryClient.invalidateQueries({ queryKey: projectKeys.all() });
      void queryClient.invalidateQueries({
        queryKey: apiKeyKeys.all(projectId),
      });
      void queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'environments-list'],
      });
    },
  });
};
