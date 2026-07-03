import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: [
    '@repo/ui',
    '@repo/utils',
    '@repo/prisma',
    '@repo/pagination',
    '@prisma/client',
    'effect',
  ],
  devIndicators: false,
  experimental: {
    // Enables forbidden() / unauthorized() interrupts used by the route guards.
    authInterrupts: true,
  },
  // Needed for `.js`-specifier imports that resolve to sibling `.ts`/`.tsx`
  // source (the NodeNext convention used across apps/api, apps/bff, and the
  // shared packages/* they consume, e.g. `export { prisma } from './client.js'`
  // resolving to `./client.ts`). Webpack doesn't do this by default.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.js', '.ts', '.tsx'],
      '.jsx': ['.jsx', '.tsx'],
    };
    return config;
  },
  // `dev` intentionally does NOT use `--turbopack`: verified empirically that
  // Turbopack does not implement the `.js` -> `.ts` extension aliasing above
  // (no equivalent to webpack's `resolve.extensionAlias` exists in Turbopack's
  // config surface as of Next 15.5.4) and fails with "Module not found" on
  // every such import, e.g. `packages/prisma/src/index.ts`'s `from
  // './client.js'`. `next build` already ran on webpack regardless, so this
  // only affects local dev — slower HMR, but actually resolves modules
  // correctly. Re-verify this if upgrading Next.js; Turbopack's resolver has
  // been actively evolving.
  turbopack: {
    resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'],
  },
};

export default nextConfig;
