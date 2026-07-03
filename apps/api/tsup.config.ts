import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  splitting: false,
  bundle: true,
  noExternal: [/^@repo\//],
  clean: true,
  dts: false,
});
