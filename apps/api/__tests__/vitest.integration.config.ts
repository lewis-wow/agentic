import { integrationConfig } from '@repo/vitest-config/integration';
import path from 'node:path';
import { mergeConfig } from 'vitest/config';

export default mergeConfig(integrationConfig, {
  test: {
    name: 'api:integration',
    root: path.resolve(import.meta.dirname, '..'),
  },
});
