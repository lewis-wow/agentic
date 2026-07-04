import type { PrismaClient } from '@repo/prisma';
import { Schema } from 'effect';

import {
  EnvironmentNameConflict,
  EnvironmentNotFound,
} from '../exceptions/index.js';
import { EnvironmentListPageSchema } from '../schemas/environments.dto.js';
import { EnvironmentSchema } from '../schemas/environments.js';

export type EnvironmentServiceOptions = {
  prisma: PrismaClient;
};

export type ListEnvironmentsArgs = {
  projectId: string;
  search?: string;
  page: number;
  limit: number;
};

export type CreateEnvironmentArgs = {
  projectId: string;
  name: string;
};

export type RemoveEnvironmentArgs = {
  projectId: string;
  environmentId: string;
};

export class EnvironmentService {
  constructor(private readonly options: EnvironmentServiceOptions) {}

  async list(args: ListEnvironmentsArgs) {
    const { projectId, search, page, limit } = args;
    const trimmedSearch = search?.trim() ?? '';
    const where = {
      projectId,
      ...(trimmedSearch
        ? { name: { contains: trimmedSearch, mode: 'insensitive' as const } }
        : {}),
    };

    const [environments, total] = await Promise.all([
      this.options.prisma.environment.findMany({
        where,
        select: { id: true, name: true },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.options.prisma.environment.count({ where }),
    ]);

    return Schema.encodeSync(EnvironmentListPageSchema)({
      items: environments,
      total,
      page,
      limit,
    });
  }

  async create(args: CreateEnvironmentArgs) {
    const { projectId, name } = args;
    const trimmedName = name.trim();

    const existing = await this.options.prisma.environment.findUnique({
      where: { projectId_name: { projectId, name: trimmedName } },
    });
    if (existing) throw new EnvironmentNameConflict();

    const environment = await this.options.prisma.environment.create({
      data: { name: trimmedName, projectId },
    });

    // `EnvironmentSchema` has no date fields to convert, so decoding the
    // full Prisma row directly (excess columns like `projectId` are dropped
    // automatically) needs no dedicated `*FromPrisma` transform.
    return {
      environment: Schema.decodeUnknownSync(EnvironmentSchema)(environment),
    };
  }

  async remove(args: RemoveEnvironmentArgs): Promise<void> {
    const { projectId, environmentId } = args;

    const result = await this.options.prisma.environment.deleteMany({
      where: { id: environmentId, projectId },
    });
    if (result.count === 0) throw new EnvironmentNotFound();
  }
}
