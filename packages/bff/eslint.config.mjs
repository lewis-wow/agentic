import { config } from '@repo/eslint-config/node';
import importPlugin from 'eslint-plugin-import';

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
  {
    plugins: { import: importPlugin },
    settings: {
      'import/resolver': { typescript: true },
    },
    rules: {
      // Catches "Module not found" (broken relative imports, deleted files,
      // typo'd .js/.ts specifiers) at lint time instead of at bundler runtime.
      'import/no-unresolved': 'error',
    },
  },
];
