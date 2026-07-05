'use server';

import { SYSTEM_ROLE } from '@repo/auth/roles';
import { prisma } from '@repo/prisma';
import { redirect } from 'next/navigation';

import { resolveAuthedUser } from '../../../lib/guards';

export type SetupActionState = {
  error?: string;
};

export const setupAction = async (
  _prev: SetupActionState,
  formData: FormData,
): Promise<SetupActionState> => {
  const projectName = formData.get('projectName');

  if (typeof projectName !== 'string' || !projectName.trim()) {
    return { error: 'Project name is required.' };
  }

  const user = await resolveAuthedUser();
  if (!user || user.role !== SYSTEM_ROLE.OWNER) {
    return { error: 'Only the installation owner can complete setup.' };
  }

  // Guard against a second first-project being created via a race or replay.
  const existingProjects = await prisma.project.count();
  if (existingProjects > 0) {
    return { error: 'Setup has already been completed.' };
  }

  await prisma.project.create({
    data: {
      name: projectName.trim(),
      environments: {
        create: [{ name: 'development' }, { name: 'production' }],
      },
    },
  });

  redirect('/dashboard');
};
