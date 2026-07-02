import { PROJECT_ROLE } from '@repo/auth/roles';

import { requireProjectAccess } from '../../../../../lib/guards';
import { FlagsClient } from './FlagsClient';

type Props = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ environmentId?: string }>;
};

export default async function FlagsPage({
  params,
  searchParams,
}: Props): Promise<React.ReactNode> {
  const { projectId } = await params;
  const { environmentId } = await searchParams;
  const { projectRole } = await requireProjectAccess(projectId);
  const canManage =
    projectRole === PROJECT_ROLE.OWNER || projectRole === PROJECT_ROLE.ADMIN;

  return (
    <FlagsClient
      projectId={projectId}
      canManage={canManage}
      environmentId={environmentId ?? null}
    />
  );
}
