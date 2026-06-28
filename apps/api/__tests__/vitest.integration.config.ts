import { integrationConfig } from '@repo/vitest-config/integration';
import { mergeConfig } from 'vitest/config';

export default mergeConfig(integrationConfig, {
  test: { name: 'api:integration' },
});
