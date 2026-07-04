import { HttpStatusCode } from '@repo/enums';
import { HttpException, UnknownError } from '@repo/exception';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiFetch } from '../../../src/lib/apiFetch.js';

const jsonResponse = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiFetch', () => {
  it('returns the parsed JSON body on a 200 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ flags: [] }, 200)),
    );

    const result = await apiFetch<{ flags: unknown[] }>({
      path: '/api/projects/p1/flags',
    });

    expect(result).toEqual({ flags: [] });
  });

  it('forwards path and init to the underlying fetch call', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ ok: true }, 200));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch({
      path: '/api/projects/p1/flags',
      init: { method: 'POST', body: '{}' },
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/projects/p1/flags', {
      method: 'POST',
      body: '{}',
    });
  });

  it('throws a reconstructed HttpException for a structured error response', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { code: 'FlagNotFound', message: 'Flag not found.' },
            HttpStatusCode.NOT_FOUND_404,
          ),
        ),
    );

    await expect(apiFetch({ path: '/api/x' })).rejects.toMatchObject({
      code: 'FlagNotFound',
      message: 'Flag not found.',
    });
    await expect(apiFetch({ path: '/api/x' })).rejects.toBeInstanceOf(
      HttpException,
    );
  });

  it('throws UnknownError when the error body is not a structured exception shape', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ garbage: true }, HttpStatusCode.BAD_GATEWAY_502),
        ),
    );

    await expect(apiFetch({ path: '/api/x' })).rejects.toBeInstanceOf(
      UnknownError,
    );
  });

  it('resolves to undefined for a 204 No Content response without parsing JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );

    await expect(apiFetch({ path: '/api/x' })).resolves.toBeUndefined();
  });
});
