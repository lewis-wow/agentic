'use server';

import { ProjectService } from '@repo/api/services';
import { SYSTEM_ROLE } from '@repo/auth/roles';
import { prisma } from '@repo/prisma';
import { redirect } from 'next/navigation';

import { resolveAuthedUser } from '../../../lib/guards';

export type SetupActionState = {
  error?: string;
};

const projectService = new ProjectService({ prisma });

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
  const alreadyExists = await projectService.exists();
  if (alreadyExists) {
    return { error: 'Setup has already been completed.' };
  }

  await projectService.createWithEnvironments({
    name: projectName.trim(),
    environmentNames: ['development', 'production'],
  });

  redirect('/dashboard');
};
