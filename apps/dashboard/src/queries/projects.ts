import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { projects: ProjectListItem[] };
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
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { project: ProjectListItem };
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
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { project: ProjectDetail };
      return data.project;
    },
  });

export const useDeleteProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (projectId: string): Promise<void> => {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.all() });
    },
  });
};
