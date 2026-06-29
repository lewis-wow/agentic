import { Schema } from 'effect';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const NodeEnv = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  TEST: 'test',
} as const;

const EnvSchema = Schema.Struct({
  NODE_ENV: Schema.optionalWith(
    Schema.Literal(NodeEnv.DEVELOPMENT, NodeEnv.PRODUCTION, NodeEnv.TEST),
    { default: () => NodeEnv.DEVELOPMENT },
  ),
  API_PORT: Schema.optionalWith(Schema.NumberFromString, {
    default: () => 3001,
  }),
  DATABASE_URL: Schema.String,
});

describe('EnvSchema', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('parses required DATABASE_URL', () => {
    const result = Schema.decodeUnknownSync(EnvSchema)({
      DATABASE_URL: 'postgresql://localhost:5432/test',
    });
    expect(result.DATABASE_URL).toBe('postgresql://localhost:5432/test');
  });

  it('defaults API_PORT to 3001', () => {
    const result = Schema.decodeUnknownSync(EnvSchema)({
      DATABASE_URL: 'postgresql://localhost:5432/test',
    });
    expect(result.API_PORT).toBe(3001);
  });

  it('parses API_PORT from string', () => {
    const result = Schema.decodeUnknownSync(EnvSchema)({
      DATABASE_URL: 'postgresql://localhost:5432/test',
      API_PORT: '8080',
    });
    expect(result.API_PORT).toBe(8080);
  });

  it('defaults NODE_ENV to development', () => {
    const result = Schema.decodeUnknownSync(EnvSchema)({
      DATABASE_URL: 'postgresql://localhost:5432/test',
    });
    expect(result.NODE_ENV).toBe('development');
  });

  it('rejects missing DATABASE_URL', () => {
    expect(() => Schema.decodeUnknownSync(EnvSchema)({})).toThrow();
  });
});
