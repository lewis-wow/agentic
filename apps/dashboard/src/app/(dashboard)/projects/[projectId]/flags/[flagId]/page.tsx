import { PROJECT_ROLE } from '@repo/auth/roles';
import Link from 'next/link';

import { requireProjectAccess } from '../../../../../../lib/guards';
import { FlagDetailClient } from './FlagDetailClient';

type Props = {
  params: Promise<{ projectId: string; flagId: string }>;
};

export default async function FlagDetailPage({
  params,
}: Props): Promise<React.ReactNode> {
  const { projectId, flagId } = await params;
  const { projectRole } = await requireProjectAccess(projectId);
  const canManage =
    projectRole === PROJECT_ROLE.OWNER || projectRole === PROJECT_ROLE.ADMIN;

  return (
    <div className="space-y-6">
      <Link
        href={`/projects/${projectId}/flags`}
        className="text-sm text-gray-500 underline"
      >
        ← Flags
      </Link>
      <FlagDetailClient
        projectId={projectId}
        flagId={flagId}
        canManage={canManage}
      />
    </div>
  );
}
