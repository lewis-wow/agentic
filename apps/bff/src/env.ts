import { Schema } from 'effect';

export const NodeEnv = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  TEST: 'test',
} as const;

const EnvSchema = Schema.Struct({
  NODE_ENV: Schema.optionalWith(
    Schema.Literal(NodeEnv.DEVELOPMENT, NodeEnv.PRODUCTION, NodeEnv.TEST),
    { default: () => NodeEnv.DEVELOPMENT },
  ),
  BFF_PORT: Schema.optionalWith(Schema.NumberFromString, { default: () => 3000 }),
});

export const env = Schema.decodeUnknownSync(EnvSchema)(process.env);
