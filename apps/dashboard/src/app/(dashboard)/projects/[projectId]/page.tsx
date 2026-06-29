import { PROJECT_ROLE } from '@repo/auth/roles';
import { prisma } from '@repo/prisma';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requireProjectAccess } from '../../../../lib/guards.js';
import { MembersPanel } from './MembersPanel.js';

type Props = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectPage({
  params,
}: Props): Promise<React.ReactNode> {
  const { projectId } = await params;
  const { projectRole } = await requireProjectAccess(projectId);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      environments: { orderBy: { createdAt: 'asc' } },
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!project) {
    notFound();
  }

  const owner = await prisma.user.findFirst({
    where: { role: 'OWNER' },
    select: { id: true, name: true, email: true },
  });

  const canManage =
    projectRole === PROJECT_ROLE.OWNER || projectRole === PROJECT_ROLE.ADMIN;

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <Link href="/dashboard" className="text-sm text-gray-500 underline">
          ← Projects
        </Link>
        <h1 className="text-xl font-semibold">{project.name}</h1>
        <p className="text-sm text-gray-500">
          Your access: <span className="font-medium">{projectRole}</span>
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Environments
        </h2>
        <ul className="space-y-2">
          {project.environments.map((environment) => (
            <li
              key={environment.id}
              className="rounded-md border px-4 py-3 text-sm"
            >
              {environment.name}
            </li>
          ))}
        </ul>
      </section>

      <MembersPanel
        projectId={project.id}
        canManage={canManage}
        owner={owner}
        members={project.members.map((member) => ({
          id: member.id,
          role: member.role,
          user: member.user,
        }))}
      />
    </div>
  );
}
