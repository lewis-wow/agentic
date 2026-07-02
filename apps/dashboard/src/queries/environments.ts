import { usePaginatedQuery, type PagedResponse } from '@repo/pagination';
import { useMutation, useQueryClient } from '@tanstack/react-query';

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

      const res = await fetch(
        `/api/projects/${projectId}/environments?${params.toString()}`,
      );
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as {
        environments: Environment[];
        total: number;
        page: number;
        limit: number;
      };
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
    mutationFn: async (
      args: CreateEnvironmentArgs,
    ): Promise<CreateEnvironmentPayload> => {
      const res = await fetch(`/api/projects/${projectId}/environments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as CreateEnvironmentPayload;
    },
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
    mutationFn: async (environmentId: string): Promise<void> => {
      const res = await fetch(
        `/api/projects/${projectId}/environments/${environmentId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error(await res.text());
    },
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
