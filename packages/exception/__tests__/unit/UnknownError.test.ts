import { describe, expect, it } from 'vitest';

import { HttpException, UnknownError } from '../../src/index.js';

describe('UnknownError', () => {
  it('is an HttpException with a fixed 500 status and code', () => {
    const err = new UnknownError();

    expect(err).toBeInstanceOf(HttpException);
    expect(err.code).toBe('UnknownError');
    expect(err.toResponse().status).toBe(500);
  });

  it('is the right fallback when HttpException.fromResponse returns null', () => {
    const result =
      HttpException.fromResponse({ json: { wrong: 'shape' }, status: 502 }) ??
      new UnknownError();

    expect(result).toBeInstanceOf(UnknownError);
  });
});
