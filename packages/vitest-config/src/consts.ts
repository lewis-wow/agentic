export const COVERAGE_EXCLUDE = [
  '**/node_modules/**',
  '**/.pnpm/**',
  '**/dist/**',

  // Tests
  '**/__tests__/**',

  // Barrel files
  '**/index.{ts,tsx}',

  // Config packages
  '**/packages/vitest-config/**',
  '**/packages/eslint-config/**',
  '**/packages/typescript-config/**',
];
