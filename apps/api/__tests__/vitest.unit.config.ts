import { unitConfig } from '@repo/vitest-config/unit';
import path from 'node:path';
import { mergeConfig } from 'vitest/config';

export default mergeConfig(unitConfig, {
  test: {
    name: 'api:unit',
    root: path.resolve(import.meta.dirname, '..'),
    setupFiles: ['./__tests__/setup.ts'],
  },
});
