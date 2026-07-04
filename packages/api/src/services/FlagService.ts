import type { PrismaClient } from '@repo/prisma';
import { Schema } from 'effect';

import {
  FlagKeyConflict,
  FlagKeyRequired,
  FlagNameRequired,
  FlagNotFound,
  InvalidFlagKey,
} from '../exceptions/index.js';
import { FlagDetailFromPrisma } from '../schemas/flags.js';

// A structural type, not an import of apps/api's concrete emitter — this
// package must stay usable without any particular transport/runtime wired
// up. apps/api passes its real `emitFlagEvent` (from `src/events/emitter.ts`)
// here; it satisfies this shape.
export type EmitFlagEvent = (event: {
  projectId: string;
  environmentId: string | null;
  type:
    | 'flag_created'
    | 'flag_updated'
    | 'flag_archived'
    | 'flag_unarchived'
    | 'flag_deleted';
  payload: {
    key: string;
    enabled?: boolean;
    type?: string;
    rollout?: number;
    rules?: unknown[];
  };
}) => unknown;

export type FlagServiceOptions = {
  prisma: PrismaClient;
  emitFlagEvent: EmitFlagEvent;
};

const FLAG_KEY_RE = /^[a-z0-9-]+$/;

export type CreateFlagArgs = {
  projectId: string;
  userId: string;
  key: string;
  name: string;
};

export type GetFlagArgs = {
  projectId: string;
  flagId: string;
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

  async get(args: GetFlagArgs) {
    const { projectId, flagId } = args;

    const flag = await this.options.prisma.flag.findUnique({
      where: { id: flagId, projectId },
      include: {
        states: {
          include: {
            environment: { select: { id: true, name: true } },
          },
          orderBy: { environment: { createdAt: 'asc' } },
        },
      },
    });
    if (!flag) throw new FlagNotFound();

    return { flag: Schema.decodeUnknownSync(FlagDetailFromPrisma)(flag) };
  }
}
