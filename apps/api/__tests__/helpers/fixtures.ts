import { prisma } from '@repo/prisma';
import type { Environment, Project, User } from '@repo/prisma';

let counter = 0;
const unique = (label: string): string => `${label}-${Date.now()}-${counter++}`;

export const createTestUser = (): Promise<User> =>
  prisma.user.create({
    data: { name: 'Test User', email: `${unique('user')}@example.com` },
  });

export const createTestProject = (): Promise<Project> =>
  prisma.project.create({ data: { name: unique('project') } });

export const createTestEnvironment = (
  projectId: string,
  name = 'development',
): Promise<Environment> =>
  prisma.environment.create({ data: { projectId, name } });

/** Deletes the project (cascades to environments, flags, flag states, flag deletions). */
export const cleanupProject = (projectId: string): Promise<unknown> =>
  prisma.project.delete({ where: { id: projectId } }).catch(() => undefined);

export const cleanupUser = (userId: string): Promise<unknown> =>
  prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
