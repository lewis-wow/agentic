import { unitConfig } from '@repo/vitest-config/unit';
import { mergeConfig } from 'vitest/config';

export default mergeConfig(unitConfig, {
  test: { name: 'api:unit' },
});
