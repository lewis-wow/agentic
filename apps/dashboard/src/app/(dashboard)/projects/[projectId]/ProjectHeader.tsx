'use client';

import { Skeleton } from '@repo/ui/components/ui/skeleton';
import Link from 'next/link';

import { useProject } from '../../../../queries/projects';

type Props = {
  projectId: string;
  projectRole: string;
};

export const ProjectHeader = ({
  projectId,
  projectRole,
}: Props): React.ReactNode => {
  const { data: project } = useProject(projectId);

  return (
    <div className="space-y-1">
      <Link href="/dashboard" className="text-sm text-gray-500 underline">
        ← Projects
      </Link>
      {project ? (
        <h1 className="text-xl font-semibold">{project.name}</h1>
      ) : (
        <Skeleton className="h-7 w-48" />
      )}
      <p className="text-sm text-gray-500">
        Your access: <span className="font-medium">{projectRole}</span>
      </p>
    </div>
  );
};
