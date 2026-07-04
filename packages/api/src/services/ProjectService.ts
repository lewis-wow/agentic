import { SYSTEM_ROLE, type SystemRole } from '@repo/auth/roles';
import type { PrismaClient } from '@repo/prisma';
import { Schema } from 'effect';

import { ProjectNotFound } from '../exceptions/index.js';
import {
  ProjectDetailFromPrisma,
  ProjectFromPrisma,
  ProjectListItemFromPrisma,
} from '../schemas/projects.js';

export type ProjectServiceOptions = {
  prisma: PrismaClient;
};

export type ListProjectsArgs = {
  userId: string;
  systemRole: SystemRole;
};

export type CreateProjectArgs = {
  name: string;
};

export type GetProjectArgs = {
  projectId: string;
};

export type RenameProjectArgs = {
  projectId: string;
  name: string;
};

export type RemoveProjectArgs = {
  projectId: string;
};

export class ProjectService {
  constructor(private readonly options: ProjectServiceOptions) {}

  async list(args: ListProjectsArgs) {
    const { userId, systemRole } = args;
    const environmentsInclude = {
      orderBy: { createdAt: 'asc' as const },
      select: { id: true, name: true },
    };

    const projects =
      systemRole === SYSTEM_ROLE.OWNER
        ? await this.options.prisma.project.findMany({
            orderBy: { createdAt: 'asc' },
            include: { environments: environmentsInclude },
          })
        : await this.options.prisma.project.findMany({
            where: { members: { some: { userId } } },
            orderBy: { createdAt: 'asc' },
            include: { environments: environmentsInclude },
          });

    return {
      projects: projects.map((project) =>
        Schema.decodeUnknownSync(ProjectListItemFromPrisma)(project),
      ),
    };
  }

  async create(args: CreateProjectArgs) {
    const project = await this.options.prisma.project.create({
      data: { name: args.name.trim() },
    });

    return { project: Schema.decodeUnknownSync(ProjectFromPrisma)(project) };
  }

  async get(args: GetProjectArgs) {
    const { projectId } = args;

    const project = await this.options.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        environments: { orderBy: { createdAt: 'asc' } },
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!project) throw new ProjectNotFound();

    const owner = await this.options.prisma.user.findFirst({
      where: { role: SYSTEM_ROLE.OWNER },
      select: { id: true, name: true, email: true },
    });

    return {
      project: Schema.decodeUnknownSync(ProjectDetailFromPrisma)({
        ...project,
        owner,
      }),
    };
  }

  async rename(args: RenameProjectArgs) {
    const { projectId, name } = args;

    const existing = await this.options.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!existing) throw new ProjectNotFound();

    const project = await this.options.prisma.project.update({
      where: { id: projectId },
      data: { name: name.trim() },
    });

    return { project: Schema.decodeUnknownSync(ProjectFromPrisma)(project) };
  }

  async remove(args: RemoveProjectArgs): Promise<void> {
    const { projectId } = args;

    const project = await this.options.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new ProjectNotFound();

    await this.options.prisma.project.delete({ where: { id: projectId } });
  }
}
