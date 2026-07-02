import { useMutation, useQueryClient } from '@tanstack/react-query';

import { projectKeys, type Environment } from './projects';

type CreateEnvironmentArgs = {
  name: string;
};

type CreateEnvironmentPayload = {
  environment: Environment;
  fullKey: string;
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
    },
  });
};

export const useRotateApiKey = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (environmentId: string): Promise<{ fullKey: string }> => {
      const res = await fetch(
        `/api/projects/${projectId}/environments/${environmentId}/rotate-key`,
        { method: 'POST' },
      );
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as { fullKey: string };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: projectKeys.detail(projectId),
      });
    },
  });
};
