import { config } from '@repo/eslint-config/node';
import importPlugin from 'eslint-plugin-import';

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
  {
    plugins: { import: importPlugin },
    rules: {
      // Bundled via tsup — extensionless relative imports are the convention
      // here (unlike apps/api, apps/bff, and the shared packages they run
      // against via plain `node`, which require explicit .js extensions).
      'import/extensions': ['error', 'never'],
    },
  },
];
