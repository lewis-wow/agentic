import { describe, expect, it } from 'vitest';

import { HttpException } from '../../src/index.js';

class TestHttpError extends HttpException {
  static readonly status = 404;
  static readonly code = 'TestHttpError';
  static readonly message = 'not found.';
}

describe('HttpException', () => {
  it('toResponse() returns a Response with the correct status and JSON body', async () => {
    const err = new TestHttpError();

    const response = err.toResponse();

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual({ code: 'TestHttpError', message: 'not found.' });
  });

  it('fromResponse() reconstructs an HttpException from a valid error payload', () => {
    const json = { code: 'TestHttpError', message: 'not found.' };

    const result = HttpException.fromResponse({ json, status: 404 });

    expect(result).not.toBeNull();
    expect(result?.code).toBe('TestHttpError');
    expect(result?.message).toBe('not found.');
  });

  it('fromResponse() returns null for a non-matching payload', () => {
    const json = { wrong: 'shape' };

    const result = HttpException.fromResponse({ json, status: 500 });

    expect(result).toBeNull();
  });
});
