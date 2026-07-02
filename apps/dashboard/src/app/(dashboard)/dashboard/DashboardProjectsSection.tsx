'use client';

import { useProjects } from '../../../queries/projects';
import { ProjectsTable } from './ProjectsTable';

type Props = {
  isOwner: boolean;
};

export const DashboardProjectsSection = ({
  isOwner,
}: Props): React.ReactNode => {
  const { data: projects = [], isPending } = useProjects();

  if (isPending) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }

  return (
    <ProjectsTable
      projects={projects}
      emptyMessage={
        isOwner
          ? 'No projects yet. Create one below.'
          : 'No projects yet. Ask an owner to grant you access.'
      }
    />
  );
};
