import { unitConfig } from '@repo/vitest-config/unit';
import path from 'node:path';
import { mergeConfig } from 'vitest/config';

export default mergeConfig(unitConfig, {
  test: {
    name: 'repo-bff:unit',
    root: path.resolve(import.meta.dirname, '..'),
  },
});
