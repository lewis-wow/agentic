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
  API_PORT: Schema.optionalWith(Schema.NumberFromString, {
    default: () => 3001,
  }),
  DATABASE_URL: Schema.String,
});

export const env = Schema.decodeUnknownSync(EnvSchema)(process.env);
