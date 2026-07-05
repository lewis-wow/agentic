import type { FlagDeletion, PrismaClient, Prisma } from '@repo/prisma';

import type { FlagStreamEvent } from '../events/flagEmitter.js';

/**
 * Allocates the next value from the shared `flag_stream_id_seq` sequence —
 * see docs/adr/0020-durable-sse-replay-via-postgres.md. Only needed for
 * `UPDATE`s: Postgres re-runs a column's `@default(dbgenerated(...))` on
 * `INSERT` automatically, so creating a `FlagState` or `FlagDeletion` row
 * never needs this — only stamping a fresh id onto an existing row does.
 */
export const nextEventId = async (
  tx: Prisma.TransactionClient,
): Promise<bigint> => {
  const [{ nextval }] = await tx.$queryRaw<
    [{ nextval: bigint }]
  >`SELECT nextval('flag_stream_id_seq') AS nextval`;
  return nextval;
};

export type FlagEventServiceOptions = {
  prisma: PrismaClient;
};

export type GetReplayEventsArgs = {
  projectId: string;
  environmentId: string;
  sinceId: bigint;
};

/**
 * Durable SSE reconnect replay — see
 * docs/adr/0020-durable-sse-replay-via-postgres.md. `FlagState` rows already
 * hold the current, environment-scoped value of a flag (created/updated/
 * archived/unarchived all just mean "this row changed"); `FlagDeletion` is
 * the one signal a mutating column can't carry, since the row disappears
 * with the flag. Deletion isn't environment-scoped, so it has no
 * `environmentId` filter.
 */
export class FlagEventService {
  constructor(private readonly options: FlagEventServiceOptions) {}

  async getReplayEvents(args: GetReplayEventsArgs): Promise<FlagStreamEvent[]> {
    const { projectId, environmentId, sinceId } = args;

    type StateWithFlagKey = Prisma.FlagStateGetPayload<{
      include: { flag: { select: { key: true } } };
    }>;

    const [states, deletions]: [StateWithFlagKey[], FlagDeletion[]] =
      await this.options.prisma.$transaction([
        this.options.prisma.flagState.findMany({
          where: {
            environmentId,
            eventId: { gt: sinceId },
            flag: { projectId },
          },
          include: { flag: { select: { key: true } } },
          orderBy: { eventId: 'asc' },
        }),
        this.options.prisma.flagDeletion.findMany({
          where: { projectId, id: { gt: sinceId } },
          orderBy: { id: 'asc' },
        }),
      ]);

    const stateEvents: FlagStreamEvent[] = states.map((state) => ({
      id: state.eventId,
      projectId,
      environmentId,
      type: 'flag_updated',
      payload: {
        key: state.flag.key,
        enabled: state.status === 'active',
        type: state.type,
        rollout: state.rollout,
        rules: state.rules as unknown[],
      },
    }));

    const deletionEvents: FlagStreamEvent[] = deletions.map((deletion) => ({
      id: deletion.id,
      projectId,
      environmentId: null,
      type: 'flag_deleted',
      payload: { key: deletion.key },
    }));

    return [...stateEvents, ...deletionEvents].sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    );
  }
}
