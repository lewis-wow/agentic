import { describe, expect, it } from 'vitest';

import {
  buildPageMeta,
  buildPrismaPage,
  parsePaginationParams,
} from '../../src/server.js';

describe('parsePaginationParams', () => {
  it('uses defaults when no params provided', () => {
    expect(parsePaginationParams({}, { limit: 25 })).toEqual({
      page: 1,
      limit: 25,
    });
  });

  it('uses limit default of 10 when no defaults provided', () => {
    expect(parsePaginationParams({})).toEqual({ page: 1, limit: 10 });
  });

  it('parses page and limit from string query params', () => {
    expect(parsePaginationParams({ page: '3', limit: '50' })).toEqual({
      page: 3,
      limit: 50,
    });
  });

  it('clamps limit to 100 when above max', () => {
    expect(parsePaginationParams({ limit: '200' }, { limit: 25 })).toEqual({
      page: 1,
      limit: 100,
    });
  });

  it('clamps limit to 1 when below min', () => {
    expect(parsePaginationParams({ limit: '0' }, { limit: 25 })).toEqual({
      page: 1,
      limit: 1,
    });
  });

  it('clamps page to 1 when below min', () => {
    expect(parsePaginationParams({ page: '0' }, { limit: 25 })).toEqual({
      page: 1,
      limit: 25,
    });
  });

  it('clamps page to 1 for negative values', () => {
    expect(parsePaginationParams({ page: '-5' }, { limit: 25 })).toEqual({
      page: 1,
      limit: 25,
    });
  });
});

describe('buildPrismaPage', () => {
  it('returns skip=0 and take=limit for page 1', () => {
    expect(buildPrismaPage(1, 25)).toEqual({ skip: 0, take: 25 });
  });

  it('returns correct skip for page 2', () => {
    expect(buildPrismaPage(2, 25)).toEqual({ skip: 25, take: 25 });
  });

  it('returns correct skip for page 3 with limit 10', () => {
    expect(buildPrismaPage(3, 10)).toEqual({ skip: 20, take: 10 });
  });
});

describe('buildPageMeta', () => {
  it('returns total/page/limit and computed totalPages', () => {
    expect(buildPageMeta(100, 1, 25)).toEqual({
      total: 100,
      page: 1,
      limit: 25,
      totalPages: 4,
    });
  });

  it('rounds up totalPages when not evenly divisible', () => {
    expect(buildPageMeta(26, 1, 25)).toEqual({
      total: 26,
      page: 1,
      limit: 25,
      totalPages: 2,
    });
  });

  it('returns totalPages 0 when total is 0', () => {
    expect(buildPageMeta(0, 1, 25)).toEqual({
      total: 0,
      page: 1,
      limit: 25,
      totalPages: 0,
    });
  });
});
