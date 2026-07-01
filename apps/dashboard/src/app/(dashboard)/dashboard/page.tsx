import { SYSTEM_ROLE } from '@repo/auth/roles';
import { prisma } from '@repo/prisma';
import Link from 'next/link';

import { requireSession } from '../../../lib/guards';
import { CreateProjectForm } from './CreateProjectForm';

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

      {projects.length === 0 ? (
        <p className="text-sm text-gray-500">
          {isOwner
            ? 'No projects yet. Create one below.'
            : 'No projects yet. Ask an owner to grant you access.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/projects/${project.id}`}
                className="block rounded-md border px-4 py-3 text-sm hover:bg-gray-50"
              >
                {project.name}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {isOwner && <CreateProjectForm />}
    </div>
  );
}
