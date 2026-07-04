import type { PrismaClient } from '@repo/prisma';
import { Schema } from 'effect';

import { FlagSnapshotResponseSchema } from '../schemas/flags.dto.js';
import type { FlagType, TargetingRule } from '../schemas/flags.js';

export type SdkServiceOptions = {
  prisma: PrismaClient;
};

export type GetFlagSnapshotArgs = {
  projectId: string;
  environmentId: string;
};

const toSdkFlagType = (prismaType: string): FlagType => {
  if (prismaType === 'percentage_rollout') return 'percentage_rollout';
  if (prismaType === 'targeted') return 'targeted';
  return 'boolean';
};

const parseRules = (raw: unknown): TargetingRule[] => {
  if (!Array.isArray(raw)) return [];
  return raw as TargetingRule[];
};

export class SdkService {
  constructor(private readonly options: SdkServiceOptions) {}

  // Shared by GET /v1/flags and the snapshot phase of GET /v1/flags/stream —
  // the SSE mechanics (streaming, replay, heartbeat) stay in the Hono route,
  // this is just the "what are this project/environment's current flags"
  // read, framework-agnostic and reusable from either call site.
  async getFlagSnapshot(args: GetFlagSnapshotArgs) {
    const { projectId, environmentId } = args;

    const flagsWithStates = await this.options.prisma.flag.findMany({
      where: { projectId },
      include: {
        states: {
          where: { environmentId },
          select: { status: true, type: true, rollout: true, rules: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const flags = flagsWithStates
      .filter((flag) => flag.states[0]?.status !== 'archived')
      .map((flag) => ({
        key: flag.key,
        enabled: flag.states[0]?.status === 'active',
        type: toSdkFlagType(flag.states[0]?.type ?? 'boolean'),
        rollout: flag.states[0]?.rollout ?? 0,
        rules: parseRules(flag.states[0]?.rules),
      }));

    return Schema.encodeSync(FlagSnapshotResponseSchema)({ flags });
  }
}
