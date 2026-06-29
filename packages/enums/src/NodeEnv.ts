import type { ValueOfEnum } from '@repo/types';

export const NodeEnv = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  TEST: 'test',
} as const;

export type NodeEnv = ValueOfEnum<typeof NodeEnv>;
