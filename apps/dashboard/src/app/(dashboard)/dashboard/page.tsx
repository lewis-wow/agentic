import { SYSTEM_ROLE } from '@repo/auth/roles';
import { prisma } from '@repo/prisma';

import { requireSession } from '../../../lib/guards';
import { CreateProjectForm } from './CreateProjectForm';
import { ProjectsTable } from './ProjectsTable';

export const dynamic = 'force-dynamic';

export default async function DashboardPage(): Promise<React.ReactNode> {
  const user = await requireSession();
  const isOwner = user.role === SYSTEM_ROLE.OWNER;

  const projects = isOwner
    ? await prisma.project.findMany({ orderBy: { createdAt: 'asc' } })
    : await prisma.project.findMany({
        where: { members: { some: { userId: user.id } } },
        orderBy: { createdAt: 'asc' },
      });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Projects</h1>
      </div>

      <ProjectsTable
        projects={projects}
        emptyMessage={
          isOwner
            ? 'No projects yet. Create one below.'
            : 'No projects yet. Ask an owner to grant you access.'
        }
      />

      {isOwner && <CreateProjectForm />}
    </div>
  );
}
