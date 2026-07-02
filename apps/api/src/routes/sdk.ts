import {
  type FlagType,
  type TargetingRule,
  FlagSnapshotResponseSchema,
} from '@repo/api';
import { isSdkClaims } from '@repo/auth';
import { prisma } from '@repo/prisma';
import { Schema } from 'effect';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';

import type { ApiAuthVariables } from '../auth/middleware.js';
import {
  flagEmitter,
  getRingBuffer,
  type FlagStreamEvent,
} from '../events/emitter.js';
import { Forbidden } from '../exceptions/index.js';

type AppEnv = { Variables: ApiAuthVariables };

const toSdkFlagType = (prismaType: string): FlagType => {
  if (prismaType === 'percentage_rollout') return 'percentage_rollout';
  if (prismaType === 'targeted') return 'targeted';
  return 'boolean';
};

const parseRules = (raw: unknown): TargetingRule[] => {
  if (!Array.isArray(raw)) return [];
  return raw as TargetingRule[];
};

export const sdkRouter = new Hono<AppEnv>();

sdkRouter.get('/flags/stream', async (c) => {
  const auth = c.get('auth');
  if (!isSdkClaims(auth)) return new Forbidden().toResponse();

  return streamSSE(c, async (stream) => {
    const lastEventIdHeader = c.req.header('Last-Event-ID');
    const lastEventId = lastEventIdHeader
      ? parseInt(lastEventIdHeader, 10)
      : NaN;

    // Subscribe-first: register the listener before writing a single byte.
    // A concurrently-running reader can observe bytes we've written before
    // our own `await stream.write(...)` continuation resumes, so any event
    // emitted in that window would otherwise never reach `handler` (the
    // ring buffer is only consulted on replay, i.e. when Last-Event-ID is
    // set — a fresh connect has no other safety net). Registering first
    // closes that window entirely.
    const buffered: FlagStreamEvent[] = [];
    let buffering = true;

    const passesEnvFilter = (event: FlagStreamEvent): boolean =>
      event.environmentId === null ||
      event.environmentId === auth.environmentId;

    const handler = (event: FlagStreamEvent): void => {
      if (event.projectId !== auth.projectId) return;
      if (buffering) {
        buffered.push(event);
        return;
      }
      if (!passesEnvFilter(event)) return;
      void stream.writeSSE({
        id: String(event.id),
        event: event.type,
        data: JSON.stringify(event.payload),
      });
    };

    flagEmitter.on('flag-event', handler);

    const heartbeatId = setInterval(() => {
      void stream.write(': keep-alive\n\n');
    }, 30_000);

    stream.onAbort(() => {
      clearInterval(heartbeatId);
      flagEmitter.off('flag-event', handler);
    });

    const flushBufferAndGoLive = async (): Promise<void> => {
      buffering = false;
      for (const event of buffered) {
        if (!passesEnvFilter(event)) continue;
        await stream.writeSSE({
          id: String(event.id),
          event: event.type,
          data: JSON.stringify(event.payload),
        });
      }
    };

    try {
      await stream.write('retry: 1000\n\n');

      // Replay path: valid Last-Event-ID that exists in the ring buffer
      if (!isNaN(lastEventId)) {
        const ringBuffer = getRingBuffer(auth.projectId);
        const toReplay = ringBuffer.filter(
          (e) => e.id > lastEventId && passesEnvFilter(e),
        );

        const oldestBufferedId = ringBuffer[0]?.id;

        const isStale =
          oldestBufferedId !== undefined && lastEventId < oldestBufferedId;

        if (toReplay.length > 0 && !isStale) {
          for (const event of toReplay) {
            await stream.writeSSE({
              id: String(event.id),
              event: event.type,
              data: JSON.stringify(event.payload),
            });
          }

          await flushBufferAndGoLive();
          await new Promise<void>((resolve) => {
            stream.onAbort(resolve);
          });
          return;
        }
      }

      // Snapshot path (fresh connect or stale/absent Last-Event-ID)
      const flagsWithStates = await prisma.flag.findMany({
        where: { projectId: auth.projectId },
        include: {
          states: {
            where: { environmentId: auth.environmentId },
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

      const encoded = Schema.encodeSync(FlagSnapshotResponseSchema)({ flags });

      await stream.writeSSE({
        event: 'snapshot',
        data: JSON.stringify(encoded),
      });

      await flushBufferAndGoLive();

      await new Promise<void>((resolve) => {
        stream.onAbort(resolve);
      });
    } finally {
      clearInterval(heartbeatId);
      flagEmitter.off('flag-event', handler);
    }
  });
});

sdkRouter.get('/flags', async (c) => {
  const auth = c.get('auth');
  if (!isSdkClaims(auth)) return new Forbidden().toResponse();

  const flagsWithStates = await prisma.flag.findMany({
    where: { projectId: auth.projectId },
    include: {
      states: {
        where: { environmentId: auth.environmentId },
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

  const encoded = Schema.encodeSync(FlagSnapshotResponseSchema)({ flags });

  return c.json(encoded);
});
