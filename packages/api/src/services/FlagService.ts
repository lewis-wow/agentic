import type { PrismaClient } from '@repo/prisma';

import type { emitFlagEvent } from '../events/emitter.js';
import {
  FlagKeyConflict,
  FlagKeyRequired,
  FlagNameRequired,
  InvalidFlagKey,
} from '../exceptions/index.js';

export type FlagServiceOptions = {
  prisma: PrismaClient;
  emitFlagEvent: typeof emitFlagEvent;
};

const FLAG_KEY_RE = /^[a-z0-9-]+$/;

export type CreateFlagArgs = {
  projectId: string;
  userId: string;
  key: string;
  name: string;
};

export class FlagService {
  constructor(private readonly options: FlagServiceOptions) {}

  async create(args: CreateFlagArgs) {
    const { projectId, userId, key, name } = args;

    if (!key) throw new FlagKeyRequired();
    if (!name) throw new FlagNameRequired();
    if (!FLAG_KEY_RE.test(key)) throw new InvalidFlagKey();

    const existing = await this.options.prisma.flag.findUnique({
      where: { projectId_key: { projectId, key } },
    });
    if (existing) throw new FlagKeyConflict();

    const environments = await this.options.prisma.environment.findMany({
      where: { projectId },
      select: { id: true },
    });

    const flag = await this.options.prisma.flag.create({
      data: {
        projectId,
        key,
        name,
        states: {
          create: environments.map((e) => ({
            environmentId: e.id,
            status: 'inactive',
            type: 'boolean',
          })),
        },
        auditLog: {
          create: {
            userId,
            action: 'flag.created',
            meta: { key, name },
          },
        },
      },
    });

    this.options.emitFlagEvent({
      projectId,
      environmentId: null,
      type: 'flag_created',
      payload: { key, enabled: false, type: 'boolean', rollout: 0 },
    });

    return { flag };
  }
}
