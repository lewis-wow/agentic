import { flagEmitter, type FlagStreamEvent } from '@repo/api/events';
import { Forbidden } from '@repo/api/exceptions';
import { FlagEventService, SdkService } from '@repo/api/services';
import { isSdkClaims } from '@repo/auth';
import { prisma } from '@repo/prisma';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';

import type { ApiAuthVariables } from '../auth/middleware.js';

type AppEnv = { Variables: ApiAuthVariables };

const sdkService = new SdkService({ prisma });
const flagEventService = new FlagEventService({ prisma });

export const sdkRouter = new Hono<AppEnv>();

sdkRouter.get('/flags/stream', async (c) => {
  const auth = c.get('auth');
  if (!isSdkClaims(auth)) return new Forbidden().toResponse();

  return streamSSE(c, async (stream) => {
    const lastEventIdHeader = c.req.header('Last-Event-ID');
    const lastEventId =
      lastEventIdHeader && /^\d+$/.test(lastEventIdHeader)
        ? BigInt(lastEventIdHeader)
        : undefined;

    // Subscribe-first: register the listener before writing a single byte.
    // A concurrently-running reader can observe bytes we've written before
    // our own `await stream.write(...)` continuation resumes, so any event
    // emitted in that window would otherwise never reach `handler` (durable
    // replay is only consulted when Last-Event-ID is set — a fresh connect
    // has no other safety net). Registering first closes that window
    // entirely.
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

      // Replay path: valid Last-Event-ID — see
      // docs/adr/0020-durable-sse-replay-via-postgres.md. Durable, so
      // there's no "stale" case to detect: an empty result just means
      // nothing changed (falls through to the snapshot path below).
      if (lastEventId !== undefined) {
        const toReplay = await flagEventService.getReplayEvents({
          projectId: auth.projectId,
          environmentId: auth.environmentId,
          sinceId: lastEventId,
        });

        if (toReplay.length > 0) {
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

      // Snapshot path (fresh connect or nothing to replay)
      const encoded = await sdkService.getFlagSnapshot({
        projectId: auth.projectId,
        environmentId: auth.environmentId,
      });

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

  const encoded = await sdkService.getFlagSnapshot({
    projectId: auth.projectId,
    environmentId: auth.environmentId,
  });

  return c.json(encoded);
});
