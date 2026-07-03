import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { forwardRequest, forwardWithJwt } from '../../src/index.js';

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

describe('forwardRequest', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rewrites the origin to apiBaseUrl without injecting Authorization', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(new Response('ok', { status: 200 }));

    const request = new Request('http://dashboard/projects/p1/flags', {
      method: 'GET',
      headers: { 'X-Forwarded-Email': 'user@example.com' },
    });

    await forwardRequest(request, 'http://bff:3000');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [
      string,
      RequestInit & { headers: Headers },
    ];
    expect(url).toBe('http://bff:3000/projects/p1/flags');
    expect((init.headers as Headers).get('Authorization')).toBeNull();
    expect((init.headers as Headers).get('X-Forwarded-Email')).toBe(
      'user@example.com',
    );
  });

  it('preserves method and body for non-GET requests', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(new Response('created', { status: 201 }));

    const body = JSON.stringify({ name: 'my-flag' });
    const request = new Request('http://dashboard/flags', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
    });

    await forwardRequest(request, 'http://bff:3000');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).not.toBeUndefined();
  });
});
