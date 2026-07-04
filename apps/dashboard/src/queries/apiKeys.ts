import type { ApiKeyListItem } from '@repo/api';
import { usePaginatedQuery, type PagedResponse } from '@repo/pagination';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '../lib/apiFetch';

export type { ApiKeyListItem } from '@repo/api';

export const apiKeyKeys = {
  all: (projectId: string) => ['projects', projectId, 'api-keys'] as const,
  list: (projectId: string, search: string) =>
    [...apiKeyKeys.all(projectId), search] as const,
} as const;

const API_KEYS_LIMIT = 10;

export const useApiKeys = (projectId: string, search = '') =>
  usePaginatedQuery<ApiKeyListItem>({
    queryKey: [...apiKeyKeys.list(projectId, search)],
    queryFn: (page): Promise<PagedResponse<ApiKeyListItem>> => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(API_KEYS_LIMIT),
      });
      if (search) params.set('search', search);

      return apiFetch<PagedResponse<ApiKeyListItem>>({
        path: `/api/projects/${projectId}/api-keys?${params.toString()}`,
      });
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
