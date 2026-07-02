import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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
} as const;

export const useApiKeys = (projectId: string) =>
  useQuery({
    queryKey: apiKeyKeys.all(projectId),
    queryFn: async (): Promise<ApiKeyListItem[]> => {
      const res = await fetch(`/api/projects/${projectId}/api-keys`);
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { apiKeys: ApiKeyListItem[] };
      return data.apiKeys;
    },
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
