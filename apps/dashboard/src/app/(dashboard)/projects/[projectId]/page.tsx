import { PROJECT_ROLE, SYSTEM_ROLE } from '@repo/auth/roles';
import Link from 'next/link';

import { requireProjectAccess } from '../../../../lib/guards';
import { DeleteProjectForm } from './DeleteProjectForm';
import { EnvironmentsPanel } from './EnvironmentsPanel';
import { MembersPanel } from './MembersPanel';
import { ProjectHeader } from './ProjectHeader';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectPage({
  params,
}: Props): Promise<React.ReactNode> {
  const { projectId } = await params;
  const { user, projectRole } = await requireProjectAccess(projectId);

  const isOwner = user.role === SYSTEM_ROLE.OWNER;
  const canManage =
    projectRole === PROJECT_ROLE.OWNER || projectRole === PROJECT_ROLE.ADMIN;

  return (
    <div className="space-y-8">
      <ProjectHeader projectId={projectId} projectRole={projectRole} />

      <div className="flex items-center justify-between rounded-md border px-4 py-3">
        <div>
          <p className="text-sm font-medium">Feature Flags</p>
          <p className="text-xs text-gray-500">
            Manage boolean flags for this project
          </p>
        </div>
        <Link
          href={`/projects/${projectId}/flags`}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Open Flags
        </Link>
      </div>

      <EnvironmentsPanel projectId={projectId} canManage={canManage} />

      <MembersPanel projectId={projectId} canManage={canManage} />

      {isOwner && <DeleteProjectForm projectId={projectId} />}
    </div>
  );
}
