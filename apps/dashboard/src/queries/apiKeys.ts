import { usePaginatedQuery, type PagedResponse } from '@repo/pagination';
import { useMutation, useQueryClient } from '@tanstack/react-query';

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

      const res = await fetch(
        `/api/projects/${projectId}/api-keys?${params.toString()}`,
      );
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as {
        apiKeys: ApiKeyListItem[];
        total: number;
        page: number;
        limit: number;
      };
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
    mutationFn: async (
      args: CreateApiKeyArgs,
    ): Promise<CreateApiKeyPayload> => {
      const res = await fetch(`/api/projects/${projectId}/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as CreateApiKeyPayload;
    },
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
    mutationFn: async (apiKeyId: string): Promise<{ fullKey: string }> => {
      const res = await fetch(
        `/api/projects/${projectId}/api-keys/${apiKeyId}/rotate`,
        { method: 'POST' },
      );
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as { fullKey: string };
    },
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
    mutationFn: async (apiKeyId: string): Promise<void> => {
      const res = await fetch(
        `/api/projects/${projectId}/api-keys/${apiKeyId}/revoke`,
        { method: 'POST' },
      );
      if (!res.ok) throw new Error(await res.text());
    },
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
    mutationFn: async (apiKeyId: string): Promise<void> => {
      const res = await fetch(
        `/api/projects/${projectId}/api-keys/${apiKeyId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: apiKeyKeys.all(projectId),
      });
    },
  });
};
