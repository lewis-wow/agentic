'use server';

import { prisma } from '@repo/prisma';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireOwner } from '../../../lib/guards.js';

export type ProjectActionState = {
  error?: string;
};

export const createProjectAction = async (
  _prev: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> => {
  await requireOwner();

  const name = formData.get('name');
  if (typeof name !== 'string' || !name.trim()) {
    return { error: 'Project name is required.' };
  }

  await prisma.project.create({ data: { name: name.trim() } });
  revalidatePath('/dashboard');
  return {};
};

export const deleteProjectAction = async (
  _prev: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> => {
  await requireOwner();

  const projectId = formData.get('projectId');
  const confirmation = formData.get('confirmation');
  const expectedName = formData.get('expectedName');

  if (
    typeof projectId !== 'string' ||
    typeof confirmation !== 'string' ||
    typeof expectedName !== 'string'
  ) {
    return { error: 'Invalid request.' };
  }

  if (confirmation !== expectedName) {
    return { error: 'Project name does not match.' };
  }

  await prisma.project.delete({ where: { id: projectId } });
  redirect('/dashboard');
};
