import type { ProjectJwtClaims, SdkJwtClaims } from '@repo/auth';
import { signRs256 } from '@repo/auth/jwt';
import { PROJECT_ROLE, SYSTEM_ROLE } from '@repo/auth/roles';
import { Hono } from 'hono';
import { afterEach, describe, expect, it } from 'vitest';

import {
  type ApiAuthVariables,
  createJwtVerifyMiddleware,
} from '../../src/auth/middleware.js';
import { flagsRouter } from '../../src/routes/flags.js';
import { sdkRouter } from '../../src/routes/sdk.js';
import {
  cleanupProject,
  cleanupUser,
  createTestEnvironment,
  createTestProject,
  createTestUser,
} from '../helpers/fixtures.js';
import { generateTestKeys } from '../helpers/keys.js';

const { privateKey, publicKey } = generateTestKeys();

type AppEnv = { Variables: ApiAuthVariables };

const buildApp = (): Hono<AppEnv> => {
  const app = new Hono<AppEnv>();
  const jwtAuth = createJwtVerifyMiddleware({ publicKeyPem: publicKey });
  app.use('/projects/:projectId/*', jwtAuth);
  app.use('/v1/*', jwtAuth);
  app.route('/projects/:projectId/flags', flagsRouter);
  app.route('/v1', sdkRouter);
  return app;
};

const ownerToken = (projectId: string, userId: string): string =>
  signRs256({
    payload: {
      userId,
      systemRole: SYSTEM_ROLE.OWNER,
      projectId,
      projectRole: PROJECT_ROLE.OWNER,
    } satisfies ProjectJwtClaims,
    privateKeyPem: privateKey,
    expiresInSeconds: 60,
  });

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

const bearer = (token: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
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

describe('SSE reconnect replay (durable, via Postgres)', () => {
  let projectId: string;
  let userId: string;

  afterEach(async () => {
    await cleanupProject(projectId);
    await cleanupUser(userId);
  });

  it('delivers a change made while disconnected via replay, not a snapshot, on reconnect', async () => {
    const project = await createTestProject();
    const environment = await createTestEnvironment(project.id, 'production');
    const user = await createTestUser();
    projectId = project.id;
    userId = user.id;

    const app = buildApp();

    // 1. Connect live, before the flag exists, to observe the create event
    // and capture its id off the real SSE wire — no direct DB peeking.
    const live = await app.request('/v1/flags/stream', {
      headers: bearer(sdkToken(projectId, environment.id)),
    });
    const liveReader = makeReader(live.body!);
    await liveReader.readUntil((t) => t.includes('event: snapshot'));

    const createRes = await app.request(`/projects/${projectId}/flags`, {
      method: 'POST',
      headers: {
        ...bearer(ownerToken(projectId, userId)),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key: 'dark-mode', name: 'Dark Mode' }),
    });
    expect(createRes.status).toBe(201);
    const { flag } = (await createRes.json()) as { flag: { id: string } };

    const createdText = await liveReader.readUntil((t) =>
      t.includes('flag_created'),
    );
    const createdId = [...createdText.matchAll(/^id:\s*(\d+)$/gm)].at(0)?.[1];
    expect(createdId).toBeDefined();

    await liveReader.cancel();

    // 2. While nobody is connected, toggle the flag on for this environment.
    const patchRes = await app.request(
      `/projects/${projectId}/flags/${flag.id}/environments/${environment.id}`,
      {
        method: 'PATCH',
        headers: {
          ...bearer(ownerToken(projectId, userId)),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'active' }),
      },
    );
    expect(patchRes.status).toBe(200);

    // 3. Reconnect with Last-Event-ID from before the toggle.
    const reconnect = await app.request('/v1/flags/stream', {
      headers: {
        ...bearer(sdkToken(projectId, environment.id)),
        'Last-Event-ID': createdId!,
      },
    });
    const reconnectReader = makeReader(reconnect.body!);
    const text = await reconnectReader.readUntil((t) =>
      t.includes('flag_updated'),
    );
    await reconnectReader.cancel();

    expect(text).not.toContain('event: snapshot');
    const dataLine = text
      .split('\n')
      .find((l) => l.startsWith('data:') && l.includes('dark-mode'));
    const payload = JSON.parse(dataLine!.slice('data:'.length).trim()) as {
      key: string;
      enabled: boolean;
    };
    expect(payload).toMatchObject({ key: 'dark-mode', enabled: true });
  });
});
