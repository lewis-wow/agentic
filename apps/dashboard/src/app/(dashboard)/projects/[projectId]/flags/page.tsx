import { PROJECT_ROLE } from '@repo/auth/roles';
import Link from 'next/link';

import { requireProjectAccess } from '../../../../../lib/guards.js';
import { FlagsClient } from './FlagsClient.js';

type Props = {
  params: Promise<{ projectId: string }>;
};

export default async function FlagsPage({
  params,
}: Props): Promise<React.ReactNode> {
  const { projectId } = await params;
  const { projectRole } = await requireProjectAccess(projectId);
  const canManage =
    projectRole === PROJECT_ROLE.OWNER || projectRole === PROJECT_ROLE.ADMIN;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link
          href={`/projects/${projectId}`}
          className="text-sm text-gray-500 underline"
        >
          ← Project
        </Link>
        <h1 className="text-xl font-semibold">Feature Flags</h1>
      </div>
      <FlagsClient projectId={projectId} canManage={canManage} />
    </div>
  );
}
