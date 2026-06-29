import { PROJECT_ROLE, SYSTEM_ROLE } from '@repo/auth/roles';
import { prisma } from '@repo/prisma';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requireProjectAccess } from '../../../../lib/guards.js';
import { DeleteProjectForm } from './DeleteProjectForm.js';
import { EnvironmentsPanel } from './EnvironmentsPanel.js';
import { MembersPanel } from './MembersPanel.js';

type Props = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectPage({
  params,
}: Props): Promise<React.ReactNode> {
  const { projectId } = await params;
  const { user, projectRole } = await requireProjectAccess(projectId);

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

  const isOwner = user.role === SYSTEM_ROLE.OWNER;
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

      <EnvironmentsPanel
        projectId={project.id}
        canManage={canManage}
        environments={project.environments.map((e) => ({
          id: e.id,
          name: e.name,
          apiKeyId: e.apiKeyId,
        }))}
      />

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

      {isOwner && (
        <DeleteProjectForm projectId={project.id} projectName={project.name} />
      )}
    </div>
  );
}
