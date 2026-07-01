'use server';

import { generateApiKey } from '@repo/auth/api-key';
import { PROJECT_ROLE } from '@repo/auth/roles';
import { prisma } from '@repo/prisma';
import { revalidatePath } from 'next/cache';

import { requireProjectAccess } from '../../../../lib/guards';

export type EnvironmentActionState = {
  error?: string;
  fullKey?: string;
};

const canManage = (projectRole: string): boolean =>
  projectRole === PROJECT_ROLE.OWNER || projectRole === PROJECT_ROLE.ADMIN;

export const createEnvironmentAction = async (
  _prev: EnvironmentActionState,
  formData: FormData,
): Promise<EnvironmentActionState> => {
  const projectId = formData.get('projectId');
  const name = formData.get('name');

  if (
    typeof projectId !== 'string' ||
    typeof name !== 'string' ||
    !name.trim()
  ) {
    return { error: 'Environment name is required.' };
  }

  const { projectRole } = await requireProjectAccess(projectId);
  if (!canManage(projectRole)) {
    return { error: 'You do not have permission to create environments.' };
  }

  const existing = await prisma.environment.findUnique({
    where: { projectId_name: { projectId, name: name.trim() } },
  });
  if (existing) {
    return { error: `An environment named "${name.trim()}" already exists.` };
  }

  const { fullKey, apiKeyId, apiKeyHash } = await generateApiKey();

  await prisma.environment.create({
    data: { name: name.trim(), projectId, apiKeyId, apiKeyHash },
  });

  revalidatePath(`/projects/${projectId}`);
  return { fullKey };
};

export const deleteEnvironmentAction = async (
  _prev: EnvironmentActionState,
  formData: FormData,
): Promise<EnvironmentActionState> => {
  const projectId = formData.get('projectId');
  const environmentId = formData.get('environmentId');
  const confirmation = formData.get('confirmation');
  const expectedName = formData.get('expectedName');

  if (
    typeof projectId !== 'string' ||
    typeof environmentId !== 'string' ||
    typeof confirmation !== 'string' ||
    typeof expectedName !== 'string'
  ) {
    return { error: 'Invalid request.' };
  }

  if (confirmation !== expectedName) {
    return { error: 'Environment name does not match.' };
  }

  const { projectRole } = await requireProjectAccess(projectId);
  if (!canManage(projectRole)) {
    return { error: 'You do not have permission to delete environments.' };
  }

  await prisma.environment.deleteMany({
    where: { id: environmentId, projectId },
  });

  revalidatePath(`/projects/${projectId}`);
  return {};
};

export const rotateApiKeyAction = async (
  _prev: EnvironmentActionState,
  formData: FormData,
): Promise<EnvironmentActionState> => {
  const projectId = formData.get('projectId');
  const environmentId = formData.get('environmentId');

  if (typeof projectId !== 'string' || typeof environmentId !== 'string') {
    return { error: 'Invalid request.' };
  }

  const { projectRole } = await requireProjectAccess(projectId);
  if (!canManage(projectRole)) {
    return { error: 'You do not have permission to rotate API keys.' };
  }

  const { fullKey, apiKeyId, apiKeyHash } = await generateApiKey();

  await prisma.environment.update({
    where: { id: environmentId },
    data: { apiKeyId, apiKeyHash },
  });

  revalidatePath(`/projects/${projectId}`);
  return { fullKey };
};
