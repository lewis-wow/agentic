import { usePaginatedQuery, type PagedResponse } from '@repo/pagination';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '../lib/apiFetch';

export type ApiKeyListItem = {
  id: string;
  name: string;
  apiKeyId: string;
  environmentId: string;
  environmentName: string;
  revokedAt: string | null;
  createdAt: string;
};

export const apiKeyKeys = {
  all: (projectId: string) => ['projects', projectId, 'api-keys'] as const,
  list: (projectId: string, search: string) =>
    [...apiKeyKeys.all(projectId), search] as const,
} as const;

const API_KEYS_LIMIT = 10;

export const useApiKeys = (projectId: string, search = '') =>
  usePaginatedQuery<ApiKeyListItem>({
    queryKey: [...apiKeyKeys.list(projectId, search)],
    queryFn: async (page): Promise<PagedResponse<ApiKeyListItem>> => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(API_KEYS_LIMIT),
      });
      if (search) params.set('search', search);

      const data = await apiFetch<{
        apiKeys: ApiKeyListItem[];
        total: number;
        page: number;
        limit: number;
      }>({
        path: `/api/projects/${projectId}/api-keys?${params.toString()}`,
      });
      return {
        items: data.apiKeys,
        total: data.total,
        page: data.page,
        limit: data.limit,
      };
    },
    limit: API_KEYS_LIMIT,
  });

type CreateApiKeyArgs = {
  name: string;
  environmentId: string;
};

type CreateApiKeyPayload = {
  apiKey: ApiKeyListItem;
  fullKey: string;
};

export const useCreateApiKey = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: CreateApiKeyArgs): Promise<CreateApiKeyPayload> =>
      apiFetch({
        path: `/api/projects/${projectId}/api-keys`,
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args),
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: apiKeyKeys.all(projectId),
      });
    },
  });
};

export const useRotateApiKey = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (apiKeyId: string): Promise<{ fullKey: string }> =>
      apiFetch({
        path: `/api/projects/${projectId}/api-keys/${apiKeyId}/rotate`,
        init: { method: 'POST' },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: apiKeyKeys.all(projectId),
      });
    },
  });
};

export const useRevokeApiKey = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (apiKeyId: string): Promise<void> =>
      apiFetch({
        path: `/api/projects/${projectId}/api-keys/${apiKeyId}/revoke`,
        init: { method: 'POST' },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: apiKeyKeys.all(projectId),
      });
    },
  });
};

export const useDeleteApiKey = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (apiKeyId: string): Promise<void> =>
      apiFetch({
        path: `/api/projects/${projectId}/api-keys/${apiKeyId}`,
        init: { method: 'DELETE' },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: apiKeyKeys.all(projectId),
      });
    },
  });
};
