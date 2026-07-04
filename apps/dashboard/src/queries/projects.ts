import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '../lib/apiFetch';

export type Environment = {
  id: string;
  name: string;
};

export type ProjectListItem = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  environments: { id: string; name: string }[];
};

export type ProjectMember = {
  id: string;
  role: string;
  user: { id: string; name: string; email: string };
};

export type ProjectOwner = { id: string; name: string; email: string } | null;

export type ProjectDetail = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  environments: Environment[];
  members: ProjectMember[];
  owner: ProjectOwner;
};

export const projectKeys = {
  all: () => ['projects'] as const,
  detail: (projectId: string) => ['projects', projectId] as const,
} as const;

export const useProjects = () =>
  useQuery({
    queryKey: projectKeys.all(),
    queryFn: async (): Promise<ProjectListItem[]> => {
      const data = await apiFetch<{ projects: ProjectListItem[] }>({
        path: '/api/projects',
      });
      return data.projects;
    },
  });

type CreateProjectArgs = {
  name: string;
};

export const useCreateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: CreateProjectArgs): Promise<ProjectListItem> => {
      const data = await apiFetch<{ project: ProjectListItem }>({
        path: '/api/projects',
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args),
        },
      });
      return data.project;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.all() });
    },
  });
};

export const useProject = (projectId: string) =>
  useQuery({
    queryKey: projectKeys.detail(projectId),
    queryFn: async (): Promise<ProjectDetail> => {
      const data = await apiFetch<{ project: ProjectDetail }>({
        path: `/api/projects/${projectId}`,
      });
      return data.project;
    },
  });

type RenameProjectArgs = {
  name: string;
};

export const useRenameProject = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: RenameProjectArgs): Promise<ProjectDetail> => {
      const data = await apiFetch<{ project: ProjectDetail }>({
        path: `/api/projects/${projectId}`,
        init: {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args),
        },
      });
      return data.project;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: projectKeys.detail(projectId),
      });
      void queryClient.invalidateQueries({ queryKey: projectKeys.all() });
    },
  });
};

export const useDeleteProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string): Promise<void> =>
      apiFetch({
        path: `/api/projects/${projectId}`,
        init: { method: 'DELETE' },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.all() });
    },
  });
};
