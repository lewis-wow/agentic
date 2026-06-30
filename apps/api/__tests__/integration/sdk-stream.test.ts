import type { SdkJwtClaims, ProjectJwtClaims } from '@repo/auth';
import { signRs256 } from '@repo/auth/jwt';
import { PROJECT_ROLE, SYSTEM_ROLE } from '@repo/auth/roles';
import { prisma } from '@repo/prisma';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type ApiAuthVariables,
  createJwtVerifyMiddleware,
} from '../../src/auth/middleware.js';
import { _resetForTesting, emitFlagEvent } from '../../src/events/emitter.js';
import { sdkRouter } from '../../src/routes/sdk.js';
import { generateTestKeys } from '../helpers/keys.js';

vi.mock('@repo/prisma', () => ({
  prisma: {
    flag: { findMany: vi.fn() },
  },
}));

const { privateKey, publicKey } = generateTestKeys();

type AppEnv = { Variables: ApiAuthVariables };

const buildApp = (): Hono<AppEnv> => {
  const app = new Hono<AppEnv>();
  const jwtAuth = createJwtVerifyMiddleware({ publicKeyPem: publicKey });
  app.use('/v1/*', jwtAuth);
  app.route('/v1', sdkRouter);
  return app;
};

const sdkToken = (projectId: string, environmentId: string): string =>
  signRs256({
    payload: {
      projectId,
      environmentId,
      projectRole: PROJECT_ROLE.SDK_CLIENT,
    } satisfies SdkJwtClaims,
    privateKeyPem: privateKey,
    expiresInSeconds: 60,
  });

const projectToken = (projectId: string): string =>
  signRs256({
    payload: {
      userId: 'user-1',
      systemRole: SYSTEM_ROLE.OWNER,
      projectId,
      projectRole: PROJECT_ROLE.OWNER,
    } satisfies ProjectJwtClaims,
    privateKeyPem: privateKey,
    expiresInSeconds: 60,
  });

const makeReader = (
  body: ReadableStream<Uint8Array>,
): {
  readUntil: (
    condition: (text: string) => boolean,
    timeoutMs?: number,
  ) => Promise<string>;
  cancel: () => Promise<void>;
} => {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let accumulated = '';

  const readUntil = async (
    condition: (text: string) => boolean,
    timeoutMs = 2000,
  ): Promise<string> => {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('SSE read timeout')), timeoutMs),
    );

    while (!condition(accumulated)) {
      const { value, done } = await Promise.race([reader.read(), timeout]);
      if (done) break;
      accumulated += decoder.decode(value, { stream: true });
    }

    return accumulated;
  };

  const cancel = (): Promise<void> =>
    reader.cancel().catch(() => undefined) as Promise<void>;

  return { readUntil, cancel };
};

describe('GET /v1/flags/stream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetForTesting();
  });

  it('returns 401 when Authorization header is missing', async () => {
    const app = buildApp();
    const res = await app.request('/v1/flags/stream');
    expect(res.status).toBe(401);
  });

  it('returns 403 for a project-scoped JWT', async () => {
    const app = buildApp();
    const res = await app.request('/v1/flags/stream', {
      headers: { Authorization: `Bearer ${projectToken('proj-1')}` },
    });
    expect(res.status).toBe(403);
  });

  it('returns text/event-stream content type and retry directive on connect', async () => {
    vi.mocked(prisma.flag.findMany).mockResolvedValue([] as never);

    const app = buildApp();
    const res = await app.request('/v1/flags/stream', {
      headers: { Authorization: `Bearer ${sdkToken('proj-1', 'env-1')}` },
    });

    expect(res.headers.get('Content-Type')).toMatch('text/event-stream');
    const { readUntil, cancel } = makeReader(res.body!);
    const text = await readUntil((t) => t.includes('retry: 1000'));
    await cancel();
    expect(text).toContain('retry: 1000');
  });

  it('sends a snapshot of active flags (archived excluded) on connect', async () => {
    vi.mocked(prisma.flag.findMany).mockResolvedValue([
      {
        id: 'flag-1',
        key: 'dark-mode',
        name: 'Dark Mode',
        projectId: 'proj-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        states: [{ status: 'active', type: 'boolean', rollout: 0, rules: [] }],
      },
      {
        id: 'flag-2',
        key: 'beta-ui',
        name: 'Beta UI',
        projectId: 'proj-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        states: [
          {
            status: 'inactive',
            type: 'percentage_rollout',
            rollout: 25,
            rules: [],
          },
        ],
      },
      {
        id: 'flag-3',
        key: 'old-feature',
        name: 'Old Feature',
        projectId: 'proj-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        states: [
          { status: 'archived', type: 'boolean', rollout: 0, rules: [] },
        ],
      },
    ] as never);

    const app = buildApp();
    const res = await app.request('/v1/flags/stream', {
      headers: { Authorization: `Bearer ${sdkToken('proj-1', 'env-1')}` },
    });

    const { readUntil, cancel } = makeReader(res.body!);
    const text = await readUntil((t) => t.includes('event: snapshot'));
    await cancel();

    expect(text).toContain('event: snapshot');
    const dataLine = text
      .split('\n')
      .find((l) => l.startsWith('data:') && l.includes('flags'));
    const payload = JSON.parse(dataLine!.slice('data:'.length).trim()) as {
      flags: {
        key: string;
        enabled: boolean;
        type: string;
        rollout: number;
        rules: unknown[];
      }[];
    };
    expect(payload.flags).toEqual([
      {
        key: 'dark-mode',
        enabled: true,
        type: 'boolean',
        rollout: 0,
        rules: [],
      },
      {
        key: 'beta-ui',
        enabled: false,
        type: 'percentage_rollout',
        rollout: 25,
        rules: [],
      },
    ]);
  });

  it('delivers flag_created to a connected client after snapshot', async () => {
    vi.mocked(prisma.flag.findMany).mockResolvedValue([] as never);

    const app = buildApp();
    const res = await app.request('/v1/flags/stream', {
      headers: { Authorization: `Bearer ${sdkToken('proj-1', 'env-1')}` },
    });

    const { readUntil, cancel } = makeReader(res.body!);

    // Wait for snapshot before emitting live events
    await readUntil((t) => t.includes('event: snapshot'));

    emitFlagEvent({
      projectId: 'proj-1',
      environmentId: null,
      type: 'flag_created',
      payload: { key: 'new-flag', enabled: false },
    });

    const text = await readUntil((t) => t.includes('flag_created'));
    await cancel();

    expect(text).toContain('event: flag_created');
    const dataLine = text
      .split('\n')
      .find((l) => l.startsWith('data:') && l.includes('new-flag'));
    const payload = JSON.parse(dataLine!.slice('data:'.length).trim()) as {
      key: string;
      enabled: boolean;
    };
    expect(payload).toEqual({ key: 'new-flag', enabled: false });
  });

  it('delivers flag_updated only to the matching environment, not to others', async () => {
    vi.mocked(prisma.flag.findMany).mockResolvedValue([] as never);

    const app = buildApp();

    // Two clients: env-1 and env-2
    const [res1, res2] = await Promise.all([
      app.request('/v1/flags/stream', {
        headers: { Authorization: `Bearer ${sdkToken('proj-1', 'env-1')}` },
      }),
      app.request('/v1/flags/stream', {
        headers: { Authorization: `Bearer ${sdkToken('proj-1', 'env-2')}` },
      }),
    ]);

    const client1 = makeReader(res1.body!);
    const client2 = makeReader(res2.body!);

    // Both receive snapshots
    await Promise.all([
      client1.readUntil((t) => t.includes('event: snapshot')),
      client2.readUntil((t) => t.includes('event: snapshot')),
    ]);

    // Emit flag_updated scoped to env-1
    emitFlagEvent({
      projectId: 'proj-1',
      environmentId: 'env-1',
      type: 'flag_updated',
      payload: { key: 'my-flag', enabled: true },
    });

    // client1 (env-1) should receive it
    const text1 = await client1.readUntil((t) => t.includes('flag_updated'));
    expect(text1).toContain('event: flag_updated');

    // client2 (env-2) should NOT receive it — verified by timeout
    await expect(
      client2.readUntil((t) => t.includes('flag_updated'), 300),
    ).rejects.toThrow('SSE read timeout');

    await Promise.all([client1.cancel(), client2.cancel()]);
  });

  it('delivers events emitted during DB query in order after snapshot', async () => {
    let resolveQuery!: (value: unknown[]) => void;
    vi.mocked(prisma.flag.findMany).mockReturnValue(
      new Promise<unknown[]>((resolve) => {
        resolveQuery = resolve;
      }) as never,
    );

    const app = buildApp();
    const res = await app.request('/v1/flags/stream', {
      headers: { Authorization: `Bearer ${sdkToken('proj-1', 'env-1')}` },
    });

    const { readUntil, cancel } = makeReader(res.body!);

    // Reading retry:1000 confirms the handler has registered its EventEmitter
    // listener and is now suspended on the DB query
    await readUntil((t) => t.includes('retry: 1000'));

    emitFlagEvent({
      projectId: 'proj-1',
      environmentId: null,
      type: 'flag_created',
      payload: { key: 'during-query', enabled: false },
    });

    // Unblock the DB query
    resolveQuery([]);

    const text = await readUntil((t) => t.includes('flag_created'));
    await cancel();

    expect(text.indexOf('event: snapshot')).toBeLessThan(
      text.indexOf('event: flag_created'),
    );
  });

  it('assigns monotonically increasing id: values to SSE frames', async () => {
    vi.mocked(prisma.flag.findMany).mockResolvedValue([] as never);

    const app = buildApp();
    const res = await app.request('/v1/flags/stream', {
      headers: { Authorization: `Bearer ${sdkToken('proj-1', 'env-1')}` },
    });

    const { readUntil, cancel } = makeReader(res.body!);
    await readUntil((t) => t.includes('event: snapshot'));

    emitFlagEvent({
      projectId: 'proj-1',
      environmentId: null,
      type: 'flag_created',
      payload: { key: 'flag-a', enabled: false },
    });
    emitFlagEvent({
      projectId: 'proj-1',
      environmentId: null,
      type: 'flag_archived',
      payload: { key: 'flag-b' },
    });

    const text = await readUntil((t) => (t.match(/^id:/gm) ?? []).length >= 2);
    await cancel();

    const ids = [...text.matchAll(/^id:\s*(\d+)$/gm)].map((m) => Number(m[1]));
    expect(ids.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i]).toBeGreaterThan(ids[i - 1]);
    }
  });

  it('replays only events with id > Last-Event-ID, without sending a snapshot', async () => {
    // Pre-populate ring buffer with 3 events before any client connects
    emitFlagEvent({
      projectId: 'proj-1',
      environmentId: null,
      type: 'flag_created',
      payload: { key: 'flag-a', enabled: false },
    });
    emitFlagEvent({
      projectId: 'proj-1',
      environmentId: null,
      type: 'flag_created',
      payload: { key: 'flag-b', enabled: false },
    });
    emitFlagEvent({
      projectId: 'proj-1',
      environmentId: null,
      type: 'flag_created',
      payload: { key: 'flag-c', enabled: false },
    });

    // Connect with Last-Event-ID = 1 → should replay events 2 and 3 only
    const app = buildApp();
    const res = await app.request('/v1/flags/stream', {
      headers: {
        Authorization: `Bearer ${sdkToken('proj-1', 'env-1')}`,
        'Last-Event-ID': '1',
      },
    });

    const { readUntil, cancel } = makeReader(res.body!);
    // Wait until both replayed events appear
    const text = await readUntil(
      (t) => (t.match(/^event: flag_created/gm) ?? []).length >= 2,
    );
    await cancel();

    // No snapshot sent
    expect(text).not.toContain('event: snapshot');

    // Events flag-b (id=2) and flag-c (id=3) replayed; flag-a (id=1) not replayed
    const keys = [...text.matchAll(/^data:\s*(.+)$/gm)].map((m) => {
      const parsed = JSON.parse(m[1]) as { key: string };
      return parsed.key;
    });
    expect(keys).not.toContain('flag-a');
    expect(keys).toContain('flag-b');
    expect(keys).toContain('flag-c');
  });

  it('falls back to snapshot when Last-Event-ID is absent', async () => {
    vi.mocked(prisma.flag.findMany).mockResolvedValue([] as never);

    const app = buildApp();
    const res = await app.request('/v1/flags/stream', {
      headers: { Authorization: `Bearer ${sdkToken('proj-1', 'env-1')}` },
      // No Last-Event-ID header
    });

    const { readUntil, cancel } = makeReader(res.body!);
    const text = await readUntil((t) => t.includes('event: snapshot'));
    await cancel();

    expect(text).toContain('event: snapshot');
  });

  it('falls back to snapshot when Last-Event-ID is older than the oldest buffered event', async () => {
    vi.mocked(prisma.flag.findMany).mockResolvedValue([] as never);

    // Fill the buffer with events 1-3, then connect with Last-Event-ID=0
    // which would be before event 1, but if we've already cleared/overflowed,
    // we simulate by providing an ID older than what's in the buffer
    emitFlagEvent({
      projectId: 'proj-1',
      environmentId: null,
      type: 'flag_created',
      payload: { key: 'flag-x', enabled: false },
    });
    // Buffer has event id=1. Connect with Last-Event-ID that yields zero
    // replay candidates but is "stale" — here we use a negative/very-old scenario.
    // We simulate stale by using Last-Event-ID=0 but the buffer only starts at 1.
    // The stale check: lastEventId < oldestBufferedId
    // With events [id=1] in buffer and lastEventId=-1, that's stale (but parseInt('-1')=-1).
    // For a cleaner test: emit nothing more and use Last-Event-ID that's clearly before the buffer start.
    // Actually with our current logic: if toReplay.length === 0 we fall through to snapshot.
    // Let's just verify Last-Event-ID=0 with buffer having only id=1 → toReplay is empty → snapshot.

    const app = buildApp();
    const res = await app.request('/v1/flags/stream', {
      headers: {
        Authorization: `Bearer ${sdkToken('proj-1', 'env-1')}`,
        'Last-Event-ID': '0',
      },
    });

    const { readUntil, cancel } = makeReader(res.body!);
    const text = await readUntil((t) => t.includes('event: snapshot'));
    await cancel();

    expect(text).toContain('event: snapshot');
  });
});
