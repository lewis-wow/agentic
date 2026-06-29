import type { Session, User } from '@repo/prisma';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  extractSessionToken,
  forwardWithJwt,
  resolveSessionUser,
  SESSION_COOKIE,
} from '../../src/index.js';

type SessionWithUser = Session & { user: User };

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  emailVerified: true,
  image: null,
  role: 'MEMBER',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeSession = (
  overrides: Partial<SessionWithUser> = {},
): SessionWithUser => {
  const user = overrides.user ?? makeUser();
  const base: Session = {
    id: 'session-1',
    token: 'tok-abc',
    expiresAt: new Date(Date.now() + 60_000),
    ipAddress: null,
    userAgent: null,
    userId: user.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return { ...base, ...overrides, user };
};

describe('SESSION_COOKIE', () => {
  it('has the expected cookie name', () => {
    expect(SESSION_COOKIE).toBe('better-auth.session_token');
  });
});

describe('extractSessionToken', () => {
  it('returns the token portion before the first dot', () => {
    expect(extractSessionToken('tok-abc.signature')).toBe('tok-abc');
  });

  it('returns the whole string when there is no dot', () => {
    expect(extractSessionToken('tokabc')).toBe('tokabc');
  });

  it('decodes percent-encoding before splitting', () => {
    const encoded = 'tok-abc.sig';
    expect(extractSessionToken(encodeURIComponent(encoded))).toBe('tok-abc');
  });

  it('handles multiple dots by splitting only on the first', () => {
    expect(extractSessionToken('tok.a.b.c')).toBe('tok');
  });
});

describe('resolveSessionUser', () => {
  it('returns null when rawCookie is undefined', async () => {
    const findSession = vi.fn();
    expect(await resolveSessionUser(undefined, findSession)).toBeNull();
    expect(findSession).not.toHaveBeenCalled();
  });

  it('returns the user for a valid, non-expired session', async () => {
    const user = makeUser();
    const session = makeSession({ user });
    const findSession = vi.fn().mockResolvedValue(session);

    const result = await resolveSessionUser('tok-abc.sig', findSession);

    expect(result).toEqual(user);
    expect(findSession).toHaveBeenCalledWith('tok-abc');
  });

  it('strips the signature before calling findSession', async () => {
    const findSession = vi.fn().mockResolvedValue(null);
    await resolveSessionUser('mytoken.signature', findSession);
    expect(findSession).toHaveBeenCalledWith('mytoken');
  });

  it('returns null when the session is not found', async () => {
    const findSession = vi.fn().mockResolvedValue(null);
    expect(await resolveSessionUser('tok.sig', findSession)).toBeNull();
  });

  it('returns null when the session has expired', async () => {
    const session = makeSession({
      expiresAt: new Date(Date.now() - 1_000),
    });
    const findSession = vi.fn().mockResolvedValue(session);
    expect(await resolveSessionUser('tok.sig', findSession)).toBeNull();
  });
});

describe('forwardWithJwt', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rewrites the origin to apiBaseUrl and injects Authorization header', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(new Response('ok', { status: 200 }));

    const request = new Request('http://dashboard/projects/p1/flags', {
      method: 'GET',
    });

    await forwardWithJwt(request, 'my-jwt', 'http://api:3001');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [
      string,
      RequestInit & { headers: Headers },
    ];
    expect(url).toBe('http://api:3001/projects/p1/flags');
    expect((init.headers as Headers).get('Authorization')).toBe(
      'Bearer my-jwt',
    );
  });

  it('preserves the query string', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(new Response('ok', { status: 200 }));

    const request = new Request('http://dashboard/flags?environmentId=env-1', {
      method: 'GET',
    });

    await forwardWithJwt(request, 'jwt', 'http://api:3001');

    const [url] = mockFetch.mock.calls[0] as [string, unknown];
    expect(url).toBe('http://api:3001/flags?environmentId=env-1');
  });

  it('does not send a body for GET requests', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(new Response('ok', { status: 200 }));

    const request = new Request('http://dashboard/flags', { method: 'GET' });
    await forwardWithJwt(request, 'jwt', 'http://api:3001');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBeUndefined();
  });

  it('forwards the body for POST requests', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(new Response('created', { status: 201 }));

    const body = JSON.stringify({ name: 'my-flag' });
    const request = new Request('http://dashboard/flags', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
    });

    await forwardWithJwt(request, 'jwt', 'http://api:3001');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.body).not.toBeUndefined();
  });

  it('returns the upstream response status unchanged', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(new Response(null, { status: 404 }));

    const request = new Request('http://dashboard/flags/missing', {
      method: 'GET',
    });

    const response = await forwardWithJwt(request, 'jwt', 'http://api:3001');
    expect(response.status).toBe(404);
  });
});
