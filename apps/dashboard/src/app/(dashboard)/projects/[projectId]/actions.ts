'use server';

import {
  isMembershipRole,
  PROJECT_ROLE,
  type ProjectRole,
} from '@repo/auth/roles';
import { prisma } from '@repo/prisma';
import { revalidatePath } from 'next/cache';

import { requireProjectAccess } from '../../../../lib/guards';

export type MemberActionState = {
  error?: string;
};

const canManage = (projectRole: ProjectRole): boolean =>
  projectRole === PROJECT_ROLE.OWNER || projectRole === PROJECT_ROLE.ADMIN;

export type AddableUser = {
  id: string;
  name: string;
  email: string;
};

/** Search registered, non-owner users who are not already members. */
export const searchAddableUsers = async (
  projectId: string,
  query: string,
): Promise<AddableUser[]> => {
  const { projectRole } = await requireProjectAccess(projectId);
  if (!canManage(projectRole)) {
    return [];
  }

  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const users = await prisma.user.findMany({
    where: {
      role: { not: 'OWNER' },
      projectMembers: { none: { projectId } },
      OR: [
        { name: { contains: trimmed, mode: 'insensitive' } },
        { email: { contains: trimmed, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, email: true },
    take: 10,
    orderBy: { name: 'asc' },
  });

  return users;
};

export const addMemberAction = async (
  _prev: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> => {
  const projectId = formData.get('projectId');
  const userId = formData.get('userId');
  const role = formData.get('role');

  if (typeof projectId !== 'string' || typeof userId !== 'string') {
    return { error: 'Missing project or user.' };
  }

  if (!isMembershipRole(role)) {
    return { error: 'Invalid role.' };
  }

  const { projectRole } = await requireProjectAccess(projectId);
  if (!canManage(projectRole)) {
    return { error: 'You cannot manage members on this project.' };
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    return { error: 'User not found.' };
  }
  if (target.role === 'OWNER') {
    return { error: 'The owner already has implicit access.' };
  }

  await prisma.projectMember.upsert({
    where: { userId_projectId: { userId, projectId } },
    create: { userId, projectId, role },
    update: { role },
  });

  revalidatePath(`/projects/${projectId}`);
  return {};
};

export const removeMemberAction = async (
  _prev: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> => {
  const projectId = formData.get('projectId');
  const memberId = formData.get('memberId');

  if (typeof projectId !== 'string' || typeof memberId !== 'string') {
    return { error: 'Missing project or member.' };
  }

  const { projectRole } = await requireProjectAccess(projectId);
  if (!canManage(projectRole)) {
    return { error: 'You cannot manage members on this project.' };
  }

  // Scope the delete to this project so a member id from elsewhere can't be used.
  await prisma.projectMember.deleteMany({
    where: { id: memberId, projectId },
  });

  revalidatePath(`/projects/${projectId}`);
  return {};
};
