import { PROJECT_ROLE, SYSTEM_ROLE } from '@repo/auth/roles';

import { requireProjectAccess } from '../../../../lib/guards';
import { ProjectDetail } from './ProjectDetail';

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
    <ProjectDetail
      projectId={projectId}
      isOwner={isOwner}
      canManage={canManage}
      projectRole={projectRole}
    />
  );
}
