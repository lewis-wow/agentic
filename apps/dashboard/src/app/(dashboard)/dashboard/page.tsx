import { SYSTEM_ROLE } from '@repo/auth/roles';

import { requireSession } from '../../../lib/guards';
import { CreateProjectForm } from './CreateProjectForm';
import { DashboardProjectsSection } from './DashboardProjectsSection';

export const dynamic = 'force-dynamic';

export default async function DashboardPage(): Promise<React.ReactNode> {
  const user = await requireSession();
  const isOwner = user.role === SYSTEM_ROLE.OWNER;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Projects</h1>
      </div>

      <DashboardProjectsSection isOwner={isOwner} />

      {isOwner && <CreateProjectForm />}
    </div>
  );
}
