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

  // Role-agnostic "has any project been created yet" check — deliberately
  // unscoped by systemRole (unlike list(), which returns [] for non-owners),
  // since "is this installation initialized" must answer the same way for
  // every caller.
  async exists(): Promise<boolean> {
    const count = await this.options.prisma.project.count();
    return count > 0;
  }

  // Project access is owner-only (no per-project membership) — a non-owner
  // has no projects to list.
  async list(args: ListProjectsArgs) {
    const { systemRole } = args;
    if (systemRole !== SYSTEM_ROLE.OWNER) {
      return { projects: [] };
    }

    const projects = await this.options.prisma.project.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        environments: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true },
        },
      },
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
      },
    });
    if (!project) throw new ProjectNotFound();

    return {
      project: Schema.decodeUnknownSync(ProjectDetailFromPrisma)(project),
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
