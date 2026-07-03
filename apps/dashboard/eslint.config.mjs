import { config } from '@repo/eslint-config/base';
import { FlatCompat } from '@eslint/eslintrc';
import importPlugin from 'eslint-plugin-import';

const compat = new FlatCompat();

/** @type {import("eslint").Linter.Config[]} */
const eslintConfig = [
  ...config,
  ...compat.extends('next/core-web-vitals'),
  {
    plugins: { import: importPlugin },
    settings: {
      'import/resolver': {
        typescript: { project: './tsconfig.json' },
      },
    },
    rules: {
      // Catches "Module not found" (broken relative imports, deleted files,
      // typo'd .js/.ts specifiers) at lint time instead of at Next.js
      // dev-server/build runtime. Uses the TS resolver so NodeNext-style
      // `./foo.js` -> `foo.ts` and workspace package `exports` fields both
      // resolve the same way tsc and Next.js's bundler already do.
      'import/no-unresolved': 'error',
      // Bundled via webpack/Turbopack — extensionless relative imports are
      // the convention here (unlike apps/api, apps/bff, and the shared
      // packages they run against via plain `node`, which require .js).
      'import/extensions': ['error', 'never'],
    },
  },
  { ignores: ['.next/**', 'next-env.d.ts'] },
];

export default eslintConfig;
