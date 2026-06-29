import { SYSTEM_ROLE } from '@repo/auth/roles';
import { prisma } from '@repo/prisma';
import Link from 'next/link';

import { requireSession } from '../../../lib/guards.js';

export default async function DashboardPage(): Promise<React.ReactNode> {
  const user = await requireSession();

  // Owners see every project; members only see projects they belong to.
  const projects =
    user.role === SYSTEM_ROLE.OWNER
      ? await prisma.project.findMany({ orderBy: { createdAt: 'asc' } })
      : await prisma.project.findMany({
          where: { members: { some: { userId: user.id } } },
          orderBy: { createdAt: 'asc' },
        });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Projects</h1>
      {projects.length === 0 ? (
        <p className="text-gray-500">
          No projects yet. Ask an owner to grant you access.
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
    </div>
  );
}
